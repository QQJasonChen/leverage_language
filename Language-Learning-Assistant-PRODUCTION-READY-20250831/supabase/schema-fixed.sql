-- Fixed Database Schema for Subscription System
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security and necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enhanced users table with security features
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'trialing')),
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  subscription_expires TIMESTAMP WITH TIME ZONE,
  api_usage INTEGER DEFAULT 0,
  api_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Security fields
  last_login TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMP WITH TIME ZONE,
  password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_changed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  user_agent TEXT,
  last_ip_address INET,
  signup_ip_address INET,
  referral_source TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription events log for auditing
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('activated', 'updated', 'cancelled', 'expired', 'payment_failed', 'payment_succeeded')),
  from_tier TEXT,
  to_tier TEXT,
  stripe_event_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events log
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking for rate limiting
CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, endpoint, date)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for email verification tokens
CREATE POLICY "Users can view own tokens" ON email_verification_tokens
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = email_verification_tokens.user_id AND users.id = auth.uid()
  ));

-- RLS Policies for subscription events (read-only for users)
CREATE POLICY "Users can view own subscription events" ON subscription_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = subscription_events.user_id AND users.id = auth.uid()
  ));

-- RLS Policies for security events (admin only, users can't see)
CREATE POLICY "Admin only access to security events" ON security_events
  FOR ALL USING (false);

-- RLS Policies for API usage log
CREATE POLICY "Users can view own usage" ON api_usage_log
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = api_usage_log.user_id AND users.id = auth.uid()
  ));

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_api_reset_date ON users(api_reset_date);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_log(date);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, signup_ip_address)
  VALUES (
    new.id, 
    new.email,
    CASE 
      WHEN new.raw_user_meta_data->>'ip_address' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'ip_address')::inet
      ELSE NULL 
    END
  );
  
  -- Log the registration event
  INSERT INTO public.security_events (user_id, event_type, details)
  VALUES (
    new.id,
    'user_registered',
    jsonb_build_object(
      'email', new.email,
      'provider', COALESCE(new.app_metadata->>'provider', 'email'),
      'confirmed', new.email_confirmed_at IS NOT NULL
    )
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Function to update user last login
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users 
  SET 
    last_login = NOW(),
    login_count = login_count + 1,
    failed_login_attempts = 0  -- Reset failed attempts on successful login
  WHERE id = new.id;
  
  -- Log successful login
  INSERT INTO public.security_events (user_id, event_type, details, severity)
  VALUES (
    new.id,
    'login_success',
    jsonb_build_object('provider', COALESCE(new.app_metadata->>'provider', 'email')),
    'low'
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for tracking logins
DROP TRIGGER IF EXISTS on_auth_login ON auth.users;
CREATE TRIGGER on_auth_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE PROCEDURE update_user_last_login();

-- Function to clean up expired verification tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_tokens 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily API usage
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET 
    api_usage = 0,
    api_reset_date = NOW()
  WHERE 
    DATE(api_reset_date) < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to safely increment API usage with rate limiting
CREATE OR REPLACE FUNCTION increment_api_usage(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  daily_limit INTEGER := 50;  -- Default free tier limit
  result JSON;
BEGIN
  -- Get user with row lock to prevent race conditions
  SELECT * INTO user_record 
  FROM users 
  WHERE id = user_uuid
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Check if user has pro subscription
  IF user_record.subscription_status = 'active' THEN
    daily_limit := -1;  -- Unlimited for pro users
  END IF;
  
  -- Reset usage if it's a new day
  IF DATE(user_record.api_reset_date) < CURRENT_DATE THEN
    UPDATE users 
    SET api_usage = 0, api_reset_date = NOW()
    WHERE id = user_uuid;
    user_record.api_usage := 0;
  END IF;
  
  -- Check if user has exceeded limit
  IF daily_limit > 0 AND user_record.api_usage >= daily_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'usage', user_record.api_usage,
      'limit', daily_limit,
      'message', 'Daily limit exceeded. Upgrade to Pro for unlimited access!'
    );
  END IF;
  
  -- Increment usage
  UPDATE users 
  SET api_usage = api_usage + 1
  WHERE id = user_uuid;
  
  RETURN json_build_object(
    'allowed', true,
    'usage', user_record.api_usage + 1,
    'limit', daily_limit,
    'is_pro', user_record.subscription_status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT ON email_verification_tokens TO authenticated;
GRANT SELECT ON subscription_events TO authenticated;
GRANT SELECT ON api_usage_log TO authenticated;

-- Create a view for user dashboard data (NO RLS POLICY - Views don't support it)
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
  u.id,
  u.email,
  u.email_verified,
  u.subscription_status,
  u.subscription_tier,
  u.subscription_expires,
  u.api_usage,
  u.api_reset_date,
  u.created_at,
  u.last_login,
  u.login_count,
  -- Calculate days until expiry
  CASE 
    WHEN u.subscription_expires IS NOT NULL 
    THEN EXTRACT(days FROM u.subscription_expires - NOW())::INTEGER
    ELSE NULL 
  END as days_until_expiry,
  -- Calculate usage percentage
  CASE 
    WHEN u.subscription_status = 'active' THEN NULL
    ELSE (u.api_usage * 100.0 / 50)::INTEGER
  END as usage_percentage
FROM users u
WHERE auth.uid() = u.id;  -- Security built into the view itself

-- Grant access to the view
GRANT SELECT ON user_dashboard TO authenticated;