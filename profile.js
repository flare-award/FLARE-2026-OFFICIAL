const profileState={data:null,request:0,view:'profile',email:null,leaderSort:'score',leaders:[],busy:false,shopCategory:'upgrades',publicData:null,badgeEditing:false,badgeDraft:null};
state.profile=profileState;
let boingScene=null,bobFaceEditor=null;
const numberFormat=new Intl.NumberFormat('ru-RU');
const dateFormat=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const formatProfileNumber=value=>numberFormat.format(Math.max(0,Number(value)||0));
const profileReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const profileToken=()=>state.session?.token||'';
const profileViewIsActive=view=>profileState.view===view&&Boolean($('.profile-modal'));
const boingSeenKey=nickname=>`flare-boing-intro:${String(nickname||'').toLowerCase()}`;
function readBoingSeen(nickname){try{return localStorage.getItem(boingSeenKey(nickname))==='1'}catch{return false}}
function writeBoingSeen(nickname){try{localStorage.setItem(boingSeenKey(nickname),'1')}catch{}}
function clearProfileState(){
  profileState.request++;profileState.data=null;profileState.email=null;profileState.leaders=[];profileState.publicData=null;profileState.badgeEditing=false;profileState.badgeDraft=null;profileState.view='profile';profileState.busy=false;
  teardownBoing(false);
}
function mergeBoingState(boing){
  if(!boing)return;
  const previousFace=profileState.data?.boing?.face;
  if(typeof boing.face==='undefined'&&typeof previousFace!=='undefined')boing={...boing,face:previousFace};
  profileState.data={...(profileState.data||{}),boing};
  updateBoingHud();
}
function profileHeader(title='Ваш аккаунт',mystery=false){
  return `<header class="profile-menu-head"><div class="profile-menu-heading"><span class="eyebrow">FLARE ID</span><h2>${esc(title)}</h2></div><div class="profile-head-actions">${mystery?'<button class="profile-mystery" id="open-boing" type="button" aria-label="Открыть BOING!" title="Что-то интересное">???</button>':''}<button class="close-button" type="button" aria-label="Закрыть">×</button></div></header>`;
}
function profileLoadingMarkup(){
  const nickname=state.session?.nickname||'Профиль';
  return `${profileHeader()}<div class="profile-loading" aria-live="polite"><span class="profile-loading-orbit"></span><strong>${esc(nickname)}</strong><span>Загружаем твой FLARE ID…</span></div>`;
}
function profileBadgeIcon(id){
  const paths={
    creator:'<path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z"/><path d="M6 21h12"/>',
    tester:'<path d="M9 3h6M10 3v6l-5 8c-1.2 2 .1 4 2.4 4h9.2c2.3 0 3.6-2 2.4-4l-5-8V3"/><path d="m8.5 15 2.2 2.2 4.8-5"/>',
    legend:'<path d="m12 2 8 7-8 13L4 9l8-7Z"/><path d="m4 9 8 3 8-3M12 12v10"/>',
    'boing-10k':'<path d="M8 4h8v5c0 3-1.8 5-4 5s-4-2-4-5V4Z"/><path d="M8 6H4v2c0 2 1.5 3 4 3m8-5h4v2c0 2-1.5 3-4 3M12 14v4m-4 3h8m-6-3h4"/>',
    'boing-100k':'<path d="m12 2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[id]||paths.legend}</svg>`;
}
function profileBadgeRarityLabel(rarity){return {special:'ОСОБЫЙ',rare:'РЕДКИЙ',legendary:'ЛЕГЕНДАРНЫЙ'}[rarity]||'ОСОБЫЙ'}
function profileBadgeMarkup(badge,compact=false,action=''){
  const classes=`profile-badge ${badge.equipped?'is-equipped':''} rarity-${esc(badge.rarity)}${action?' is-editing':''}`,tooltipId=`badge-tip-${compact?'compact-':''}${badge.id}`;
  const tooltip=`<span class="profile-badge-tooltip" id="${esc(tooltipId)}" role="tooltip"><strong>${esc(badge.name)}</strong><span class="profile-badge-rarity">${profileBadgeRarityLabel(badge.rarity)}</span><span class="profile-badge-description">${esc(badge.description)}</span></span>`;
  if(compact)return `<span class="${classes} profile-badge-compact" data-badge-id="${esc(badge.id)}" tabindex="0" aria-label="${esc(badge.name)}" aria-describedby="${esc(tooltipId)}"><span class="profile-badge-icon">${profileBadgeIcon(badge.id)}</span>${tooltip}</span>`;
  const actionMarkup=action?`<button class="profile-badge-action is-${action}" type="button" data-badge-${action}="${esc(badge.id)}" aria-label="${action==='remove'?'Снять':'Вернуть'} бейдж ${esc(badge.name)}" title="${action==='remove'?'Снять':'Вернуть'}"><svg viewBox="0 0 24 24" aria-hidden="true">${action==='remove'?'<path d="M6 12h12"/>':'<path d="M12 6v12M6 12h12"/>'}</svg></button>`:'';
  return `<div class="${classes}" data-badge-id="${esc(badge.id)}" tabindex="0" aria-describedby="${esc(tooltipId)}"><span class="profile-badge-icon">${profileBadgeIcon(badge.id)}</span><span>${esc(badge.name)}</span>${action?'':`<small>${badge.equipped?'Надет':'Снят'}</small>`}${actionMarkup}${tooltip}</div>`;
}
function profileBadgeEditToggleMarkup(){
  const save=profileState.badgeEditing;
  return `<button class="profile-badge-edit-toggle ${save?'is-save':''}" id="profile-badge-edit-toggle" type="button" aria-label="${save?'Сохранить расположение бейджей':'Изменить надетые бейджи'}" title="${save?'Сохранить':'Изменить бейджи'}"><svg viewBox="0 0 24 24" aria-hidden="true">${save?'<path d="m5 12 4 4L19 6"/>':'<path d="m14.5 5.5 4 4M4 20l3.8-.8L19 8a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L4.8 16.2 4 20Z"/><path d="m13 7 4 4"/>'}</svg></button>`;
}
function beginBoingBadgeEdit(){
  const badges=profileState.data?.boing?.badges||[];if(!badges.length||profileState.busy)return;
  profileState.badgeEditing=true;profileState.badgeDraft=badges.filter(badge=>badge.equipped).map(badge=>badge.id);renderProfile(true);
}
function changeBoingBadgeDraft(badgeId,equip){
  if(!profileState.badgeEditing||profileState.busy)return;
  const badges=profileState.data?.boing?.badges||[];if(!badges.some(badge=>badge.id===badgeId))return;
  const draft=new Set(Array.isArray(profileState.badgeDraft)?profileState.badgeDraft:[]);if(equip)draft.add(badgeId);else draft.delete(badgeId);
  profileState.badgeDraft=[...draft];renderProfile(true);if(!equip)$('.profile-badge-storage')?.scrollIntoView({block:'nearest'});
}
async function saveBoingBadgeLayout(){
  if(!profileState.badgeEditing||profileState.busy)return;
  const badges=profileState.data?.boing?.badges||[],draft=Array.isArray(profileState.badgeDraft)?profileState.badgeDraft:[];
  const before=badges.filter(badge=>badge.equipped).map(badge=>badge.id).sort(),after=[...draft].sort();
  if(JSON.stringify(before)===JSON.stringify(after)){profileState.badgeEditing=false;profileState.badgeDraft=null;renderProfile(true);return}
  const token=profileToken(),button=$('#profile-badge-edit-toggle');profileState.busy=true;if(button)button.disabled=true;
  try{
    const result=await rpc('set_my_boing_badges',{p_token:token,p_badge_ids:draft});if(token!==profileToken())return;
    mergeBoingState(result.boing);profileState.badgeEditing=false;profileState.badgeDraft=null;
    if(profileViewIsActive('profile'))renderProfile(true);toast('Бейджи сохранены.');
  }catch(error){toast(error.message);if(button?.isConnected)button.disabled=false}finally{profileState.busy=false}
}
function profileAvatarMarkup(profile,large=true){
  const nickname=profile.nickname||state.session?.nickname||'',boing=profile.boing||{},frame=boing.selected_frame||'frame-default';
  return `<div class="profile-avatar ${esc(frame)} ${large?'profile-avatar-large':''}"><span class="profile-avatar-fallback" aria-hidden="true">${esc(nickname.slice(0,1).toUpperCase()||'F')}</span><img src="${esc(photoSource(`avatar:${slugPhotoName(nickname)}`))}" data-photo-key="avatar:${esc(slugPhotoName(nickname))}" alt="Аватар ${esc(nickname)}"><span class="profile-avatar-lock" title="Аватар берётся из номинантов и не меняется" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span></div>`;
}
function profileStatsMarkup(profile){
  const boing=profile.boing||{};
  const stats=[
    ['Голосование',`${formatProfileNumber(profile.votes_done)} / ${formatProfileNumber(profile.total_nominations)}`,'номинаций заполнено'],
    ['Рекорд BOING!',formatProfileNumber(boing.best_score),'очков за один раунд'],
    ['COINS',formatProfileNumber(boing.coins),'доступно в магазине'],
    ['Во FLARE',formatProfileNumber(profile.days_with_flare),'дней с регистрации'],
    ['Всего кликов',formatProfileNumber(boing.total_clicks),'за все раунды BOING!'],
    ['Опрос',profile.event_answered?'Ответ дан':'Ещё нет','дата посещения премии']
  ];
  return `<div class="profile-stats">${stats.map(([label,value,hint])=>`<div class="profile-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></div>`).join('')}</div>`;
}
function renderProfile(preserveScroll=false){
  const previousScroll=preserveScroll?($('.profile-scroll')?.scrollTop||0):0,profile=profileState.data;
  if(!profile?.boing)return;
  const boing=profile.boing,badges=Array.isArray(boing.badges)?boing.badges:[],editing=profileState.badgeEditing,draft=editing&&Array.isArray(profileState.badgeDraft)?profileState.badgeDraft:badges.filter(b=>b.equipped).map(b=>b.id),equipped=badges.filter(b=>draft.includes(b.id)),removed=badges.filter(b=>!draft.includes(b.id)),hasBannerUpgrade=(boing.inventory||[]).includes('banner-custom');
  const visibleBadges=editing?equipped:badges,badgeList=visibleBadges.length?visibleBadges.map(b=>profileBadgeMarkup(b,false,editing?'remove':'')).join(''):`<p class="profile-empty-copy">${editing?'Все бейджи сняты. Их можно вернуть из окошка ниже.':'Пока пусто. Особенные бейджи выдаются за большие достижения и очень редко появляются в магазине.'}</p>`;
  const badgeStorage=editing?`<div class="profile-badge-storage"><div class="profile-badge-storage-title"><span>СНЯТЫЕ БЕЙДЖИ</span><small>Нажми +, чтобы вернуть</small></div><div class="profile-badges-list is-editing">${removed.length?removed.map(b=>profileBadgeMarkup({...b,equipped:false},false,'restore')).join(''):'<p class="profile-empty-copy">Все бейджи надеты.</p>'}</div></div>`:'';
  const badgeCollection=badges.length?`<div class="profile-badges-collection"><div class="profile-badges-list ${editing?'is-editing':''}">${badgeList}</div></div>${badgeStorage}`:`<div class="profile-badges-list">${badgeList}</div>`;
  const created=profile.created_at?dateFormat.format(new Date(profile.created_at)):'—';
  const content=`${profileHeader('Ваш аккаунт',true)}<div class="profile-scroll"><section class="profile-identity ${profile.banner?'has-custom-banner':''}">${profile.banner?`<img class="profile-banner" src="${profile.banner}" alt="Фотобаннер профиля">`:''}<div class="profile-identity-shade"></div><div class="profile-identity-main">${profileAvatarMarkup(profile)}<div class="profile-details"><div class="profile-nickname-line"><h3>${esc(profile.nickname)}</h3><span>УЧАСТНИК FLARE</span></div><div class="profile-equipped-badges">${equipped.length?equipped.map(b=>profileBadgeMarkup(b,true)).join(''):'<span class="profile-no-badge">Бейджи появятся здесь</span>'}${badges.length?profileBadgeEditToggleMarkup():''}</div><dl class="profile-meta"><div><dt>Регистрация</dt><dd>${esc(created)}</dd></div><div><dt>Email</dt><dd><span id="profile-email-value">${esc(profileState.email||profile.email_masked)}</span><button class="profile-email-toggle" id="profile-email-toggle" type="button">${profileState.email?'Скрыть':'Показать'}</button></dd></div></dl></div></div></section>${hasBannerUpgrade?`<div class="profile-banner-controls"><span>Фотобаннер · JPG, PNG или WebP до 12 МБ</span><div><label class="profile-small-button">Выбрать фото<input id="profile-banner-input" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button class="profile-small-button" id="profile-banner-remove" type="button" ${profile.banner?'':'disabled'}>Убрать</button></div></div>`:''}${profileStatsMarkup(profile)}${editing?`<section class="profile-badges-section is-editing"><div class="profile-section-title"><div><span class="eyebrow">КОЛЛЕКЦИЯ</span><h3>Бейджи</h3></div><span>${badges.length} получено</span></div>${badgeCollection}</section>`:''}<div class="profile-footer-actions"><span>Аватар синхронизирован с номинантами</span><button class="profile-logout" id="profile-logout" type="button">Выйти из аккаунта</button></div></div>`;
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
  profileState.view='profile';profileState.email=null;profileState.busy=false;profileState.badgeEditing=false;profileState.badgeDraft=null;
  const request=++profileState.request,token=profileToken();
  replaceModalView(profileLoadingMarkup(),'profile-modal account-profile-modal');
  try{
    const profile=await rpc('get_my_profile',{p_token:token});
    if(request!==profileState.request||token!==profileToken())return;
    profileState.data=profile;renderProfile();
  }catch(error){if(request===profileState.request&&token===profileToken())renderProfileError(error)}
}
async function logoutAccount(){
  const current=state.session;if(!current)return;
  teardownBoing(false);profileState.request++;profileState.data=null;profileState.email=null;
  state.session=null;localStorage.removeItem('flare-session');updateAccount();closeModal();
  rpc('flare_logout',{p_token:current.token}).catch(()=>{});toast('Ты вышел из аккаунта.');
}
function bindProfileAvatarFallback(){
  $$('.profile-avatar img').forEach(image=>{const hide=()=>image.closest('.profile-avatar')?.classList.add('no-image');if(image.complete&&image.naturalWidth===0)hide();else image.addEventListener('error',hide,{once:true})});
}
function bindProfileControls(){
  bindProfileAvatarFallback();
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
  $('#profile-badge-edit-toggle')?.addEventListener('click',()=>{if(profileState.badgeEditing)saveBoingBadgeLayout();else beginBoingBadgeEdit()});
  $$('[data-badge-remove]').forEach(button=>button.addEventListener('click',()=>changeBoingBadgeDraft(button.dataset.badgeRemove,false)));
  $$('[data-badge-restore]').forEach(button=>button.addEventListener('click',()=>changeBoingBadgeDraft(button.dataset.badgeRestore,true)));
  $('#profile-banner-input')?.addEventListener('change',handleProfileBanner);
  $('#profile-banner-remove')?.addEventListener('click',async event=>{
    const button=event.currentTarget,token=profileToken();button.disabled=true;
    try{await rpc('set_my_profile_banner',{p_token:token,p_data:null});if(token!==profileToken())return;if(profileViewIsActive('profile')){profileState.data.banner=null;renderProfile()}toast('Фотобаннер убран.')}catch(error){toast(error.message);if(button.isConnected)button.disabled=false}
  });
}
function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось прочитать фотографию.'));reader.readAsDataURL(file)})}
function loadImageElement(source){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось открыть фотографию.'));image.src=source})}
function canvasToJpeg(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось обработать фотографию.')),'image/jpeg',quality))}
async function prepareProfileBanner(file){
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))throw new Error('Можно загрузить только фотографию JPG, PNG или WebP. GIF и видео не поддерживаются.');
  if(file.size>12*1024*1024)throw new Error('Фотография должна быть меньше 12 МБ.');
  const source=await readFileAsDataUrl(file),image=await loadImageElement(source),scale=Math.min(1,1600/image.naturalWidth,1000/image.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#111110';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  let quality=.84,blob=await canvasToJpeg(canvas,quality);
  while(blob.size>490000&&quality>.5){quality-=.08;blob=await canvasToJpeg(canvas,quality)}
  if(blob.size>500000)throw new Error('Не удалось уменьшить фотографию до 500 КБ. Выбери другой кадр.');
  return await readFileAsDataUrl(blob);
}
async function handleProfileBanner(event){
  const input=event.currentTarget,file=input.files?.[0],token=profileToken();if(!file)return;
  const label=input.closest('label');label?.classList.add('is-busy');input.disabled=true;
  try{
    const data=await prepareProfileBanner(file);await rpc('set_my_profile_banner',{p_token:token,p_data:data});if(token!==profileToken())return;if(profileViewIsActive('profile')){profileState.data.banner=data;renderProfile()}toast('Фотобаннер сохранён.');
  }catch(error){toast(error.message);if(input.isConnected)input.disabled=false;label?.classList.remove('is-busy')}
}
function boingHeader(active='game'){
  return `<header class="boing-head"><button class="boing-back" id="boing-back" type="button" aria-label="Вернуться к аккаунту"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg><span>АККАУНТ</span></button><div class="boing-logo" aria-label="BOING!">BOING<span>!</span></div><button class="close-button" type="button" aria-label="Закрыть">×</button></header><nav class="boing-tabs" aria-label="Разделы BOING!"><button type="button" data-boing-view="game" class="${active==='game'?'is-active':''}">PLAY</button><button type="button" data-boing-view="leaders" class="${active==='leaders'?'is-active':''}">LEADERS</button><button type="button" data-boing-view="shop" class="${active==='shop'?'is-active':''}">SHOP</button></nav>`;
}
function bindBoingNavigation(active){
  $('#boing-back').onclick=finishBoingAndShowProfile;
  $$('[data-boing-view]').forEach(button=>button.onclick=()=>{if(button.dataset.boingView===active)return;if(button.dataset.boingView==='game')renderBoingGame();else if(button.dataset.boingView==='shop')showBoingShop();else showBoingLeaders()});
}
function bobAccessoryMarkup(accessory){
  if(accessory==='bob-crown')return '<span class="bob-crown" aria-hidden="true"><i></i><i></i><i></i></span>';
  if(accessory==='bob-cap')return '<span class="bob-cap" aria-hidden="true"></span>';
  if(accessory==='bob-shades')return '<span class="bob-shades" aria-hidden="true"><i></i><i></i></span>';
  return '';
}
function bobFaceMarkup(boing){
  if(boing?.face)return `<img class="bob-custom-face" src="${esc(boing.face)}" alt="" draggable="false">`;
  return '<i class="bob-eye bob-eye-left"></i><i class="bob-eye bob-eye-right"></i><i class="bob-mouth"></i><i class="bob-cheek bob-cheek-left"></i><i class="bob-cheek bob-cheek-right"></i>';
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
function renderBoingGame(){
  if(!profileState.data?.boing)return;
  bobFaceEditor=null;profileState.view='game';
  const scene=ensureBoingScene(),boing=profileState.data.boing;
  scene.running=false;cancelAnimationFrame(scene.raf);scene.raf=0;
  const hint=scene.score>0?'НАЖМИ НА BOB, ЧТОБЫ ПРОДОЛЖИТЬ':'НАЖМИ НА BOB, ЧТОБЫ НАЧАТЬ';
  const content=`${boingHeader('game')}<div class="boing-game-layout"><div class="boing-hud"><div><span>SCORE</span><strong id="boing-score">${formatProfileNumber(scene.score)}</strong></div><div><span>BEST</span><strong id="boing-best">${formatProfileNumber(Math.max(boing.best_score,scene.score))}</strong></div><div><span>COINS</span><strong id="boing-coins">${formatProfileNumber(boing.coins)}</strong></div></div><div class="boing-arena" id="boing-arena"><div class="boing-level">LEVEL 1 <span>НЕ УРОНИ BOB</span></div><div class="boing-hint" id="boing-hint">${hint}</div><button class="bob" id="bob" type="button" aria-label="Кликнуть по BOB и получить очки"><span class="bob-name" id="bob-name">${esc(boing.bob_name)}</span>${bobCharacterMarkup(boing)}</button><button class="bob-face-edit" id="bob-face-edit" type="button" aria-label="Нарисовать лицо BOB" title="Нарисовать лицо" ${canEditBobFace(scene)?'':'hidden'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5 4 4M4 20l3.8-.8L19 8a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L4.8 16.2 4 20Z"/><path d="m13 7 4 4"/></svg></button><div class="boing-impact" id="boing-impact" aria-live="polite"></div><div class="boing-floor"><span>FLOOR</span></div></div><div class="boing-game-footer"><button class="boing-rename" id="boing-rename" type="button">Переименовать BOB <span id="boing-rename-price">${boing.free_renames_left?`бесплатно · ${boing.free_renames_left}`:'10 000 COINS'}</span></button><div class="boing-milestone-wrap"><div class="boing-milestone"><span id="boing-milestone-label">До следующей цели</span><div><i id="boing-milestone-fill"></i></div></div><small>COINS за каждые 100 общих очков · больше после 1 000, 10 000, 50 000 и 100 000</small></div></div></div>`;
  replaceModalView(content,'profile-modal boing-modal');
  bindBoingNavigation('game');
  scene.element=$('#bob');scene.arena=$('#boing-arena');
  scene.observer?.disconnect();
  if('ResizeObserver'in window){scene.observer=new ResizeObserver(()=>resetBobPosition(scene,false));scene.observer.observe(scene.arena)}
  resetBobPosition(scene,true);updateBoingHud();
  scene.element.addEventListener('click',()=>clickBob(scene));
  $('#bob-face-edit').onclick=showBoingFaceEditor;
  $('#boing-rename').onclick=showBoingRename;
}
function resetBobPosition(scene,force=false){
  if(!scene?.arena?.isConnected||!scene.element)return;
  const width=scene.arena.clientWidth,height=scene.arena.clientHeight;if(!width||!height)return;
  scene.size=scene.element.offsetWidth||104;
  if(force||!scene.running){scene.x=Math.max(0,(width-scene.size)/2);scene.y=Math.max(32,(height-scene.size)*.38);scene.vx=0;scene.vy=0;scene.rotation=0;scene.spin=0}
  else{scene.x=clamp(scene.x,0,Math.max(0,width-scene.size));scene.y=clamp(scene.y,0,Math.max(0,height-scene.size))}
  paintBob(scene);
}
function paintBob(scene){
  if(!scene?.element?.isConnected)return;
  scene.element.style.transform=`translate3d(${scene.x}px,${scene.y}px,0) rotate(${scene.rotation}deg)`;
  const edit=$('#bob-face-edit');
  if(edit){edit.hidden=!canEditBobFace(scene);edit.style.transform=`translate3d(${scene.x+scene.size-7}px,${scene.y+5}px,0)`}
}
function updateBoingHud(){
  const boing=profileState.data?.boing;if(!boing)return;
  const scene=boingScene,score=scene?.score||0;
  if($('#boing-score'))$('#boing-score').textContent=formatProfileNumber(score);
  if($('#boing-best'))$('#boing-best').textContent=formatProfileNumber(Math.max(Number(boing.best_score)||0,score));
  if($('#boing-coins'))$('#boing-coins').textContent=formatProfileNumber(boing.coins);
  const progress=(Number(boing.total_score)||0)%100;
  if($('#boing-milestone-fill'))$('#boing-milestone-fill').style.width=`${progress}%`;
  if($('#boing-milestone-label'))$('#boing-milestone-label').textContent=progress?`${100-progress} очков до COINS`:'100 очков до COINS';
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
    if(scene.destroyed){await rpc('sync_boing_run',{p_token:token,p_run_id:data.run_id,p_clicks:scene.clicks,p_failed:true});scene.runId=null;return}
    mergeBoingState(data.boing);queueBoingSync(scene,false);
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
    const data=await rpc('sync_boing_run',{p_token:token,p_run_id:runId,p_clicks:clicks,p_failed:Boolean(failed)});
    if(scene.destroyed)return;
    mergeBoingState(data.boing);scene.syncedClicks=Math.max(scene.syncedClicks,clicks);
    if(failed){if(scene.runId===runId)scene.runId=null;return}
    if(scene.clicks===clicks&&data.boing?.active_run){scene.score=Number(data.boing.active_run.score)||scene.score;updateBoingHud()}
    if(scene.clicks>scene.syncedClicks)scheduleBoingSync(scene);
  }).catch(error=>{if(!scene.destroyed){toast(error.message);if(!failed)scheduleBoingSync(scene)}});
}
function scheduleBoingSync(scene){
  if(!scene||scene.destroyed||scene.failed||scene.syncScheduled)return;
  scene.syncScheduled=true;
  scene.syncTimer=setTimeout(()=>{scene.syncScheduled=false;queueBoingSync(scene,false)},550);
}
function clickBob(scene){
  if(!scene||scene.destroyed||scene.locked||scene.failed||!scene.arena?.isConnected)return;
  if(!scene.runId)startBoingRun(scene);
  const boing=profileState.data.boing,points=Math.max(1,Number(boing.points_per_click)||1);
  scene.score+=points;scene.clicks++;scene.running=true;
  scene.vy=-Math.min(790,620+Math.random()*90);scene.vx=clamp(scene.vx*.35+(Math.random()*360-180),-340,340);
  const spinDirection=Math.sign(scene.vx)||(Math.random()<.5?-1:1);scene.spin=clamp(scene.spin*.25+spinDirection*(280+Math.abs(scene.vx)*1.15),-760,760);
  scene.arena.classList.add('is-playing');$('#boing-hint').textContent='';paintBob(scene);
  if(!scene.raf){scene.last=performance.now();scene.raf=requestAnimationFrame(now=>stepBoing(scene,now))}
  updateBoingHud();if(scene.runId)scheduleBoingSync(scene);
}
function failBoingRound(scene){
  if(scene.failed||scene.destroyed)return;
  scene.failed=true;scene.running=false;scene.locked=true;cancelAnimationFrame(scene.raf);scene.raf=0;
  scene.arena?.classList.add('is-failed');if($('#boing-impact'))$('#boing-impact').textContent='OUCH! СОХРАНЯЕМ РЕЗУЛЬТАТ…';
  queueBoingSync(scene,true).finally(()=>{
    if(scene.destroyed)return;
    scene.runId=null;scene.score=0;scene.clicks=0;scene.syncedClicks=0;scene.failed=false;scene.locked=false;scene.vx=0;scene.vy=0;
    scene.arena?.classList.remove('is-failed','is-playing');if($('#boing-impact'))$('#boing-impact').textContent='';if($('#boing-hint'))$('#boing-hint').textContent='ЕЩЁ РАЗ! НАЖМИ НА BOB';
    resetBobPosition(scene,true);updateBoingHud();
  });
}
function stepBoing(scene,now){
  if(!scene.running||scene.destroyed||!scene.arena?.isConnected){scene.raf=0;return}
  const dt=Math.min(.032,Math.max(.001,(now-scene.last)/1000));scene.last=now;
  const width=scene.arena.clientWidth,height=scene.arena.clientHeight,floor=height-scene.size-8;
  scene.vy+=1540*dt;scene.x+=scene.vx*dt;scene.y+=scene.vy*dt;scene.rotation+=scene.spin*dt;
  if(scene.x<=0){scene.x=0;scene.vx=Math.abs(scene.vx)*.82}else if(scene.x>=width-scene.size){scene.x=width-scene.size;scene.vx=-Math.abs(scene.vx)*.82}
  if(scene.y<=0){scene.y=0;scene.vy=Math.abs(scene.vy)*.72}
  if(scene.y>=floor){scene.y=floor;paintBob(scene);failBoingRound(scene);return}
  paintBob(scene);scene.raf=requestAnimationFrame(time=>stepBoing(scene,time));
}
function teardownBoing(sync=true){
  bobFaceEditor=null;
  const scene=boingScene;if(!scene)return;
  boingScene=null;scene.destroyed=true;scene.running=false;clearTimeout(scene.syncTimer);cancelAnimationFrame(scene.raf);scene.observer?.disconnect();
  if(sync&&scene.runId&&profileToken())queueBoingSync(scene,true);
}
async function finishBoingAndShowProfile(){
  const scene=boingScene;if(scene?.finishing)return;
  if(scene){
    scene.finishing=true;scene.locked=true;pauseBoingScene();
    if(scene.starting)await scene.queue.catch(()=>{});
    if(scene.runId)await queueBoingSync(scene,true);
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
  if(!boing.game_intro_seen){boing.game_intro_seen=true;writeBoingSeen(state.session?.nickname);rpc('mark_boing_intro_seen',{p_token:profileToken()}).catch(error=>console.info('Отметка о входе в BOING! не сохранена:',error.message))}
}
function showBoingRename(){
  const boing=profileState.data?.boing;if(!boing)return;
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
    editor.context.clearRect(0,0,editor.canvas.width,editor.canvas.height);editor.context.drawImage(image,0,0,editor.canvas.width,editor.canvas.height);
    editor.imported=true;pushBobFaceHistory(editor);toast('PNG добавлена. Сохрани лицо BOB.');
  }catch(error){toast(error.message)}finally{
    editor.busy=false;if(input.isConnected){input.disabled=false;input.value='';label?.classList.remove('is-busy')}if(save?.isConnected)save.disabled=false;
  }
}
async function saveBobFaceEditor(editor){
  if(!editor||!editor.ready||editor.busy)return;
  const token=profileToken(),button=$('#bob-face-save');editor.busy=true;if(button){button.disabled=true;button.textContent='Сохраняем…'}
  try{
    const pixels=editor.context.getImageData(0,0,editor.canvas.width,editor.canvas.height).data;let hasDrawing=false;
    for(let i=3;i<pixels.length;i+=4){if(pixels[i]){hasDrawing=true;break}}
    let data=null;
    if(hasDrawing){const blob=await canvasToPng(editor.canvas);if(blob.size>150000)throw new Error('Рисунок получился слишком сложным. Удали часть штрихов.');data=await readFileAsDataUrl(blob)}
    const result=await rpc(editor.imported?'upload_my_boing_face':'set_my_boing_face',{p_token:token,p_data:data});if(token!==profileToken())return;
    mergeBoingState(result.boing);toast(data?'Лицо BOB сохранено.':'Стандартное лицо BOB возвращено.');
    if(profileViewIsActive('face'))renderBoingGame();
  }catch(error){toast(error.message);editor.busy=false;if(button?.isConnected){button.disabled=false;button.textContent='Сохранить лицо'}}
}
function showBoingFaceEditor(){
  const scene=boingScene,boing=profileState.data?.boing;
  if(!boing||!canEditBobFace(scene)){toast('Лицо можно менять перед началом нового раунда.');return}
  pauseBoingScene();profileState.view='face';
  const canUpload=(boing.inventory||[]).includes('bob-face-upload');
  const uploadControls=canUpload?`<div class="bob-face-upload-row"><label class="profile-small-button bob-face-upload-label is-disabled" id="bob-face-upload-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>Загрузить PNG<input id="bob-face-upload-input" type="file" accept="image/png,.png" hidden disabled></label><span>до 12 МБ · кадрируется в круг</span></div>`:'';
  const content=`${boingHeader('game')}<section class="bob-face-editor ${canUpload?'has-upload':''}"><div class="bob-face-editor-head"><span class="eyebrow">BOB FACE STUDIO</span><h3>Твой BOB. Твои правила.</h3><p>${canUpload?'Нарисуй лицо или загрузи свою PNG. Пустой холст вернёт стандартную улыбку.':'Нарисуй лицо прямо на круге. Пустой холст вернёт стандартную улыбку.'}</p></div><div class="bob-face-stage"><div class="bob-face-canvas-shell"><span class="bob-face-editor-body" aria-hidden="true"></span><canvas id="bob-face-canvas" width="320" height="320" aria-label="Холст для рисования лица BOB"></canvas></div><div class="bob-face-toolbar"><div class="bob-face-brushes" role="group" aria-label="Размер кисти"><button type="button" data-face-brush="3" aria-label="Тонкая кисть" title="Тонкая кисть"><i></i></button><button type="button" data-face-brush="6" class="is-active" aria-label="Средняя кисть" title="Средняя кисть"><i></i></button><button type="button" data-face-brush="11" aria-label="Толстая кисть" title="Толстая кисть"><i></i></button></div><span></span><button type="button" id="bob-face-undo" aria-label="Отменить штрих" title="Отменить штрих" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7-5 5 5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg></button><button type="button" id="bob-face-clear" aria-label="Очистить холст" title="Очистить холст"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg></button></div>${uploadControls}</div><div class="bob-face-actions"><span>PNG · прозрачный фон</span><div><button class="profile-small-button" id="bob-face-cancel" type="button">Не менять</button><button class="button" id="bob-face-save" type="button" disabled>Сохранить лицо</button></div></div></section>`;
  replaceModalView(content,'profile-modal boing-modal bob-face-modal');bindBoingNavigation('game');
  const canvas=$('#bob-face-canvas'),context=canvas.getContext('2d');context.lineCap='round';context.lineJoin='round';context.strokeStyle='#211c13';
  const editor={canvas,context,history:[],index:-1,size:6,drawing:false,ready:false,busy:false,imported:false};bobFaceEditor=editor;
  const ready=()=>{if(bobFaceEditor!==editor)return;editor.ready=true;pushBobFaceHistory(editor);const save=$('#bob-face-save'),upload=$('#bob-face-upload-input');if(save)save.disabled=false;if(upload){upload.disabled=false;$('#bob-face-upload-label')?.classList.remove('is-disabled')}};
  if(boing.face)loadImageElement(boing.face).then(image=>{if(bobFaceEditor!==editor)return;context.drawImage(image,0,0,canvas.width,canvas.height);ready()}).catch(()=>ready());else ready();
  const finish=event=>{if(!editor.drawing)return;editor.drawing=false;try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)}catch{}pushBobFaceHistory(editor)};
  canvas.addEventListener('pointerdown',event=>{if(!editor.ready||editor.busy)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);const point=bobFacePoint(editor,event);editor.drawing=true;context.lineWidth=editor.size;context.beginPath();context.moveTo(point.x,point.y);context.lineTo(point.x+.01,point.y);context.stroke()});
  canvas.addEventListener('pointermove',event=>{if(!editor.drawing||editor.busy)return;event.preventDefault();const point=bobFacePoint(editor,event);context.lineTo(point.x,point.y);context.stroke()});
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  $$('[data-face-brush]').forEach(button=>button.onclick=()=>{if(editor.busy)return;editor.size=Number(button.dataset.faceBrush);$$('[data-face-brush]').forEach(item=>item.classList.toggle('is-active',item===button))});
  $('#bob-face-undo').onclick=()=>restoreBobFaceHistory(editor);
  $('#bob-face-clear').onclick=()=>{if(!editor.ready||editor.busy)return;context.clearRect(0,0,canvas.width,canvas.height);pushBobFaceHistory(editor)};
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
const boingShopGroups={upgrades:{label:'Апгрейды',kinds:['click','coin']},cosmetics:{label:'Косметика',kinds:['accessory','leader','face']},profile:{label:'Профиль',kinds:['frame','banner','badge']}};
const boingShopKindLabels={click:'CLICK',coin:'COINS',accessory:'BOB',leader:'LEADERS',face:'BOB PNG',frame:'AVATAR',banner:'PROFILE',badge:'BADGE'};
function showBoingShop(category=profileState.shopCategory||'upgrades'){
  const boing=profileState.data?.boing;if(!boing)return;
  if(!boingShopGroups[category])category='upgrades';
  pauseBoingScene();profileState.view='shop';profileState.shopCategory=category;
  const allItems=Array.isArray(boing.shop)?boing.shop:[],items=allItems.filter(item=>boingShopGroups[category].kinds.includes(item.kind));
  const tabs=Object.entries(boingShopGroups).map(([id,group])=>`<button type="button" data-shop-category="${id}" class="${id===category?'is-active':''}">${group.label}</button>`).join('');
  replaceModalView(`${boingHeader('shop')}<div class="boing-panel-scroll"><nav class="boing-shop-categories" aria-label="Категории магазина">${tabs}</nav><div class="boing-shop-balance"><span>ТВОЙ БАЛАНС</span><strong>${formatProfileNumber(boing.coins)} <small>COINS</small></strong></div><div class="boing-shop-grid">${items.map(item=>`<article class="boing-shop-item kind-${esc(item.kind)}"><div class="boing-shop-item-top"><span>${esc(boingShopKindLabels[item.kind]||item.kind)}</span>${item.kind==='click'||item.kind==='coin'?`<small>LVL ${item.level} / ${item.max_level}</small>`:''}</div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="boing-shop-item-action">${shopItemButton(item,boing)}</div></article>`).join('')}</div><p class="boing-shop-note">${category==='upgrades'?'Улучшения действуют на все следующие клики и начисления COINS.':category==='cosmetics'?'Аксессуары можно надевать и снимать. BOB NAME IN LEADERS открывает имя в таблице, а BOB PNG FACE — загрузку своих PNG.':'Рамки можно менять, баннер загружается в профиле, а новый бейдж надевается автоматически.'}</p></div>`,'profile-modal boing-modal');
  bindBoingNavigation('shop');
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
  replaceModalView(`${boingHeader('leaders')}<div class="boing-leaders-panel"><div class="boing-leaders-head"><div><span class="eyebrow">ТОЛЬКО ИГРОКИ</span><h3>LEADERS</h3></div><div class="boing-leader-sort"><button type="button" data-leader-sort="score" class="${sort==='score'?'is-active':''}">По очкам</button><button type="button" data-leader-sort="coins" class="${sort==='coins'?'is-active':''}">По COINS</button></div></div><div class="boing-leaders-loading"><span class="profile-loading-orbit"></span><p>Считаем рекорды…</p></div></div>`,'profile-modal boing-modal');
  bindBoingNavigation('leaders');$$('[data-leader-sort]').forEach(button=>button.onclick=()=>showBoingLeaders(button.dataset.leaderSort));
  try{
    const token=profileToken(),result=await rpc('get_boing_leaders',{p_token:token,p_sort:sort});
    if(request!==profileState.request||token!==profileToken()||!profileViewIsActive('leaders')||sort!==profileState.leaderSort)return;
    profileState.leaders=result.leaders||[];renderBoingLeaderRows();
  }catch(error){const loading=$('.boing-leaders-loading');if(request===profileState.request&&profileViewIsActive('leaders')&&loading)loading.innerHTML=`<p>${esc(error.message)}</p>`}
}
function renderBoingLeaderRows(){
  const panel=$('.boing-leaders-panel');if(!panel)return;
  const rows=profileState.leaders.length?profileState.leaders.map(player=>`<div class="boing-leader-row ${player.nickname===state.session?.nickname?'is-me':''}"><span class="boing-leader-rank">${String(player.rank).padStart(2,'0')}</span><div><button class="boing-leader-name" type="button" data-public-profile="${esc(player.nickname)}" aria-label="Открыть профиль ${esc(player.nickname)}"><strong>${esc(player.nickname)}</strong></button><small>${player.bob_name?`BOB: ${esc(player.bob_name)}`:'Имя BOB скрыто'}</small></div><span><b>${formatProfileNumber(player.best_score)}</b><small>очков</small></span><span><b>${formatProfileNumber(player.coins)}</b><small>COINS</small></span></div>`).join(''):'<div class="boing-leaders-empty"><strong>Пока никто не играл</strong><p>Первый рекорд может быть твоим.</p></div>';
  $('.boing-leaders-loading',panel)?.remove();panel.insertAdjacentHTML('beforeend',`<div class="boing-leader-list">${rows}</div>`);
  $$('[data-public-profile]',panel).forEach(button=>button.onclick=()=>showPublicFlareProfile(button.dataset.publicProfile));
}
function publicProfileHeader(nickname='Профиль участника'){
  return `<header class="public-profile-head"><button class="boing-back" id="public-profile-back" type="button" aria-label="Вернуться к лидерам"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg><span>LEADERS</span></button><div><span class="eyebrow">FLARE ID</span><h2>${esc(nickname)}</h2></div><button class="close-button" type="button" aria-label="Закрыть">×</button></header>`;
}
function publicProfileBadgeMarkup(badge,compact=false){return profileBadgeMarkup(badge,compact)}
function renderPublicFlareProfile(){
  const profile=profileState.publicData;if(!profile?.boing)return;
  const boing=profile.boing,badges=Array.isArray(boing.badges)?boing.badges:[],created=profile.created_at?dateFormat.format(new Date(profile.created_at)):'—';
  const stats=[['Голосование',`${formatProfileNumber(profile.votes_done)} / ${formatProfileNumber(profile.total_nominations)}`,'номинаций заполнено'],['Рекорд BOING!',formatProfileNumber(boing.best_score),'очков за один раунд'],['COINS',formatProfileNumber(boing.coins),'баланс участника'],['Во FLARE',formatProfileNumber(profile.days_with_flare),'дней с регистрации'],['Всего кликов',formatProfileNumber(boing.total_clicks),'за все раунды BOING!']];
  const content=`${publicProfileHeader(profile.nickname)}<div class="public-profile-body"><div class="profile-scroll public-profile-scroll"><div class="public-profile-layout"><div class="public-profile-info"><section class="profile-identity ${profile.banner?'has-custom-banner':''}">${profile.banner?`<img class="profile-banner" src="${profile.banner}" alt="Фотобаннер профиля">`:''}<div class="profile-identity-shade"></div><div class="profile-identity-main">${profileAvatarMarkup(profile)}<div class="profile-details"><div class="profile-nickname-line"><h3>${esc(profile.nickname)}</h3><span>УЧАСТНИК FLARE</span></div><div class="profile-equipped-badges">${badges.length?badges.map(badge=>publicProfileBadgeMarkup(badge,true)).join(''):'<span class="profile-no-badge">Без бейджей</span>'}</div><dl class="profile-meta"><div><dt>Регистрация</dt><dd>${esc(created)}</dd></div></dl></div></div></section><div class="profile-stats">${stats.map(([label,value,hint])=>`<div class="profile-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></div>`).join('')}</div><section class="profile-badges-section"><div class="profile-section-title"><div><span class="eyebrow">КОЛЛЕКЦИЯ</span><h3>Бейджи</h3></div><span>${badges.length} получено</span></div><div class="profile-badges-list">${badges.length?badges.map(badge=>publicProfileBadgeMarkup(badge)).join(''):'<p class="profile-empty-copy">Пока нет полученных бейджей.</p>'}</div></section></div></div></div><aside class="public-profile-bob-card"><span>BOB УЧАСТНИКА</span><div class="bob public-bob-character" aria-label="BOB участника ${esc(profile.nickname)}">${bobCharacterMarkup(boing)}</div><strong>${esc(boing.bob_name||'BOB')}</strong><small>${boing.face?'лицо нарисовано в BOING!':'классическое лицо BOB'}</small></aside></div>`;
  replaceModalView(content,'profile-modal public-profile-modal');$('#public-profile-back').onclick=()=>showBoingLeaders();bindProfileAvatarFallback();
}
async function showPublicFlareProfile(nickname){
  if(!nickname)return;
  pauseBoingScene();const request=++profileState.request,token=profileToken();profileState.view='public-profile';profileState.publicData=null;
  replaceModalView(`${publicProfileHeader(nickname)}<div class="profile-loading"><span class="profile-loading-orbit"></span><strong>${esc(nickname)}</strong><span>Открываем профиль участника…</span></div>`,'profile-modal public-profile-modal');
  $('#public-profile-back').onclick=()=>showBoingLeaders();
  try{
    const profile=await rpc('get_public_flare_profile',{p_token:token,p_nickname:nickname});
    if(request!==profileState.request||token!==profileToken()||!profileViewIsActive('public-profile'))return;
    profileState.publicData=profile;renderPublicFlareProfile();
  }catch(error){
    if(request!==profileState.request||!profileViewIsActive('public-profile'))return;
    replaceModalView(`${publicProfileHeader(nickname)}<div class="profile-error"><h3>${esc(nickname)}</h3><p>${esc(error.message)}</p><div><button class="button" id="public-profile-retry" type="button">Повторить</button></div></div>`,'profile-modal public-profile-modal');
    $('#public-profile-back').onclick=()=>showBoingLeaders();$('#public-profile-retry').onclick=()=>showPublicFlareProfile(nickname);
  }
}
