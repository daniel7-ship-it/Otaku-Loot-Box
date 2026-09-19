export const JINX_URL = 'https://www.etsy.com/listing/1821496421/anime-keychain-embroidered-jet-tag';

export function validateRequest(input) {
  if (!input || input.productId !== 12 || input.quantity !== 1 || input.country !== 'US' ||
      typeof input.postalCode !== 'string' || !/^\d{5}$/.test(input.postalCode)) {
    throw new Error('Only Jinx (12), quantity 1, country US and a five-digit ZIP are supported.');
  }
  return { productId: 12, quantity: 1, country: 'US', postalCode: input.postalCode };
}

export function parseQuote(input, observed, now = Date.now()) {
  const request = validateRequest(input);
  if (observed.destination !== `Deliver to United States, ${request.postalCode}` ||
      !observed.usd || observed.loading || observed.blocked) throw new Error('Unverified shipping estimate.');
  const matches = [...observed.shippingText.matchAll(/Cost to ship:\s*\$\s*(\d{1,4})\.(\d{2})(?!\d)/g)];
  if (matches.length !== 1) throw new Error('Missing or ambiguous shipping estimate.');
  const shippingAmount = Number(matches[0][1]) * 100 + Number(matches[0][2]);
  return {
    ...request, supplier: 'etsy', sourceUrl: JINX_URL, currency: 'usd', shippingAmount,
    kind: 'listing_estimate', checkoutEligible: false,
    observedAt: new Date(now).toISOString(), expiresAt: new Date(now + 5 * 60_000).toISOString(),
  };
}

export async function quoteJinx(browser, input) {
  const request = validateRequest(input);
  // Isolate destination cookies between requests. Never reuse a customer's session.
  const context = await browser.newContext({ locale: 'en-US' });
  const deadline = setTimeout(() => { void context.close().catch(() => {}); }, 45_000);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    await page.goto(JINX_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.getByRole('button', { name: /^Deliver to / }).click();
    await page.locator('#estimated-shipping-country').selectOption({ label: 'United States' });
    await page.locator('#estimated-shipping-zip-code').fill(request.postalCode);
    await page.locator('#estimated-shipping-submit-button').click();
    const destination = page.getByRole('button', { name: `Deliver to United States, ${request.postalCode}`, exact: true });
    await destination.waitFor({ state: 'visible' });
    const shipping = page.locator('#shipping_and_returns');
    const shippingText = await shipping.innerText();
    const usd = await page.getByRole('link', { name: /Update your settings.*United States.*\(USD\)/ }).count() === 1;
    const text = await page.locator('body').innerText();
    return parseQuote(request, {
      destination: (await destination.innerText()).trim(), shippingText, usd,
      loading: /\bLoading\b/i.test(shippingText),
      blocked: /captcha|verify (?:that )?you are human|access denied|problem calculating your shipping/i.test(text),
    });
  } finally {
    clearTimeout(deadline);
    await context.close().catch(() => {});
  }
}
