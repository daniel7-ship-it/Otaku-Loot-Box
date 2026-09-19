begin;

create table if not exists public.otaku_orders (
  id text primary key check (id ~ '^cs_test_[A-Za-z0-9]{1,200}$'),
  received_at timestamptz not null,
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ? 'id' and payload ? 'mode'
    and payload->>'id' = id and payload->>'mode' = 'test'
  )
);

alter table public.otaku_orders enable row level security;
revoke all on public.otaku_orders from public, anon, authenticated;
grant select, insert on public.otaku_orders to service_role;
create index if not exists otaku_orders_received_at_idx
  on public.otaku_orders (received_at desc, id desc);

commit;
