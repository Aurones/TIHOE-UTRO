begin;

create table public.categories (
 slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=64),
 kind text not null check(kind in ('adult','child','towel')),
 name text not null check(length(trim(name)) between 1 and 90),
 description text not null check(length(trim(description)) between 1 and 350),
 image text not null check(image ~ '^(\./img/category-(bedding|towels|child)\.webp|[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg)$'),
 position integer not null default 100 check(position between 0 and 9999),
 archived boolean not null default false
);
insert into public.categories(slug,kind,name,description,image,position) values
 ('postelnoe-belie','adult','Постельное бельё','Постельное бельё на заказ по вашим размерам. Комплекты и отдельные изделия для дома.','./img/category-bedding.webp',10),
 ('polotentsa','towel','Полотенца','Мягкие полотенца для рук, лица и ванной. Выберите готовое изделие или соберите набор.','./img/category-towels.webp',20),
 ('detskoe-postelnoe-belie','child','Детское постельное бельё','Бельё для детской кроватки. Подберите рисунок и соберите комплект по размеру матраса.','./img/category-child.webp',30);

alter table public.fabrics add column category_slug text references public.categories(slug);
create table public.products (
 id uuid primary key default gen_random_uuid(),
 category_slug text not null references public.categories(slug),
 name text not null check(length(trim(name)) between 1 and 100),
 description text not null default '' check(length(description)<=500),
 material text not null check(length(trim(material)) between 1 and 100),
 image text not null check(image ~ '^(\./img/category-(bedding|towels|child)\.webp|[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg)$'),
 sizes text[] not null check(cardinality(sizes) between 1 and 30 and length(array_to_string(sizes,','))<=900),
 colors text[] not null check(cardinality(colors) between 1 and 30 and length(array_to_string(colors,','))<=600),
 custom_size boolean not null default false,
 pricing text not null check(pricing in ('fixed','custom')),
 price integer not null check(price between 0 and 100000),
 fabric_id uuid references public.fabrics(id),
 available boolean not null default true,
 hidden boolean not null default false,
 check((pricing='fixed' and fabric_id is null and not custom_size and price>0) or (pricing='custom' and fabric_id is not null))
);
create index products_category on public.products(category_slug);
alter table public.orders alter column fabric_id drop not null,
 add column category_slug text not null default 'postelnoe-belie' references public.categories(slug),
 add column category_name text not null default 'Постельное бельё',
 add column product_id uuid references public.products(id),
 add column product_config jsonb,
 drop constraint orders_items_check,
 add constraint order_contents check(jsonb_typeof(items)='array' and (
   (product_id is null and fabric_id is not null and product_config is null and jsonb_array_length(items) between 1 and 4)
   or (product_id is not null and product_config is not null and jsonb_array_length(items)=0)
 ));
create index orders_category_recent on public.orders(category_slug,created_at desc);

create or replace function workshop_private.order_history() returns trigger language plpgsql set search_path='' as $$
begin
 if new.product_id is null then perform workshop_private.validate_items(new.items); end if;
 if tg_op='INSERT' then new.history:='[]';
 elsif (to_jsonb(old)-'owner_unread'-'customer_unread')=(to_jsonb(new)-'owner_unread'-'customer_unread') then return new;
 else new.history:=old.history;
 end if;
 new.history:=new.history||jsonb_build_array(jsonb_build_object('at',now(),'status',new.status,'paid',new.paid,'final_price',new.final_price));
 return new;
end $$;

alter table public.categories enable row level security;
alter table public.products enable row level security;
revoke all on public.categories,public.products from public,anon,authenticated;
grant select,insert,update on public.categories,public.products to authenticated;
create policy categories_owner on public.categories to authenticated using(public.owner_status()) with check(public.owner_status());
create policy products_owner on public.products to authenticated using(public.owner_status()) with check(public.owner_status());

create function public.assortment() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.position,c.name) from public.categories c where not c.archived),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(to_jsonb(p)-'fabric_id'-'hidden'-'price'||jsonb_build_object(
   'price',case when p.pricing='fixed' then p.price end,
   'available',p.available and (p.pricing='fixed' or (f.available and not f.hidden and f.stock>0)))
   order by p.name) from public.products p join public.categories c on c.slug=p.category_slug
   left join public.fabrics f on f.id=p.fabric_id where not p.hidden and not c.archived),'[]'::jsonb),
 'fabric_categories',coalesce((select jsonb_object_agg(f.id,f.category_slug) from public.fabrics f where not f.hidden and f.category_slug is not null),'{}'::jsonb)
 )
$$;

create function workshop_private.bedding_category(p jsonb,f public.fabrics) returns public.categories
language plpgsql stable set search_path='' as $$
declare c public.categories;
begin
 select * into c from public.categories where slug=coalesce(p->>'category_slug','postelnoe-belie') and not archived and kind in ('adult','child');
 if c.slug is null or (f.category_slug is not null and f.category_slug<>c.slug) then raise exception 'Выберите доступную ткань для этой категории.';end if;
 return c;
end $$;

create function workshop_private.product_quote(p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare d public.products;c public.categories;f public.fabrics; rules jsonb; result jsonb; q numeric;
 size text:=p->>'size'; color text:=p->>'color'; dims text[]; part text;
 dimensions jsonb:='[]'; w int;l int; total numeric;
begin
 if p is null or octet_length(p::text)>10000 or jsonb_typeof(p->'qty') is distinct from 'number' then raise exception 'Проверьте параметры товара.';end if;
 select * into d from public.products where id=(p->>'product_id')::uuid and available and not hidden;
 select * into c from public.categories where slug=d.category_slug and not archived;
 q:=(p->>'qty')::numeric;
 if c.slug is null or q<>trunc(q) or q not between 1 and 12 or not coalesce(color=any(d.colors),false) then raise exception 'Товар или выбранный вариант недоступен.';end if;
 if not coalesce(size=any(d.sizes),false) and not (d.custom_size and coalesce(size ~ '^[1-9][0-9]{1,2} × [1-9][0-9]{1,2}$',false)) then raise exception 'Выберите доступный размер.';end if;
 if d.pricing='fixed' then total:=d.price*q;
 else
   select * into f from public.fabrics where id=d.fabric_id and available and not hidden and stock>0;
   if f.id is null or (f.category_slug is not null and f.category_slug<>c.slug) or not (color=any(f.colors)) then raise exception 'Материал или расцветка недоступны.';end if;
   select s.rules into rules from public.settings s where id=1;
   rules:=jsonb_set(rules,'{labor,sheet}',to_jsonb(d.price));
   if size !~ '^[1-9][0-9]{1,2} × [1-9][0-9]{1,2}(; [1-9][0-9]{1,2} × [1-9][0-9]{1,2}){0,3}$' then raise exception 'Проверьте формат размеров.';end if;
   foreach part in array string_to_array(size,'; ') loop
     dims:=string_to_array(part,' × ');w:=dims[1]::int;l:=dims[2]::int;
     if w not between 20 and 400 or l not between 20 and 400 then raise exception 'Укажите размеры от 20 до 400 см.';end if;
     result:=workshop_private.calc(jsonb_build_array(jsonb_build_object('type','sheet','w',w,'l',l,'qty',q)),f,rules);
     if result is null then raise exception 'Изделие не помещается по ширине ткани.';end if;
     dimensions:=dimensions||jsonb_build_array(result);
   end loop;
   select sum((a->>'price')::numeric) into total from jsonb_array_elements(dimensions) as e(a);
 end if;
 return jsonb_build_object('price',total,'pricing',d.pricing,'category_slug',c.slug,'category_name',c.name,'name',d.name,'fabric_id',d.fabric_id,'material',d.material,'size',size,'color',color,'qty',q,
  'extra_cost',coalesce((rules->>'extra')::numeric,0)*jsonb_array_length(dimensions),'meters',(select sum((a->>'meters')::numeric) from jsonb_array_elements(dimensions) as e(a)),
  'cost',(select sum((a->>'cost')::numeric) from jsonb_array_elements(dimensions) as e(a)));
end $$;

create function public.estimate_product(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb;
begin
 perform workshop_private.limit_request('estimate',workshop_private.client_ip(),150,60);
 q:=workshop_private.product_quote(p);
 return jsonb_build_object('price',q->'price','pricing',q->'pricing');
end $$;

create function public.place_product_order(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();n uuid;oid uuid;q jsonb;
begin
 if u is null then raise exception 'Для отправки заказа нужна сессия покупателя.';end if;
 if p is null or octet_length(p::text)>10000 or p->'consent' is distinct from 'true'::jsonb then raise exception 'Проверьте данные и подтвердите согласие.';end if;
 n:=(p->>'nonce')::uuid;
 if n is null then raise exception 'Обновите черновик заказа.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||n::text,0));
 select id into oid from public.orders where customer_id=u and nonce=n;
 if oid is not null then return oid;end if;
 perform workshop_private.limit_request('order-user',u::text,5,3600);
 perform workshop_private.limit_request('order-ip',workshop_private.client_ip(),35,3600);
 q:=workshop_private.product_quote(p);
 if (p->>'expected_price')::numeric is distinct from (q->>'price')::numeric then raise exception 'Цена изменилась. Рассчитайте стоимость ещё раз.';end if;
 insert into public.orders(customer_id,nonce,category_slug,category_name,product_id,product_config,fabric_id,fabric_name,color,items,customer,contact,delivery,delivery_note,comment,estimate,final_price,meters,cost,extra_cost,consent_at)
 values(u,n,q->>'category_slug',q->>'category_name',(p->>'product_id')::uuid,q-'price'-'cost'-'meters'-'extra_cost'-'fabric_id',(q->>'fabric_id')::uuid,q->>'name',q->>'color','[]',
 trim(p->>'customer'),trim(p->>'contact'),p->>'delivery',coalesce(p->>'delivery_note',''),coalesce(p->>'comment',''),(q->>'price')::numeric,
 case when q->>'pricing'='fixed' then (q->>'price')::numeric end,(q->>'meters')::numeric,(q->>'cost')::numeric,(q->>'extra_cost')::numeric,now()) returning id into oid;
 return oid;
end $$;

create function public.my_orders_assortment() returns table(id uuid,created_at timestamptz,fabric_id uuid,fabric_name text,color text,items jsonb,comment text,status text,estimate numeric,final_price numeric,due date,owner_unread boolean,category_slug text,category_name text,product_id uuid,product_config jsonb)
language sql stable security definer set search_path='' as $$
 select o.id,o.created_at,o.fabric_id,o.fabric_name,o.color,o.items,o.comment,o.status,o.estimate,o.final_price,o.due,o.owner_unread,o.category_slug,o.category_name,o.product_id,o.product_config
 from public.orders o where o.customer_id=auth.uid() order by o.created_at desc
$$;

revoke all on function public.assortment(),public.estimate_product(jsonb),public.place_product_order(jsonb),public.my_orders_assortment() from public,anon,authenticated;
grant execute on function public.assortment(),public.estimate_product(jsonb),public.my_orders_assortment() to anon,authenticated;
grant execute on function public.place_product_order(jsonb) to authenticated;

create or replace function public.estimate_order(p jsonb) returns numeric language plpgsql security definer set search_path='' as $$
declare f public.fabrics; r jsonb; result jsonb;
begin
 perform workshop_private.limit_request('estimate',workshop_private.client_ip(),150,60);
 if p is null or octet_length(p::text)>6500 then raise exception 'Проверьте комплектацию.';end if;
 select * into f from public.fabrics where id=(p->>'fabric_id')::uuid and available and not hidden and stock>0;
 if f.id is null or not coalesce(p->>'color'=any(f.colors),false) then raise exception 'Выберите доступную ткань и расцветку.';end if;
 perform workshop_private.bedding_category(p,f);
 select rules into r from public.settings where id=1;
 result:=workshop_private.calc(p->'items',f,r);
 if result is null then raise exception 'Деталь не помещается по ширине рулона. Стоимость рассчитает мастер.';end if;
 return (result->>'price')::numeric;
end $$;
create or replace function public.place_order(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n uuid; oid uuid; f public.fabrics;r jsonb;c jsonb; category public.categories;
begin
 if u is null then raise exception 'Для отправки заказа нужна сессия покупателя.';end if;
 if p is null or octet_length(p::text)>10000 or p->'consent' is distinct from 'true'::jsonb then raise exception 'Проверьте данные и подтвердите согласие.';end if;
 n:=(p->>'nonce')::uuid;
 if n is null then raise exception 'Обновите черновик заказа.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||n::text,0));
 select id into oid from public.orders where customer_id=u and nonce=n;
 if oid is not null then return oid;end if;
 perform workshop_private.limit_request('order-user',u::text,5,3600);
 perform workshop_private.limit_request('order-ip',workshop_private.client_ip(),35,3600);
 select * into f from public.fabrics where id=(p->>'fabric_id')::uuid and available and not hidden and stock>0;
 if f.id is null or not coalesce(p->>'color'=any(f.colors),false) then raise exception 'Выберите доступную ткань и расцветку.';end if;
 category:=workshop_private.bedding_category(p,f);
 select rules into r from public.settings where id=1;
 c:=workshop_private.calc(p->'items',f,r);
 insert into public.orders(customer_id,nonce,category_slug,category_name,fabric_id,fabric_name,color,items,customer,contact,delivery,delivery_note,comment,estimate,meters,cost,extra_cost,consent_at)
 values(u,n,category.slug,category.name,f.id,f.name,p->>'color',p->'items',trim(p->>'customer'),trim(p->>'contact'),p->>'delivery',coalesce(p->>'delivery_note',''),coalesce(p->>'comment',''),(c->>'price')::numeric,(c->>'meters')::numeric,(c->>'cost')::numeric,(r->>'extra')::numeric,now())
 returning id into oid;
 return oid;
end $$;

commit;
