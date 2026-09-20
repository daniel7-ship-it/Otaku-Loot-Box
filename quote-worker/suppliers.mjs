import { ETSY_PRODUCTS } from './etsy.mjs';
import { TEMU_PRODUCTS } from './temu.mjs';

// One source of truth for supplier ownership. Providers stay disabled until
// their APIs or calculators are verified for destination-specific quotes.
export const SUPPLIER_PRODUCTS = Object.freeze({
  etsy: Object.freeze({ ...ETSY_PRODUCTS }),
  temu: Object.freeze({ ...TEMU_PRODUCTS }),
});

export function supplierForProduct(productId) {
  const id = Number(productId);
  for (const [supplier, products] of Object.entries(SUPPLIER_PRODUCTS)) {
    if (Object.hasOwn(products, id)) return supplier;
  }
  return null;
}
