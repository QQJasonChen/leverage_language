-- LeverageLanguage Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Reports table
CREATE TABLE public.ai_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_text TEXT NOT NULL,
  language TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  audio_data JSONB,
  tags TEXT[] DEFAULT '{}',
  has_errors BOOLEAN DEFAULT false,
  error_types TEXT[] DEFAULT '{}',
  error_count INTEGER DEFAULT 0,
  is_correct BOOLEAN DEFAULT true,
  favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for performance
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_search_text (user_id, search_text),
  INDEX idx_language (user_id, language)
);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM
  ai_analyses_used INTEGER DEFAULT 0,
  exports_used INTEGER DEFAULT 0,
  audio_generations_used INTEGER DEFAULT 0,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for one record per user per month
  UNIQUE(user_id, month)
);

-- Learning analytics table
CREATE TABLE public.learning_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_words INTEGER DEFAULT 0,
  correct_words INTEGER DEFAULT 0,
  error_words INTEGER DEFAULT 0,
  languages_practiced TEXT[] DEFAULT '{}',
  session_count INTEGER DEFAULT 0,
  total_session_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for one record per user per day
  UNIQUE(user_id, date)
);

-- Flashcards table
CREATE TABLE public.flashcards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.ai_reports(id) ON DELETE CASCADE,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  audio_url TEXT,
  difficulty INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  ease_factor NUMERIC DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  next_review_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription events table (for history)
CREATE TABLE public.subscription_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL, -- 'upgraded', 'downgraded', 'cancelled', 'renewed'
  from_tier TEXT,
  to_tier TEXT,
  stripe_event_id TEXT UNIQUE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: Users can only see/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- AI Reports: Users can only see/manage their own reports
CREATE POLICY "Users can view own reports" ON public.ai_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reports" ON public.ai_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" ON public.ai_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports" ON public.ai_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Usage Tracking: Users can only see their own usage
CREATE POLICY "Users can view own usage" ON public.usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON public.usage_tracking
  FOR ALL USING (auth.uid() = user_id);

-- Learning Analytics: Users can only see their own analytics
CREATE POLICY "Users can view own analytics" ON public.learning_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own analytics" ON public.learning_analytics
  FOR ALL USING (auth.uid() = user_id);

-- Flashcards: Users can only see/manage their own flashcards
CREATE POLICY "Users can manage own flashcards" ON public.flashcards
  FOR ALL USING (auth.uid() = user_id);

-- Subscription Events: Users can only see their own events
CREATE POLICY "Users can view own subscription events" ON public.subscription_events
  FOR SELECT USING (auth.uid() = user_id);

-- Functions and Triggers
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_reports_updated_at BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Initialize usage tracking for current month
  INSERT INTO public.usage_tracking (user_id, month)
  VALUES (
    NEW.id,
    TO_CHAR(NOW(), 'YYYY-MM')
  )
  ON CONFLICT (user_id, month) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check usage limits
CREATE OR REPLACE FUNCTION public.check_usage_limit(
  p_user_id UUID,
  p_action TEXT
) RETURNS JSONB AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_usage public.usage_tracking%ROWTYPE;
  v_current_month TEXT;
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Get user profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  
  -- Get or create usage record
  INSERT INTO public.usage_tracking (user_id, month)
  VALUES (p_user_id, v_current_month)
  ON CONFLICT (user_id, month) DO NOTHING;
  
  SELECT * INTO v_usage FROM public.usage_tracking 
  WHERE user_id = p_user_id AND month = v_current_month;
  
  -- Check limits based on tier and action
  CASE p_action
    WHEN 'ai_analysis' THEN
      v_used := v_usage.ai_analyses_used;
      v_limit := CASE v_profile.subscription_tier
        WHEN 'free' THEN 50
        ELSE -1 -- Unlimited for pro/enterprise
      END;
    WHEN 'export' THEN
      v_used := v_usage.exports_used;
      v_limit := CASE v_profile.subscription_tier
        WHEN 'free' THEN 10
        ELSE -1
      END;
    ELSE
      RETURN jsonb_build_object('allowed', true);
  END CASE;
  
  -- Return result
  IF v_limit = -1 OR v_used < v_limit THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'used', v_used,
      'limit', v_limit,
      'remaining', CASE WHEN v_limit = -1 THEN NULL ELSE v_limit - v_used END
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'limit', v_limit,
      'remaining', 0,
      'reason', 'Monthly limit reached',
      'upgrade_required', true
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_action TEXT,
  p_count INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Ensure usage record exists
  INSERT INTO public.usage_tracking (user_id, month)
  VALUES (p_user_id, v_current_month)
  ON CONFLICT (user_id, month) DO NOTHING;
  
  -- Update the appropriate counter
  CASE p_action
    WHEN 'ai_analysis' THEN
      UPDATE public.usage_tracking 
      SET ai_analyses_used = ai_analyses_used + p_count
      WHERE user_id = p_user_id AND month = v_current_month;
    WHEN 'export' THEN
      UPDATE public.usage_tracking 
      SET exports_used = exports_used + p_count
      WHERE user_id = p_user_id AND month = v_current_month;
    WHEN 'audio_generation' THEN
      UPDATE public.usage_tracking 
      SET audio_generations_used = audio_generations_used + p_count
      WHERE user_id = p_user_id AND month = v_current_month;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;