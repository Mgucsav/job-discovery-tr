-- Aşama 2: İlanların Supabase Postgres'te kalıcı tutulması.
-- src/domain.ts içindeki JobPosting sözleşmesini owner_id ve edinilme yöntemiyle genişletir.
-- Tekillik anahtarı: owner_id + source + source_job_id (siteler arası ilanlar birleştirilmez).

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null,
  source_job_id text not null,
  url text not null,
  title text,
  company text,
  location text,
  description text,
  first_seen_at timestamptz not null default now(),
  acquisition_method text not null,
  source_email_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_postings_owner_source_job_key unique (owner_id, source, source_job_id),
  constraint job_postings_source_check check (source in ('linkedin', 'kariyer', 'indeed')),
  constraint job_postings_source_job_id_check check (length(source_job_id) between 1 and 64),
  constraint job_postings_url_https_check check (url ~ '^https://' and length(url) <= 2048),
  constraint job_postings_title_check check (title is null or length(title) between 1 and 240),
  constraint job_postings_company_check check (company is null or length(company) between 1 and 200),
  constraint job_postings_location_check check (location is null or length(location) between 1 and 200),
  constraint job_postings_description_check check (description is null or length(description) between 1 and 5000),
  constraint job_postings_acquisition_method_check check (acquisition_method in ('manual', 'gmail')),
  -- Manuel kayda sahte Gmail e-posta kimliği yazılamaz; Gmail kaydı e-posta kimliğini kaybedemez.
  constraint job_postings_source_email_id_check check (
    (acquisition_method = 'gmail' and source_email_id is not null)
    or (acquisition_method = 'manual' and source_email_id is null)
  )
);

comment on table public.job_postings is 'Kullanıcıya ait keşfedilen/elle eklenen iş ilanları. Tam e-posta gövdesi saklanmaz.';
comment on column public.job_postings.first_seen_at is 'İlanın ilk görüldüğü an; daha eski bir görülme sonradan işlenirse geriye çekilir.';
comment on column public.job_postings.acquisition_method is 'İlk görülmeyi sağlayan yöntem: manual (web arayüzü) veya gmail (keşif koşusu).';

create index job_postings_owner_first_seen_idx on public.job_postings (owner_id, first_seen_at desc);

create function public.job_postings_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger job_postings_touch_updated_at
before update on public.job_postings
for each row execute function public.job_postings_touch_updated_at();

-- Row Level Security: yalnızca oturum açan kullanıcı kendi satırlarını görür ve değiştirir.
alter table public.job_postings enable row level security;

create policy job_postings_select_own on public.job_postings
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy job_postings_insert_own on public.job_postings
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy job_postings_update_own on public.job_postings
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy job_postings_delete_own on public.job_postings
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Yetkiler politikalardan ayrı olarak daraltılır: anon rolünün tabloya hiç erişimi yoktur.
revoke all on table public.job_postings from public;
revoke all on table public.job_postings from anon;
grant select, insert, update, delete on table public.job_postings to authenticated;

-- JsonFileJobRepository.upsert ile aynı davranış:
--   * yeni ilan -> 'inserted'
--   * daha eski görülme -> ilk görülme bilgisi ve edinilme kaynağı geriye çekilir
--   * eksik başlık/şirket/konum/açıklama sonradan tamamlanır, mevcut değer ezilmez
--   * değişiklik yoksa -> 'unchanged'
-- security invoker: RLS çağıran kullanıcı adına uygulanır.
create function public.upsert_job_posting(
  p_source text,
  p_source_job_id text,
  p_url text,
  p_title text default null,
  p_company text default null,
  p_location text default null,
  p_description text default null,
  p_acquisition_method text default 'manual',
  p_source_email_id text default null,
  p_first_seen_at timestamptz default now()
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_current public.job_postings%rowtype;
  v_changed boolean := false;
begin
  if v_owner is null then
    raise exception 'Oturum doğrulanamadı.' using errcode = '42501';
  end if;

  select * into v_current
  from public.job_postings
  where owner_id = v_owner and source = p_source and source_job_id = p_source_job_id
  for update;

  if not found then
    insert into public.job_postings (
      owner_id, source, source_job_id, url, title, company, location, description,
      first_seen_at, acquisition_method, source_email_id
    ) values (
      v_owner, p_source, p_source_job_id, p_url, p_title, p_company, p_location, p_description,
      p_first_seen_at, p_acquisition_method, p_source_email_id
    );
    return 'inserted';
  end if;

  if p_first_seen_at < v_current.first_seen_at then
    v_current.first_seen_at := p_first_seen_at;
    v_current.acquisition_method := p_acquisition_method;
    v_current.source_email_id := p_source_email_id;
    v_changed := true;
  end if;

  if v_current.title is null and p_title is not null then
    v_current.title := p_title;
    v_changed := true;
  end if;
  if v_current.company is null and p_company is not null then
    v_current.company := p_company;
    v_changed := true;
  end if;
  if v_current.location is null and p_location is not null then
    v_current.location := p_location;
    v_changed := true;
  end if;
  if v_current.description is null and p_description is not null then
    v_current.description := p_description;
    v_changed := true;
  end if;

  if not v_changed then
    return 'unchanged';
  end if;

  update public.job_postings
  set first_seen_at = v_current.first_seen_at,
      acquisition_method = v_current.acquisition_method,
      source_email_id = v_current.source_email_id,
      title = v_current.title,
      company = v_current.company,
      location = v_current.location,
      description = v_current.description
  where id = v_current.id;

  return 'updated';
end
$$;

revoke all on function public.upsert_job_posting(text, text, text, text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.upsert_job_posting(text, text, text, text, text, text, text, text, text, timestamptz) from anon;
grant execute on function public.upsert_job_posting(text, text, text, text, text, text, text, text, text, timestamptz) to authenticated;
