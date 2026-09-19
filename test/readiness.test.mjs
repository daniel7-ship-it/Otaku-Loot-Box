import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../backend/server.mjs';

test('readiness reports configuration without secrets or customer information', async () => {
  for (const configured of [false, true]) {
    const server = createApp({
      config: { origin: 'https://example.com', ...(configured ? { webhookSecret: 'whsec_private', agentToken: 'private-token' } : {}) },
      stripe: () => { throw new Error('Readiness must not call Stripe'); },
      orders: configured ? { list: () => { throw new Error('Readiness must not read customers'); } } : undefined,
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/readiness`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        mode: 'test', livePaymentsEnabled: false,
        orderRecordingConfigured: configured, supplierPurchasingEnabled: false,
      });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});
