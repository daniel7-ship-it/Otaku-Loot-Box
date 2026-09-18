(() => {
  let busy = false;
  let attempt;
  const get = id => document.getElementById(id);
  const message = text => { get('checkoutMessage').textContent = text; };

  function apiBase() {
    const configured = window.OTAKU_CHECKOUT_API;
    if (!configured) throw new Error('Test checkout is not connected yet. Your cart is saved; the store owner needs to connect the backend.');
    const url = new URL(configured);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('The checkout backend URL is not configured correctly.');
    }
    return url.origin;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase()}${path}`, { ...options, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Test checkout is unavailable. Please retry.');
    if (data.mode !== 'test') throw new Error('Checkout did not confirm test mode.');
    return data;
  }

  function requestId(items) {
    const fingerprint = JSON.stringify(items);
    if (!attempt) {
      try { attempt = JSON.parse(sessionStorage.getItem('otaku-checkout-attempt')); } catch {}
    }
    // Preserve the request ID after network errors; expire before Stripe's 24h retention.
    if (!attempt || attempt.fingerprint !== fingerprint || Date.now() - attempt.created > 23 * 60 * 60 * 1000) {
      attempt = { fingerprint, id: crypto.randomUUID(), created: Date.now() };
      try { sessionStorage.setItem('otaku-checkout-attempt', JSON.stringify(attempt)); } catch {}
    }
    return attempt.id;
  }

  function forgetAttempt() {
    attempt = null;
    try { sessionStorage.removeItem('otaku-checkout-attempt'); } catch {}
  }

  window.otakuCheckout = {
    get busy() { return busy; },
    reset() { busy = false; get('checkout').textContent = 'Test checkout →'; },
    async begin(cart) {
      if (busy || !cart.length) return;
      busy = true;
      const button = get('checkout');
      button.disabled = true;
      button.textContent = 'Opening test checkout…';
      message('Opening Stripe sandbox. No real payment or shipment.');
      try {
        const items = cart.map(({ id, qty }) => ({ id, qty })).sort((a, b) => a.id - b.id);
        const data = await request('/api/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, requestId: requestId(items) }),
        });
        const target = new URL(data.url);
        if (target.origin !== 'https://checkout.stripe.com' || target.username || target.password) throw new Error('Unexpected checkout destination.');
        window.location.assign(target.href);
      } catch (error) {
        message(error.name === 'TypeError' || error.name === 'TimeoutError'
          ? 'Could not reach test checkout. Your cart is saved. Please try again.' : error.message);
        busy = false;
        button.disabled = cart.length === 0;
        button.textContent = 'Test checkout →';
      }
    },
    async checkReturn(openCart) {
      const params = new URLSearchParams(location.search);
      const result = params.get('checkout');
      if (!['success', 'cancelled'].includes(result)) return;
      openCart();
      forgetAttempt();
      if (result === 'cancelled') {
        message('Test checkout cancelled. Your cart is saved; no supplier order was placed.');
        return;
      }
      message('Checking your sandbox payment with Stripe…');
      try {
        const data = await request(`/api/checkout/status?session_id=${encodeURIComponent(params.get('session_id') || '')}`);
        message(data.status === 'complete' && data.paymentStatus === 'paid'
          ? 'Test payment confirmed by Stripe. No real money was charged and no items will ship. Your cart is retained for testing.'
          : 'Test payment is not confirmed yet. Your cart is saved; no supplier order has been placed.');
      } catch {
        message('Could not verify the test payment. Refresh to retry. Your cart is saved; no supplier order has been placed.');
      }
    },
  };
})();
