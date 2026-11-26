-- Тихое утро 1.3. Сначала отключите регистрацию в Auth и создайте владельца через Studio.
-- Замените единственный адрес ниже на email этого пользователя и выполните весь файл.
begin;
set local tihoe.owner_email = 'replace-owner@example.invalid';

create schema if not exists workshop_private;
revoke all on schema workshop_private from public, anon, authenticated;

create table if not exists workshop_private.site_owners (
 id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists workshop_private.storefront (
 id boolean primary key default true check(id),
 revision integer not null default 0,
 published_revision integer not null default 0,
 draft jsonb not null,
 live jsonb not null,
 public_doc jsonb not null,
 public_media text[] not null default '{}'
);
revoke all on workshop_private.site_owners,workshop_private.storefront from public,anon,authenticated;
alter table workshop_private.site_owners enable row level security;
alter table workshop_private.storefront enable row level security;

do $$
declare owner_id uuid;
begin
 select id into owner_id from auth.users
 where lower(email)=lower(current_setting('tihoe.owner_email')) and email_confirmed_at is not null and not is_anonymous;
 if owner_id is null then raise exception 'Создайте подтверждённого владельца в Auth и укажите его email в начале файла.';end if;
 insert into workshop_private.site_owners(id) values(owner_id) on conflict do nothing;
end $$;

create or replace function public.storefront_is_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from workshop_private.site_owners where id=auth.uid())
$$;

create or replace function workshop_private.pick(data jsonb, keys text[]) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(data) where key=any(keys)
$$;

create or replace function workshop_private.public_storefront(data jsonb) returns jsonb
language sql stable set search_path='' as $$
 with categories as (
  select element as c from jsonb_array_elements(data->'categories') element where not coalesce((element->>'archived')::boolean,false)
 ), fabrics as (
  select element as f from jsonb_array_elements(data->'fabrics') element
  where not coalesce((element->>'hidden')::boolean,false)
    and (element->>'category_slug' is null or exists(select 1 from categories where c->>'slug'=element->>'category_slug'))
 ), products as (
  select element as p,f from jsonb_array_elements(data->'products') element
  left join fabrics on f->>'id'=element->>'fabric_id'
  where not coalesce((element->>'hidden')::boolean,false) and exists(select 1 from categories where c->>'slug'=element->>'category_slug')
 )
 select jsonb_build_object(
 'home',workshop_private.pick(data->'home',array['eyebrow','title','description','hero','heroAlt','logo']),
 'contact',workshop_private.pick(data->'contact',array['telegram','vk','phone','description','delivery']),
 'promo',case when (data->'promo'->>'enabled')::boolean then workshop_private.pick(data->'promo',array['title','text','enabled']) else '{"enabled":false}'::jsonb end,
 'notice',case when (data->'notice'->>'enabled')::boolean then workshop_private.pick(data->'notice',array['title','text','enabled']) else '{"enabled":false}'::jsonb end,
 'categories',coalesce((select jsonb_agg(workshop_private.pick(c,array['slug','kind','name','description','image','position','presets']) order by (c->>'position')::integer,c->>'name') from categories),'[]'::jsonb),
 'fabrics',coalesce((select jsonb_agg(workshop_private.pick(f,array['id','category_slug','name','material','composition','description','colors','width','photo'])||
   jsonb_build_object('available',(f->>'available')::boolean and (f->>'stock')::numeric>0) order by f->>'name') from fabrics),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(workshop_private.pick(p,array['id','category_slug','name','description','material','image','sizes','custom_size','pricing'])||
   jsonb_build_object('available',(p->>'available')::boolean and (p->>'pricing'='fixed' or coalesce((f->>'available')::boolean and (f->>'stock')::numeric>0 and
     (f->>'category_slug' is null or f->>'category_slug'=p->>'category_slug') and (p->'colors') ?| array(select jsonb_array_elements_text(f->'colors')),false)),
    'colors',case when p->>'pricing'='fixed' then p->'colors' else to_jsonb(array(select color from jsonb_array_elements_text(p->'colors') color where (f->'colors') ? color)) end,
    'price',case when p->>'pricing'='fixed' then p->'price' end) order by p->>'name') from products),'[]'::jsonb)
 )
$$;

create or replace function workshop_private.media_paths(data jsonb) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct path),'{}') from (
  select data->'home'->>'hero' as path union all select data->'home'->>'logo'
  union all select x->>'image' from jsonb_array_elements(data->'categories') x
  union all select x->>'image' from jsonb_array_elements(data->'products') x
  union all select x->>'photo' from jsonb_array_elements(data->'fabrics') x
 ) photos where path ~ '^[0-9a-f-]{36}\.jpg$'
$$;

create or replace function workshop_private.valid_image(path text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(path ~ '^(\./img/[a-z0-9-]+\.(webp|svg|png)|[0-9a-f-]{36}\.jpg)$',false)
$$;
create or replace function workshop_private.num(value text, lo numeric, hi numeric) returns boolean
language sql immutable set search_path='' as $$
 select case when value ~ '^[0-9]{1,8}(\.[0-9]{1,4})?$' then value::numeric between lo and hi else false end
$$;
create or replace function workshop_private.validate_site(data jsonb) returns void
language plpgsql stable set search_path='' as $$
declare k text;j jsonb; r jsonb;section jsonb;
begin
 if data is null or jsonb_typeof(data) is distinct from 'object' or octet_length(data::text)>400000 then raise exception 'Содержимое витрины слишком большое или имеет неверный формат.';end if;
 foreach k in array array['home','contact','notice','promo','rules'] loop
  if jsonb_typeof(data->k) is distinct from 'object' then raise exception 'Заполните настройки витрины.';end if;
 end loop;
 foreach k in array array['categories','products','fabrics'] loop
  if jsonb_typeof(data->k) is distinct from 'array' then raise exception 'Проверьте ассортимент.';end if;
  if jsonb_array_length(data->k)>(case when k='categories' then 80 else 300 end) then raise exception 'Слишком много позиций в ассортименте.';end if;
 end loop;
 if length(trim(coalesce(data->'home'->>'title',''))) not between 1 and 120 or
    length(coalesce(data->'home'->>'description',''))>350 or
    not workshop_private.valid_image(data->'home'->>'hero') or not workshop_private.valid_image(data->'home'->>'logo')
 then raise exception 'Проверьте заголовок и изображения главной страницы.';end if;
 foreach k in array array['promo','notice'] loop
   section:=data->k;
   if jsonb_typeof(section->'enabled') is distinct from 'boolean' or
      length(coalesce(section->>'title',''))>120 or length(coalesce(section->>'text',''))>500
   then raise exception 'Проверьте настройки объявления.';end if;
 end loop;
 section:=data->'contact';
 if length(coalesce(section->>'description',''))>500 or length(coalesce(section->>'delivery',''))>700 or
    coalesce(section->>'telegram','') !~ '^(@?[a-zA-Z][a-zA-Z0-9_]{4,31})?$' or
    coalesce(section->>'vk','') !~ '^(@?[a-zA-Z0-9_.-]{2,64})?$' or
    coalesce(section->>'phone','') !~ '^([+0-9 ()-]{5,30})?$'
 then raise exception 'Проверьте контакты и условия доставки.';end if;
 r:=data->'rules';
 if not workshop_private.num(r->>'seam',0,20) or not workshop_private.num(r->>'shrink',0,30) or
    not workshop_private.num(r->>'markup',0,500) or not workshop_private.num(r->>'discount',0,100) then raise exception 'Проверьте правила расчёта.';end if;
 foreach k in array array['elastic','zipper','packaging','extra'] loop
  if not workshop_private.num(r->>k,0,100000) then raise exception 'Проверьте правила расчёта.';end if;
 end loop;
 foreach k in array array['sheet','fitted','duvet','pillow'] loop
  if not workshop_private.num(r->'labor'->>k,0,100000) then raise exception 'Проверьте стоимость пошива.';end if;
 end loop;
 for j in select value from jsonb_array_elements(data->'categories') loop
  if coalesce(j->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(j->>'slug')>64 or
     coalesce(j->>'kind','') not in ('adult','child','towel') or length(trim(coalesce(j->>'name',''))) not between 1 and 90 or
     not workshop_private.num(j->>'position',0,9999) or not workshop_private.valid_image(j->>'image') then raise exception 'Проверьте категорию.';end if;
 end loop;
 for j in select value from jsonb_array_elements(data->'fabrics') loop
  if coalesce(j->>'id','') !~ '^[0-9a-f-]{36}$' or length(trim(coalesce(j->>'name',''))) not between 1 and 100 or
     not workshop_private.num(j->>'width',50,400) or not workshop_private.num(j->>'rate',0,100000) or
     not workshop_private.num(j->>'stock',0,100000) or not workshop_private.valid_image(j->>'photo') or
     jsonb_typeof(j->'colors') is distinct from 'array' or jsonb_array_length(j->'colors') not between 1 and 60
  then raise exception 'Проверьте ткань.';end if;
 end loop;
 for j in select value from jsonb_array_elements(data->'products') loop
  if coalesce(j->>'id','') !~ '^[0-9a-f-]{36}$' or length(trim(coalesce(j->>'name',''))) not between 1 and 100 or
     coalesce(j->>'pricing','') not in ('fixed','custom') or not workshop_private.num(j->>'price',0,100000) or
     not workshop_private.valid_image(j->>'image') or jsonb_typeof(j->'sizes') is distinct from 'array' or
     jsonb_array_length(j->'sizes') not between 1 and 30 or jsonb_typeof(j->'colors') is distinct from 'array' or
     jsonb_array_length(j->'colors') not between 1 and 30 then raise exception 'Проверьте товар.';end if;
 end loop;
 if exists(select 1 from unnest(workshop_private.media_paths(data)) path
   where not exists(select 1 from storage.objects o where o.bucket_id='site-media' and o.name=path)) then
   raise exception 'Одно из изображений не найдено. Загрузите его повторно.';
 end if;
end $$;

create or replace function public.storefront_snapshot() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('revision',published_revision,'content',public_doc) from workshop_private.storefront where id
$$;
create or replace function public.storefront_draft() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.storefront_is_owner() then raise exception 'Доступ к редактору закрыт.' using errcode='42501';end if;
 return (select jsonb_build_object('revision',revision,'published_revision',published_revision,'draft',draft) from workshop_private.storefront where id);
end $$;
create or replace function public.save_storefront_draft(expected integer,content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.storefront_is_owner() then raise exception 'Доступ к редактору закрыт.' using errcode='42501';end if;
 perform workshop_private.validate_site(content);
 update workshop_private.storefront set draft=content,revision=revision+1 where id and revision=expected;
 if not found then raise exception 'Черновик изменился на другом устройстве. Откройте редактор заново.';end if;
 return public.storefront_draft();
end $$;
create or replace function public.publish_storefront(expected integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare data jsonb; visible jsonb;
begin
 if not public.storefront_is_owner() then raise exception 'Право публикации есть только у владельца.' using errcode='42501';end if;
 select draft into data from workshop_private.storefront where id and revision=expected for update;
 if not found then raise exception 'Черновик изменился на другом устройстве. Откройте редактор заново.';end if;
 perform workshop_private.validate_site(data);
 visible:=workshop_private.public_storefront(data);
 update workshop_private.storefront set live=data,public_doc=visible,public_media=workshop_private.media_paths(visible),
   revision=revision+1,published_revision=revision+1 where id;
 return public.storefront_draft();
end $$;

create or replace function public.storefront_media_visible(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from workshop_private.storefront where id and path=any(public_media))
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-media','site-media',false,2097152,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
drop policy if exists storefront_read_media on storage.objects;
drop policy if exists storefront_upload_media on storage.objects;
create policy storefront_read_media on storage.objects for select to anon,authenticated using (
 bucket_id='site-media' and (public.storefront_is_owner() or public.storefront_media_visible(name))
);
create policy storefront_upload_media on storage.objects for insert to authenticated with check (
 bucket_id='site-media' and public.storefront_is_owner() and name ~ '^[0-9a-f-]{36}\.jpg$'
);

create or replace function workshop_private.validate_site_items(items jsonb) returns void language plpgsql set search_path='' as $$
declare i jsonb; t text; w numeric; l numeric; h numeric; q numeric; seen text[]:='{}';
begin
 if items is null or jsonb_typeof(items)<>'array' then raise exception 'Выберите изделия.';end if;
 if jsonb_array_length(items) not between 1 and 4 or octet_length(items::text)>4000 then raise exception 'Проверьте комплектацию.';end if;
 for i in select value from jsonb_array_elements(items) loop
  t:=i->>'type';
  if t is null or t not in ('sheet','fitted','duvet','pillow') or t=any(seen)
    or jsonb_typeof(i->'w') is distinct from 'number' or jsonb_typeof(i->'l') is distinct from 'number'
    or jsonb_typeof(i->'qty') is distinct from 'number' then raise exception 'Проверьте комплектацию и размеры.';end if;
  w:=(i->>'w')::numeric;l:=(i->>'l')::numeric;q:=(i->>'qty')::numeric;
  if w not between 20 and 400 or l not between 20 and 400 or q not between 1 and 12 or w<>trunc(w) or l<>trunc(l) or q<>trunc(q) then raise exception 'Проверьте размеры и количество.';end if;
  if t='fitted' then
   if jsonb_typeof(i->'h') is distinct from 'number' then raise exception 'Укажите высоту матраса.';end if;
   h:=(i->>'h')::numeric;
   if h not between 5 and 60 or h<>trunc(h) then raise exception 'Проверьте высоту матраса.';end if;
  end if;
  if (t='pillow' and coalesce(i->>'closure','') not in ('Клапан','Молния')) or
     (t='duvet' and coalesce(i->>'closure','') not in ('Без застёжки','Молния')) then raise exception 'Проверьте застёжку.';end if;
  seen:=array_append(seen,t);
 end loop;
end $$;
create or replace function workshop_private.calc_site(p jsonb,f jsonb,r jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare i jsonb;t text;k integer;q integer;w numeric;l numeric;d numeric;flap numeric;
 s numeric:=(r->>'seam')::numeric; factor numeric:=1/(1-(r->>'shrink')::numeric/100);
 labor numeric:=0;hardware numeric:=0;parts jsonb:='[]';rec record;j integer;packed boolean;
 widths numeric[]:='{}';lengths numeric[]:='{}';meters numeric;cost numeric;
begin
 perform workshop_private.validate_site_items(p);
 for i in select value from jsonb_array_elements(p) loop
  t:=i->>'type';q:=(i->>'qty')::integer;
  d:=case when t='fitted' then 2*((i->>'h')::numeric+8) else 0 end;
  flap:=case when t='pillow' and i->>'closure'='Клапан' then 20 else 0 end;
  w:=((i->>'w')::numeric+d+2*s)*factor;l:=((i->>'l')::numeric+d+2*s)*factor;
  for k in 1..q loop
   parts:=parts||jsonb_build_array(jsonb_build_array(w,l));
   if t in ('duvet','pillow') then parts:=parts||jsonb_build_array(jsonb_build_array(w,l+flap*factor));end if;
  end loop;
  labor:=labor+q*(r->'labor'->>t)::numeric;
  hardware:=hardware+q*(case when t='fitted' then (r->>'elastic')::numeric when i->>'closure'='Молния' then (r->>'zipper')::numeric else 0 end);
 end loop;
 if exists(select 1 from jsonb_array_elements(parts) p(a) where (a->>0)::numeric>(f->>'width')::numeric and (coalesce((f->>'direction')::boolean,false) or (a->>1)::numeric>(f->>'width')::numeric)) then return null;end if;
 for rec in select case when turn then l0 else w0 end as w,case when turn then w0 else l0 end as l
  from (select w0,l0,not coalesce((f->>'direction')::boolean,false) and l0<=(f->>'width')::numeric and (w0>(f->>'width')::numeric or w0<l0) as turn
        from (select (a->>0)::numeric w0,(a->>1)::numeric l0 from jsonb_array_elements(parts) p(a)) x) y
  order by 2 desc loop
  packed:=false;
  for j in 1..cardinality(widths) loop
   if widths[j]+rec.w<=(f->>'width')::numeric and lengths[j]>=rec.l then widths[j]:=widths[j]+rec.w;packed:=true;exit;end if;
  end loop;
  if not packed then widths:=array_append(widths,rec.w);lengths:=array_append(lengths,rec.l);end if;
 end loop;
 select ceil(sum(m)/10)/10 into meters from unnest(lengths) m;
 cost:=round(meters*(f->>'rate')::numeric+labor+hardware+(r->>'packaging')::numeric+(r->>'extra')::numeric);
 return jsonb_build_object('meters',meters,'cost',cost,'price',round(cost*(1+(r->>'markup')::numeric/100)*(1-(r->>'discount')::numeric/100)));
end $$;
create or replace function public.storefront_quote(p jsonb) returns numeric
language plpgsql stable security definer set search_path='' as $$
declare data jsonb; category jsonb; fabric jsonb; product jsonb; rules jsonb; result jsonb;
 color text:=p->>'color'; size text:=p->>'size'; dims text[]; part text; total numeric:=0; q numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>5000 then raise exception 'Проверьте состав и размеры.';end if;
 select live into data from workshop_private.storefront where id;
 rules:=data->'rules';
 if p ? 'product_id' then
   select x into product from jsonb_array_elements(data->'products') x
     where x->>'id'=p->>'product_id' and x->>'pricing'='custom' and (x->>'available')::boolean and not coalesce((x->>'hidden')::boolean,false);
   if product is null or jsonb_typeof(p->'qty') is distinct from 'number' or not (product->'colors' ? coalesce(color,'')) then raise exception 'Этот товар недоступен для пошива.';end if;
   q:=(p->>'qty')::numeric;
   if q<>trunc(q) or q not between 1 and 12 or coalesce(size,'') !~ '^[1-9][0-9]{1,2} × [1-9][0-9]{1,2}(; [1-9][0-9]{1,2} × [1-9][0-9]{1,2}){0,3}$' then raise exception 'Проверьте размер и количество.';end if;
   if not (product->'sizes' ? size) and not (coalesce((product->>'custom_size')::boolean,false) and position('; ' in size)=0) then raise exception 'Этот размер недоступен.';end if;
 end if;
 select x into category from jsonb_array_elements(data->'categories') x
   where x->>'slug'=coalesce(product->>'category_slug',p->>'category_slug') and not coalesce((x->>'archived')::boolean,false);
 select x into fabric from jsonb_array_elements(data->'fabrics') x
   where x->>'id'=coalesce(product->>'fabric_id',p->>'fabric_id') and (x->>'available')::boolean and
   not coalesce((x->>'hidden')::boolean,false) and (x->>'stock')::numeric>0;
 if category is null or fabric is null or (fabric->>'category_slug' is not null and fabric->>'category_slug'<>category->>'slug') or
    not (fabric->'colors' ? coalesce(color,'')) then raise exception 'Ткань или расцветка сейчас недоступна.';end if;
 if product is null then
   if category->>'kind'='towel' then raise exception 'Выберите изделие в категории полотенец.';end if;
   result:=workshop_private.calc_site(p->'items',fabric,rules);
   if result is null then raise exception 'Деталь не помещается по ширине ткани. Стоимость уточнит мастер.';end if;
   return (result->>'price')::numeric;
 end if;
 rules:=jsonb_set(rules,'{labor,sheet}',product->'price');
 foreach part in array string_to_array(size,'; ') loop
   dims:=string_to_array(part,' × ');
   result:=workshop_private.calc_site(jsonb_build_array(jsonb_build_object('type','sheet','w',dims[1]::int,'l',dims[2]::int,'qty',q::integer)),fabric,rules);
   if result is null then raise exception 'Деталь не помещается по ширине ткани. Стоимость уточнит мастер.';end if;
   total:=total+(result->>'price')::numeric;
 end loop;
 return total;
end $$;

revoke all on function public.storefront_is_owner(),public.storefront_snapshot(),public.storefront_draft(),
 public.save_storefront_draft(integer,jsonb),public.publish_storefront(integer),public.storefront_media_visible(text),public.storefront_quote(jsonb)
 from public,anon,authenticated;
grant execute on function public.storefront_is_owner(),public.storefront_snapshot(),public.storefront_media_visible(text),public.storefront_quote(jsonb) to anon,authenticated;
grant execute on function public.storefront_draft(),public.save_storefront_draft(integer,jsonb),public.publish_storefront(integer) to authenticated;

drop policy if exists owner_fabric_files on storage.objects;
drop policy if exists chat_read_files on storage.objects;
drop policy if exists chat_create_files on storage.objects;
drop policy if exists chat_delete_files on storage.objects;

-- Закрываем старые интерфейсы базы, если на этом проекте ранее применялись миграции 1.0–1.2.
-- Строки и файлы остаются доступны администратору в Studio.
do $$
declare signature text; legacy_table text;
begin
 foreach signature in array array[
   'catalog()','assortment()','estimate_order(jsonb)','estimate_product(jsonb)',
   'place_order(jsonb)','place_product_order(jsonb)','my_orders()','my_orders_assortment()',
   'can_chat(uuid)','chat_file_allowed(text)','send_chat(uuid,text,text)','read_chat(uuid)','delete_order(uuid)','owner_status()'
 ] loop
   if to_regprocedure('public.'||signature) is not null then
     execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
   end if;
 end loop;
 foreach legacy_table in array array['orders','messages','fabrics','settings','categories','products'] loop
   if to_regclass('public.'||legacy_table) is not null then
     execute format('revoke all on table public.%I from public,anon,authenticated',legacy_table);
   end if;
 end loop;
end $$;

with initial as (select $storefront${
 "home": {
  "eyebrow": "Семейная мастерская",
  "title": "Уют, сшитый специально для вас",
  "description": "Шьём постельное бельё по вашим размерам и из выбранной вами ткани.",
  "hero": "./img/hero.webp",
  "heroAlt": "Постельное бельё шалфейного цвета в мягком утреннем свете",
  "logo": "./img/sun.svg"
 },
 "promo": {
  "title": "",
  "text": "",
  "enabled": false
 },
 "notice": {
  "title": "",
  "text": "",
  "enabled": false
 },
 "contact": {
  "telegram": "",
  "vk": "",
  "phone": "",
  "description": "",
  "delivery": ""
 },
 "categories": [
  {
   "slug": "postelnoe-belie",
   "kind": "adult",
   "name": "Постельное бельё",
   "description": "Постельное бельё на заказ по вашим размерам. Комплекты и отдельные изделия для дома.",
   "image": "./img/category-bedding.webp",
   "position": 10
  },
  {
   "slug": "polotentsa",
   "kind": "towel",
   "name": "Полотенца",
   "description": "Мягкие полотенца для рук, лица и ванной. Подберите размеры для индивидуального пошива.",
   "image": "./img/category-towels.webp",
   "position": 20
  },
  {
   "slug": "detskoe-postelnoe-belie",
   "kind": "child",
   "name": "Детское постельное бельё",
   "description": "Бельё для детской кроватки. Подберите рисунок и соберите комплект по размеру матраса.",
   "image": "./img/category-child.webp",
   "position": 30
  }
 ],
 "fabrics": [],
 "products": [],
 "rules": {
  "seam": 2,
  "shrink": 5,
  "labor": {
   "sheet": 450,
   "fitted": 650,
   "duvet": 950,
   "pillow": 240
  },
  "elastic": 160,
  "zipper": 120,
  "packaging": 120,
  "extra": 0,
  "markup": 25,
  "discount": 0
 }
}$storefront$::jsonb as data)
insert into workshop_private.storefront(draft,live,public_doc)
select data,data,workshop_private.public_storefront(data) from initial
on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
