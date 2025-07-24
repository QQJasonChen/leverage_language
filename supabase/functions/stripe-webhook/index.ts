// Supabase Edge Function to handle Stripe webhooks
// Deploy this to handle subscription events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the webhook signature
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    
    if (!signature) {
      throw new Error('No Stripe signature found')
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured')
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(`Webhook Error: ${err.message}`, { 
        status: 400,
        headers: corsHeaders
      })
    }

    console.log('Processing webhook event:', event.type)

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(supabase, event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(supabase, event.data.object as Stripe.Subscription)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(supabase, event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response('Webhook processed successfully', {
      headers: corsHeaders,
      status: 200,
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(`Webhook Error: ${error.message}`, {
      status: 400,
      headers: corsHeaders,
    })
  }
})

async function handleSubscriptionChange(supabase: any, subscription: Stripe.Subscription) {
  console.log('Handling subscription change:', subscription.id)
  
  // Get the price to determine the tier
  const priceId = subscription.items.data[0]?.price.id
  let tier = 'free'
  
  // Map Stripe price IDs to subscription tiers
  const priceToTierMap: Record<string, string> = {
    'price_pro_monthly': 'pro',
    'price_pro_yearly': 'pro',
    'price_enterprise_monthly': 'enterprise',
    'price_enterprise_yearly': 'enterprise',
  }
  
  tier = priceToTierMap[priceId] || 'free'
  
  // Update user profile
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)

  if (error) {
    console.error('Error updating user subscription:', error)
    throw error
  }

  // Log the subscription event
  await logSubscriptionEvent(supabase, subscription.customer as string, {
    event_type: subscription.status === 'active' ? 'activated' : 'updated',
    to_tier: tier,
    stripe_event_id: subscription.id,
    metadata: {
      status: subscription.status,
      period_end: subscription.current_period_end
    }
  })

  console.log('Subscription updated successfully')
}

async function handleSubscriptionCancellation(supabase: any, subscription: Stripe.Subscription) {
  console.log('Handling subscription cancellation:', subscription.id)
  
  // Update user profile
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating cancelled subscription:', error)
    throw error
  }

  // Log the cancellation event
  await logSubscriptionEvent(supabase, subscription.customer as string, {
    event_type: 'cancelled',
    from_tier: 'pro', // We'd need to look this up for accuracy
    to_tier: 'free',
    stripe_event_id: subscription.id,
    metadata: {
      cancelled_at: subscription.canceled_at,
      period_end: subscription.current_period_end
    }
  })

  console.log('Subscription cancelled successfully')
}

async function handlePaymentSuccess(supabase: any, invoice: Stripe.Invoice) {
  console.log('Handling payment success:', invoice.id)
  
  // If this is a subscription invoice, ensure the subscription is active
  if (invoice.subscription) {
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)

    if (error) {
      console.error('Error updating payment success:', error)
    }
  }
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  console.log('Handling payment failure:', invoice.id)
  
  // If this is a subscription invoice, mark as past_due
  if (invoice.subscription) {
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)

    if (error) {
      console.error('Error updating payment failure:', error)
    }
  }
}

async function logSubscriptionEvent(supabase: any, customerId: string, eventData: any) {
  // Find user by customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await supabase
      .from('subscription_events')
      .insert({
        user_id: profile.id,
        ...eventData
      })
  }
}