-- TImx off-chain schema.
--
-- Division of responsibility, enforced by what is NOT in here: no balances, no trade state, no
-- collateral or repayment amounts. Those live on Creditcoin and are read from the contracts. This
-- database holds descriptive metadata, documents, logistics detail and correspondence — the things
-- a trade needs that do not belong in consensus.
--
-- The one exception is `attestation_index`, which mirrors on-chain attestation records purely so
-- the Developer page can page through history without scanning logs. It is a cache. The chain is
-- still the authority, and the UI reads proof kind from the adapter contract, never from this
-- table.
--
-- Writes never come from the browser. The anon key is read-only by policy; every insert goes
-- through a Next.js route handler that has already verified a wallet signature and then uses the
-- service role. See `web/src/app/api`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organisations and profiles
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  industry text,
  kyb_status text not null default 'unverified'
    check (kyb_status in ('unverified', 'pending', 'verified')),
  created_at timestamptz not null default now()
);

-- Wallet address is the primary key: TImx authenticates with a wallet, so there is no separate
-- user id to keep in sync with it.
create table if not exists profiles (
  wallet_address text primary key
    check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  display_name text,
  role text not null default 'buyer' check (role in ('buyer', 'supplier', 'financier')),
  organization_id uuid references organizations (id) on delete set null,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_organization_idx on profiles (organization_id);

-- ---------------------------------------------------------------------------
-- Trade metadata
-- ---------------------------------------------------------------------------

-- Keyed by the on-chain trade id (stored as text: uint256 exceeds bigint).
-- `chain_id` is part of the key space in practice, since ids restart per deployment.
create table if not exists trade_metadata (
  trade_id text not null,
  chain_id integer not null,
  title text not null,
  commodity text not null default '',
  industry text not null default '',
  origin_country text not null default '',
  destination_country text not null default '',
  supplier_name text not null default '',
  buyer_name text not null default '',
  incoterms text,
  summary text,
  created_at timestamptz not null default now(),
  primary key (trade_id, chain_id)
);

create index if not exists trade_metadata_industry_idx on trade_metadata (industry);
create index if not exists trade_metadata_corridor_idx
  on trade_metadata (origin_country, destination_country);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

-- Files are never stored on-chain. `content_hash` is a keccak256 digest computed in the browser;
-- anyone holding the original can recompute it and verify the document has not been altered.
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  trade_id text not null,
  name text not null,
  document_type text not null,
  content_hash text check (content_hash is null or content_hash ~ '^0x[0-9a-fA-F]{64}$'),
  storage_cid text,
  uploaded_by text check (uploaded_by is null or uploaded_by ~ '^0x[0-9a-fA-F]{40}$'),
  created_at timestamptz not null default now()
);

create index if not exists documents_trade_idx on documents (trade_id);

-- ---------------------------------------------------------------------------
-- Shipments
-- ---------------------------------------------------------------------------

-- Logistics detail behind a shipment event. `source_tx_hash` links back to the transaction on the
-- source chain that the attestation proves, so a reader can go from a delivery date to the event
-- that made it official.
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  trade_id text not null,
  carrier text,
  tracking_reference text,
  origin_port text,
  destination_port text,
  dispatched_at timestamptz,
  estimated_arrival timestamptz,
  delivered_at timestamptz,
  source_tx_hash text check (source_tx_hash is null or source_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists shipments_trade_idx on shipments (trade_id);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  trade_id text,
  sender_address text not null check (sender_address ~ '^0x[0-9a-fA-F]{40}$'),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_trade_idx on messages (trade_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Attestation index (cache of on-chain records)
-- ---------------------------------------------------------------------------

-- `proof_kind` mirrors TradeTypes.ProofKind, where 1 = USC_PROOF is the only value an accepted
-- attestation can carry. Indexed here for filtering only; anything that renders a verification
-- claim reads it from the adapter contract, not from this cache.
create table if not exists attestation_index (
  attestation_id text primary key check (attestation_id ~ '^0x[0-9a-fA-F]{64}$'),
  trade_id text not null,
  event_kind smallint not null,
  proof_kind smallint not null check (proof_kind = 1),
  source_chain_key integer not null,
  source_height text not null,
  source_tx_hash text not null,
  creditcoin_tx_hash text,
  recorded_at timestamptz not null default now()
);

create index if not exists attestation_index_trade_idx on attestation_index (trade_id);
create index if not exists attestation_index_proof_idx on attestation_index (proof_kind);

-- ---------------------------------------------------------------------------
-- Chain read model
-- ---------------------------------------------------------------------------
--
-- The tables in this section MIRROR on-chain state. They exist so the product can filter, sort and
-- paginate without an archive-node scan on every page load.
--
-- The rule, without exception: nothing here is authoritative. A screen that shows a balance, an
-- outstanding amount or a trade state reads it from the contracts. These rows are for finding
-- things, not for deciding anything, and an indexer that falls behind must degrade into a stale
-- list — never into a wrong number. `synced_at` and `block_number` exist so staleness is visible
-- rather than silent.

create table if not exists trades (
  trade_id text not null,
  chain_id integer not null,
  buyer_address text not null check (buyer_address ~ '^0x[0-9a-fA-F]{40}$'),
  supplier_address text not null check (supplier_address ~ '^0x[0-9a-fA-F]{40}$'),
  financier_address text check (financier_address ~ '^0x[0-9a-fA-F]{40}$'),
  -- Mirrors TradeTypes.TradeState. Stored as the enum ordinal so a renamed label cannot silently
  -- change the meaning of historical rows.
  state smallint not null,
  trade_value numeric(78, 0) not null,
  collateral numeric(78, 0) not null,
  financing numeric(78, 0) not null,
  interest_bps integer not null,
  term_days integer not null,
  created_at_chain timestamptz,
  funded_at_chain timestamptz,
  maturity_at_chain timestamptz,
  block_number bigint not null,
  synced_at timestamptz not null default now(),
  primary key (trade_id, chain_id)
);

create index if not exists trades_state_idx on trades (chain_id, state);
create index if not exists trades_buyer_idx on trades (buyer_address);
create index if not exists trades_supplier_idx on trades (supplier_address);
create index if not exists trades_financier_idx on trades (financier_address);

-- Who stands where on a trade. Derived from the trade row, kept separate so "my trades" is one
-- indexed lookup rather than a three-column OR across every trade.
create table if not exists trade_participants (
  trade_id text not null,
  chain_id integer not null,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  role text not null check (role in ('buyer', 'supplier', 'financier')),
  created_at timestamptz not null default now(),
  primary key (trade_id, chain_id, wallet_address, role)
);

create index if not exists trade_participants_wallet_idx on trade_participants (wallet_address);

-- A trade open for financing. Closed when a financier commits on-chain.
create table if not exists financing_requests (
  trade_id text not null,
  chain_id integer not null,
  amount numeric(78, 0) not null,
  interest_bps integer not null,
  term_days integer not null,
  status text not null default 'open' check (status in ('open', 'committed', 'withdrawn')),
  committed_by text check (committed_by ~ '^0x[0-9a-fA-F]{40}$'),
  committed_tx_hash text check (committed_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  synced_at timestamptz not null default now(),
  primary key (trade_id, chain_id)
);

create index if not exists financing_requests_status_idx on financing_requests (status);

-- Collateral held by CollateralVault, mirrored for reporting.
create table if not exists collateral_positions (
  trade_id text not null,
  chain_id integer not null,
  depositor text not null check (depositor ~ '^0x[0-9a-fA-F]{40}$'),
  amount numeric(78, 0) not null,
  status text not null check (status in ('locked', 'released', 'seized', 'refunded')),
  locked_tx_hash text check (locked_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  resolved_tx_hash text check (resolved_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  synced_at timestamptz not null default now(),
  primary key (trade_id, chain_id)
);

create index if not exists collateral_positions_depositor_idx on collateral_positions (depositor);

-- Individual repayments. Partial repayments are the norm, so this is a ledger rather than a total:
-- the outstanding balance is read from RepaymentManager, not summed from these rows.
create table if not exists repayments (
  id uuid primary key default gen_random_uuid(),
  trade_id text not null,
  chain_id integer not null,
  payer text not null check (payer ~ '^0x[0-9a-fA-F]{40}$'),
  amount numeric(78, 0) not null,
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  block_number bigint not null,
  paid_at timestamptz not null,
  unique (tx_hash, trade_id)
);

create index if not exists repayments_trade_idx on repayments (trade_id, paid_at desc);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- Delivered to a wallet, not to a person: identity here is the address that signed in.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  trade_id text,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_wallet_idx
  on notifications (wallet_address, created_at desc);
create index if not exists notifications_unread_idx
  on notifications (wallet_address) where read_at is null;

-- ---------------------------------------------------------------------------
-- Sign-in nonces
-- ---------------------------------------------------------------------------

-- Single-use challenges for wallet sign-in. Rows are deleted on verification — successful or
-- not — so a captured signature cannot be replayed against the same challenge.
create table if not exists auth_nonces (
  nonce text primary key,
  address text not null check (address ~ '^0x[0-9a-fA-F]{40}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_nonces_address_idx on auth_nonces (address, created_at desc);
create index if not exists auth_nonces_expiry_idx on auth_nonces (expires_at);

-- Housekeeping for challenges nobody completed. Safe to schedule with pg_cron.
create or replace function purge_expired_nonces() returns void
language sql
as $$
  delete from auth_nonces where expires_at < now();
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Descriptive tables are publicly readable — a marketplace is only useful if listings can be
-- browsed before connecting a wallet. Writes are restricted to the service role, so the anon key
-- shipped to the browser cannot mutate anything.
--
-- Note the deliberate absence of a "users can edit their own row" policy keyed on wallet address:
-- an anon client can claim any address, so wallet-scoped writes need signature verification, which
-- happens in the route handlers before the service role is used.
--
-- `auth_nonces` is excluded from public reads entirely. A readable nonce table would let anyone
-- enumerate outstanding challenges.

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table trade_metadata enable row level security;
alter table documents enable row level security;
alter table shipments enable row level security;
alter table messages enable row level security;
alter table attestation_index enable row level security;
alter table trades enable row level security;
alter table trade_participants enable row level security;
alter table financing_requests enable row level security;
alter table collateral_positions enable row level security;
alter table repayments enable row level security;
alter table notifications enable row level security;
alter table auth_nonces enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'trade_metadata',
    'documents', 'shipments', 'messages', 'attestation_index',
    'trades', 'trade_participants', 'financing_requests',
    'collateral_positions', 'repayments'
  ]
  loop
    execute format('drop policy if exists %I on %I;', t || '_read', t);
    execute format('create policy %I on %I for select using (true);', t || '_read', t);

    execute format('drop policy if exists %I on %I;', t || '_write', t);
    execute format(
      'create policy %I on %I for all to service_role using (true) with check (true);',
      t || '_write', t
    );
  end loop;
end $$;

-- No policy is created for `auth_nonces`, so with RLS enabled the anon key can neither read nor
-- write it. Only the service role, which bypasses RLS, can touch it.

-- `notifications` is deliberately not publicly readable: a notification names a wallet and what it
-- is waiting on, which is nobody else's business. It is served through a route handler that has
-- established the session address first.
drop policy if exists notifications_write on notifications;
create policy notifications_write on notifications
  for all to service_role using (true) with check (true);
