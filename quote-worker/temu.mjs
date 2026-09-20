export const TEMU_PRODUCTS = Object.freeze({
  18: 'https://www.temu.com/-power-casual-outfit-1-sitting--plush-7-h-g-603070406709704.html',
});

export function validateRequest(input) {
  if (!input || !Object.hasOwn(TEMU_PRODUCTS, input.productId) || input.quantity !== 1 ||
      input.country !== 'US' || typeof input.postalCode !== 'string' || !/^\d{5}$/.test(input.postalCode)) {
    throw new Error('Only the supported Temu product, quantity 1, country US and a five-digit ZIP are supported.');
  }
  return { productId: Number(input.productId), quantity: 1, country: 'US', postalCode: input.postalCode };
}

export function parseQuote(input, observed, now = Date.now()) {
  const request = validateRequest(input);
  if (observed.destination !== `Deliver to United States, ${request.postalCode}` ||
      !observed.usd || observed.loading || observed.blocked) throw new Error('Unverified shipping estimate.');
  const matches = [...String(observed.shippingText || '').matchAll(/(?:shipping|delivery)[^$]{0,80}\$\s*(\d{1,4})\.(\d{2})/gi)];
  if (matches.length !== 1) throw new Error('Missing or ambiguous shipping estimate.');
  const shippingAmount = Number(matches[0][1]) * 100 + Number(matches[0][2]);
  return { ...request, supplier: 'temu', sourceUrl: TEMU_PRODUCTS[request.productId], currency: 'usd', shippingAmount,
    kind: 'listing_estimate', checkoutEligible: false, observedAt: new Date(now).toISOString(), expiresAt: new Date(now + 5 * 60_000).toISOString() };
}

export async function quoteTemu(browser, input) {
  const request = validateRequest(input);
  const context = await browser.newContext({ locale: 'en-US' });
  const deadline = setTimeout(() => { void context.close().catch(() => {}); }, 45_000);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    const response = await page.goto(TEMU_PRODUCTS[request.productId], { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!response || !response.ok()) throw new Error(`Supplier shipping access failed (HTTP ${response?.status() ?? 'unknown'}).`);
    throw new Error('Temu shipping calculator selectors require supplier verification before use.');
  } finally {
    clearTimeout(deadline);
    await context.close().catch(() => {});
  }
}
