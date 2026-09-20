import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPLIER_PRODUCTS, supplierForProduct } from '../quote-worker/suppliers.mjs';

test('supplier registry covers every real sourced product exactly once', () => {
  const ids = Object.values(SUPPLIER_PRODUCTS).flatMap(products => Object.keys(products));
  assert.equal(new Set(ids).size, 9);
  assert.equal(supplierForProduct(12), 'etsy');
  assert.equal(supplierForProduct(18), 'temu');
  assert.equal(supplierForProduct(1), null);
});
