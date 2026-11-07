const profileState={data:null,request:0,view:'profile',email:null,leaderSort:'score',leaders:[],busy:false,shopCategory:'upgrades',publicData:null,badgeEditing:false,badgeDraft:null,frameDraft:null,bannerDraft:null,bannerDirty:false};
state.profile=profileState;
let boingScene=null,bobFaceEditor=null;
const boingGravity=1540;
// Mass is 1; BOB is a uniform circular rigid body (I = mass * radius² / 2).
// The old kick ranged from 340 to 375 px/s. Use its midpoint, with exactly +5%.
const boingLegacyKick=(340+375)/2,boingClickStrength=1.05;
const boingPhysicsStep=1/120;
const numberFormat=new Intl.NumberFormat('ru-RU');
const dateFormat=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const formatProfileNumber=value=>numberFormat.format(Math.max(0,Number(value)||0));
const profileReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const profileToken=()=>state.session?.token||'';
const profileViewIsActive=view=>profileState.view===view&&Boolean($('.profile-modal'));
const boingSeenKey=nickname=>`flare-boing-intro:${String(nickname||'').toLowerCase()}`;
function readBoingSeen(nickname){try{return localStorage.getItem(boingSeenKey(nickname))==='1'}catch{return false}}
function writeBoingSeen(nickname){try{localStorage.setItem(boingSeenKey(nickname),'1')}catch{}}
function isBoingUnlocked(){
  const nickname=state.session?.nickname||'',ownsProfile=Boolean(nickname&&profileState.data?.nickname?.toLowerCase()===nickname.toLowerCase());
  return Boolean(nickname&&(readBoingSeen(nickname)||(ownsProfile&&profileState.data?.boing?.game_intro_seen)));
}
function updateBoingQuickEntry(){
  const button=$('#boing-quick-entry');if(button)button.hidden=!isBoingUnlocked();
}
function syncBoingUnlock(){
  if(profileState.data?.boing?.game_intro_seen&&state.session?.nickname)writeBoingSeen(state.session.nickname);
  updateBoingQuickEntry();
}
function clearProfileState(){
  profileState.request++;profileState.data=null;profileState.email=null;profileState.leaders=[];profileState.publicData=null;profileState.badgeEditing=false;profileState.badgeDraft=null;profileState.frameDraft=null;profileState.bannerDraft=null;profileState.bannerDirty=false;profileState.view='profile';profileState.busy=false;
  teardownBoing(false);
}
function mergeBoingState(boing){
  if(!boing)return;
  const previousFace=profileState.data?.boing?.face;
  if(typeof boing.face==='undefined'&&typeof previousFace!=='undefined')boing={...boing,face:previousFace};
  profileState.data={...(profileState.data||{}),boing};
  updateBoingHud();
  const firePanel=$('.ogonyok-game'),fireKey=JSON.stringify(boing.streak||{});if(firePanel&&firePanel.dataset.streakState!==fireKey&&!firePanel.contains(document.activeElement)){firePanel.innerHTML=ogonyokPanel(boing);firePanel.dataset.streakState=fireKey;}
}
function profileHeader(title='Ваш аккаунт',mystery=false,appearance=false){
  const showMystery=mystery&&!isBoingUnlocked();
  return `<header class="profile-menu-head"><div class="profile-menu-heading"><span class="eyebrow">FLARE ID</span><div class="profile-title-line"><h2>${esc(title)}</h2>${showMystery?'<span class="profile-title-divider" aria-hidden="true"></span><button class="profile-mystery" id="open-boing" type="button" aria-label="Открыть BOING!">???</button>':''}</div></div><div class="profile-head-actions">${appearance?profileBadgeEditToggleMarkup():''}<button class="close-button" type="button" aria-label="Закрыть">×</button></div></header>`;
}
function profileLoadingMarkup(){
  const nickname=state.session?.nickname||'Профиль';
  return `${profileHeader('Ваш аккаунт',true)}<div class="profile-loading" aria-live="polite"><span class="profile-loading-orbit"></span><strong>${esc(nickname)}</strong><span>Загружаем твой FLARE ID…</span></div>`;
}
function profileBadgeIcon(id){
  if(id.startsWith('legacy-')){
    const category=id.slice(7).replace(/-\d+$/,'');
    const icons={
      king:'<path d="m3 7 4 4 5-7 5 7 4-4-2 11H5Z"/><path d="M6 21h12"/>',
      multigaming:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M6 12h6M9 9v6m6-4h.01M18 14h.01"/>',
      conflict:'<path d="m14 3 7-1-1 7-9 9-5-5 8-10Z"/><path d="m4 11 9 9m-6-3-4 4m-1-1 2 2M9 14l8-8"/>',
      sos:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5"/>',
      track:'<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
      scam:'<path d="M12 3a7 7 0 0 0-7 7v11l4-3 3 3 3-3 4 3V10a7 7 0 0 0-7-7Z"/><path d="M9 10h.01M15 10h.01"/>',
      duo:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-6a5 5 0 0 1 6 5v1"/>',
      freak:'<path d="m3 8 4 3 5-8 5 8 4-3-3 13H6Z"/><path d="M9 16h.01m6 0h.01"/>',
      fail:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
      toxic:'<path d="M6 3h12v6l-3 3 3 3v6H6v-6l3-3-3-3V3Z"/><path d="m9 6 6 12m0-12-6 12"/>',
      breakthrough:'<path d="M8 16c-3-5 2-11 12-12 0 9-7 15-12 12Zm0 0-4 4m4-8-5 1 1 5m8-2-1 5 5-1"/><circle cx="15" cy="9" r="2"/>',
      phrase:'<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',
      fortnite:'<path d="M5 21V4h14v4h-9v4h7v4h-7v5H5Z"/>',
      meme:'<circle cx="12" cy="12" r="9"/><path d="M7 10h3m4 0h3m-9 4c2 4 6 4 8 0"/>',
      event:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-9 3-3 4h4l-1 3 5-5h-4l1-2"/>',
      cs:'<circle cx="12" cy="12" r="7"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/>',
      player:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
      cringe:'<circle cx="12" cy="12" r="9"/><path d="m7 9 3 2m4 0 3-2m-8 8 2-2 2 2 2-2"/>',
      laureate:'<path d="m12 3 2 5 5 1-4 4 1 6-4-3-4 3 1-6-4-4 5-1Z"/><path d="M4 5C0 12 3 20 9 22M20 5c4 7 1 15-5 17"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[category]||icons.laureate}</svg>`;
  }
  const paths={
    creator:'<path d="m5 20 2-10 7-7 7 7-7 7-9 3Z"/><path d="m5 20 7-7m-5-3 7 7"/><circle cx="13" cy="12" r="1.5"/><path d="m4 2 .7 2.3L7 5l-2.3.7L4 8l-.7-2.3L1 5l2.3-.7L4 2Z"/>',
    tester:'<path d="M9 3h6M10 3v6l-5 8c-1.2 2 .1 4 2.4 4h9.2c2.3 0 3.6-2 2.4-4l-5-8V3"/><path d="m8.5 15 2.2 2.2 4.8-5"/>',
    legend:'<path d="m12 2 8 7-8 13L4 9l8-7Z"/><path d="m4 9 8 3 8-3M12 12v10"/>',
    'boing-10k':'<path d="M8 4h8v5c0 3-1.8 5-4 5s-4-2-4-5V4Z"/><path d="M8 6H4v2c0 2 1.5 3 4 3m8-5h4v2c0 2-1.5 3-4 3M12 14v4m-4 3h8m-6-3h4"/>',
    'boing-100k':'<path d="m12 2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2Z"/>',
    'community-favorite':'<path d="M8 11H4v10h4V11Zm4 10h6.2a2 2 0 0 0 2-1.6l1.1-6a2 2 0 0 0-2-2.4h-4.5l.7-4.1A2.4 2.4 0 0 0 13.3 4L12 4.8 8 11v10h4Z"/>',
    winner:'<path d="M8 4h8v5c0 3-1.8 5-4 5s-4-2-4-5V4Z"/><path d="M8 6H4v2c0 2 1.5 3 4 3m8-5h4v2c0 2-1.5 3-4 3M12 14v4m-4 3h8m-6-3h4"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[id]||(id.startsWith('winner-')?paths.winner:paths.legend)}</svg>`;
}
const profileBadgeRarityRank={legendary:0,rare:1,special:2};
function isDoubleWinnerBadge(badge){return badge.id.startsWith('legacy-')&&badge.id.endsWith('-2')}
function sortProfileBadges(badges){
  const rank=badge=>badge.id==='creator'?-1:(profileBadgeRarityRank[badge.rarity]??99);
  return [...badges].sort((a,b)=>rank(a)-rank(b)||Number(isDoubleWinnerBadge(b))-Number(isDoubleWinnerBadge(a))||a.name.localeCompare(b.name,'ru',{sensitivity:'base'})||a.id.localeCompare(b.id));
}
function profileBadgeRarityLabel(rarity){return {special:'ОСОБЫЙ',rare:'РЕДКИЙ',legendary:'ЛЕГЕНДАРНЫЙ'}[rarity]||'ОСОБЫЙ'}
function profileBadgeMarkup(badge,compact=false,action=''){
  const classes=`profile-badge ${badge.equipped?'is-equipped':''} rarity-${esc(badge.rarity)}${isDoubleWinnerBadge(badge)?' profile-badge--double':''}${action?' is-editing':''}${action&&!badge.equipped?' is-draft-removed':''}`,tooltipId=`badge-tip-${compact?'compact-':''}${badge.id}`;
  const tooltip=`<span class="profile-badge-tooltip" id="${esc(tooltipId)}" role="tooltip"><span class="profile-badge-tooltip-head"><strong>${esc(badge.name)}</strong><span class="profile-badge-rarity">${profileBadgeRarityLabel(badge.rarity)}</span></span><span class="profile-badge-description">${esc(badge.description)}</span></span>`;
  const victoryMark=isDoubleWinnerBadge(badge)?'<span class="profile-badge-victories" aria-hidden="true">×2</span>':'';
  const actionMarkup=action?`<button class="profile-badge-action is-${action}" type="button" data-badge-${action}="${esc(badge.id)}" aria-label="${action==='remove'?'Снять':'Вернуть'} бейдж ${esc(badge.name)}" title="${action==='remove'?'Снять':'Вернуть'}"><svg viewBox="0 0 24 24" aria-hidden="true">${action==='remove'?'<path d="M6 12h12"/>':'<path d="M12 6v12M6 12h12"/>'}</svg></button>`:'';
  if(compact)return `<div class="${classes} profile-badge-compact" data-badge-id="${esc(badge.id)}" tabindex="0" aria-label="${esc(badge.name)}" aria-describedby="${esc(tooltipId)}"><span class="profile-badge-icon">${profileBadgeIcon(badge.id)}</span>${victoryMark}${actionMarkup}${tooltip}</div>`;
  return `<div class="${classes}" data-badge-id="${esc(badge.id)}" tabindex="0" aria-describedby="${esc(tooltipId)}"><span class="profile-badge-icon">${profileBadgeIcon(badge.id)}</span><span>${esc(badge.name)}</span>${action?'':`<small>${badge.equipped?'Надет':'Снят'}</small>`}${actionMarkup}${tooltip}</div>`;
}
function profileBadgeEditToggleMarkup(){
  const editing=profileState.badgeEditing,pencil='<path d="m14.5 5.5 4 4M4 20l3.8-.8L19 8a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L4.8 16.2 4 20Z"/><path d="m13 7 4 4"/>';
  return `<button class="profile-badge-edit-toggle ${editing?'is-editing':''}" id="profile-badge-edit-toggle" type="button" aria-label="Изменить оформление профиля" title="${editing?'Редактирование открыто':'Изменить оформление'}" ${editing?'disabled aria-disabled="true"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${pencil}</svg></button>`;
}
const profileFrameNames={'frame-default':'Без рамки','frame-gold':'GOLD FRAME','frame-aurora':'AURORA FRAME','frame-inferno':'INFERNO FRAME'};
function profileAppearanceFrameOptions(boing){
  const inventory=new Set(Array.isArray(boing?.inventory)?boing.inventory:[]),shop=Array.isArray(boing?.shop)?boing.shop:[];
  const frames=[{id:'frame-default',name:profileFrameNames['frame-default']}];
  shop.filter(item=>item.kind==='frame'&&inventory.has(item.id)).forEach(item=>frames.push({id:item.id,name:item.name||profileFrameNames[item.id]||item.id}));
  inventory.forEach(id=>{if(id.startsWith('frame-')&&id!=='frame-default'&&!frames.some(frame=>frame.id===id))frames.push({id,name:profileFrameNames[id]||id})});
  return frames;
}
function canEditProfileAppearance(profile){
  const boing=profile?.boing||{},badges=Array.isArray(boing.badges)?boing.badges:[];
  return Boolean(badges.length||(boing.inventory||[]).includes('banner-custom')||profileAppearanceFrameOptions(boing).length>1);
}
function resetProfileAppearanceDraft(){
  profileState.badgeEditing=false;profileState.badgeDraft=null;profileState.frameDraft=null;profileState.bannerDraft=null;profileState.bannerDirty=false;
}
function beginProfileAppearanceEdit(){
  const profile=profileState.data;if(!canEditProfileAppearance(profile)||profileState.busy)return;
  const boing=profile.boing,badges=Array.isArray(boing.badges)?boing.badges:[];
  profileState.badgeEditing=true;profileState.badgeDraft=badges.filter(badge=>badge.equipped).map(badge=>badge.id);profileState.frameDraft=boing.selected_frame||'frame-default';profileState.bannerDraft=profile.banner||null;profileState.bannerDirty=false;renderProfile(true);
}
function cancelProfileAppearanceEdit(){
  if(!profileState.badgeEditing||profileState.busy)return;
  resetProfileAppearanceDraft();renderProfile(true);
}
function changeBoingBadgeDraft(badgeId,equip){
  if(!profileState.badgeEditing||profileState.busy)return;
  const badges=profileState.data?.boing?.badges||[];if(!badges.some(badge=>badge.id===badgeId))return;
  const draft=new Set(Array.isArray(profileState.badgeDraft)?profileState.badgeDraft:[]);if(equip)draft.add(badgeId);else draft.delete(badgeId);
  profileState.badgeDraft=[...draft];renderProfile(true);
}
async function saveProfileAppearance(){
  if(!profileState.badgeEditing||profileState.busy)return;
  const profile=profileState.data,boing=profile?.boing||{},badges=Array.isArray(boing.badges)?boing.badges:[],draft=new Set(Array.isArray(profileState.badgeDraft)?profileState.badgeDraft:[]);
  const before=badges.filter(badge=>badge.equipped).map(badge=>badge.id).sort(),after=badges.filter(badge=>draft.has(badge.id)).map(badge=>badge.id).sort();
  const frames=profileAppearanceFrameOptions(boing),nextFrame=frames.some(frame=>frame.id===profileState.frameDraft)?profileState.frameDraft:(boing.selected_frame||'frame-default'),frameChanged=nextFrame!==(boing.selected_frame||'frame-default'),bannerChanged=Boolean(profileState.bannerDirty),nextBanner=profileState.bannerDraft||null;
  if(JSON.stringify(before)===JSON.stringify(after)&&!frameChanged&&!bannerChanged){resetProfileAppearanceDraft();renderProfile(true);return}
  const token=profileToken(),saveButton=$('#profile-appearance-save'),cancelButton=$('#profile-appearance-cancel');profileState.busy=true;if(saveButton)saveButton.disabled=true;if(cancelButton)cancelButton.disabled=true;
  try{
    const result=await rpc('set_my_profile_appearance',{p_token:token,p_badge_ids:after,p_frame_id:nextFrame,p_update_banner:bannerChanged,p_banner_data:bannerChanged?nextBanner:null});if(token!==profileToken())return;
    mergeBoingState(result.boing);if(bannerChanged)profileState.data.banner=nextBanner;resetProfileAppearanceDraft();
    if(profileViewIsActive('profile'))renderProfile(true);toast('Оформление сохранено.');
  }catch(error){toast(error.message);if(saveButton?.isConnected)saveButton.disabled=false;if(cancelButton?.isConnected)cancelButton.disabled=false}finally{profileState.busy=false}
}
function profileAvatarMarkup(profile,large=true){
  const nickname=profile.nickname||state.session?.nickname||'',boing=profile.boing||{},frame=boing.selected_frame||'frame-default';
  return `<div class="profile-avatar ${esc(frame)} ${large?'profile-avatar-large':''}"><span class="profile-avatar-fallback" aria-hidden="true">${esc(nickname.slice(0,1).toUpperCase()||'F')}</span><img src="${esc(photoSource(`avatar:${slugPhotoName(nickname)}`))}" data-photo-key="avatar:${esc(slugPhotoName(nickname))}" alt="Аватар ${esc(nickname)}"></div>`;
}
// Ogonyok: artwork is local vector geometry; the server owns days, progress and bonuses.
const ogonyokMilestones=[1,3,5,10,15,20,30,40,50];
function ogonyokStage(days){
 const d=Math.max(0,Number(days)||0),threshold=d>=50?Math.floor(d/10)*10:([...ogonyokMilestones].reverse().find(n=>d>=n)||0);
 const next=d>=50?threshold+10:(ogonyokMilestones.find(n=>n>d)||60);
 const tier=d>=50?8:Math.max(0,ogonyokMilestones.indexOf(threshold));
 return {days:d,threshold,next,tier,name:d===0?'Искра ждёт':d<3?'Искра':d<5?'Огонёк':d<10?'Пламя':d<15?'Сияние':d<20?'Вихрь':d<30?'Аврора':d<40?'Сверхновая':d<50?'Корона':'Вечный огонь'};
}
function ogonyokMark(streak={},compact=false){
 const stage=ogonyokStage(streak.days),d=stage.days,t=stage.tier;
 const rings=t>=3?'<ellipse class="ogonyok-orbit" cx="32" cy="39" rx="27" ry="14" fill="none" stroke="currentColor" stroke-width=".8"/>':'';
 const wings=t>=2?'<path class="ogonyok-wings" d="M22 48C10 47 8 38 9 30c6 8 11 6 13 1M42 48c12-1 14-10 13-18-6 8-11 6-13 1" fill="none" stroke="currentColor" stroke-width="1.4"/>':'';
 const crown=t>=5?'<path d="m18 14 3-8 8 7 3-11 3 11 8-7 3 8M17 57h30" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5"/>':'';
 const halo=t>=6?`<g fill="currentColor" opacity=".75">${Array.from({length:Math.min(12,6+Math.floor(d/10))},(_,i)=>{const a=i*Math.PI*2/Math.min(12,6+Math.floor(d/10));return `<circle cx="${32+29*Math.cos(a)}" cy="${33+28*Math.sin(a)}" r=".8"/>`}).join('')}</g>`:'';
 const sparks=t>=1?'<path class="ogonyok-sparks" d="m13 18 1-3 1 3-1 3Zm37 5 1-4 1 4-1 4ZM47 9l1-2 1 2-1 2Z" fill="currentColor"/>':'';
 return `<span class="ogonyok-mark ogonyok-tier-${t} ${d?'is-lit':'is-dormant'} ${compact?'is-compact':''}" style="${d>=50?`--ember:${['#fff2d2','#93ebff','#d7b5ff','#ffb7d5','#a9ffdb'][Math.floor((d-50)/10)%5]}`:''}" role="img" aria-label="Огонёк: ${d} дней" title="Огонёк · ${d} дней подряд${streak.bonus?' · +'+streak.bonus+' очков за клик':''}"><svg viewBox="0 0 64 64" aria-hidden="true">${halo}${rings}${wings}${crown}${sparks}<path class="ogonyok-flame" d="M33 9c2 13 17 17 17 31 0 12-8 20-19 20S13 52 14 41c0-8 5-13 9-18-1 9 2 11 4 12 5-8 1-15 6-26Z" fill="currentColor"/><path class="ogonyok-core" d="M33 29c-1 9 8 12 8 19a10 10 0 0 1-20 0c0-5 4-8 5-11 0 5 2 6 3 7 4-5 1-9 4-15Z" fill="#fff0c3"/></svg><b>${d}</b></span>`;
}
function ogonyokPanel(boing={}){
 const st=boing.streak||{},stage=ogonyokStage(st.days),score=Math.max(0,Number(st.today_score)||0),goal=1000;
 return `${ogonyokMark(st)}<div class="ogonyok-copy"><div><strong>${stage.name}</strong><span>${stage.days} дн. · +${Number(st.bonus)||0} к клику</span></div><p>${st.qualified_today?'Сегодня огонь сохранён':`${formatProfileNumber(Math.min(score,goal))} / 1000 очков сегодня`} <span>· следующий облик: ${stage.next} дн.</span></p><progress value="${Math.min(score,goal)}" max="1000" aria-label="Очки для Огонька сегодня"></progress></div><details class="ogonyok-help"><summary aria-label="Правила Огонька">?</summary><div>Набирай 1000 очков за день в завершённых засчитанных раундах. Сутки — с 00:00 до 00:00 МСК. Пропуск сбрасывает серию, но не рекорд. Бонус: с 1-го дня +1, с 5-го +3, с 10-го +6, с 15-го +9, с 20-го +12, далее каждые 10 дней ещё +3. Бонус фиксируется на старте раунда. Новый облик: 1, 3, 5, 10, 15, 20 дней, затем каждые 10. Очки раунда относятся ко дню его завершения.</div></details>`;
}
function profileBobAside(boing={},own=false){
 const best=Math.max(0,Number(boing.streak?.best)||0);
 return `<aside class="profile-bob-aside"><div class="public-profile-bob-card"><span>${own?'ТВОЙ BOB':'BOB УЧАСТНИКА'}</span><div class="bob public-bob-character" aria-label="BOB">${bobCharacterMarkup(boing)}</div><strong>${esc(boing.bob_name||'BOB')}</strong>${ogonyokMark(boing.streak||{},true)}</div><div class="profile-streak-record"><span>ЛУЧШИЙ ОГОНЁК</span>${ogonyokMark({days:best},true)}<strong>${best} <small>дн. подряд</small></strong></div></aside>`;
}
function profileStatsMarkup(profile){
  const boing=profile.boing||{};
  const stats=[
    ['Голосование',`${formatProfileNumber(profile.votes_done)} / ${formatProfileNumber(profile.total_nominations)}`,'номинаций заполнено'],
    ['Рекорд BOING!',formatProfileNumber(boing.best_score),'очков за один раунд'],
    ['COINS',formatProfileNumber(boing.coins),'доступно в магазине'],
    ['Во FLARE',formatProfileNumber(profile.days_with_flare),'дней с регистрации']
  ];
  return `<div class="profile-stats">${stats.map(([label,value,hint])=>`<div class="profile-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></div>`).join('')}</div>`;
}
function profileReputationMarkup(profile,own=false){
  const reputation=profile.reputation||{},up=Math.max(0,Number(reputation.up)||0),down=Math.max(0,Number(reputation.down)||0),viewerValue=Number(reputation.viewer_value)||0,canRate=!own&&reputation.can_rate!==false;
  const button=(value,label,path)=>`<button class="profile-reputation-button ${value===1?'is-like':'is-dislike'} ${viewerValue===value?'is-active':''}" type="button" data-reputation-value="${value}" aria-label="${label}" aria-pressed="${viewerValue===value}" ${canRate?'':'disabled'} ${own?'title="Нельзя оценить собственный профиль"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg><span>${formatProfileNumber(value===1?up:down)}</span></button>`;
  return `<div class="profile-reputation" data-reputation-nickname="${esc(profile.nickname||'')}"><div class="profile-reputation-buttons">${button(1,'Большой палец вверх','<path d="M8 11H4v10h4V11Zm4 10h6.2a2 2 0 0 0 2-1.6l1.1-6a2 2 0 0 0-2-2.4h-4.5l.7-4.1A2.4 2.4 0 0 0 13.3 4L12 4.8 8 11v10h4Z"/>')}${button(-1,'Большой палец вниз','<path d="M16 13h4V3h-4v10Zm-4-10H5.8a2 2 0 0 0-2 1.6l-1.1 6a2 2 0 0 0 2 2.4h4.5l-.7 4.1a2.4 2.4 0 0 0 2.2 2.9L12 19.2 16 13V3h-4Z"/>')}</div></div>`;
}
function renderProfile(preserveScroll=false){
  const previousScroll=preserveScroll?($('.profile-scroll')?.scrollTop||0):0,profile=profileState.data;
  if(!profile?.boing)return;
  const boing=profile.boing,badges=sortProfileBadges(Array.isArray(boing.badges)?boing.badges:[]),editing=profileState.badgeEditing,draft=editing&&Array.isArray(profileState.badgeDraft)?new Set(profileState.badgeDraft):new Set(badges.filter(badge=>badge.equipped).map(badge=>badge.id)),visibleBadges=editing?badges.map(badge=>({...badge,equipped:draft.has(badge.id)})):badges.filter(badge=>badge.equipped),hasBannerUpgrade=(boing.inventory||[]).includes('banner-custom'),frameOptions=profileAppearanceFrameOptions(boing),previewBanner=editing?profileState.bannerDraft:profile.banner,previewFrame=editing?(profileState.frameDraft||'frame-default'):(boing.selected_frame||'frame-default'),canEdit=canEditProfileAppearance(profile);
  const badgeList=visibleBadges.map(badge=>profileBadgeMarkup(badge,true,editing?(badge.equipped?'remove':'restore'):'')).join('');
  const frameEditor=frameOptions.length>1?`<div class="profile-frame-editor"><span class="profile-appearance-label">РАМКА АВАТАРА</span><div class="profile-frame-options" role="group" aria-label="Рамка аватара">${frameOptions.map(frame=>`<button class="profile-frame-choice ${previewFrame===frame.id?'is-selected':''}" type="button" data-profile-frame="${esc(frame.id)}" aria-pressed="${previewFrame===frame.id}"><span class="profile-frame-choice-swatch ${esc(frame.id)}" aria-hidden="true"></span><span>${esc(frame.name)}</span></button>`).join('')}</div></div>`:'';
  const bannerEditor=hasBannerUpgrade?`<div class="profile-banner-controls"><span>Фотобаннер · JPG, PNG или WebP до 12 МБ</span><div><label class="profile-small-button">Выбрать фото<input id="profile-banner-input" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button class="profile-small-button" id="profile-banner-remove" type="button" ${previewBanner?'':'disabled'}>Убрать</button></div></div>`:'';
  const appearanceEditor=editing?`<section class="profile-appearance-controls" aria-label="Настройки оформления"><div class="profile-appearance-title"><span>ОФОРМЛЕНИЕ</span><small>Изменения применятся после сохранения</small></div>${frameEditor}${bannerEditor}<div class="profile-appearance-actions"><button class="profile-small-button profile-appearance-cancel" id="profile-appearance-cancel" type="button">Отменить</button><button class="button profile-appearance-save" id="profile-appearance-save" type="button">Сохранить</button></div></section>`:'';
  const created=profile.created_at?dateFormat.format(new Date(profile.created_at)):'—';
  syncBoingUnlock();
  const previewProfile={...profile,boing:{...boing,selected_frame:previewFrame}};
  const content=`${profileHeader('Ваш аккаунт',true,canEdit)}<div class="profile-scroll"><div class="own-profile-layout"><div class="own-profile-info"><section class="profile-identity ${previewBanner?'has-custom-banner':''} ${editing?'is-appearance-editing':''}">${previewBanner?`<img class="profile-banner" src="${esc(previewBanner)}" alt="Фотобаннер профиля">`:''}<div class="profile-identity-shade"></div><div class="profile-identity-main">${profileAvatarMarkup(previewProfile)}<div class="profile-details"><div class="profile-nickname-line"><h3>${esc(profile.nickname)}</h3><div class="profile-equipped-badges">${badgeList}</div></div><dl class="profile-meta"><div><dt>Дата регистрации</dt><dd>${esc(created)}</dd></div><div><dt>Email</dt><dd><span id="profile-email-value">${esc(profileState.email||profile.email_masked)}</span><button class="profile-email-toggle" id="profile-email-toggle" type="button">${profileState.email?'Скрыть':'Показать'}</button></dd></div></dl></div></div></section>${appearanceEditor}${profileStatsMarkup(profile)}<div class="profile-footer-actions">${profileReputationMarkup(profile,true)}<button class="profile-logout" id="profile-logout" type="button">Выйти из аккаунта</button></div></div>${profileBobAside(boing,true)}</div></div>`;
  replaceModalView(content,'profile-modal account-profile-modal');
  bindProfileControls();if(preserveScroll&&$('.profile-scroll'))$('.profile-scroll').scrollTop=previousScroll;
}
function renderProfileError(error){
  console.info('Профиль не загружен:',error?.message||error);
  const nickname=state.session?.nickname||'Аккаунт';
  const content=`${profileHeader()}<div class="profile-error"><div class="profile-error-avatar">${profileAvatarMarkup({nickname,boing:{}},false)}</div><h3>${esc(nickname)}</h3><p>Не удалось загрузить данные профиля. Проверь соединение и попробуй ещё раз.</p><div><button class="button" id="profile-retry" type="button">Повторить</button><button class="profile-logout" id="profile-logout" type="button">Выйти из аккаунта</button></div></div>`;
  replaceModalView(content,'profile-modal account-profile-modal');
  bindProfileAvatarFallback();$('#profile-retry').onclick=showProfile;$('#profile-logout').onclick=logoutAccount;
}
async function showProfile(){
  if(!state.session){renderAuth();return}
  profileState.view='profile';profileState.email=null;profileState.busy=false;resetProfileAppearanceDraft();
  const request=++profileState.request,token=profileToken();
  replaceModalView(profileLoadingMarkup(),'profile-modal account-profile-modal');
  const mysteryButton=$('#open-boing');if(mysteryButton)mysteryButton.onclick=()=>{const button=$('#open-boing');if(button)button.disabled=true;openBoingQuickEntry()};
  try{
    const reputation=await rpc('prepare_flare_profile',{p_token:token,p_nickname:null});
    const profile=await rpc('get_my_profile',{p_token:token});
    if(request!==profileState.request||token!==profileToken())return;
    profileState.data={...profile,reputation};renderProfile();
  }catch(error){if(request===profileState.request&&token===profileToken())renderProfileError(error)}
}
async function logoutAccount(){
  const current=state.session;if(!current)return;
  teardownBoing(false);profileState.request++;profileState.data=null;profileState.email=null;resetProfileAppearanceDraft();
  state.session=null;localStorage.removeItem('flare-session');updateAccount();closeModal();
  rpc('flare_logout',{p_token:current.token}).catch(()=>{});toast('Ты вышел из аккаунта.');
}
function bindProfileAvatarFallback(){
  $$('.profile-avatar img, .boing-leader-avatar img').forEach(image=>{const hide=()=>image.closest('.profile-avatar, .boing-leader-avatar')?.classList.add('no-image');if(image.complete&&image.naturalWidth===0)hide();else image.addEventListener('error',hide,{once:true})});
}
function positionProfileBadgeTooltips(){
  $$('.profile-badge').forEach(badge=>{
    const tip=$('.profile-badge-tooltip',badge),scroll=badge.closest('.profile-scroll');if(!tip||!scroll)return;
    const area=scroll.getBoundingClientRect(),rect=badge.getBoundingClientRect(),width=Math.max(120,Math.min(380,scroll.clientWidth-24));
    const center=Math.max(area.left+12+width/2,Math.min(rect.left+rect.width/2,area.left+scroll.clientWidth-12-width/2));
    tip.style.width=`${width}px`;tip.style.left=`${center-rect.left}px`;
  });
}
window.addEventListener('resize',positionProfileBadgeTooltips,{passive:true});
function bindProfileControls(){
  bindProfileAvatarFallback();positionProfileBadgeTooltips();
  $('#open-boing')?.addEventListener('click',showBoing);
  $('#profile-logout')?.addEventListener('click',logoutAccount);
  $('#profile-email-toggle')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    if(profileState.email){profileState.email=null;$('#profile-email-value').textContent=profileState.data.email_masked;button.textContent='Показать';return}
    button.disabled=true;
    try{
      const token=profileToken(),email=await rpc('reveal_my_email',{p_token:token});
      if(token!==profileToken()||!$('#profile-email-value'))return;
      profileState.email=email;$('#profile-email-value').textContent=email;button.textContent='Скрыть';
    }catch(error){toast(error.message)}finally{if(button.isConnected)button.disabled=false}
  });
  $('#profile-badge-edit-toggle')?.addEventListener('click',beginProfileAppearanceEdit);
  $('#profile-appearance-save')?.addEventListener('click',saveProfileAppearance);
  $('#profile-appearance-cancel')?.addEventListener('click',cancelProfileAppearanceEdit);
  $$('[data-badge-remove]').forEach(button=>button.addEventListener('click',()=>changeBoingBadgeDraft(button.dataset.badgeRemove,false)));
  $$('[data-badge-restore]').forEach(button=>button.addEventListener('click',()=>changeBoingBadgeDraft(button.dataset.badgeRestore,true)));
  $$('[data-profile-frame]').forEach(button=>button.addEventListener('click',()=>{if(!profileState.badgeEditing||profileState.busy)return;profileState.frameDraft=button.dataset.profileFrame;renderProfile(true)}));
  $('#profile-banner-input')?.addEventListener('change',handleProfileBanner);
  $('#profile-banner-remove')?.addEventListener('click',()=>{if(!profileState.badgeEditing||profileState.busy)return;profileState.bannerDraft=null;profileState.bannerDirty=true;renderProfile(true)});
}
function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать фотографию.'));reader.readAsDataURL(file)})}
function loadImageElement(source){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось открыть фотографию.'));image.src=source})}
function canvasToJpeg(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось обработать фотографию.')),'image/jpeg',quality))}
// Trim only fully transparent outer margins; keep every visible/antialiased pixel.
function profileImageContentBounds(image){
  const width=image.naturalWidth,height=image.naturalHeight;
  if(width*height>32000000)throw new Error('Слишком большое разрешение фото. Уменьши его до 32 мегапикселей.');
  const scan=document.createElement('canvas');scan.width=width;scan.height=height;
  const context=scan.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  let left=width,top=height,right=-1,bottom=-1;
  // Read strips instead of allocating a second full-resolution RGBA buffer.
  for(let y=0;y<height;y+=128){
    const rows=Math.min(128,height-y),pixels=context.getImageData(0,y,width,rows).data;
    for(let row=0;row<rows;row++)for(let x=0;x<width;x++){
      if(pixels[(row*width+x)*4+3]===0)continue;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y+row);bottom=Math.max(bottom,y+row);
    }
  }
  scan.width=scan.height=0;
  if(right<left)throw new Error('На фото нет видимого изображения: все пиксели прозрачные.');
  return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}
// Social uploads trim transparent margins before flattening to a bounded JPEG.
// Banners retain their original framing.
async function prepareProfileImage(file,trimTransparent=true){
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))throw new Error('Можно загрузить только фотографию JPG, PNG или WebP. GIF и видео не поддерживаются.');
  if(file.size>12*1024*1024)throw new Error('Фотография должна быть меньше 12 МБ.');
  const source=await readFileAsDataUrl(file),image=await loadImageElement(source);
  const bounds=trimTransparent?profileImageContentBounds(image):{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
  const scale=Math.min(1,1600/bounds.width,1000/bounds.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bounds.width*scale));canvas.height=Math.max(1,Math.round(bounds.height*scale));
  const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#111110';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height,0,0,canvas.width,canvas.height);
  let quality=.84,blob=await canvasToJpeg(canvas,quality);
  while(blob.size>490000&&quality>.5){quality-=.08;blob=await canvasToJpeg(canvas,quality)}
  if(blob.size>500000)throw new Error('Не удалось уменьшить фотографию до 500 КБ. Выбери другой кадр.');
  return await readFileAsDataUrl(blob);
}
function prepareProfileBanner(file){return prepareProfileImage(file,false)}
async function handleProfileBanner(event){
  const input=event.currentTarget,file=input.files?.[0],token=profileToken();if(!file||!profileState.badgeEditing||profileState.busy)return;
  const label=input.closest('label');label?.classList.add('is-busy');input.disabled=true;
  try{
    const data=await prepareProfileBanner(file);if(token!==profileToken()||!profileState.badgeEditing)return;
    profileState.bannerDraft=data;profileState.bannerDirty=true;if(profileViewIsActive('profile'))renderProfile(true);toast('Фото добавлено. Нажми галочку, чтобы сохранить оформление.');
  }catch(error){toast(error.message);if(input.isConnected)input.disabled=false;label?.classList.remove('is-busy')}
}
function boingHeader(active='game'){
  return `<header class="boing-head"><button class="boing-back" id="boing-back" type="button" aria-label="Вернуться к аккаунту"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg><span>АККАУНТ</span></button><div class="boing-logo" aria-label="BOING!">BOING<span>!</span></div><button class="close-button" type="button" aria-label="Закрыть">×</button></header><nav class="boing-tabs" aria-label="Разделы BOING!"><button type="button" data-boing-view="game" class="${active==='game'?'is-active':''}">ИГРАТЬ</button><button type="button" data-boing-view="leaders" class="${active==='leaders'?'is-active':''}">ТОП</button><button type="button" data-boing-view="shop" class="${active==='shop'?'is-active':''}">МАГАЗИН</button></nav>`;
}
function bindBoingNavigation(active){
  $('#boing-back').onclick=finishBoingAndShowProfile;
  $$('[data-boing-view]').forEach(button=>button.onclick=()=>{if(button.dataset.boingView===active)return;if(button.dataset.boingView==='game')renderBoingGame();else if(button.dataset.boingView==='shop')showBoingShop();else showBoingLeaders()});
}
function bobAccessoryMarkup(accessory){
  if(accessory==='bob-crown')return '<span class="bob-crown bob-accessory-outside" aria-hidden="true"><i></i><i></i><i></i></span>';
  if(accessory==='bob-cap')return '<span class="bob-cap bob-accessory-outside" aria-hidden="true"></span>';
  if(accessory==='bob-shades')return '<span class="bob-shades" aria-hidden="true"><i></i><i></i></span>';
  if(accessory==='bob-fedora')return '<span class="bob-fedora bob-accessory-outside" aria-hidden="true"><i></i></span>';
  if(accessory==='bob-beanie')return '<span class="bob-beanie bob-accessory-outside" aria-hidden="true"><i></i></span>';
  if(accessory==='bob-sneakers')return '<span class="bob-sneakers bob-accessory-outside" aria-hidden="true"><i></i><i></i></span>';
  if(accessory==='bob-bowtie')return '<span class="bob-bowtie bob-accessory-outside" aria-hidden="true"><i></i></span>';
  return '';
}
let defaultBobFaceSource='';
function drawDefaultBobFace(context,width=320,height=320){
  context.save();context.globalCompositeOperation='source-over';context.globalAlpha=1;context.scale(width/320,height/320);
  context.strokeStyle='#242722';context.lineCap='round';context.lineJoin='round';
  context.lineWidth=20;context.beginPath();context.moveTo(112,113);context.lineTo(112,137);context.moveTo(208,113);context.lineTo(208,137);context.stroke();
  context.lineWidth=12;context.beginPath();context.moveTo(106,177);context.quadraticCurveTo(160,224,214,177);context.stroke();context.restore();
}
function defaultBobFace(){
  if(defaultBobFaceSource)return defaultBobFaceSource;
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;drawDefaultBobFace(canvas.getContext('2d'));
  defaultBobFaceSource=canvas.toDataURL('image/png');return defaultBobFaceSource;
}
function bobFaceMarkup(boing){
  return `<img class="bob-custom-face${boing?.face?'':' bob-default-face'}" src="${esc(boing?.face||defaultBobFace())}" alt="" draggable="false">`;
}
function bobCharacterMarkup(boing){return `${bobAccessoryMarkup(boing?.selected_accessory)}<span class="bob-body">${bobFaceMarkup(boing)}</span>`}
function canEditBobFace(scene){return Boolean(scene&&!scene.runId&&!scene.clicks&&!scene.starting&&!scene.failed)}
function ensureBoingScene(){
  if(boingScene)return boingScene;
  const active=profileState.data?.boing?.active_run;
  boingScene={runId:active?.id||null,score:Number(active?.score)||0,clicks:Number(active?.clicks)||0,syncedClicks:Number(active?.clicks)||0,running:false,starting:false,locked:false,failed:false,destroyed:false,x:0,y:0,vx:0,vy:0,rotation:0,spin:0,size:104,raf:0,last:0,queue:Promise.resolve(),syncTimer:null,syncScheduled:false,element:null,arena:null,observer:null};
  return boingScene;
}
function pauseBoingScene(){
  bobFaceEditor=null;
  const scene=boingScene;if(!scene)return;
  scene.running=false;cancelAnimationFrame(scene.raf);scene.raf=0;
  if(scene.runId)queueBoingSync(scene,false);
}
// Unmodified Lucide text-cursor-input and palette icons (ISC); see assets/icons/lucide-LICENSE.txt.
function boingControlIcon(name){
  const paths=name==='name'?'<path d="M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6"/><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/><path d="M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"/><path d="M9 6v12"/>':'<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
function renderBoingGame(){
  if(!profileState.data?.boing)return;
  bobFaceEditor=null;profileState.view='game';
  const scene=ensureBoingScene(),boing=profileState.data.boing;
  scene.running=false;cancelAnimationFrame(scene.raf);scene.raf=0;
  const hint=scene.score>0?'НАЖМИ НА BOB, ЧТОБЫ ПРОДОЛЖИТЬ':'НАЖМИ НА BOB, ЧТОБЫ НАЧАТЬ';
  const content=`${boingHeader('game')}<div class="boing-game-layout"><section class="ogonyok-game" aria-label="Ежедневный Огонёк">${ogonyokPanel(boing)}</section><div class="boing-arena" id="boing-arena"><div class="boing-hud"><div><span>SCORE</span><strong id="boing-score">${formatProfileNumber(scene.score)}</strong></div><div><span>BEST</span><strong id="boing-best">${formatProfileNumber(Math.max(boing.best_score,scene.score))}</strong></div><div><span>COINS</span><strong id="boing-coins">${formatProfileNumber(boing.coins)}</strong></div></div><div class="boing-hint" id="boing-hint">${hint}</div><button class="bob" id="bob" type="button" aria-label="Кликнуть по BOB и получить очки">${bobCharacterMarkup(boing)}</button><span class="bob-name" id="bob-name">${esc(boing.bob_name)}</span><div class="boing-impact" id="boing-impact" aria-live="polite"></div><div class="boing-floor" aria-hidden="true"></div></div><div class="boing-game-footer"><div class="boing-game-actions"><button class="boing-rename" id="boing-rename" type="button">${boingControlIcon('name')}<span>Сменить имя</span></button><button class="boing-rename" id="bob-face-edit" type="button" ${canEditBobFace(scene)?'':'disabled title="Можно менять перед началом нового раунда"'}>${boingControlIcon('face')}<span>Изменить лицо</span></button></div><div class="boing-level">LEVEL 1 <span>НЕ УРОНИ BOB</span></div></div></div>`;
  replaceModalView(content,'profile-modal boing-modal');
  bindBoingNavigation('game');
  scene.element=$('#bob');scene.arena=$('#boing-arena');
  scene.observer?.disconnect();
  if('ResizeObserver'in window){scene.observer=new ResizeObserver(()=>resetBobPosition(scene,false));scene.observer.observe(scene.arena)}
  resetBobPosition(scene,true);updateBoingHud();
  bindBobInput(scene);
  $('#bob-face-edit').onclick=showBoingFaceEditor;
  $('#boing-rename').onclick=showBoingRename;
}
function boingAutomationPattern(samples){
  // Conservative evidence only: do not punish ordinary bursts, a steady human rhythm,
  // coarse privacy timers, touch jitter, or held accessibility keys.
  if(samples.length<64)return false;
  const recent=samples.slice(-64),gaps=recent.slice(1).map((sample,i)=>sample.t-recent[i].t);
  if(gaps.some(gap=>gap<=0))return false;
  const span=recent.at(-1).t-recent[0].t;
  if(span<800)return true; // sustained >78 inputs/sec, never just a double click
  const mean=span/63;if(mean<12||mean>220)return false;
  const spread=Math.max(...gaps)-Math.min(...gaps),variance=gaps.reduce((sum,gap)=>sum+(gap-mean)**2,0)/63;
  const fractions=new Set(recent.map(sample=>Math.round(sample.t*10)%10));
  return fractions.size>=4&&spread<1.3&&variance<.1225;
}
function acceptBobInput(scene,event){
  if(scene.destroyed||scene.locked||scene.failed)return;
  // Only activate round rejection once the server supports discarding uncredited runs.
  const protectedRun=profileState.data?.boing?.integrity_version===1;
  if(event.isTrusted===false){if(protectedRun)rejectBoingRound(scene);return}
  scene.inputSamples||=[];
  const sample={n:scene.clicks+1,t:performance.timeOrigin+performance.now()};
  const samples=[...scene.inputSamples,sample].slice(-80);
  if(protectedRun&&boingAutomationPattern(samples)){rejectBoingRound(scene);return}
  scene.inputSamples=samples;clickBob(scene,event);
}
function bindBobInput(scene){
  // A moving button may leave the pointer before pointerup, so do not wait for click.
  // Do not capture the pointer: each subsequent hit must still land on BOB.
  scene.element.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();scene.element.focus({preventScroll:true});acceptBobInput(scene,event);
  });
  scene.element.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();if(!event.repeat)acceptBobInput(scene,event);
  });
  // Assistive activation is a detail=0 click. Pointer compatibility clicks must not double-count.
  scene.element.addEventListener('click',event=>{if(event.detail===0&&!event.pointerType&&!event.sourceCapabilities?.firesTouchEvents)acceptBobInput(scene,event)});
}
function resetBoingRound(scene,hint='ЕЩЁ РАЗ! НАЖМИ НА BOB'){
  clearTimeout(scene.rejectRetryTimer);clearTimeout(scene.settleRetryTimer);scene.rejectRetries=0;scene.settleRetries=0;
  scene.runId=null;scene.score=0;scene.clicks=0;scene.syncedClicks=0;scene.failed=false;scene.locked=false;scene.rejected=false;scene.vx=0;scene.vy=0;scene.inputSamples=[];
  scene.arena?.classList.remove('is-failed','is-playing');if($('#boing-impact'))$('#boing-impact').textContent='';if($('#boing-hint'))$('#boing-hint').textContent=hint;
  resetBobPosition(scene,true);updateBoingHud();
}
function finishRejectedBoingRound(scene,data){
  if(scene.destroyed)return;
  scene.running=false;cancelAnimationFrame(scene.raf);scene.raf=0;clearTimeout(scene.syncTimer);scene.syncScheduled=false;
  mergeBoingState(data.boing);resetBoingRound(scene,'РАУНД НЕ ЗАСЧИТАН · НАЖМИ НА BOB');
  toast('Автоматическая серия нажатий: раунд завершён без зачёта. Можно начать заново.');
}
function rejectBoingRound(scene){
  if(scene.rejected||scene.destroyed)return;
  scene.rejected=true;scene.failed=true;scene.locked=true;scene.running=false;cancelAnimationFrame(scene.raf);scene.raf=0;clearTimeout(scene.syncTimer);scene.syncScheduled=false;
  scene.arena?.classList.add('is-failed');if($('#boing-impact'))$('#boing-impact').textContent='РАУНД НЕ ЗАСЧИТАН';
  // Wait behind an in-flight start/sync; the server has not credited this run yet.
  discardRejectedBoingRound(scene);
}
function discardRejectedBoingRound(scene){
  enqueueBoingTask(scene,async()=>{
    if(!scene.runId){if(!scene.destroyed)resetBoingRound(scene);return}
    const data=await rpc('discard_boing_run',{p_token:profileToken(),p_run_id:scene.runId});
    finishRejectedBoingRound(scene,data);
  }).catch(error=>{if(!scene.destroyed){scene.rejectRetries=(scene.rejectRetries||0)+1;if(scene.rejectRetries===1)toast('Раунд остановлен. Повторяем отмену результата.');scene.rejectRetryTimer=setTimeout(()=>discardRejectedBoingRound(scene),Math.min(15000,2000*2**Math.min(3,scene.rejectRetries-1)))}});
}
function resetBobPosition(scene,force=false){
  if(!scene?.arena?.isConnected||!scene.element)return;
  const width=scene.arena.clientWidth,height=scene.arena.clientHeight;if(!width||!height)return;
  scene.size=scene.element.offsetWidth||104;
  if(force||!scene.running){scene.x=Math.max(0,(width-scene.size)/2);scene.y=Math.max(32,(height-scene.size)*.38);scene.vx=0;scene.vy=0;scene.rotation=0;scene.spin=0;scene.accumulator=0}
  else{scene.x=clamp(scene.x,0,Math.max(0,width-scene.size));scene.y=clamp(scene.y,0,Math.max(0,height-scene.size))}
  // Cache accessory geometry once per layout, rather than measuring on every frame.
  const hat=scene.element.querySelector('.bob-accessory-outside'),radius=scene.size/2;
  scene.accessoryCorners=[];
  if(hat){
    const x=hat.offsetLeft,y=hat.offsetTop,w=hat.offsetWidth,h=hat.offsetHeight,isCap=hat.classList.contains('bob-cap');
    const brim=isCap?getComputedStyle(hat,'::after'):null;
    const right=x+w+(brim?Math.max(0,-parseFloat(brim.right)||0):0),bottom=y+h+(brim?Math.max(0,-parseFloat(brim.bottom)||0):0);
    scene.accessoryCorners=[[x,y],[right,y],[x,bottom],[right,bottom]].map(([px,py])=>[px-radius,py-radius]);
  }
  paintBob(scene);
}
function paintBob(scene){
  if(!scene?.element?.isConnected)return;
  scene.element.style.transform=`translate3d(${scene.x}px,${scene.y}px,0) rotate(${scene.rotation}deg)`;
  // The label follows the centre, not the body's rotation. Account for rotating hats too.
  const name=$('#bob-name'),radius=scene.size/2;
  if(name){
    const angle=scene.rotation*Math.PI/180,corners=scene.accessoryCorners||[];
    const below=Math.max(radius,...corners.map(([x,y])=>x*Math.sin(angle)+y*Math.cos(angle)));
    const half=name.offsetWidth/2,left=clamp(scene.x+radius,half+6,scene.arena.clientWidth-half-6),top=scene.y+radius+below+8;
    name.style.left=`${left}px`;name.style.top=`${top}px`;
    name.classList.toggle('is-obscured',top+name.offsetHeight>scene.arena.clientHeight-8);
  }
  for(const id of ['bob-face-edit','boing-rename']){const control=$('#'+id);if(control){control.disabled=!canEditBobFace(scene);control.title=control.disabled?'Можно менять перед началом нового раунда':''}}
}
function updateBoingHud(){
  const boing=profileState.data?.boing;if(!boing)return;
  const scene=boingScene,score=scene?.score||0;
  if($('#boing-score'))$('#boing-score').textContent=formatProfileNumber(score);
  if($('#boing-best'))$('#boing-best').textContent=formatProfileNumber(Math.max(Number(boing.best_score)||0,score));
  if($('#boing-coins'))$('#boing-coins').textContent=formatProfileNumber(boing.coins);
}
function enqueueBoingTask(scene,task){
  const run=scene.queue.catch(()=>{}).then(task);scene.queue=run;return run;
}
function startBoingRun(scene){
  if(scene.starting||scene.runId||scene.destroyed)return;
  const token=profileToken();if(!token)return;
  scene.starting=true;
  enqueueBoingTask(scene,async()=>{
    if(scene.destroyed)return;
    const data=await rpc('start_boing_run',{p_token:token});
    scene.starting=false;scene.runId=data.run_id;scene.syncedClicks=0;
    if(scene.destroyed){await rpc(scene.rejected?'discard_boing_run':'sync_boing_run',scene.rejected?{p_token:token,p_run_id:data.run_id}:{p_token:token,p_run_id:data.run_id,p_clicks:scene.clicks,p_failed:true});scene.runId=null;return}
    mergeBoingState(data.boing);scene.score=scene.clicks*Math.max(1,Number(data.boing?.points_per_click)||1);updateBoingHud();queueBoingSync(scene,false);
  }).catch(error=>{
    scene.starting=false;if(scene.destroyed)return;
    scene.running=false;scene.score=0;scene.clicks=0;scene.syncedClicks=0;resetBobPosition(scene,true);updateBoingHud();toast(error.message);
  });
}
function queueBoingSync(scene,failed){
  if(!scene||scene.destroyed&&!failed)return Promise.resolve();
  const token=profileToken();if(!token)return Promise.resolve();
  clearTimeout(scene.syncTimer);scene.syncScheduled=false;
  return enqueueBoingTask(scene,async()=>{
    if(!scene.runId)return;
    const runId=scene.runId,clicks=scene.clicks;
    const guarded=profileState.data?.boing?.integrity_version===1;
    const data=scene.rejected?await rpc('discard_boing_run',{p_token:token,p_run_id:runId}):await rpc(guarded?'sync_boing_checked_run':'sync_boing_run',{p_token:token,p_run_id:runId,p_clicks:clicks,p_failed:Boolean(failed),...(guarded?{p_times:scene.inputSamples||[]}: {})});
    if(scene.destroyed)return;
    if(data.rejected){finishRejectedBoingRound(scene,data);return}
    mergeBoingState(data.boing);scene.syncedClicks=Math.max(scene.syncedClicks,clicks);
    if(failed){if(scene.runId===runId)scene.runId=null;return}
    if(scene.clicks===clicks&&data.boing?.active_run){scene.score=Number(data.boing.active_run.score)||scene.score;updateBoingHud()}
    if(scene.clicks>scene.syncedClicks)scheduleBoingSync(scene);
  }).catch(error=>{if(failed)throw error;if(!scene.destroyed){toast(error.message);scheduleBoingSync(scene)}});
}
function scheduleBoingSync(scene){
  if(!scene||scene.destroyed||scene.failed||scene.syncScheduled)return;
  scene.syncScheduled=true;
  scene.syncTimer=setTimeout(()=>{scene.syncScheduled=false;queueBoingSync(scene,false)},550);
}
function bobClickPoint(scene,event){
  // Keyboard/assistive activation is a centre hit. Screen-space coordinates remain
  // correct at any body angle, unlike offsets inside the rotated face/image.
  if(!event||!Number.isFinite(event.clientX)||(event.detail===0&&!event.pointerType))return {x:0,y:0};
  const rect=scene.arena.getBoundingClientRect(),radius=scene.size/2;
  let x=event.clientX-rect.left-scene.arena.clientLeft-scene.x-radius,y=event.clientY-rect.top-scene.arena.clientTop-scene.y-radius;
  const distance=Math.hypot(x,y),limit=radius*.98;
  if(distance>limit){x*=limit/distance;y*=limit/distance}
  return {x,y};
}
function applyBobClickImpulse(scene,point){
  const radius=scene.size/2,inertia=radius*radius/2,impulse=boingLegacyKick*boingClickStrength;
  // A finger pushes upward and slightly inward. Contact velocity includes rotation;
  // rubber grip opposes lateral slipping without increasing the impulse magnitude.
  const omega=scene.spin*Math.PI/180,contactVx=scene.vx-omega*point.y;
  const nx=-.55*point.x/radius+clamp(-contactVx/boingLegacyKick*.18,-.15,.15),ny=-1,length=Math.hypot(nx,ny);
  const jx=impulse*nx/length,jy=impulse*ny/length;
  scene.vx+=jx;scene.vy+=jy;
  scene.spin+=(point.x*jy-point.y*jx)/inertia*180/Math.PI;
}
function clickBob(scene,event){
  if(!scene||scene.destroyed||scene.locked||scene.failed||!scene.arena?.isConnected)return;
  if(!scene.runId)startBoingRun(scene);
  const boing=profileState.data.boing,points=Math.max(1,Number(boing.points_per_click)||1);
  scene.score+=points;scene.clicks++;scene.running=true;
  // Tap assist cancels falling speed before the kick, so gravity cannot swallow a late tap.
  // The actual click impulse is unchanged (+5%); rising momentum and torque are preserved.
  scene.vy=Math.min(scene.vy,0);
  applyBobClickImpulse(scene,bobClickPoint(scene,event));
  scene.arena.classList.add('is-playing');$('#boing-hint').textContent='';paintBob(scene);
  if(!scene.raf){scene.last=performance.now();scene.accumulator=0;scene.raf=requestAnimationFrame(now=>stepBoing(scene,now))}
  updateBoingHud();if(scene.runId)scheduleBoingSync(scene);
}
function failBoingRound(scene){
  if(scene.failed||scene.destroyed)return;
  scene.failed=true;scene.running=false;scene.locked=true;cancelAnimationFrame(scene.raf);scene.raf=0;
  scene.arena?.classList.add('is-failed');if($('#boing-impact'))$('#boing-impact').textContent='OUCH! СОХРАНЯЕМ РЕЗУЛЬТАТ…';
  settleBoingRound(scene);
}
function settleBoingRound(scene){
  queueBoingSync(scene,true).then(()=>{if(!scene.destroyed)resetBoingRound(scene)}).catch(()=>{
    if(scene.destroyed)return;
    scene.settleRetries=(scene.settleRetries||0)+1;
    if(scene.settleRetries===1)toast('Нет подтверждения сохранения. Результат удерживается, повторяем запрос.');
    scene.settleRetryTimer=setTimeout(()=>settleBoingRound(scene),Math.min(15000,2000*2**Math.min(3,scene.settleRetries-1)));
  });
}
function resolveBobContact(scene,rx,ry,nx,ny,restitution){
  const radius=scene.size/2,inertia=radius*radius/2,normalSpeed=scene.vx*nx+scene.vy*ny;
  if(normalSpeed>=0)return;
  const normalImpulse=-(1+restitution)*normalSpeed;
  scene.vx+=normalImpulse*nx;scene.vy+=normalImpulse*ny;
  const tx=-ny,ty=nx,omega=scene.spin*Math.PI/180;
  const slip=(scene.vx-omega*ry)*tx+(scene.vy+omega*rx)*ty;
  const lever=rx*ty-ry*tx;
  const friction=clamp(-slip/(1+lever*lever/inertia),-.22*normalImpulse,.22*normalImpulse);
  scene.vx+=friction*tx;scene.vy+=friction*ty;scene.spin+=lever*friction/inertia*180/Math.PI;
}
function advanceBobPhysics(scene,dt,width,height){
  const radius=scene.size/2,maxX=Math.max(0,width-scene.size),floor=height-scene.size-8;
  const drag=Math.exp(-.08*dt);scene.vx*=drag;scene.vy*=drag;scene.spin*=Math.exp(-.12*dt);
  scene.vy+=boingGravity*dt;scene.x+=scene.vx*dt;scene.y+=scene.vy*dt;
  scene.rotation=((scene.rotation+scene.spin*dt)%360+360)%360;
  if(scene.x<0){scene.x=0;resolveBobContact(scene,-radius,0,1,0,.82)}
  else if(scene.x>maxX){scene.x=maxX;resolveBobContact(scene,radius,0,-1,0,.82)}
  if(scene.y<0){scene.y=0;resolveBobContact(scene,0,-radius,0,1,.72)}
  if(scene.y>=floor){scene.y=floor;return true}
  return false;
}
function stepBoing(scene,now){
  if(!scene.running||scene.destroyed||!scene.arena?.isConnected){scene.raf=0;return}
  // Fixed substeps make trajectories and contacts stable at 30/60/120 Hz.
  const dt=Math.min(.1,Math.max(0,(now-scene.last)/1000));scene.last=now;
  scene.accumulator=(scene.accumulator||0)+dt;
  const width=scene.arena.clientWidth,height=scene.arena.clientHeight;
  while(scene.accumulator+1e-9>=boingPhysicsStep){
    scene.accumulator-=boingPhysicsStep;
    if(advanceBobPhysics(scene,boingPhysicsStep,width,height)){paintBob(scene);failBoingRound(scene);return}
  }
  paintBob(scene);scene.raf=requestAnimationFrame(time=>stepBoing(scene,time));
}
function teardownBoing(sync=true){
  bobFaceEditor=null;
  const scene=boingScene;if(!scene)return;
  boingScene=null;scene.destroyed=true;scene.running=false;clearTimeout(scene.syncTimer);clearTimeout(scene.rejectRetryTimer);clearTimeout(scene.settleRetryTimer);cancelAnimationFrame(scene.raf);scene.observer?.disconnect();
  if(sync&&scene.runId&&profileToken())queueBoingSync(scene,true).catch(()=>{});
}
async function finishBoingAndShowProfile(){
  const scene=boingScene;if(scene?.finishing)return;
  if(scene){
    scene.finishing=true;scene.locked=true;pauseBoingScene();
    if(scene.starting)await scene.queue.catch(()=>{});
    try{if(scene.runId)await queueBoingSync(scene,true)}catch{scene.finishing=false;scene.locked=scene.failed||scene.rejected;toast('Не удалось подтвердить сохранение. Попробуй ещё раз — раунд не сброшен.');return}
    if(scene.destroyed)return;
    teardownBoing(false);
  }
  if(state.session)showProfile();
}
function showBoing(){
  const boing=profileState.data?.boing;if(!boing)return;
  const oldModal=$('.profile-modal'),oldRect=oldModal?.getBoundingClientRect(),first=!boing.game_intro_seen&&!readBoingSeen(state.session?.nickname)&&!profileReducedMotion();
  renderBoingGame();
  if(first&&oldRect&&oldModal?.isConnected){
    const modal=$('.boing-modal'),nextRect=modal.getBoundingClientRect();
    modal.animate([{width:`${oldRect.width}px`,height:`${oldRect.height}px`,opacity:.72,borderRadius:'24px'},{width:`${nextRect.width}px`,height:`${nextRect.height}px`,opacity:1,borderRadius:'28px'}],{duration:720,easing:'cubic-bezier(.2,.75,.2,1)'});
    $('.boing-game-layout')?.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,delay:220,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
  }
  writeBoingSeen(state.session?.nickname);updateBoingQuickEntry();
  if(!boing.game_intro_seen){boing.game_intro_seen=true;rpc('mark_boing_intro_seen',{p_token:profileToken()}).catch(error=>console.info('Отметка о входе в BOING! не сохранена:',error.message))}
}
async function openBoingQuickEntry(){
  if(!state.session)return;
  const nickname=state.session.nickname.toLowerCase();
  if(profileState.data?.nickname?.toLowerCase()===nickname&&profileState.data.boing){showBoing();return}
  profileState.view='profile';profileState.email=null;profileState.busy=false;profileState.badgeEditing=false;profileState.badgeDraft=null;
  const request=++profileState.request,token=profileToken();
  replaceModalView(profileLoadingMarkup(),'profile-modal account-profile-modal');
  const mystery=$('#open-boing');if(mystery)mystery.disabled=true;
  try{
    const profile=await rpc('get_my_profile',{p_token:token});
    if(request!==profileState.request||token!==profileToken())return;
    profileState.data=profile;syncBoingUnlock();showBoing();
  }catch(error){if(request===profileState.request&&token===profileToken())renderProfileError(error)}
}
function showBoingRename(){
  const boing=profileState.data?.boing;if(!boing||!canEditBobFace(boingScene))return;
  pauseBoingScene();profileState.view='rename';
  const price=Number(boing.rename_price)||0;
  replaceModalView(`${boingHeader('game')}<form class="boing-rename-panel" id="boing-rename-form"><span class="eyebrow">НОВОЕ ИМЯ</span><h3>Как назовём BOB?</h3><p>1–16 букв, цифр, пробелов, дефисов или подчёркиваний.</p><input id="boing-name-input" name="name" value="${esc(boing.bob_name)}" maxlength="16" required autocomplete="off" aria-label="Новое имя BOB"><span class="boing-rename-cost">${price?`${formatProfileNumber(price)} COINS`:`Бесплатно · осталось ${boing.free_renames_left}`}</span><div><button class="profile-small-button" id="boing-rename-cancel" type="button">Отмена</button><button class="button" type="submit">Сохранить имя</button></div></form>`,'profile-modal boing-modal');
  bindBoingNavigation('game');$('#boing-rename-cancel').onclick=renderBoingGame;
  $('#boing-rename-form').onsubmit=async event=>{
    event.preventDefault();const button=$('button[type="submit"]',event.currentTarget),input=$('#boing-name-input'),token=profileToken(),name=input.value;button.disabled=true;
    try{const result=await rpc('rename_boing_bob',{p_token:token,p_name:name});if(token!==profileToken())return;mergeBoingState(result.boing);toast('Новое имя сохранено.');if(profileViewIsActive('rename'))renderBoingGame()}catch(error){toast(error.message);if(button.isConnected)button.disabled=false}
  };
  $('#boing-name-input').focus();$('#boing-name-input').select();
}
function pushBobFaceHistory(editor){
  if(!editor?.ready)return;
  editor.history=editor.history.slice(0,editor.index+1);
  editor.history.push(editor.context.getImageData(0,0,editor.canvas.width,editor.canvas.height));
  if(editor.history.length>25)editor.history.shift();else editor.index++;
  const undo=$('#bob-face-undo');if(undo)undo.disabled=editor.index<=0;
}
function restoreBobFaceHistory(editor){
  if(!editor||editor.index<=0||editor.busy)return;
  editor.index--;editor.context.putImageData(editor.history[editor.index],0,0);
  const undo=$('#bob-face-undo');if(undo)undo.disabled=editor.index<=0;
}
function bobFacePoint(editor,event){
  const rect=editor.canvas.getBoundingClientRect();
  return{x:(event.clientX-rect.left)*editor.canvas.width/rect.width,y:(event.clientY-rect.top)*editor.canvas.height/rect.height};
}
function resetBobFaceBrush(editor){
  const context=editor.context;context.globalCompositeOperation='source-over';context.globalAlpha=1;
}
function applyBobFaceBrush(editor){
  const context=editor.context;context.globalCompositeOperation=editor.erasing?'destination-out':'source-over';context.globalAlpha=editor.erasing?1:1-editor.transparency/100;
  context.lineWidth=editor.size;context.strokeStyle=editor.color;context.lineCap='round';context.lineJoin='round';
}
function canvasToPng(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить рисунок.')),'image/png'))}
async function prepareBobFaceUpload(file){
  const isPng=file.type==='image/png'||(!file.type&&/\.png$/i.test(file.name||''));
  if(!isPng)throw new Error('Для лица BOB можно загрузить только PNG.');
  if(file.size>12*1024*1024)throw new Error('PNG должен быть меньше 12 МБ.');
  const source=await readFileAsDataUrl(file),image=await loadImageElement(source),canvas=document.createElement('canvas'),size=320;
  canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  const scale=Math.max(size/image.naturalWidth,size/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  context.drawImage(image,(size-width)/2,(size-height)/2,width,height);
  context.globalCompositeOperation='destination-in';context.beginPath();context.arc(size/2,size/2,size/2,0,Math.PI*2);context.fill();context.globalCompositeOperation='source-over';
  let blob=await canvasToPng(canvas);
  for(const nextSize of [256,224,192,160,128]){
    if(blob.size<=150000)break;
    const smaller=document.createElement('canvas');smaller.width=nextSize;smaller.height=nextSize;
    const smallerContext=smaller.getContext('2d');smallerContext.imageSmoothingEnabled=true;smallerContext.imageSmoothingQuality='high';smallerContext.drawImage(canvas,0,0,nextSize,nextSize);
    blob=await canvasToPng(smaller);
  }
  if(blob.size>150000)throw new Error('Эта PNG слишком сложная. Выбери изображение с меньшим количеством деталей.');
  return await readFileAsDataUrl(blob);
}
async function handleBobFaceUpload(event,editor){
  const input=event.currentTarget,file=input.files?.[0];
  if(!file||!editor.ready||editor.busy)return;
  const label=input.closest('label'),save=$('#bob-face-save');editor.busy=true;input.disabled=true;label?.classList.add('is-busy');if(save)save.disabled=true;
  try{
    const data=await prepareBobFaceUpload(file),image=await loadImageElement(data);
    if(bobFaceEditor!==editor)return;
    resetBobFaceBrush(editor);editor.context.clearRect(0,0,editor.canvas.width,editor.canvas.height);editor.context.drawImage(image,0,0,editor.canvas.width,editor.canvas.height);
    editor.imported=true;pushBobFaceHistory(editor);toast('PNG добавлена. Сохрани лицо BOB.');
  }catch(error){toast(error.message)}finally{
    editor.busy=false;if(input.isConnected){input.disabled=false;input.value='';label?.classList.remove('is-busy')}if(save?.isConnected)save.disabled=false;
  }
}
async function saveBobFaceEditor(editor){
  if(!editor||!editor.ready||editor.busy)return;
  const token=profileToken(),button=$('#bob-face-save');editor.busy=true;if(button){button.disabled=true;button.textContent='Сохраняем…'}
  try{
    const blob=await canvasToPng(editor.canvas);if(blob.size>150000)throw new Error('Рисунок получился слишком сложным. Удали часть штрихов.');
    const data=await readFileAsDataUrl(blob);
    const result=await rpc(editor.imported?'upload_my_boing_face':'set_my_boing_face',{p_token:token,p_data:data});if(token!==profileToken())return;
    mergeBoingState(result.boing);toast('Лицо BOB сохранено.');
    if(profileViewIsActive('face'))renderBoingGame();
  }catch(error){toast(error.message);editor.busy=false;if(button?.isConnected){button.disabled=false;button.textContent='Сохранить лицо'}}
}
const bobFaceColors=[
  {value:'#242722',name:'Чёрный'},{value:'#ffffff',name:'Белый'},{value:'#f25467',name:'Красный'},{value:'#ff9e7a',name:'Оранжевый'},{value:'#f0c66d',name:'Жёлтый'},
  {value:'#79dfc3',name:'Зелёный'},{value:'#78c8ff',name:'Голубой'},{value:'#8d9dff',name:'Синий'},{value:'#ca9aff',name:'Фиолетовый'},{value:'#f4798b',name:'Розовый'}
];
function updateBobFaceTools(editor){
  $$('[data-face-color]').forEach(button=>{const active=!editor.erasing&&button.dataset.faceColor===editor.color;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
  $$('[data-face-brush]').forEach(button=>{const active=Number(button.dataset.faceBrush)===editor.size;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
  const eraser=$('#bob-face-eraser');if(eraser){eraser.classList.toggle('is-active',editor.erasing);eraser.setAttribute('aria-pressed',String(editor.erasing))}
}
function showBoingFaceEditor(){
  const scene=boingScene,boing=profileState.data?.boing;
  if(!boing||!canEditBobFace(scene)){toast('Лицо можно менять перед началом нового раунда.');return}
  pauseBoingScene();profileState.view='face';
  const canUpload=(boing.inventory||[]).includes('bob-face-upload');
  const uploadControls=canUpload?`<div class="bob-face-upload-row"><label class="profile-small-button bob-face-upload-label is-disabled" id="bob-face-upload-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>Загрузить PNG<input id="bob-face-upload-input" type="file" accept="image/png,.png" hidden disabled></label><span>до 12 МБ · кадрируется в круг</span></div>`:'';
  const palette=bobFaceColors.map(color=>`<button type="button" data-face-color="${color.value}" style="--face-color:${color.value}" aria-label="${color.name}" title="${color.name}" aria-pressed="false"><i></i></button>`).join('');
  const content=`${boingHeader('game')}<section class="bob-face-editor ${canUpload?'has-upload':''}"><div class="bob-face-editor-head"><span class="eyebrow">BOB FACE STUDIO</span><h3>Твой BOB:</h3><p>Нарисуй ему лицо.</p></div><div class="bob-face-stage"><div class="bob-face-canvas-shell"><span class="bob-face-editor-body" aria-hidden="true"></span><canvas id="bob-face-canvas" width="320" height="320" aria-label="Холст для рисования лица BOB"></canvas></div><div class="bob-face-palette" role="group" aria-label="Цвет кисти">${palette}</div><div class="bob-face-toolbar"><div class="bob-face-brushes" role="group" aria-label="Размер кисти"><button type="button" data-face-brush="3" aria-label="Тонкая кисть" title="Тонкая кисть"><i></i></button><button type="button" data-face-brush="6" class="is-active" aria-label="Средняя кисть" title="Средняя кисть"><i></i></button><button type="button" data-face-brush="11" aria-label="Толстая кисть" title="Толстая кисть"><i></i></button><button type="button" data-face-brush="18" aria-label="Очень толстая кисть" title="Очень толстая кисть"><i></i></button></div><span></span><button type="button" id="bob-face-eraser" aria-label="Ластик" title="Ластик" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 15 8-9 8 7-6 7H8l-4-4a2 2 0 0 1 0-1Z"/><path d="m9 20 7-8M13 20h7"/></svg></button><button type="button" id="bob-face-undo" aria-label="Отменить штрих" title="Отменить штрих" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7-5 5 5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg></button><button type="button" id="bob-face-clear" aria-label="Очистить холст" title="Очистить холст"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg></button></div><label class="bob-face-transparency"><span>Прозрачность</span><input id="bob-face-transparency" type="range" min="0" max="90" step="10" value="0" aria-label="Прозрачность кисти"><output id="bob-face-transparency-value" for="bob-face-transparency">0%</output></label>${uploadControls}</div><div class="bob-face-actions"><div><button class="profile-small-button" id="bob-face-cancel" type="button">Отменить</button><button class="button" id="bob-face-save" type="button" disabled>Сохранить лицо</button></div></div></section>`;
  replaceModalView(content,'profile-modal boing-modal bob-face-modal');bindBoingNavigation('game');
  const canvas=$('#bob-face-canvas'),context=canvas.getContext('2d');
  const editor={canvas,context,history:[],index:-1,size:6,color:bobFaceColors[0].value,transparency:0,erasing:false,drawing:false,ready:false,busy:false,imported:false};bobFaceEditor=editor;updateBobFaceTools(editor);
  const ready=()=>{if(bobFaceEditor!==editor)return;resetBobFaceBrush(editor);editor.ready=true;pushBobFaceHistory(editor);const save=$('#bob-face-save'),upload=$('#bob-face-upload-input');if(save)save.disabled=false;if(upload){upload.disabled=false;$('#bob-face-upload-label')?.classList.remove('is-disabled')}};
  if(boing.face)loadImageElement(boing.face).then(image=>{if(bobFaceEditor!==editor)return;resetBobFaceBrush(editor);context.drawImage(image,0,0,canvas.width,canvas.height);ready()}).catch(()=>{if(bobFaceEditor!==editor)return;drawDefaultBobFace(context,canvas.width,canvas.height);ready()});else{drawDefaultBobFace(context,canvas.width,canvas.height);ready()}
  const finish=event=>{if(!editor.drawing)return;editor.drawing=false;try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)}catch{}pushBobFaceHistory(editor);resetBobFaceBrush(editor)};
  canvas.addEventListener('pointerdown',event=>{if(!editor.ready||editor.busy)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);const point=bobFacePoint(editor,event);editor.drawing=true;applyBobFaceBrush(editor);context.beginPath();context.moveTo(point.x,point.y);context.lineTo(point.x+.01,point.y);context.stroke()});
  canvas.addEventListener('pointermove',event=>{if(!editor.drawing||editor.busy)return;event.preventDefault();const point=bobFacePoint(editor,event);context.lineTo(point.x,point.y);context.stroke()});
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  $$('[data-face-color]').forEach(button=>button.onclick=()=>{if(editor.busy)return;editor.color=button.dataset.faceColor;editor.erasing=false;updateBobFaceTools(editor)});
  $$('[data-face-brush]').forEach(button=>button.onclick=()=>{if(editor.busy)return;editor.size=Number(button.dataset.faceBrush);updateBobFaceTools(editor)});
  $('#bob-face-eraser').onclick=()=>{if(editor.busy)return;editor.erasing=!editor.erasing;updateBobFaceTools(editor)};
  $('#bob-face-transparency').oninput=event=>{editor.transparency=Number(event.currentTarget.value);$('#bob-face-transparency-value').textContent=`${editor.transparency}%`};
  $('#bob-face-undo').onclick=()=>restoreBobFaceHistory(editor);
  $('#bob-face-clear').onclick=()=>{if(!editor.ready||editor.busy)return;resetBobFaceBrush(editor);context.clearRect(0,0,canvas.width,canvas.height);pushBobFaceHistory(editor)};
  $('#bob-face-upload-input')?.addEventListener('change',event=>handleBobFaceUpload(event,editor));
  $('#bob-face-cancel').onclick=renderBoingGame;$('#bob-face-save').onclick=()=>saveBobFaceEditor(editor);
}
function shopItemButton(item,boing){
  if(item.kind==='click'||item.kind==='coin'){
    if(item.sold_out)return '<button type="button" disabled>MAX</button>';
    return `<button type="button" data-buy-item="${esc(item.id)}">${formatProfileNumber(item.price)} COINS</button>`;
  }
  if(item.kind==='frame'||item.kind==='accessory'){
    if(item.owned){const selected=boing.selected_frame===item.id||boing.selected_accessory===item.id,defaultId=item.kind==='frame'?'frame-default':'accessory-none';return `<button type="button" data-equip-item="${esc(selected?defaultId:item.id)}">${selected?'Снять':'Надеть'}</button>`}
  }else if(item.owned)return '<button type="button" disabled>Куплено</button>';
  return `<button type="button" data-buy-item="${esc(item.id)}">${formatProfileNumber(item.price)} COINS</button>`;
}
// Official Lucide sliders-horizontal / palette / user-round (ISC).
function boingShopGroupIcon(category){
  if(category==='cosmetics')return boingControlIcon('face');
  const paths='<path d="M10 5H3" />  <path d="M12 19H3" />  <path d="M14 3v4" />  <path d="M16 17v4" />  <path d="M21 12h-9" />  <path d="M21 19h-5" />  <path d="M21 5h-7" />  <path d="M8 10v4" />  <path d="M8 12H3" />' ,profilePaths='<circle cx="12" cy="8" r="5" />  <path d="M20 21a8 8 0 0 0-16 0" />';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${category==='upgrades'?paths:profilePaths}</svg>`;
}
const boingShopGroups={upgrades:{label:'Апгрейды',kinds:['click','coin']},cosmetics:{label:'Косметика',kinds:['accessory','face']},profile:{label:'Профиль',kinds:['frame','banner','badge']}};
const boingShopKindLabels={click:'CLICK',coin:'COINS',accessory:'BOB',leader:'ТОП',face:'BOB PNG',frame:'AVATAR',banner:'PROFILE',badge:'BADGE'};
function boingShopItemPreview(item,boing){
  if(item.kind==='accessory')return `<div class="boing-shop-preview" aria-hidden="true"><div class="boing-preview-bob">${bobCharacterMarkup({...boing,selected_accessory:item.id})}</div></div>`;
  if(item.kind==='frame')return `<div class="boing-frame-preview" aria-hidden="true">${profileAvatarMarkup({...profileState.data,boing:{...boing,selected_frame:item.id}},false)}</div>`;
  return '';
}
function showBoingShop(category=profileState.shopCategory||'upgrades'){
  const boing=profileState.data?.boing;if(!boing)return;
  if(!boingShopGroups[category])category='upgrades';
  pauseBoingScene();profileState.view='shop';profileState.shopCategory=category;
  const allItems=Array.isArray(boing.shop)?boing.shop:[],items=allItems.filter(item=>item.id!=='leader-bob-name'&&boingShopGroups[category].kinds.includes(item.kind));
  const tabs=Object.entries(boingShopGroups).map(([id,group])=>`<button type="button" data-shop-category="${id}" class="${id===category?'is-active':''}">${boingShopGroupIcon(id)}<span>${group.label}</span></button>`).join('');
  replaceModalView(`${boingHeader('shop')}<div class="boing-panel-scroll"><nav class="boing-shop-categories" aria-label="Категории магазина">${tabs}</nav><div class="boing-shop-balance"><span>ТВОЙ БАЛАНС</span><strong>${formatProfileNumber(boing.coins)} <small>COINS</small></strong></div><div class="boing-shop-grid">${items.map(item=>`<article class="boing-shop-item kind-${esc(item.kind)}"><div class="boing-shop-item-top"><span>${esc(boingShopKindLabels[item.kind]||item.kind)}</span>${item.kind==='click'||item.kind==='coin'?`<small>LVL ${item.level} / ${item.max_level}</small>`:''}</div><h3>${esc(item.name)}</h3>${boingShopItemPreview(item,boing)}<p>${esc(item.description)}</p><div class="boing-shop-item-action">${shopItemButton(item,boing)}</div></article>`).join('')}</div><p class="boing-shop-note">${category==='upgrades'?(boing.economy_version>=3?'100 COINS за каждые полные 200 очков одного раунда. Остаток не переносится между раундами. Награда зачисляется после завершения; незасчитанный раунд ничего не приносит. COINS BOOST: +10% за уровень.':boing.economy_version===2?'POWER CLICK увеличивает очки, но не ускоряет выдачу COINS. Награда — за каждые 100 кликов: 100 COINS, с 10 000 кликов — 200. COINS BOOST добавляет 10% за уровень. Следующий уровень всегда дороже.':'Улучшения действуют на следующие клики и начисления COINS. Актуальные цены и эффекты указаны в карточках.'):category==='cosmetics'?'Аксессуары можно надевать и снимать. Имя BOB видно в таблице всем бесплатно. BOB PNG FACE открывает загрузку своих PNG.':'Рамки можно менять, баннер загружается в профиле, а новый бейдж надевается автоматически.'}</p></div>`,'profile-modal boing-modal');
  bindBoingNavigation('shop');bindProfileAvatarFallback();
  $$('[data-shop-category]').forEach(button=>button.onclick=()=>showBoingShop(button.dataset.shopCategory));
  $$('[data-buy-item]').forEach(button=>button.onclick=async()=>{
    const token=profileToken(),itemId=button.dataset.buyItem;button.disabled=true;
    try{const result=await rpc('buy_boing_item',{p_token:token,p_item_id:itemId});if(token!==profileToken())return;mergeBoingState(result.boing);toast('Покупка сохранена.');if(profileViewIsActive('shop'))showBoingShop()}catch(error){toast(error.message);if(button.isConnected)button.disabled=false}
  });
  $$('[data-equip-item]').forEach(button=>button.onclick=async()=>{
    const token=profileToken(),itemId=button.dataset.equipItem;button.disabled=true;
    try{const result=await rpc('equip_boing_item',{p_token:token,p_item_id:itemId});if(token!==profileToken())return;mergeBoingState(result.boing);if(profileViewIsActive('shop'))showBoingShop()}catch(error){toast(error.message);if(button.isConnected)button.disabled=false}
  });
}
async function showBoingLeaders(sort=profileState.leaderSort||'score'){
  pauseBoingScene();const request=++profileState.request;profileState.view='leaders';profileState.leaderSort=sort;
  replaceModalView(`${boingHeader('leaders')}<div class="boing-leaders-panel"><div class="boing-leaders-head"><div><span class="eyebrow">ТОЛЬКО ИГРОКИ</span><h3>ТОП</h3></div><div class="boing-leader-sort"><button type="button" data-leader-sort="score" class="${sort==='score'?'is-active':''}">По очкам</button><button type="button" data-leader-sort="coins" class="${sort==='coins'?'is-active':''}">По COINS</button></div></div><p class="boing-leaders-tip">Нажми на никнейм в таблице, чтобы открыть профиль участника.</p><div class="boing-leaders-loading"><span class="profile-loading-orbit"></span><p>Считаем рекорды…</p></div></div>`,'profile-modal boing-modal');
  bindBoingNavigation('leaders');$$('[data-leader-sort]').forEach(button=>button.onclick=()=>showBoingLeaders(button.dataset.leaderSort));
  try{
    const token=profileToken(),result=await rpc('get_boing_leaders',{p_token:token,p_sort:sort});
    if(request!==profileState.request||token!==profileToken()||!profileViewIsActive('leaders')||sort!==profileState.leaderSort)return;
    profileState.leaders=result.leaders||[];renderBoingLeaderRows();
  }catch(error){const loading=$('.boing-leaders-loading');if(request===profileState.request&&profileViewIsActive('leaders')&&loading)loading.innerHTML=`<p>${esc(error.message)}</p>`}
}
function boingLeaderAvatarMarkup(nickname){
  const photoKey=`avatar:${slugPhotoName(nickname)}`;
  return `<span class="boing-leader-avatar" aria-hidden="true"><span>${esc(nickname.slice(0,1).toUpperCase()||'F')}</span><img src="${esc(photoSource(photoKey))}" data-photo-key="${esc(photoKey)}" alt="" loading="lazy"></span>`;
}
function renderBoingLeaderRows(){
  const panel=$('.boing-leaders-panel');if(!panel)return;
  const rows=profileState.leaders.length?profileState.leaders.map(player=>`<div class="boing-leader-row ${player.nickname===state.session?.nickname?'is-me':''}"><span class="boing-leader-rank">${String(player.rank).padStart(2,'0')}</span><div class="boing-leader-user">${boingLeaderAvatarMarkup(player.nickname)}<div class="boing-leader-identity"><div class="boing-leader-labels"><button class="boing-leader-name" type="button" data-public-profile="${esc(player.nickname)}" aria-label="Открыть профиль ${esc(player.nickname)}"><strong>${esc(player.nickname)}</strong></button>${player.bob_name?`<span class="boing-leader-bob-name" title="BOB: ${esc(player.bob_name)}">${esc(player.bob_name)}</span>`:''}</div>${player.streak?.days>0?ogonyokMark(player.streak,true):''}</div></div><span><b>${formatProfileNumber(player.best_score)}</b><small>очков</small></span><span><b>${formatProfileNumber(player.coins)}</b><small>COINS</small></span></div>`).join(''):'<div class="boing-leaders-empty"><strong>Пока никто не играл</strong><p>Первый рекорд может быть твоим.</p></div>';
  $('.boing-leaders-loading',panel)?.remove();panel.insertAdjacentHTML('beforeend',`<div class="boing-leader-list">${rows}</div>`);
  bindProfileAvatarFallback();$$('[data-public-profile]',panel).forEach(button=>button.onclick=()=>showPublicFlareProfile(button.dataset.publicProfile));
}
function publicProfileHeader(nickname='Профиль участника'){
  return `<header class="public-profile-head"><button class="boing-back" id="public-profile-back" type="button" aria-label="Вернуться к лидерам"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg><span>ТОП</span></button><div><span class="eyebrow">FLARE ID</span><h2>${esc(nickname)}</h2></div><button class="close-button" type="button" aria-label="Закрыть">×</button></header>`;
}
function publicProfileBadgeMarkup(badge,compact=false){return profileBadgeMarkup(badge,compact)}
function renderPublicFlareProfile(){
  const profile=profileState.publicData;if(!profile?.boing)return;
  const boing=profile.boing,badges=sortProfileBadges(Array.isArray(boing.badges)?boing.badges:[]).filter(badge=>badge.equipped),created=profile.created_at?dateFormat.format(new Date(profile.created_at)):'—';
  const stats=[['Голосование',`${formatProfileNumber(profile.votes_done)} / ${formatProfileNumber(profile.total_nominations)}`,'номинаций заполнено'],['Рекорд BOING!',formatProfileNumber(boing.best_score),'очков за один раунд'],['COINS',formatProfileNumber(boing.coins),'баланс участника'],['Во FLARE',formatProfileNumber(profile.days_with_flare),'дней с регистрации']];
  const content=`${publicProfileHeader(profile.nickname)}<div class="public-profile-body"><div class="profile-scroll public-profile-scroll"><div class="public-profile-layout"><div class="public-profile-info"><section class="profile-identity ${profile.banner?'has-custom-banner':''}">${profile.banner?`<img class="profile-banner" src="${profile.banner}" alt="Фотобаннер профиля">`:''}<div class="profile-identity-shade"></div><div class="profile-identity-main">${profileAvatarMarkup(profile)}<div class="profile-details"><div class="profile-nickname-line"><h3>${esc(profile.nickname)}</h3><div class="profile-equipped-badges">${badges.length?badges.map(badge=>publicProfileBadgeMarkup(badge,true)).join(''):'<span class="profile-no-badge">Без бейджей</span>'}</div></div><dl class="profile-meta"><div><dt>Дата регистрации</dt><dd>${esc(created)}</dd></div></dl></div></div></section><div class="profile-stats">${stats.map(([label,value,hint])=>`<div class="profile-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></div>`).join('')}</div><div class="profile-footer-actions public-profile-footer">${profileReputationMarkup(profile)}</div></div>${profileBobAside(boing)}</div></div></div>`;
  replaceModalView(content,'profile-modal public-profile-modal');$('#public-profile-back').onclick=()=>showBoingLeaders();bindProfileAvatarFallback();positionProfileBadgeTooltips();bindPublicReputationControls();
}
function bindPublicReputationControls(){
  $$('[data-reputation-value]',$('.public-profile-modal')||document).forEach(button=>button.onclick=()=>ratePublicProfile(Number(button.dataset.reputationValue)));
}
async function ratePublicProfile(value){
  const profile=profileState.publicData;if(!profile||profileState.busy||!profile.reputation?.can_rate)return;
  const nickname=profile.nickname,token=profileToken(),request=profileState.request;profileState.busy=true;$$('[data-reputation-value]',$('.public-profile-modal')||document).forEach(button=>button.disabled=true);
  try{
    const result=await rpc('set_profile_reputation',{p_token:token,p_nickname:nickname,p_value:value});if(token!==profileToken()||request!==profileState.request)return;
    let current=profile;if(result.awarded)current=await rpc('get_public_flare_profile',{p_token:token,p_nickname:nickname});
    profileState.publicData={...current,reputation:result.reputation};renderPublicFlareProfile();toast(result.value===0?'Оценка снята.':'Оценка сохранена.');
  }catch(error){toast(error.message);if(profileViewIsActive('public-profile'))$$('[data-reputation-value]',$('.public-profile-modal')||document).forEach(button=>button.disabled=false)}finally{profileState.busy=false}
}
async function showPublicFlareProfile(nickname){
  if(!nickname)return;
  pauseBoingScene();const request=++profileState.request,token=profileToken();profileState.view='public-profile';profileState.publicData=null;
  replaceModalView(`${publicProfileHeader(nickname)}<div class="profile-loading"><span class="profile-loading-orbit"></span><strong>${esc(nickname)}</strong><span>Открываем профиль участника…</span></div>`,'profile-modal public-profile-modal');
  $('#public-profile-back').onclick=()=>showBoingLeaders();
  try{
    const reputation=await rpc('prepare_flare_profile',{p_token:token,p_nickname:nickname});
    const profile=await rpc('get_public_flare_profile',{p_token:token,p_nickname:nickname});
    if(request!==profileState.request||token!==profileToken()||!profileViewIsActive('public-profile'))return;
    profileState.publicData={...profile,reputation};renderPublicFlareProfile();
  }catch(error){
    if(request!==profileState.request||!profileViewIsActive('public-profile'))return;
    replaceModalView(`${publicProfileHeader(nickname)}<div class="profile-error"><h3>${esc(nickname)}</h3><p>${esc(error.message)}</p><div><button class="button" id="public-profile-retry" type="button">Повторить</button></div></div>`,'profile-modal public-profile-modal');
    $('#public-profile-back').onclick=()=>showBoingLeaders();$('#public-profile-retry').onclick=()=>showPublicFlareProfile(nickname);
  }
}
$('#boing-quick-entry')?.addEventListener('click',openBoingQuickEntry);
updateBoingQuickEntry();
