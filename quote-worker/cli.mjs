import { quoteEtsy, validateRequest } from './etsy.mjs';

let browser;
try {
  const input = validateRequest({ productId: Number(process.argv[3] || 12), quantity: 1, country: 'US', postalCode: process.argv[2] });
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true });
  console.log(JSON.stringify(await quoteEtsy(browser, input)));
} catch {
  console.error(JSON.stringify({ error: 'Quote unavailable. Check worker dependencies or supplier access. Do not substitute a default rate.' }));
  process.exitCode = 1;
} finally { await browser?.close(); }
