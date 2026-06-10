import { db } from "./sql";

const SCHEMA = `
create table if not exists settings (
  id int primary key default 1,
  free_scan_limit int not null default 5,
  free_code_limit int not null default 1,
  day_pass_price numeric not null default 5,
  month_pass_price numeric not null default 40,
  confirmations_required int not null default 12,
  invoice_expiry_minutes int not null default 60,
  scan_universe_default int not null default 50,
  scan_universe_max int not null default 200,
  updated_at timestamptz not null default now()
);
create table if not exists chains (
  key text primary key,
  label text not null,
  address text not null default '',
  explorer_api_key text not null default '',
  enabled boolean not null default false,
  sort int not null default 0
);
create table if not exists free_usage (
  identity text not null,
  day date not null,
  scans int not null default 0,
  code_hashes text[] not null default '{}',
  primary key (identity, day)
);
create table if not exists invoices (
  id text primary key,
  plan text not null,
  chain_key text not null,
  address text not null,
  base_price numeric not null,
  unique_amount text not null,
  email text,
  identity text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists used_tx (
  tx_hash text primary key,
  chain_key text not null,
  amount text not null,
  invoice_id text not null,
  verified_at timestamptz not null default now()
);
create table if not exists passes (
  id text primary key,
  type text not null,
  email text,
  identity text,
  invoice_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
`;

const DEFAULT_CHAINS = [
  { key: "trc20", label: "USDT · Tron (TRC-20)", sort: 1 },
  { key: "erc20", label: "USDT · Ethereum (ERC-20)", sort: 2 },
  { key: "bep20", label: "USDT · BNB Chain (BEP-20)", sort: 3 },
  { key: "polygon", label: "USDT · Polygon", sort: 4 },
];

let ready = false;

/** Create tables + seed defaults. Idempotent; runs once per process. */
export async function ensureDb() {
  if (ready) return;
  const sql = db();
  await sql.unsafe(SCHEMA);
  await sql.unsafe(`alter table settings add column if not exists scan_universe_default int not null default 50`);
  await sql.unsafe(`alter table settings add column if not exists scan_universe_max int not null default 200`);
  await sql`insert into settings (id) values (1) on conflict (id) do nothing`;
  for (const c of DEFAULT_CHAINS) {
    await sql`insert into chains (key, label, sort) values (${c.key}, ${c.label}, ${c.sort})
              on conflict (key) do nothing`;
  }
  ready = true;
}

export interface Settings {
  free_scan_limit: number; free_code_limit: number;
  day_pass_price: string; month_pass_price: string;
  confirmations_required: number; invoice_expiry_minutes: number; scan_universe_default: number; scan_universe_max: number;
}

export async function getSettings(): Promise<Settings> {
  await ensureDb();
  const [s] = await db()`select * from settings where id = 1`;
  return s as unknown as Settings;
}
