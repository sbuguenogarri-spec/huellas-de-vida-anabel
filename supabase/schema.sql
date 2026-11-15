do $$ begin
  create type public.appointment_status as enum ('scheduled', 'attended', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  national_id text,
  full_name text not null check (length(trim(full_name)) > 0),
  birth_date date not null,
  phone text not null,
  email text,
  address text,
  emergency_contact text,
  occupation text,
  medical_history text,
  podiatry_history text,
  allergies text,
  medications text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index if not exists patients_user_national_id_unique
  on public.patients (user_id, national_id)
  where national_id is not null and length(trim(national_id)) > 0;

alter table public.patients
  alter column birth_date drop not null;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null,
  appointment_date date not null,
  appointment_time time not null,
  price_clp integer not null check (price_clp >= 0),
  status public.appointment_status not null default 'scheduled',
  cancellation_reason text,
  is_rescheduled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, patient_id)
    references public.patients (user_id, id) on delete restrict,
  check (
    status <> 'cancelled'
    or length(trim(coalesce(cancellation_reason, ''))) > 0
  )
);

create index if not exists appointments_user_date_time_idx
  on public.appointments (user_id, appointment_date, appointment_time);

create table if not exists public.session_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null,
  treatment text not null check (length(trim(treatment)) > 0),
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, appointment_id),
  foreign key (user_id, appointment_id)
    references public.appointments (user_id, id) on delete cascade
);

create table if not exists public.session_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, session_id)
    references public.session_records (user_id, id) on delete cascade,
  unique (user_id, storage_path)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null default current_date,
  description text not null check (length(trim(description)) > 0),
  category text not null,
  amount_clp integer not null check (amount_clp > 0),
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx
  on public.expenses (user_id, expense_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.session_records enable row level security;
alter table public.session_photos enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "patients own rows" on public.patients;
create policy "patients own rows"
  on public.patients for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "appointments own rows" on public.appointments;
create policy "appointments own rows"
  on public.appointments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "session records own rows" on public.session_records;
create policy "session records own rows"
  on public.session_records for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "session photos own rows" on public.session_photos;
create policy "session photos own rows"
  on public.session_photos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "expenses own rows" on public.expenses;
create policy "expenses own rows"
  on public.expenses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-photos',
  'session-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "session photo files select own" on storage.objects;
create policy "session photo files select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'session-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "session photo files insert own" on storage.objects;
create policy "session photo files insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "session photo files update own" on storage.objects;
create policy "session photo files update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'session-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'session-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "session photo files delete own" on storage.objects;
create policy "session photo files delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'session-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
