import { orderStore } from './orders.mjs';
import { supabaseOrderStore } from './supabase-orders.mjs';

export function configureOrders(env, config) {
  const settings = ['ORDER_DATA_DIR', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ORDER_AGENT_TOKEN'];
  if (!settings.some(key => env[key])) return undefined;
  const supabase = Boolean(env.SUPABASE_URL || env.SUPABASE_SECRET_KEY);
  if ((supabase && env.ORDER_DATA_DIR) || (!supabase && !env.ORDER_DATA_DIR)) {
    throw new Error('Choose either Supabase or ORDER_DATA_DIR for order storage.');
  }
  if (!/^whsec_\S+$/.test(env.STRIPE_WEBHOOK_SECRET || '') || (env.ORDER_AGENT_TOKEN || '').length < 32) {
    throw new Error('STRIPE_WEBHOOK_SECRET and ORDER_AGENT_TOKEN are required for order recording.');
  }
  const orders = supabase
    ? supabaseOrderStore(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)
    : orderStore(env.ORDER_DATA_DIR);
  config.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  config.agentToken = env.ORDER_AGENT_TOKEN;
  return orders;
}
