begin;
create schema if not exists workshop_private;
revoke all on schema workshop_private from public, anon, authenticated;
create table workshop_private.owners (id uuid primary key references auth.users on delete cascade);
create function public.owner_status() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from workshop_private.owners where id=auth.uid())
$$;
create table public.fabrics (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 material text not null check(length(material) between 1 and 80), composition text not null check(length(composition) between 1 and 100),
 description text not null default '' check(length(description)<=1000),
 colors text[] not null check(cardinality(colors) between 1 and 60 and length(array_to_string(colors,','))<=560),
 width integer not null check(width between 50 and 400), rate numeric not null check(rate between 0 and 100000),
 stock numeric not null default 0 check(stock between 0 and 100000), direction boolean not null default false,
 available boolean not null default true, hidden boolean not null default false, photo text not null check(photo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$')
);
create table public.settings (id integer primary key check(id=1), rules jsonb not null);
insert into public.settings values (1,'{"seam":2,"shrink":5,"labor":{"sheet":450,"fitted":650,"duvet":950,"pillow":240},"elastic":160,"zipper":120,"packaging":120,"extra":0,"markup":25,"discount":0}');
create table public.orders (
 id uuid primary key default gen_random_uuid(), customer_id uuid references auth.users on delete set null,
 nonce uuid, created_at timestamptz not null default now(),
 fabric_id uuid not null references public.fabrics, fabric_name text not null,
 color text not null check(length(color) between 1 and 80), items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 4),
 customer text not null check(length(trim(customer)) between 1 and 80),
 contact text not null check(length(trim(contact)) between 5 and 120),
 delivery text not null check(delivery in ('Самовывоз','Доставка по согласованию')),
 delivery_note text not null default '' check(length(delivery_note)<=500),
 comment text not null default '' check(length(comment)<=1000),
 status text not null default 'Новый заказ' check(status in ('Новый заказ','Уточнение деталей','Цена согласована','В работе','Готов к выдаче','Завершён','Отменён')),
 estimate numeric check(estimate>=0), final_price numeric check(final_price between 0 and 10000000),
 paid numeric not null default 0 check(paid between 0 and 10000000), due date,
 meters numeric check(meters between 0 and 5000), cost numeric check(cost between 0 and 100000000), extra_cost numeric not null default 0 check(extra_cost>=0),
 notes text not null default '' check(length(notes)<=1000), archived boolean not null default false check(not archived or status in ('Завершён','Отменён')),
 history jsonb not null default '[]', consent_at timestamptz, owner_unread boolean not null default false, customer_unread boolean not null default false,
 unique(customer_id,nonce)
);
create index orders_customer_recent on public.orders(customer_id,created_at desc);
create index orders_status_recent on public.orders(status,created_at desc);
create table public.messages (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete cascade,
 sender uuid references auth.users on delete set null, created_at timestamptz not null default now(),
 body text not null default '' check(length(body)<=2000), photo text,
 check(length(trim(body))>0 or photo is not null)
);
create index messages_order_recent on public.messages(order_id,created_at desc);
create index messages_sender_recent on public.messages(sender,created_at desc);
create table workshop_private.throttle (
 bucket text not null, actor text not null, window_start timestamptz not null, count integer not null,
 primary key(bucket,actor,window_start)
);
create function workshop_private.limit_request(b text, a text, maximum integer, seconds integer) returns void
language plpgsql set search_path='' as $$
declare n integer; w timestamptz:=to_timestamp(floor(extract(epoch from now())/seconds)*seconds);
begin
 delete from workshop_private.throttle where window_start<now()-interval '2 days';
 insert into workshop_private.throttle values(b,a,w,1) on conflict(bucket,actor,window_start)
 do update set count=workshop_private.throttle.count+1 returning count into n;
 if n>maximum then raise exception 'Слишком много запросов. Попробуйте позже.'; end if;
end $$;
create function workshop_private.client_ip() returns text language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'cf-connecting-ip','unknown')
$$;
create function workshop_private.validate_items(items jsonb) returns void language plpgsql set search_path='' as $$
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
create function workshop_private.validate_rules() returns trigger language plpgsql set search_path='' as $$
declare k text; v numeric; maximum numeric;
begin
 if jsonb_typeof(new.rules) is distinct from 'object' or octet_length(new.rules::text)>2000 then raise exception 'Проверьте настройки расчёта.';end if;
 foreach k in array array['seam','shrink','elastic','zipper','packaging','extra','markup','discount'] loop
  maximum:=case k when 'seam' then 20 when 'shrink' then 30 when 'markup' then 500 when 'discount' then 100 else 100000 end;
  if jsonb_typeof(new.rules->k) is distinct from 'number' then raise exception 'Заполните числовые настройки расчёта.';end if;
  v:=(new.rules->>k)::numeric;
  if v not between 0 and maximum then raise exception 'Значение настройки выходит за допустимые пределы.';end if;
 end loop;
 foreach k in array array['sheet','fitted','duvet','pillow'] loop
  if jsonb_typeof(new.rules->'labor'->k) is distinct from 'number' or (new.rules->'labor'->>k)::numeric not between 0 and 100000 then raise exception 'Проверьте стоимость пошива.';end if;
 end loop;
 return new;
end $$;
create trigger validate_settings before insert or update on public.settings for each row execute function workshop_private.validate_rules();
create function workshop_private.calc(p jsonb,f public.fabrics,r jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare i jsonb;t text;k integer;q integer;w numeric;l numeric;d numeric;flap numeric;
 s numeric:=(r->>'seam')::numeric; factor numeric:=1/(1-(r->>'shrink')::numeric/100);
 labor numeric:=0;hardware numeric:=0;parts jsonb:='[]';rec record;j integer;packed boolean;
 widths numeric[]:='{}';lengths numeric[]:='{}';meters numeric;cost numeric;
begin
 perform workshop_private.validate_items(p);
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
 if exists(select 1 from jsonb_array_elements(parts) p(a) where (a->>0)::numeric>f.width and (f.direction or (a->>1)::numeric>f.width)) then return null;end if;
 for rec in select case when turn then l0 else w0 end as w,case when turn then w0 else l0 end as l
  from (select w0,l0,not f.direction and l0<=f.width and (w0>f.width or w0<l0) as turn
        from (select (a->>0)::numeric w0,(a->>1)::numeric l0 from jsonb_array_elements(parts) p(a)) x) y
  order by 2 desc loop
  packed:=false;
  for j in 1..cardinality(widths) loop
   if widths[j]+rec.w<=f.width and lengths[j]>=rec.l then widths[j]:=widths[j]+rec.w;packed:=true;exit;end if;
  end loop;
  if not packed then widths:=array_append(widths,rec.w);lengths:=array_append(lengths,rec.l);end if;
 end loop;
 select ceil(sum(m)/10)/10 into meters from unnest(lengths) m;
 cost:=round(meters*f.rate+labor+hardware+(r->>'packaging')::numeric+(r->>'extra')::numeric);
 return jsonb_build_object('meters',meters,'cost',cost,'price',round(cost*(1+(r->>'markup')::numeric/100)*(1-(r->>'discount')::numeric/100)));
end $$;
create function workshop_private.order_history() returns trigger language plpgsql set search_path='' as $$
begin
 perform workshop_private.validate_items(new.items);
 if tg_op='INSERT' then new.history:='[]';
 elsif (to_jsonb(old)-'owner_unread'-'customer_unread')=(to_jsonb(new)-'owner_unread'-'customer_unread') then return new;
 else new.history:=old.history;
 end if;
 new.history:=new.history||jsonb_build_array(jsonb_build_object('at',now(),'status',new.status,'paid',new.paid,'final_price',new.final_price));
 return new;
end $$;
create trigger record_order_change before insert or update on public.orders for each row execute function workshop_private.order_history();
create function public.catalog() returns table(id uuid,name text,material text,composition text,description text,colors text[],width integer,available boolean,photo text)
language sql stable security definer set search_path='' as $$
 select f.id,f.name,f.material,f.composition,f.description,f.colors,f.width,f.available and f.stock>0,f.photo
 from public.fabrics f where not f.hidden order by f.name
$$;
create function public.estimate_order(p jsonb) returns numeric language plpgsql security definer set search_path='' as $$
declare f public.fabrics; r jsonb; result jsonb;
begin
 perform workshop_private.limit_request('estimate',workshop_private.client_ip(),150,60);
 if p is null or octet_length(p::text)>6500 then raise exception 'Проверьте комплектацию.';end if;
 select * into f from public.fabrics where id=(p->>'fabric_id')::uuid and available and not hidden and stock>0;
 if f.id is null or not coalesce(p->>'color'=any(f.colors),false) then raise exception 'Выберите доступную ткань и расцветку.';end if;
 select rules into r from public.settings where id=1;
 result:=workshop_private.calc(p->'items',f,r);
 if result is null then raise exception 'Деталь не помещается по ширине рулона. Стоимость рассчитает мастер.';end if;
 return (result->>'price')::numeric;
end $$;
create function public.place_order(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n uuid; oid uuid; f public.fabrics;r jsonb;c jsonb;
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
 select rules into r from public.settings where id=1;
 c:=workshop_private.calc(p->'items',f,r);
 insert into public.orders(customer_id,nonce,fabric_id,fabric_name,color,items,customer,contact,delivery,delivery_note,comment,estimate,meters,cost,extra_cost,consent_at)
 values(u,n,f.id,f.name,p->>'color',p->'items',trim(p->>'customer'),trim(p->>'contact'),p->>'delivery',coalesce(p->>'delivery_note',''),coalesce(p->>'comment',''),(c->>'price')::numeric,(c->>'meters')::numeric,(c->>'cost')::numeric,(r->>'extra')::numeric,now())
 returning id into oid;
 return oid;
end $$;
create function public.my_orders() returns table(id uuid,created_at timestamptz,fabric_id uuid,fabric_name text,color text,items jsonb,comment text,status text,estimate numeric,final_price numeric,due date,owner_unread boolean)
language sql stable security definer set search_path='' as $$
 select o.id,o.created_at,o.fabric_id,o.fabric_name,o.color,o.items,o.comment,o.status,o.estimate,o.final_price,o.due,o.owner_unread
 from public.orders o where o.customer_id=auth.uid() order by o.created_at desc
$$;
create function public.can_chat(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.orders where id=oid and (customer_id=auth.uid() or public.owner_status()))
$$;
create function public.chat_file_allowed(p text) returns boolean language sql stable security definer set search_path='' as $$
 select case when p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' then
  case when split_part(p,'/',1) ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then public.can_chat(split_part(p,'/',1)::uuid) else false end
  else false end
$$;
create function public.send_chat(oid uuid,txt text,pic text) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid;
begin
 if not public.can_chat(oid) then raise exception 'Переписка недоступна.';end if;
 perform workshop_private.limit_request('chat',auth.uid()::text,30,60);
 if txt is null or length(txt)>2000 or (length(trim(txt))=0 and pic is null) then raise exception 'Напишите сообщение или прикрепите фото.';end if;
 if pic is not null and (split_part(pic,'/',1)<>oid::text or not exists(select 1 from storage.objects s where s.bucket_id='chat' and s.name=pic and s.owner_id=auth.uid()::text)) then raise exception 'Фото недоступно.';end if;
 insert into public.messages(order_id,sender,body,photo) values(oid,auth.uid(),trim(txt),pic) returning id into mid;
 if public.owner_status() then update public.orders set owner_unread=true where id=oid;
 else update public.orders set customer_unread=true where id=oid;end if;
 return mid;
end $$;
create function public.read_chat(oid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_chat(oid) then raise exception 'Переписка недоступна.';end if;
 if public.owner_status() then update public.orders set customer_unread=false where id=oid and customer_unread;
 else update public.orders set owner_unread=false where id=oid and owner_unread;end if;
end $$;
create function public.delete_order(oid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.owner_status() then raise exception 'Доступ закрыт.';end if;
 if exists(select 1 from storage.objects where bucket_id='chat' and split_part(name,'/',1)=oid::text) then
  raise exception 'Сначала удалите фотографии переписки через хранилище.';
 end if;
 delete from public.orders where id=oid;
end $$;
alter table public.fabrics enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.settings enable row level security;
alter table workshop_private.owners enable row level security;
alter table workshop_private.throttle enable row level security;
revoke all on public.fabrics,public.orders,public.messages,public.settings from anon,authenticated;
grant select,insert,update on public.fabrics,public.orders to authenticated;
grant select on public.messages to authenticated;
grant select,update on public.settings to authenticated;
create policy owner_fabrics on public.fabrics for all to authenticated using (public.owner_status()) with check(public.owner_status());
create policy owner_orders on public.orders for all to authenticated using (public.owner_status()) with check(public.owner_status());
create policy owner_settings on public.settings for all to authenticated using (public.owner_status()) with check(public.owner_status());
create policy participant_messages on public.messages for select to authenticated using (public.can_chat(order_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('fabrics','fabrics',true,2097152,array['image/jpeg']),
 ('chat','chat',false,2097152,array['image/jpeg']);
create policy owner_fabric_files on storage.objects for all to authenticated
 using(bucket_id='fabrics' and public.owner_status()) with check(bucket_id='fabrics' and public.owner_status() and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create policy chat_read_files on storage.objects for select to authenticated using(bucket_id='chat' and public.chat_file_allowed(name));
create policy chat_create_files on storage.objects for insert to authenticated with check(bucket_id='chat' and public.chat_file_allowed(name));
create policy chat_delete_files on storage.objects for delete to authenticated using(bucket_id='chat' and public.owner_status());
revoke all on function public.owner_status(),public.catalog(),public.estimate_order(jsonb),public.place_order(jsonb),public.my_orders(),public.can_chat(uuid),public.chat_file_allowed(text),public.send_chat(uuid,text,text),public.read_chat(uuid),public.delete_order(uuid) from public,anon,authenticated;
grant execute on function public.catalog(),public.estimate_order(jsonb),public.my_orders() to anon,authenticated;
grant execute on function public.owner_status(),public.place_order(jsonb),public.can_chat(uuid),public.chat_file_allowed(text),public.send_chat(uuid,text,text),public.read_chat(uuid),public.delete_order(uuid) to authenticated;
alter publication supabase_realtime add table public.messages;
commit;
