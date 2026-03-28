-- ============================================================
-- IntelliCoin — Schema updates
-- Run this in Supabase SQL Editor if you already ran the
-- original schema. If starting fresh, run the full schema first.
-- ============================================================

-- Add signal_rank column to signals table
alter table public.signals
  add column if not exists signal_rank text check (signal_rank in ('S','A','B','C'));

-- Add gate-based access columns to users table
alter table public.users
  add column if not exists min_rank_access text default 'SA',
  add column if not exists manual_scans_per_day integer default 0,
  add column if not exists manual_scans_used_today integer default 0,
  add column if not exists manual_scans_reset_at date default current_date;

-- Add min_rank_to_broadcast to scanner_config
alter table public.scanner_config
  add column if not exists min_rank_to_broadcast text default 'SA';

-- Reset manual scan counter daily (run via pg_cron if available)
-- Otherwise the app handles this check client-side

-- Update your admin user to have unlimited manual scans
update public.users
set manual_scans_per_day = 999
where role = 'admin';

-- Index for signal rank
create index if not exists signals_rank_idx on public.signals(signal_rank);
