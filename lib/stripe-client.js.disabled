// Stripe Client for LeverageLanguage
// Handles subscription payments and checkout

class StripeClient {
  constructor() {
    this.stripe = null;
    this.publishableKey = 'YOUR_STRIPE_PUBLISHABLE_KEY'; // From .env
    this.isInitialized = false;
    
    this.plans = {
      pro_monthly: {
        name: 'Pro Monthly',
        price: 9.99,
        priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
        interval: 'month'
      },
      pro_yearly: {
        name: 'Pro Yearly',
        price: 99.99,
        priceId: 'price_pro_yearly',
        interval: 'year',
        discount: '17% off'
      },
      enterprise_monthly: {
        name: 'Enterprise Monthly', 
        price: 29.99,
        priceId: 'price_enterprise_monthly',
        interval: 'month'
      },
      enterprise_yearly: {
        name: 'Enterprise Yearly',
        price: 299.99,
        priceId: 'price_enterprise_yearly',
        interval: 'year',
        discount: '17% off'
      }
    };
    
    this.init();
  }

  async init() {
    try {
      // Load Stripe.js
      if (!window.Stripe) {
        await this.loadStripeJS();
      }
      
      this.stripe = window.Stripe(this.publishableKey);
      this.isInitialized = true;
      
      console.log('💳 Stripe client initialized');
    } catch (error) {
      console.error('❌ Stripe initialization failed:', error);
    }
  }

  async loadStripeJS() {
    return new Promise((resolve, reject) => {
      if (window.Stripe) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Create checkout session for subscription
  async createCheckoutSession(planId, customerId = null) {
    if (!this.isInitialized) {
      throw new Error('Stripe not initialized');
    }

    const plan = this.plans[planId];
    if (!plan) {
      throw new Error('Invalid plan ID');
    }

    try {
      // Call your backend to create Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          customerId,
          successUrl: `${window.location.origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/subscription-cancelled`
        })
      });

      const session = await response.json();

      if (!response.ok) {
        throw new Error(session.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const { error } = await this.stripe.redirectToCheckout({
        sessionId: session.id
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Checkout session error:', error);
      return { success: false, error: error.message };
    }
  }

  // Create customer portal session for managing subscription
  async createPortalSession(customerId) {
    if (!customerId) {
      throw new Error('Customer ID required');
    }

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          returnUrl: window.location.origin
        })
      });

      const session = await response.json();

      if (!response.ok) {
        throw new Error(session.error || 'Failed to create portal session');
      }

      // Redirect to Stripe Customer Portal
      window.location.href = session.url;
      return { success: true };
    } catch (error) {
      console.error('Portal session error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get plan information
  getPlan(planId) {
    return this.plans[planId];
  }

  getAllPlans() {
    return this.plans;
  }

  // Format price for display
  formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  // Handle successful subscription
  async handleSubscriptionSuccess(sessionId) {
    try {
      const response = await fetch(`/api/stripe/session/${sessionId}`);
      const session = await response.json();

      if (!response.ok) {
        throw new Error(session.error || 'Failed to retrieve session');
      }

      return {
        success: true,
        customerId: session.customer,
        subscriptionId: session.subscription
      };
    } catch (error) {
      console.error('Subscription success handling error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
window.stripeClient = new StripeClient();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StripeClient;
}