(() => {
  let busy = false;
  let attempt;
  let prepared;
  let embedded;
  let revision = 0;
  let expiryTimer;
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
    const response = await fetch(`${apiBase()}${path}`, { ...options, signal: AbortSignal.timeout(60000) });
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

  function invalidate() {
    revision++;
    clearTimeout(expiryTimer);
    embedded?.destroy();
    embedded = null;
    prepared = null;
    busy = false;
    get('orderReview').hidden = true;
    get('paymentPanel').hidden = true;
    get('reviewSubmit').disabled = false;
    get('reviewSubmit').textContent = 'Calculate shipping & tax →';
  }

  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  async function confirmPayment(sessionId) {
    try {
      const data = await request(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`);
      message(data.status === 'complete' && data.paymentStatus === 'paid'
        ? 'Test payment confirmed by Stripe. No real money was charged and no items will ship.'
        : 'Payment is not confirmed yet. Please check again shortly.');
      if (data.status === 'complete') { invalidate(); forgetAttempt(); }
    } catch { message('Could not verify payment yet. Please retry the status check.'); }
  }

  window.otakuCheckout = {
    get busy() { return busy; },
    reset() { busy = false; get('checkout').textContent = 'Test checkout →'; },
    showReview(cart, onSubmit) {
      if (!cart.length || busy) return;
      invalidate();
      get('checkoutReview').hidden = false;
      get('cartItems').hidden = true;
      get('checkout').hidden = true;
      get('checkoutReview').oninput = () => { invalidate(); message('Calculate shipping and tax after entering your delivery details.'); };
      get('checkoutReview').onsubmit = event => {
        event.preventDefault();
        if (get('checkoutReview').reportValidity()) onSubmit(new FormData(get('checkoutReview')));
      };
    },
    hideReview() {
      invalidate();
      get('checkoutReview').hidden = true;
      get('cartItems').hidden = false;
      get('checkout').hidden = false;
    },
    async begin(cart, formData) {
      if (busy || !cart.length) return;
      busy = true;
      const token = ++revision;
      const button = get('reviewSubmit');
      button.disabled = true;
      button.textContent = 'Calculating…';
      message('Checking shipping and tax for your delivery address…');
      try {
        const items = cart.map(({ id, qty }) => ({ id, qty })).sort((a, b) => a.id - b.id);
        const data = await request('/api/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, requestId: requestId(items), customer: Object.fromEntries(formData || []) }),
        });
        if (token !== revision) return;
        const totals = data.totals;
        if (!totals || totals.currency !== 'usd' || !['subtotal', 'shipping', 'tax', 'total'].every(key => Number.isSafeInteger(totals[key]) && totals[key] >= 0) ||
            totals.total !== totals.subtotal + totals.shipping + totals.tax || !data.clientSecret || !/^pk_test_/.test(data.publishableKey) || data.expiresAt * 1000 <= Date.now()) {
          throw new Error('A verified checkout total is not available. Please try again later.');
        }
        prepared = data;
        for (const key of ['subtotal', 'shipping', 'tax', 'total']) get(`final-${key}`).textContent = money(totals[key]);
        get('deliverySummary').textContent = [...formData.values()].join(' · ');
        get('checkoutReview').hidden = true;
        get('orderReview').hidden = false;
        get('payOnSite').hidden = false;
        get('payOnSite').disabled = false;
        get('payOnSite').textContent = `Continue to payment · ${money(totals.total)}`;
        get('payOnSite').onclick = () => window.otakuCheckout.mountPayment();
        get('editDelivery').onclick = () => { invalidate(); get('checkoutReview').hidden = false; message('Update your address and calculate a new total.'); };
        expiryTimer = setTimeout(() => { invalidate(); get('checkoutReview').hidden = false; message('This total expired. Calculate it again before paying.'); }, data.expiresAt * 1000 - Date.now());
        busy = false;
        message('Review your total, then pay securely here. Sandbox only; no real charge or shipment.');
      } catch (error) {
        if (token !== revision) return;
        message(error.name === 'TypeError' || error.name === 'TimeoutError'
          ? 'Could not reach test checkout. Your cart is saved. Please try again.' : error.message);
        busy = false;
        button.disabled = cart.length === 0;
        button.textContent = 'Calculate shipping & tax →';
      }
    },
    async mountPayment() {
      if (busy || !prepared) return;
      const data = prepared;
      if (Date.now() >= data.expiresAt * 1000) { invalidate(); get('checkoutReview').hidden = false; message('Calculate a new total before paying.'); return; }
      busy = true;
      const token = revision;
      get('payOnSite').disabled = true;
      try {
        if (typeof window.Stripe !== 'function') throw new Error('Secure payment could not load. Check your connection and retry.');
        embedded?.destroy();
        const checkout = await window.Stripe(data.publishableKey).createEmbeddedCheckoutPage({
          fetchClientSecret: async () => data.clientSecret,
          onComplete: () => confirmPayment(data.sessionId),
        });
        if (token !== revision) { checkout.destroy(); return; }
        embedded = checkout;
        get('paymentPanel').hidden = false;
        checkout.mount('#embeddedCheckout');
        get('payOnSite').hidden = true;
        get('verifyPayment').onclick = () => confirmPayment(data.sessionId);
        message('Enter payment details below. Your delivery address and total are shown above.');
      } catch (error) {
        if (token !== revision) return;
        message(error.message || 'Secure payment could not load. Please retry.');
        get('payOnSite').disabled = false;
      } finally { if (token === revision) busy = false; }
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
