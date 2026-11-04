/**
 * Paddle checkout.
 *
 * Paddle is the merchant of record: it takes the card, handles sales tax/VAT,
 * and pays out to the operator. We only open its hosted overlay and pass the
 * buyer's Firebase uid through as custom data so the webhook can grant access.
 *
 * The client must never grant access itself — `checkout.completed` is a UI
 * hint, not proof. Access is written server-side to `entitlements/{uid}` after
 * Paddle signs a `transaction.completed` webhook.
 *
 * Configuration (all optional; checkout stays dark until they are set):
 *   VITE_PADDLE_ENV              'sandbox' | 'production'
 *   VITE_PADDLE_CLIENT_TOKEN     client-side token from Paddle > Developer tools
 *   VITE_PADDLE_PRICE_PASS       price id for the $19 Exam Pass
 *   VITE_PADDLE_PRICE_EXTENSION  price id for the $9 Extension
 *   VITE_PADDLE_PRICE_LIFETIME   price id for the $49 Lifetime
 */

const PADDLE_SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';

const config = {
  env: import.meta.env.VITE_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
  token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '',
  prices: {
    pass: import.meta.env.VITE_PADDLE_PRICE_PASS || '',
    extension: import.meta.env.VITE_PADDLE_PRICE_EXTENSION || '',
    lifetime: import.meta.env.VITE_PADDLE_PRICE_LIFETIME || '',
  },
};

let paddlePromise = null;
let initialized = false;

/** True when at least the main product can be sold. */
export function isCheckoutConfigured() {
  return Boolean(config.token && config.prices.pass);
}

/**
 * Per-plan availability: a token plus that plan's price id. Lets us ship a
 * single product first without the other buttons lying.
 * @param {string} plan
 */
export function isPlanPurchasable(plan) {
  return Boolean(config.token && config.prices[plan]);
}

/** Load Paddle.js once, on demand (no third-party script until someone buys). */
function loadPaddle() {
  if (paddlePromise) return paddlePromise;

  paddlePromise = new Promise((resolve, reject) => {
    if (window.Paddle) {
      resolve(window.Paddle);
      return;
    }
    const script = document.createElement('script');
    script.src = PADDLE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Paddle) resolve(window.Paddle);
      else reject(new Error('Paddle.js loaded but did not register.'));
    };
    script.onerror = () => reject(new Error('Could not load Paddle.js.'));
    document.head.appendChild(script);
  }).catch((err) => {
    // Allow a later retry (offline, ad blocker) instead of caching the failure.
    paddlePromise = null;
    throw err;
  });

  return paddlePromise;
}

async function getPaddle() {
  const Paddle = await loadPaddle();
  if (!initialized) {
    Paddle.Environment.set(config.env);
    Paddle.Initialize({
      token: config.token,
      eventCallback: (event) => {
        // Fires for checkout.* events inside the overlay. Nothing is granted
        // here; the webhook is the source of truth.
        window.dispatchEvent(
          new CustomEvent('examello:checkout', { detail: event })
        );
      },
    });
    initialized = true;
  }
  return Paddle;
}

/**
 * Open the Paddle overlay for a plan.
 *
 * @param {Object} options
 * @param {'pass'|'extension'|'lifetime'} options.plan
 * @param {string} options.uid       Firebase uid, passed as custom data
 * @param {string} [options.email]   pre-fills the buyer's email
 * @param {string} [options.successUrl]
 * @returns {Promise<void>}
 */
export async function startCheckout({ plan, uid, email, successUrl }) {
  if (!isPlanPurchasable(plan)) {
    throw new Error('Checkout is not available for this plan yet.');
  }
  if (!uid) {
    throw new Error('Sign in before buying so we can attach the purchase to your account.');
  }

  const Paddle = await getPaddle();
  Paddle.Checkout.open({
    items: [{ priceId: config.prices[plan], quantity: 1 }],
    ...(email ? { customer: { email } } : {}),
    // The webhook reads this back off the transaction.
    customData: { uid, plan },
    settings: successUrl ? { successUrl } : {},
  });
}
