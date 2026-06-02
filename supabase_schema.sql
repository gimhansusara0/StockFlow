-- ============================================================
-- StockFlow — Supabase schema
-- Run this in Supabase SQL Editor (one time).
-- ============================================================

-- COLLECTIONS — group multiple products together
create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

-- PRODUCTS (parent item)
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete set null,
  name          text not null,
  description   text,
  image_url     text,
  buying_price  numeric(12,2) not null default 0,   -- global fallback price
  selling_price numeric(12,2) not null default 0,   -- global fallback price
  created_at    timestamptz default now()
);
-- if products table already existed, add the columns:
alter table products add column if not exists collection_id uuid references collections(id) on delete set null;
alter table products add column if not exists buying_price  numeric(12,2) not null default 0;
alter table products add column if not exists selling_price numeric(12,2) not null default 0;

-- VARIANTS (e.g. "Yellow Print", "Blue Dragon") — same item, different print/colour
create table if not exists variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  name          text not null,
  image_url     text,
  buying_price  numeric(12,2) not null default 0,   -- shared price when same_buy = true
  selling_price numeric(12,2) not null default 0,   -- shared price when same_sell = true
  same_buy      boolean not null default true,      -- one buy price for all sizes
  same_sell     boolean not null default true,      -- one sell price for all sizes
  created_at    timestamptz default now()
);
-- if variants table already existed, add the columns:
alter table variants add column if not exists image_url text;
alter table variants add column if not exists same_buy  boolean not null default true;
alter table variants add column if not exists same_sell boolean not null default true;

-- SIZES per variant (S, M, L ... each holds stock qty + optional own prices)
create table if not exists variant_sizes (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references variants(id) on delete cascade,
  size          text not null,
  stock         integer not null default 0,
  buying_price  numeric(12,2) not null default 0,   -- used when variant.same_buy = false
  selling_price numeric(12,2) not null default 0,   -- used when variant.same_sell = false
  created_at    timestamptz default now()
);
-- if variant_sizes already existed, add the columns:
alter table variant_sizes add column if not exists buying_price  numeric(12,2) not null default 0;
alter table variant_sizes add column if not exists selling_price numeric(12,2) not null default 0;

-- BATCHES — a "subtract from stock" / sales event
-- We record what was deducted, what came back / unusable, what sold.
create table if not exists batches (
  id            uuid primary key default gen_random_uuid(),
  variant_size_id uuid not null references variant_sizes(id) on delete cascade,
  deducted      integer not null default 0,   -- taken out of stock
  returned      integer not null default 0,   -- came back unsold
  unusable      integer not null default 0,   -- faulty / damaged
  note          text,
  created_at    timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_variants_product on variants(product_id);
create index if not exists idx_sizes_variant on variant_sizes(variant_id);
create index if not exists idx_batches_size on batches(variant_size_id);
create index if not exists idx_products_collection on products(collection_id);

-- ============================================================
-- STORAGE: create a public bucket named "products" for images
-- (Dashboard > Storage > New bucket > name: products > public)
-- ============================================================

-- Row Level Security (open policies — single user / internal tool).
-- Tighten these if you add auth.
alter table products       enable row level security;
alter table collections    enable row level security;
alter table variants       enable row level security;
alter table variant_sizes  enable row level security;
alter table batches        enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='collections' and policyname='all collections') then
    create policy "all collections"   on collections   for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='products' and policyname='all products') then
    create policy "all products"      on products      for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='variants' and policyname='all variants') then
    create policy "all variants"      on variants      for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='variant_sizes' and policyname='all sizes') then
    create policy "all sizes"         on variant_sizes for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='batches' and policyname='all batches') then
    create policy "all batches"       on batches       for all using (true) with check (true);
  end if;
end $$;

-- Storage policy (allow public read + anon upload to "products" bucket)
do $$
begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='products read') then
    create policy "products read"   on storage.objects for select using (bucket_id = 'products');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='products write') then
    create policy "products write"  on storage.objects for insert with check (bucket_id = 'products');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='products update') then
    create policy "products update" on storage.objects for update using (bucket_id = 'products');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='products delete') then
    create policy "products delete" on storage.objects for delete using (bucket_id = 'products');
  end if;
end $$;
