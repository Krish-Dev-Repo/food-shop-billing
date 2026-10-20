create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  cost numeric(10, 2) not null check (cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  total numeric(10, 2) not null check (total >= 0),
  total_cost numeric(10, 2) not null check (total_cost >= 0),
  nickname text,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists nickname text;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity integer not null check (quantity between 1 and 100),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  unit_cost numeric(10, 2) not null check (unit_cost >= 0)
);

create index if not exists orders_owner_created_at_idx
  on public.orders (owner_id, created_at desc);
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Owners can read their products" on public.products;
create policy "Owners can read their products" on public.products
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Owners can manage their products" on public.products;
create policy "Owners can manage their products" on public.products
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can read their orders" on public.orders;
create policy "Owners can read their orders" on public.orders
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Owners can read their order items" on public.order_items;
create policy "Owners can read their order items" on public.order_items
  for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.seed_default_products()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
begin
  if current_owner is null then
    raise exception 'Sign in before initializing the menu';
  end if;

  insert into public.products (owner_id, name, price, cost)
  values
    (current_owner, 'Classic burger', 8.50, 3.25),
    (current_owner, 'Cheese pizza', 12.00, 5.00),
    (current_owner, 'French fries', 3.50, 1.10),
    (current_owner, 'Fresh orange juice', 4.00, 1.40),
    (current_owner, 'Chicken wrap', 7.50, 3.00),
    (current_owner, 'Chocolate brownie', 3.00, 0.95)
  on conflict (owner_id, name) do nothing;
end;
$$;

drop function if exists public.create_order(jsonb);

create or replace function public.create_order(p_items jsonb, p_nickname text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  new_order_id uuid;
  item jsonb;
  selected_product public.products%rowtype;
  item_quantity integer;
  order_total numeric(10, 2) := 0;
  order_cost numeric(10, 2) := 0;
  order_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if current_owner is null then
    raise exception 'Sign in before creating an order';
  end if;
  if char_length(order_nickname) > 80 then
    raise exception 'Bill nicknames must be 80 characters or fewer';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order must contain at least one item';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (item->>'quantity')::integer;
    if item_quantity < 1 or item_quantity > 100 then
      raise exception 'Each item quantity must be between 1 and 100';
    end if;

    select * into selected_product
    from public.products
    where id = (item->>'product_id')::uuid
      and owner_id = current_owner
      and active = true;
    if not found then
      raise exception 'A selected menu item is unavailable';
    end if;

    order_total := order_total + selected_product.price * item_quantity;
    order_cost := order_cost + selected_product.cost * item_quantity;
  end loop;

  insert into public.orders (owner_id, total, total_cost, nickname)
  values (current_owner, order_total, order_cost, order_nickname)
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (item->>'quantity')::integer;
    select * into selected_product
    from public.products
    where id = (item->>'product_id')::uuid
      and owner_id = current_owner
      and active = true;
    if not found then
      raise exception 'A selected menu item is unavailable';
    end if;

    insert into public.order_items (
      owner_id, order_id, product_id, name, quantity, unit_price, unit_cost
    )
    values (
      current_owner, new_order_id, selected_product.id, selected_product.name,
      item_quantity, selected_product.price, selected_product.cost
    );
  end loop;

  return new_order_id;
end;
$$;

revoke all on function public.seed_default_products() from public;
revoke all on function public.create_order(jsonb, text) from public;
grant execute on function public.seed_default_products() to authenticated;
grant execute on function public.create_order(jsonb, text) to authenticated;

grant select, insert, update, delete on public.products to authenticated;
grant select on public.orders, public.order_items to authenticated;
