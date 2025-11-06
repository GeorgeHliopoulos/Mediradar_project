-- Schema definition for pharmacy operating schedule management
create table if not exists public.pharmacy_schedule (
  id serial primary key,
  pharmacy_user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week text not null,
  start_time time,
  end_time time,
  is_open boolean not null default true,
  is_emergency boolean not null default false,
  effective_date date
);

comment on table public.pharmacy_schedule is 'Stores weekly and special schedule entries for MediRadar pharmacies.';
comment on column public.pharmacy_schedule.day_of_week is 'Localized day label (e.g. Δευτέρα, Τρίτη).';
comment on column public.pharmacy_schedule.effective_date is 'Optional date for emergency or special schedules; null for standard weekly hours.';

create index if not exists pharmacy_schedule_user_day_idx
  on public.pharmacy_schedule (pharmacy_user_id, day_of_week);

create index if not exists pharmacy_schedule_effective_date_idx
  on public.pharmacy_schedule (effective_date);
