-- Historical honors supplied by the organizer. No invented years and no 2026 vote results.
begin;
create table if not exists public.flare_legacy_awards(
 nickname text not null references public.flare_members(nickname),
 badge_id text not null references public.flare_badges(id),
 win_count integer not null check(win_count>=0),
 primary key(nickname,badge_id)
);
alter table public.flare_legacy_awards enable row level security;
revoke all on public.flare_legacy_awards from public,anon,authenticated;
insert into public.flare_badges(id,name,description,rarity,sort_order) values
('legacy-king-2','FLARE KING · ×2 подряд','Две короны подряд в прошлых сезонах. Трон не освобождал — только поправлял корону.','legendary',100),
('legacy-multigaming-2','MULTIGAMING ГОДА · ×2 подряд','Две победы подряд в прошлых сезонах. Новая игра выходит — он уже в лобби.','legendary',101),
('legacy-conflict-1','КОНФЛИКТ ГОДА · победитель','Совместная победа Akirakume, Eozik, Flourin, Maronnix и Nodben против Fines Stark и Denis_185. Шумели всей командой.','rare',102),
('legacy-conflict-2','КОНФЛИКТ ГОДА · ×2 подряд','Дважды против Fines Stark: сначала один на один, затем с Akirakume, Eozik, Maronnix и Nodben против него и Denis_185. Соперник знакомый.','legendary',103),
('legacy-sos-1','С.О.С. ГОДА · победитель','Выход 4 эпизода «THE FANTASTIC SPIDER-MAN». Дождались продолжения — и сразу выдали награду.','rare',104),
('legacy-track-1','ТРЕК ГОДА · победитель','Совместный трек Maronnix и Eozik — «Лютый гандон». Название без церемоний, победа — с церемонией.','rare',105),
('legacy-scam-1','КИДАЛОВО ГОДА · победитель','Победа Nodben в прошлом сезоне. Планы были общие, а награда за исчезновение — личная.','rare',106),
('legacy-duo-1','ДУО ГОДА · победитель','Dony_zq × Nodben — победный дуэт прошлого сезона. Одна номинация, два заслуженных бейджа.','rare',107),
('legacy-freak-1','ФРИК ГОДА · победитель','Победа в прошлом сезоне. Когда быть обычным уже слишком скучно — получается отдельная номинация.','rare',108),
('legacy-fail-1','ПРОВАЛ ГОДА · победитель','«Встреча Flourin и Nodben» так и не случилась. Встречу отменили, совместную победу — нет.','rare',109),
('legacy-toxic-1','ТОКСИК ГОДА · победитель','Победа в прошлом сезоне. Слова были острые, зато бейдж теперь безобидный.','rare',110),
('legacy-breakthrough-1','ПРОРЫВ ГОДА · победитель','Победа за яркий прорыв в одном из прошлых сезонов. Из «кто это?» — в «без него уже не то».','rare',111),
('legacy-phrase-1','ФРАЗА ГОДА · победитель','«Я НЕ ВЕРЮ» — фраза Eozik, которая забрала номинацию. В победу уже можно поверить.','rare',112),
('legacy-fortnite-2','ЛУЧШИЙ FORTNITE-УЧАСТНИК · ×2','Две победы Dony_zq в прошлых сезонах. Одного титула не хватило — пришлось забирать второй.','legendary',113),
('legacy-meme-2','ЧЕЛОВЕК-МЕМ ГОДА · ×2','Две победы Qusti в прошлых сезонах. Мемы меняются, поставщик остаётся прежним.','legendary',114),
('legacy-event-1','СОБЫТИЕ ГОДА · победитель','«Qusti побрился налысо». Волос стало меньше, поводов для церемонии — больше.','rare',115),
('legacy-cs-1','ЛУЧШИЙ CS-УЧАСТНИК · победитель','Титул лучшего CS-участника одного из прошлых сезонов. Хорошая игра закончилась заслуженной наградой.','rare',116),
('legacy-player-1','ИГРОК ГОДА · победитель','Победа Rezo1n в прошлом сезоне. Когда просто хорошо играть уже недостаточно для описания.','rare',117),
('legacy-cringe-1','КРИНЖ ГОДА · победитель','Победа Cloury в прошлом сезоне. Было неловко, зато теперь есть официальное подтверждение.','rare',118),
('legacy-laureate-3','Коллекционер побед · 3 победы','3 победы в прошлых сезонах FLARE. Не случайный удачный вечер, а целая коллекция поводов выйти за наградой.','rare',87),
('legacy-laureate-4','Коллекционер побед · 4 победы','4 победы в прошлых сезонах FLARE. Не случайный удачный вечер, а целая коллекция поводов выйти за наградой.','rare',86),
('legacy-laureate-5','Легенда сезонов · 5 побед','5 побед в прошлых сезонах FLARE. Трофеям уже нужна отдельная полка. История премии без этого имени была бы заметно короче.','legendary',85),
('legacy-laureate-7','Легенда сезонов · 7 побед','7 побед в прошлых сезонах FLARE. Трофеям уже нужна отдельная полка. История премии без этого имени была бы заметно короче.','legendary',83)
on conflict(id) do update set name=excluded.name,description=excluded.description,rarity=excluded.rarity,sort_order=excluded.sort_order;
insert into public.flare_legacy_awards(nickname,badge_id,win_count) values
('Maronnix','legacy-king-2',2),
('Maronnix','legacy-multigaming-2',2),
('Maronnix','legacy-conflict-1',1),
('Maronnix','legacy-sos-1',1),
('Maronnix','legacy-track-1',1),
('Maronnix','legacy-laureate-7',0),
('Nodben','legacy-scam-1',1),
('Nodben','legacy-conflict-1',1),
('Nodben','legacy-duo-1',1),
('Nodben','legacy-freak-1',1),
('Nodben','legacy-fail-1',1),
('Nodben','legacy-laureate-5',0),
('Flourin','legacy-conflict-2',2),
('Flourin','legacy-toxic-1',1),
('Flourin','legacy-fail-1',1),
('Flourin','legacy-laureate-4',0),
('Eozik','legacy-breakthrough-1',1),
('Eozik','legacy-conflict-1',1),
('Eozik','legacy-phrase-1',1),
('Eozik','legacy-track-1',1),
('Eozik','legacy-laureate-4',0),
('Dony_zq','legacy-fortnite-2',2),
('Dony_zq','legacy-duo-1',1),
('Dony_zq','legacy-laureate-3',0),
('Qusti','legacy-meme-2',2),
('Qusti','legacy-event-1',1),
('Qusti','legacy-laureate-3',0),
('Rezo1n','legacy-cs-1',1),
('Rezo1n','legacy-breakthrough-1',1),
('Rezo1n','legacy-player-1',1),
('Rezo1n','legacy-laureate-3',0),
('Akirakume','legacy-cs-1',1),
('Akirakume','legacy-conflict-1',1),
('Cloury','legacy-cringe-1',1)
on conflict(nickname,badge_id) do update set win_count=excluded.win_count;
-- Equip new awards only. Re-running never overwrites a user's hidden/equipped choices.
insert into public.flare_account_badges(account_id,badge_id,equipped)
select a.id,w.badge_id,true from public.flare_accounts a
join public.flare_legacy_awards w on w.nickname=a.nickname where not a.is_test_account
on conflict(account_id,badge_id) do nothing;
-- Unregistered winners receive their honors when their account is created.
create or replace function public.flare_grant_legacy_awards_on_signup()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not new.is_test_account then
  insert into public.flare_account_badges(account_id,badge_id,equipped)
  select new.id,w.badge_id,true from public.flare_legacy_awards w where w.nickname=new.nickname
  on conflict(account_id,badge_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.flare_grant_legacy_awards_on_signup() from public,anon,authenticated;
drop trigger if exists flare_grant_legacy_awards_on_signup on public.flare_accounts;
create trigger flare_grant_legacy_awards_on_signup after insert on public.flare_accounts
for each row execute function public.flare_grant_legacy_awards_on_signup();
commit;
