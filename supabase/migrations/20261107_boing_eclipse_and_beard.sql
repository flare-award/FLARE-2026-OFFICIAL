-- Preserve nominee IDs/votes and past purchases. New optional cosmetics only.
begin;
update public.flare_options set kind='image' where id='sos-1';
insert into public.flare_boing_items(id,kind,name,description,base_price,max_level,sort_order) values
('frame-eclipse','frame','ECLIPSE FRAME','Тёмный обод затмения с вращающейся платиново-золотой короной.',55000,1,55),
('bob-beard','accessory','BOB BEARD','Короткая чёрная щетина по нижней дуге BOB.',1000,1,69)
on conflict(id) do update set kind=excluded.kind,name=excluded.name,description=excluded.description,base_price=excluded.base_price,max_level=excluded.max_level,sort_order=excluded.sort_order;
update public.flare_boing_items set sort_order=99 where id='banner-custom';
commit;
