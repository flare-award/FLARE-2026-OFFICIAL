const CONFIG=window.FLARE_CONFIG||{};
const nomineeViewIds=new Set(['standard','compact','list']);
function loadNomineeViewPreference(nickname){try{const accountView=nickname?localStorage.getItem(`flare-nominee-view:${String(nickname).toLowerCase()}`):null,saved=accountView||localStorage.getItem('flare-nominee-view');return nomineeViewIds.has(saved)?saved:'standard'}catch{return 'standard'}}
function saveNomineeViewPreference(view,nickname){if(!nomineeViewIds.has(view))return;try{localStorage.setItem('flare-nominee-view',view);if(nickname)localStorage.setItem(`flare-nominee-view:${String(nickname).toLowerCase()}`,view)}catch{}}
const initialSession=JSON.parse(localStorage.getItem('flare-session')||'null');
let nomineeViewRevision=0;
const nomineeViewWriteQueues=new Map();
const state={session:initialSession,votes:{},eventChoice:null,eventSaved:null,eventResults:null,eventSaving:false,eventChoiceRevision:0,hiddenOptionIds:[],category:'основная',nomination:null,selected:null,carousel:0,busy:false,nominationListScrollTop:0,pendingCategory:null,nomineeView:loadNomineeViewPreference(initialSession?.nickname)};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const closing=new Date('2026-11-22T00:00:00+03:00');
const ceremonyDates={
  'dec-4':new Date('2026-12-04T00:00:00+03:00'),
  'dec-5':new Date('2026-12-05T00:00:00+03:00'),
  'dec-6':new Date('2026-12-06T00:00:00+03:00')
};
const eventChoiceLabels={'dec-4':'4 декабря','dec-5':'5 декабря','dec-6':'6 декабря'};
const winnersReleaseDate=new Date('2026-12-06T00:00:00+03:00');
const selfHoverMessages=['ЗА СЕБЯ НЕЛЬЗЯ ГОЛОСОВАТЬ','УБЕРИ КУРСОР','МНОГО ХОЧЕШЬ','КУДА ЛЕЗЕШЬ?','ЧИТАЙ ПРАВИЛА','ИДИ НАХУЙ','ТЫ СЛУЧАЕМ НЕ АХУЕЛ?','ДОСТУП ОТКЛОНЁН','СПАСИБО ЗА ПОНИМАНИЕ','НЕ ПОЛУЧАЕТСЯ?','ЭГОИСТ','ПИДОРАС ОБНАРУЖЕН','НЕ СЕЙЧАС','Я СКАЗАЛ НЕЛЬЗЯ','ПОПРОБУЙ ЕЩЁ РАЗ','ЩА ПОЧИНЮ, ПОДОЖДИ'];
const isClosed=()=>Date.now()>=closing.getTime();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clientReady=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&!CONFIG.supabaseUrl.includes('YOUR_')&&!CONFIG.supabaseAnonKey.includes('YOUR_'));
function toast(message){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.append(el)}el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2800)}
async function rpc(name,args={}){if(!clientReady())throw new Error('Сначала добавьте URL и anon key Supabase в config.js.');const headers={'Content-Type':'application/json','apikey':CONFIG.supabaseAnonKey,'Authorization':`Bearer ${CONFIG.supabaseAnonKey}`};const response=await fetch(`${CONFIG.supabaseUrl.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args)});let result;try{result=await response.json()}catch{result={}}if(!response.ok)throw new Error(result.message||result.details||'Не удалось связаться с Supabase.');return result}
function saveSession(s){state.session=s;state.nomineeView=loadNomineeViewPreference(s.nickname);state.hiddenOptionIds=Array.isArray(s.hidden_option_ids)?s.hidden_option_ids:[];localStorage.setItem('flare-session',JSON.stringify(s));updateAccount()}
function persistNomineeViewPreference(view){
  nomineeViewRevision++;saveNomineeViewPreference(view,state.session?.nickname);
  const token=state.session?.token;if(!token)return;
  const previous=nomineeViewWriteQueues.get(token)||Promise.resolve();
  const write=previous.catch(()=>{}).then(()=>rpc('set_my_nominee_view',{p_token:token,p_view:view})).catch(error=>console.info('Вид списка пока сохранён только на этом устройстве:',error.message));
  nomineeViewWriteQueues.set(token,write);
}
async function restoreNomineeViewFromAccount(token){
  const revision=nomineeViewRevision;
  try{const view=await rpc('get_my_nominee_view',{p_token:token});if(state.session?.token!==token||revision!==nomineeViewRevision)return;if(!nomineeViewIds.has(view)){if(view===null)persistNomineeViewPreference(state.nomineeView);return}state.nomineeView=view;saveNomineeViewPreference(view,state.session.nickname);syncNomineeViewUi()}
  catch(error){console.info('Настройка вида аккаунта пока не загружена:',error.message)}
}
function updateAccount(){
  const s=state.session,button=$('#auth-button');
  button.innerHTML=`<span class="account-button-label">${esc(s?s.nickname:'Войти')}</span>`;
  button.classList.toggle('is-signed-in',Boolean(s));
  button.setAttribute('aria-label',s?`Открыть профиль ${s.nickname}`:'Войти или зарегистрироваться');
  $('#account-status').innerHTML=s?.nickname.toLowerCase()==='maronnix'?'<button type="button" class="text-button" id="admin-entry">Панель</button>':'';
  $('#admin-entry')?.addEventListener('click',showAdmin);
  updateProgress();
  if(typeof updateBoingQuickEntry==='function')updateBoingQuickEntry();
  if(!s&&typeof clearProfileState==='function')clearProfileState();
  if(s){
    const accountToken=s.token,choiceRevision=state.eventChoiceRevision;
    restoreNomineeViewFromAccount(accountToken);
    rpc('get_my_ballot',{p_token:accountToken}).then(data=>{
      if(state.session?.token!==accountToken)return;
      state.votes=data.votes||{};state.hiddenOptionIds=Array.isArray(data.hidden_option_ids)?data.hidden_option_ids:[];
      if(state.session)state.session.is_test_account=Boolean(data.is_test_account);
      state.eventSaved=data.event_choice||null;if(state.eventChoiceRevision===choiceRevision)state.eventChoice=state.eventSaved;state.eventResults=data.event_results||null;state.session.ballot_submitted=Boolean(data.ballot_submitted);localStorage.setItem('flare-session',JSON.stringify(state.session));
      if(state.eventChoiceRevision!==choiceRevision&&state.eventChoice&&state.eventChoice!==state.eventSaved)saveEvent();
      updateProgress();renderEventOptions();
    }).catch(e=>{
      console.warn(e);
      if(state.session?.token===accountToken&&/session|token|авторизац|доступ к аккаунтам временно закрыт/i.test(e.message)){
        localStorage.removeItem('flare-session');state.session=null;state.hiddenOptionIds=[];updateAccount();if(/доступ к аккаунтам временно закрыт/i.test(e.message))toast('Для аккаунта временно закрыт доступ.');
      }
    });
  }else{
    state.votes={};state.hiddenOptionIds=[];state.eventChoice=null;state.eventSaved=null;state.eventResults=null;updateProgress();renderEventOptions();
  }
}
function updateProgress(){const total=nominations.length,done=Object.keys(state.votes).length;$('#overall-progress').textContent=state.session?`Проголосовано: ${done}/${total}`:'Войди, чтобы голосовать';$('#deadline-banner').hidden=!isClosed();$('#event-poll-status').textContent=!state.session?'Войди в аккаунт, чтобы ответить на опрос.':state.eventSaving?'Сохраняем твой ответ…':state.eventSaved?'Твой ответ сохранён. Нажми другой вариант, чтобы изменить его.':'Нажми на вариант — ответ сохранится сразу.';}
function countForm(count,one,few,many){const n=Math.abs(Number(count)||0)%100,last=n%10;return n>10&&n<20?many:last===1?one:last>=2&&last<=4?few:many}
function countLabel(count,one,few,many){return `${count} ${countForm(count,one,few,many)}`}
function nomineeCountLabel(count){return countLabel(count,'номинант','номинанта','номинантов')}

const photoOverrides=Object.create(null);
let photoDatabasePromise;
function sortClipNominees(){const clip=nominations.find(nomination=>nomination.id==='clip-of-year');if(clip)clip.nominees.sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'})||a.id.localeCompare(b.id))}
async function loadVideoCatalog(){
  if(!clientReady())return false;
  try{
    const catalog=await rpc('get_video_options');
    const videoItems=new Map(nominations.flatMap(nomination=>nomination.nominees.filter(item=>item.type==='video').map(item=>[item.id,item])));
    for(const row of Array.isArray(catalog)?catalog:[]){
      const item=videoItems.get(row.id);
      if(item){item.name=row.name||item.name;item.url=row.video_url||''}
    }
    sortClipNominees();
    syncPhotoSlotLabels();
    if($('#admin-panel-design'))updatePhotoSyncStatus();
    return true;
  }catch(error){console.info('Названия и ссылки видео не загружены:',error.message);return false}
}
function slugPhotoName(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function buildPhotoSlots(){
  const slots=[],people=new Set();
  nominations.forEach(nom=>{
    nom.nominees.forEach(item=>{
      if(item.type==='person'){
        if(people.has(item.name))return;
        people.add(item.name);
        const slug=slugPhotoName(item.name);
        slots.push({key:`avatar:${slug}`,group:'Аватары участников',groupKey:'avatars',label:item.name,path:`assets/photos/avatars/${slug}.jpg`});
        return;
      }
      const groupKey=item.type==='video'?'videos':'nominees';
      slots.push({key:`nominee:${nom.id}:${item.id}`,group:item.type==='video'?'Статичные кадры видео':'Картинки номинантов',groupKey,label:`${nom.title} · ${item.name}`,path:`assets/photos/nominees/${nom.id}/${item.id}.jpg`});
    });
  });
  return slots;
}
const photoSlots=buildPhotoSlots();
const photoSlotByKey=new Map(photoSlots.map(slot=>[slot.key,slot]));
function syncPhotoSlotLabels(){
  // Names/order are mutable; photo keys, paths and local overrides belong to IDs.
  nominations.forEach(nomination=>nomination.nominees.forEach(item=>{
    if(item.type==='person')return;
    const slot=photoSlotByKey.get(`nominee:${nomination.id}:${item.id}`);
    if(slot)slot.label=`${nomination.title} · ${item.name}`;
  }));
  $$('.admin-design-card').forEach(card=>{
    const slot=photoSlotByKey.get(card.dataset.designKey);if(!slot)return;
    card.dataset.designSearch=`${slot.label} ${slot.path}`.toLowerCase();
    const title=$('.admin-design-info h4',card);if(title)title.textContent=slot.label;
    const image=$('.admin-design-preview>img',card);if(image)image.alt=slot.label;
    $('[data-design-upload]',card)?.setAttribute('aria-label',`Заменить фото: ${slot.label}`);
  });
}

function photoSource(key){return photoOverrides[key]||photoSlotByKey.get(key)?.path||''}
function openPhotoDatabase(){
  if(photoDatabasePromise)return photoDatabasePromise;
  photoDatabasePromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('В этом браузере недоступно локальное хранилище фото.'));return}
    const request=indexedDB.open('flare-design-assets',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('photos'))request.result.createObjectStore('photos',{keyPath:'key'})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Не удалось открыть локальное хранилище фото.'));
  });
  return photoDatabasePromise;
}
async function loadPhotoOverrides(){
  try{
    const db=await openPhotoDatabase();
    await new Promise((resolve,reject)=>{
      const request=db.transaction('photos','readonly').objectStore('photos').getAll();
      request.onsuccess=()=>{for(const row of request.result){if(row.blob instanceof Blob)photoOverrides[row.key]=URL.createObjectURL(row.blob)}resolve()};
      request.onerror=()=>reject(request.error);
    });
  }catch(error){console.info('Локальные фото не загружены:',error.message)}
}
function updatePhotoNodes(key){
  const url=photoSource(key);
  $$('[data-photo-key]').filter(node=>node.dataset.photoKey===key).forEach(node=>{if(node instanceof HTMLImageElement)node.src=url;else node.style.backgroundImage=`url("${url}")`});
}
function resizePhoto(file){
  return new Promise((resolve,reject)=>{
    if(!file||!file.type.startsWith('image/')){reject(new Error('Выбери файл изображения.'));return}
    const source=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{
      const maxSide=1800,scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const context=canvas.getContext('2d');context.fillStyle='#10100f';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(source);
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось обработать это изображение.')),'image/jpeg',.86);
    };
    image.onerror=()=>{URL.revokeObjectURL(source);reject(new Error('Не удалось прочитать изображение.'))};image.src=source;
  });
}
const avatarCropSessions=new Map();
const avatarCropSize=512;
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function drawAvatarCrop(session){
  const {canvas,image}=session,context=canvas.getContext('2d'),size=avatarCropSize;
  if(!context||!image.naturalWidth||!image.naturalHeight)return;
  const scale=Math.max(size/image.naturalWidth,size/image.naturalHeight)*session.zoom;
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  const maxX=Math.max(0,(width-size)/2),maxY=Math.max(0,(height-size)/2);
  session.panX=clamp(session.panX,-1,1);session.panY=clamp(session.panY,-1,1);
  context.clearRect(0,0,size,size);
  context.drawImage(image,(size-width)/2+session.panX*maxX,(size-height)/2+session.panY*maxY,width,height);
  session.editor.querySelector('[data-avatar-zoom]').value=String(Math.round(session.zoom*100));
  session.editor.querySelector('[data-avatar-zoom-value]').textContent=`${Math.round(session.zoom*100)}%`;
  const panX=session.editor.querySelector('[data-avatar-pan-x]'),panY=session.editor.querySelector('[data-avatar-pan-y]');
  panX.value=String(Math.round(session.panX*100));panY.value=String(Math.round(session.panY*100));
  panX.disabled=maxX<1;panY.disabled=maxY<1;
}
function finishAvatarCrop(key){
  const session=avatarCropSessions.get(key);if(!session)return;
  avatarCropSessions.delete(key);if(session.ownedUrl)URL.revokeObjectURL(session.ownedUrl);
  const editor=session.editor;editor.hidden=true;editor.classList.remove('is-open');session.card.appendChild(editor);
  session.canvas.classList.remove('is-dragging');
}
function closeAllAvatarCrops(){for(const key of avatarCropSessions.keys())finishAvatarCrop(key)}
function revealDesignCard(card){const modal=card?.closest('.admin-modal');if(!modal)return;const item=card.getBoundingClientRect(),viewport=modal.getBoundingClientRect(),head=$('.admin-head',modal)?.getBoundingClientRect(),headHeight=head?.height||0;modal.scrollTop+=item.top-(viewport.top+headHeight)-(modal.clientHeight-headHeight-item.height)/2}
async function openAvatarCrop(card,source,ownedUrl=''){
  const key=card.dataset.designKey;finishAvatarCrop(key);
  const editor=card.querySelector('[data-avatar-editor]'),canvas=card.querySelector('[data-avatar-canvas]');
  const image=new Image();
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Не удалось открыть это фото для кадрирования.'));image.src=source});
  }catch(error){if(ownedUrl)URL.revokeObjectURL(ownedUrl);throw error}
  if(!card.isConnected){if(ownedUrl)URL.revokeObjectURL(ownedUrl);return}
  const session={key,card,canvas,editor,image,zoom:1,panX:0,panY:.32,ownedUrl};
  document.body.appendChild(editor);
  avatarCropSessions.set(key,session);editor.hidden=false;editor.classList.add('is-open');editor.scrollTop=0;drawAvatarCrop(session);
}
function bindAvatarCropControls(grid){
  $$('.admin-design-card[data-design-category="avatars"]',grid).forEach(card=>{
    const key=card.dataset.designKey,canvas=card.querySelector('[data-avatar-canvas]');
    card.querySelector('[data-design-crop]').onclick=async()=>{try{await openAvatarCrop(card,photoSource(key));}catch(error){toast(error.message)}};
    card.querySelector('[data-avatar-zoom]').oninput=()=>{const session=avatarCropSessions.get(key);if(session){session.zoom=Number(session.editor.querySelector('[data-avatar-zoom]').value)/100;drawAvatarCrop(session)}};
    card.querySelector('[data-avatar-pan-x]').oninput=()=>{const session=avatarCropSessions.get(key);if(session){session.panX=Number(session.editor.querySelector('[data-avatar-pan-x]').value)/100;drawAvatarCrop(session)}};
    card.querySelector('[data-avatar-pan-y]').oninput=()=>{const session=avatarCropSessions.get(key);if(session){session.panY=Number(session.editor.querySelector('[data-avatar-pan-y]').value)/100;drawAvatarCrop(session)}};
    canvas.addEventListener('pointerdown',event=>{const session=avatarCropSessions.get(key);if(!session)return;canvas.setPointerCapture(event.pointerId);session.drag={x:event.clientX,y:event.clientY,panX:session.panX,panY:session.panY};canvas.classList.add('is-dragging')});
    canvas.addEventListener('pointermove',event=>{const session=avatarCropSessions.get(key);if(!session?.drag)return;const rect=canvas.getBoundingClientRect(),scale=avatarCropSize/rect.width;
      const drawScale=Math.max(avatarCropSize/session.image.naturalWidth,avatarCropSize/session.image.naturalHeight)*session.zoom;
      const maxX=Math.max(0,(session.image.naturalWidth*drawScale-avatarCropSize)/2),maxY=Math.max(0,(session.image.naturalHeight*drawScale-avatarCropSize)/2);
      if(maxX)session.panX=clamp(session.drag.panX+(event.clientX-session.drag.x)*scale/maxX,-1,1);
      if(maxY)session.panY=clamp(session.drag.panY+(event.clientY-session.drag.y)*scale/maxY,-1,1);
      drawAvatarCrop(session);
    });
    const stopDrag=event=>{const session=avatarCropSessions.get(key);if(session?.drag){session.drag=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)}};
    canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
    card.querySelector('[data-avatar-crop-save]').onclick=async event=>{const session=avatarCropSessions.get(key);if(!session)return;const button=event.currentTarget;button.disabled=true;try{const blob=await new Promise(resolve=>session.canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw new Error('Не удалось сохранить кадр аватарки.');await savePhotoOverride(key,blob);finishAvatarCrop(key);revealDesignCard(card);card.querySelector(`[data-design-reset="${key}"]`).disabled=false;toast('Круглый кадр аватарки сохранён.')}catch(error){toast(error.message)}finally{button.disabled=false}};
    card.querySelector('[data-avatar-crop-cancel]').onclick=()=>finishAvatarCrop(key);
  });
}
async function savePhotoOverride(key,blob){
  const db=await openPhotoDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({key,blob});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Не удалось сохранить фотографию.'))});
  const previous=photoOverrides[key];photoOverrides[key]=URL.createObjectURL(blob);updatePhotoNodes(key);updatePhotoSyncStatus();if(previous)URL.revokeObjectURL(previous);
}
async function resetPhotoOverride(key){
  const db=await openPhotoDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Не удалось вернуть фотографию.'))});
  const old=photoOverrides[key];delete photoOverrides[key];updatePhotoNodes(key);updatePhotoSyncStatus();if(old)URL.revokeObjectURL(old);
}
async function resetAllPhotoOverrides(){
  const db=await openPhotoDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Не удалось сбросить фотографии.'))});
  for(const [key,url] of Object.entries(photoOverrides)){delete photoOverrides[key];updatePhotoNodes(key);URL.revokeObjectURL(url)}updatePhotoSyncStatus();
}
function renderVideoOptionsEditor(){
  const videos=nominations.flatMap(nomination=>nomination.nominees.filter(item=>item.type==='video').map(item=>({nomination,item})));
  return `<section class="admin-video-editor"><details><summary class="admin-video-summary"><span><strong>Ссылки и названия видео</strong><small>Клипы, события и остальные видео-номинанты</small></span><b>${videos.length} вариантов</b></summary><div class="admin-video-editor-body"><p>Изменения сохраняются в Supabase и сразу отображаются всем. Выполни актуальный <code>supabase/schema.sql</code> в Supabase SQL Editor, чтобы включить управление ссылками для всех видео.</p><div class="admin-video-list">${videos.map(({nomination,item})=>`<div class="admin-video-row" data-video-row="${esc(item.id)}"><div class="admin-video-identity"><span>${esc(nomination.title)}</span><strong>${esc(item.name)}</strong></div><label class="admin-video-field"><span>Название</span><input type="text" maxlength="120" required data-video-name="${esc(item.id)}" value="${esc(item.name)}"></label><label class="admin-video-field"><span>Ссылка на видео</span><input type="url" data-video-url="${esc(item.id)}" value="${esc(item.url||'')}" placeholder="https://youtu.be/..."></label><button type="button" class="button admin-video-save" data-video-save="${esc(item.id)}">Сохранить</button></div>`).join('')}</div></div></details></section>`;
}
function renderDesignPanel(){
  syncPhotoSlotLabels();
  const cards=photoSlots.map(slot=>{
    const avatar=slot.groupKey==='avatars';
    const image=`<img src="${esc(photoSource(slot.key))}" data-photo-key="${esc(slot.key)}" alt="${esc(slot.label)}" loading="lazy">`;
    const preview=avatar?`<div class="admin-design-preview is-avatar">${image}<div class="admin-avatar-reference" aria-label="Круглый кадр аватарки"><div class="admin-avatar-reference-circle"><img src="${esc(photoSource(slot.key))}" data-photo-key="${esc(slot.key)}" alt="" loading="lazy"></div><small>В круге</small></div></div>`:`<div class="admin-design-preview">${image}</div>`;
    const cropEditor=avatar?`<section class="admin-avatar-editor" data-avatar-editor hidden><h4>${esc(slot.label)} · кадр аватарки</h4><p>Перетащи фото в круге. Точная круглая обрезка сохранится и в карточке номинанта.</p><canvas class="admin-avatar-crop-canvas" data-avatar-canvas width="512" height="512" aria-label="Круглый предпросмотр кадра аватарки"></canvas><div class="admin-avatar-crop-controls"><label>Размер <output data-avatar-zoom-value>100%</output><input type="range" min="100" max="300" step="1" value="100" data-avatar-zoom aria-label="Размер кадра"></label><label>По горизонтали<input type="range" min="-100" max="100" step="1" value="0" data-avatar-pan-x aria-label="Положение по горизонтали"></label><label>По вертикали<input type="range" min="-100" max="100" step="1" value="0" data-avatar-pan-y aria-label="Положение по вертикали"></label></div><div class="admin-avatar-crop-actions"><button type="button" class="button admin-avatar-crop-save" data-avatar-crop-save>Применить кадр</button><button type="button" class="button-quiet admin-avatar-crop-cancel" data-avatar-crop-cancel>Отмена</button></div></section>`:'';
    return `<article class="admin-design-card" data-design-key="${esc(slot.key)}" data-design-category="${slot.groupKey}" data-design-search="${esc(`${slot.label} ${slot.path}`.toLowerCase())}">${preview}<div class="admin-design-info"><h4>${esc(slot.label)}</h4><span class="admin-design-local-badge" data-local-photo-badge hidden>Локальная замена</span><code>${esc(slot.path)}</code></div><div class="admin-design-actions"><label class="admin-design-upload">Заменить<input type="file" accept="image/*" data-design-upload="${esc(slot.key)}" aria-label="Заменить фото: ${esc(slot.label)}"></label>${avatar?`<button type="button" class="admin-design-crop" data-design-crop>Настроить кадр</button>`:''}<button type="button" class="admin-design-download" data-design-download="${esc(slot.key)}">Скачать</button><button type="button" class="admin-design-reset" data-design-reset="${esc(slot.key)}" ${photoOverrides[slot.key]?'':'disabled'}>Сбросить</button></div>${cropEditor}</article>`;
  }).join('');
  return `<section class="admin-tab-panel admin-design-panel" id="admin-panel-design" role="tabpanel" aria-labelledby="admin-tab-design" hidden><div class="admin-design-intro"><div class="admin-design-intro-copy"><span class="admin-design-kicker">МЕДИАТЕКА · ${photoSlots.length} ФОТО</span><h3>Фотографии сайта</h3><p>Загруженные изображения автоматически уменьшаются без искажения. Для аватаров можно отдельно настроить кадр.</p><p class="admin-design-note">Замены пока видны только в этом браузере. Чтобы опубликовать их, скачай изменения и замени файлы в репозитории.</p></div><div class="admin-design-export-actions"><button type="button" class="button admin-design-export" id="export-design-changes" disabled>Скачать изменения</button><button type="button" class="button-quiet admin-design-export" id="export-design-photos">Скачать все фото</button></div></div><div class="admin-design-sync" id="admin-design-sync-status" role="status" aria-live="polite"><div><strong data-design-sync-title></strong><p data-design-sync-copy></p></div><details data-design-sync-files hidden><summary data-design-sync-summary></summary><ul data-design-sync-list></ul></details></div>${renderVideoOptionsEditor()}<div class="admin-design-toolbar"><div class="admin-design-toolbar-main"><div class="admin-design-filters" role="group" aria-label="Фильтр фотографий"><button type="button" class="is-active" data-design-filter="all">Все (${photoSlots.length})</button><button type="button" data-design-filter="avatars">Аватары</button><button type="button" data-design-filter="nominees">Картинки</button><button type="button" data-design-filter="videos">Видео</button><button type="button" data-design-filter="changed">Изменены</button></div><div class="admin-design-search-row"><input id="admin-design-search" type="search" placeholder="Имя или путь к фото" aria-label="Найти фото по названию или пути"><button type="button" class="admin-design-clear" id="admin-design-clear" hidden>Сбросить</button></div></div><div class="admin-design-toolbar-meta"><span id="admin-design-results" aria-live="polite"></span><span>Быстрый фильтр «Изменены» покажет локальные замены</span></div></div><p class="admin-design-empty" id="admin-design-empty" hidden>Ничего не найдено. Измени запрос или сбрось фильтры.</p><div class="admin-design-grid">${cards}</div></section>`;
}
function applyAdminDesignFilters(){
  const panel=$('#admin-panel-design'),grid=$('.admin-design-grid',panel);if(!grid)return;
  const activeFilter=$('.admin-design-filters .is-active',panel)?.dataset.designFilter||'all',query=$('#admin-design-search',panel)?.value.trim().toLowerCase()||'',cards=$$('.admin-design-card',grid);let visible=0;
  cards.forEach(card=>{const categoryMatches=activeFilter==='all'||(activeFilter==='changed'?Boolean(photoOverrides[card.dataset.designKey]):card.dataset.designCategory===activeFilter),searchMatches=!query||card.dataset.designSearch.includes(query);card.hidden=!(categoryMatches&&searchMatches);if(!card.hidden)visible++});
  const resultCount=$('#admin-design-results',panel),empty=$('#admin-design-empty',panel),clear=$('#admin-design-clear',panel);
  if(resultCount)resultCount.textContent=`Показано ${visible} из ${cards.length}`;
  if(empty)empty.hidden=visible>0;
  if(clear)clear.hidden=activeFilter==='all'&&!query;
}
function updatePhotoSyncStatus(){const status=$('#admin-design-sync-status');if(!status)return;const pending=photoSlots.filter(slot=>Boolean(photoOverrides[slot.key])),title=$('[data-design-sync-title]',status),copy=$('[data-design-sync-copy]',status),details=$('[data-design-sync-files]',status),summary=$('[data-design-sync-summary]',status),list=$('[data-design-sync-list]',status),changedButton=$('#export-design-changes');if(title)title.textContent=pending.length?`Локально изменено: ${pending.length} фото`:'Нет локальных изменений';if(copy)copy.textContent=pending.length?'Эти замены видны только в этом браузере. На сайте пока прежние файлы. Скачай изменения и замени перечисленные файлы в репозитории.':'Предпросмотр использует опубликованные файлы. Новые замены сохранятся локально, пока ты не выгрузишь их.';if(details){details.hidden=!pending.length;if(summary)summary.textContent=`Показать файлы для публикации (${pending.length})`;if(list)list.innerHTML=pending.map(slot=>`<li><strong>${esc(slot.label)}</strong><code>${esc(slot.path)}</code></li>`).join('')}if(changedButton){changedButton.disabled=!pending.length;changedButton.textContent=`Скачать изменения${pending.length?` (${pending.length})`:''}`}const grid=$('.admin-design-grid');if(grid)$$('.admin-design-card',grid).forEach(card=>{const changed=Boolean(photoOverrides[card.dataset.designKey]),badge=$('[data-local-photo-badge]',card),reset=$('[data-design-reset]',card);card.classList.toggle('has-local-photo',changed);if(badge)badge.hidden=!changed;if(reset)reset.disabled=!changed});applyAdminDesignFilters()}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}return(crc^0xffffffff)>>>0}
function createZip(files){
  const encoder=new TextEncoder(),localParts=[],centralParts=[];let offset=0,centralSize=0;
  for(const file of files){
    const name=encoder.encode(file.name),data=file.data,crc=crc32(data);
    const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);localParts.push(local,data);
    const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);centralParts.push(central);centralSize+=central.length;offset+=local.length+data.length;
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
  return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
}
async function exportPhotoPack(changedOnly=false){
  const slots=changedOnly?photoSlots.filter(slot=>photoOverrides[slot.key]):photoSlots,button=$(changedOnly?'#export-design-changes':'#export-design-photos');if(!slots.length){toast('Нет локальных изменений для скачивания.');return}if(button)button.disabled=true;
  try{
    const files=[];
    for(const slot of slots){const response=await fetch(photoSource(slot.key));if(!response.ok)throw new Error(`Не удалось загрузить ${slot.path}`);files.push({name:slot.path,data:new Uint8Array(await response.arrayBuffer())})}
    const url=URL.createObjectURL(createZip(files)),link=document.createElement('a');link.href=url;link.download=changedOnly?'flare-photo-changes.zip':'flare-photos.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast(changedOnly?'Архив изменений готов. Замени файлы по указанным путям в репозитории.':'Полный архив готов. Распакуй его в корень репозитория.');
  }catch(error){toast(error.message)}finally{if(button)button.disabled=false;updatePhotoSyncStatus()}
}
function bindDesignPanel(){
  const panel=$('#admin-panel-design'),grid=$('.admin-design-grid',panel);if(!grid)return;
  $$('[data-design-filter]',panel).forEach(button=>button.onclick=()=>{$$('.admin-design-filters button',panel).forEach(item=>item.classList.toggle('is-active',item===button));applyAdminDesignFilters()});
  const search=$('#admin-design-search',panel),clear=$('#admin-design-clear',panel);
  search.oninput=applyAdminDesignFilters;
  clear.onclick=()=>{search.value='';$$('.admin-design-filters button',panel).forEach(item=>item.classList.toggle('is-active',item.dataset.designFilter==='all'));applyAdminDesignFilters();search.focus()};
  applyAdminDesignFilters();
  $$('[data-video-save]',panel).forEach(button=>button.onclick=async()=>{
    const id=button.dataset.videoSave,nameInput=$(`[data-video-name="${id}"]`,panel),urlInput=$(`[data-video-url="${id}"]`,panel),nominee=nominations.flatMap(nomination=>nomination.nominees).find(item=>item.id===id&&item.type==='video');
    const name=nameInput.value.trim(),url=urlInput.value.trim();if(!name){nameInput.focus();toast('Укажи название видео-номинанта.');return}
    button.disabled=true;
    try{
      const saved=await rpc('admin_update_video_option',{p_token:state.session.token,p_option_id:id,p_name:name,p_video_url:url||null});
      if(nominee){nominee.name=saved.name;nominee.url=saved.video_url||''}
      sortClipNominees();
      syncPhotoSlotLabels();updatePhotoSyncStatus();
      const identity=$('.admin-video-identity strong',button.closest('[data-video-row]'));if(identity)identity.textContent=saved.name;
      nameInput.value=saved.name;urlInput.value=saved.video_url||'';toast('Название и ссылка видео сохранены для всех.');
    }catch(error){toast(error.message)}finally{button.disabled=false}
  });
  $$('[data-design-upload]',grid).forEach(input=>input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const key=input.dataset.designUpload,slot=photoSlotByKey.get(key),card=input.closest('.admin-design-card');input.disabled=true;try{const blob=await resizePhoto(file);if(slot.groupKey==='avatars'){const url=URL.createObjectURL(blob);await openAvatarCrop(card,url,url);toast('Перетащи и настрой кадр в круглом предпросмотре.')}else{await savePhotoOverride(key,blob);card.querySelector(`[data-design-reset="${key}"]`).disabled=false;toast('Фото заменено для этого браузера.')}}catch(error){toast(error.message)}finally{input.disabled=false;input.value=''}});
  $$('[data-design-reset]',grid).forEach(button=>button.onclick=async()=>{const key=button.dataset.designReset;finishAvatarCrop(key);try{await resetPhotoOverride(key);button.disabled=true;toast('Вернул опубликованное фото для этого браузера.')}catch(error){toast(error.message)}});
  $$('[data-design-download]',grid).forEach(button=>button.onclick=()=>{const slot=photoSlotByKey.get(button.dataset.designDownload);const link=document.createElement('a');link.href=photoSource(slot.key);link.download=slot.path.split('/').pop();link.click()});
  bindAvatarCropControls(grid);
  $('#export-design-changes').onclick=()=>exportPhotoPack(true);$('#export-design-photos').onclick=()=>exportPhotoPack(false);updatePhotoSyncStatus();
}
let adminSocialRows=[],adminSocialDraft=null;
function renderAdminSocialPanel(){
  return `<section class="admin-tab-panel admin-social-panel" id="admin-panel-social" role="tabpanel" aria-labelledby="admin-tab-social" hidden><div class="admin-social-intro"><span class="admin-design-kicker">ПРОФИЛИ УЧАСТНИКОВ</span><h3>Социальные сети</h3><p>Steam — ссылка на профиль. Discord и Telegram — фотографии, которые участники откроют из меню в номинации «СТИЛЬ ГОДА». Пустые сервисы в меню не показываются.</p></div><form class="admin-social-form" id="admin-social-form"><label class="admin-social-member"><span>Участник</span><select id="admin-social-member">${MEMBERS.map(nickname=>`<option value="${esc(nickname)}">${esc(nickname)}</option>`).join('')}</select></label><div class="admin-social-fields"><label class="admin-social-field"><span><b>Steam</b><small>Ссылка на профиль</small></span><input id="admin-social-steam" type="url" maxlength="500" placeholder="https://steamcommunity.com/id/..." autocomplete="off"></label><div class="admin-social-photo-field" data-admin-social-field="discord"><div><b>Discord</b><small>Фото профиля или нужного экрана</small></div><div class="admin-social-photo-preview" id="admin-social-discord-preview"></div><div class="admin-social-photo-actions"><label class="admin-design-upload">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp" data-admin-social-photo="discord" hidden></label><button class="admin-design-reset" type="button" data-admin-social-clear="discord">Убрать</button></div></div><div class="admin-social-photo-field" data-admin-social-field="telegram"><div><b>Telegram</b><small>Фото профиля или нужного экрана</small></div><div class="admin-social-photo-preview" id="admin-social-telegram-preview"></div><div class="admin-social-photo-actions"><label class="admin-design-upload">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp" data-admin-social-photo="telegram" hidden></label><button class="admin-design-reset" type="button" data-admin-social-clear="telegram">Убрать</button></div></div></div><div class="admin-social-submit"><p>Фото автоматически уменьшаются и сохраняются как JPEG.</p><button class="button" id="admin-social-save" type="submit">Сохранить соцсети</button></div></form></section>`;
}
function emptyAdminSocial(nickname){return {nickname,steam_url:'',discord_image:null,telegram_image:null}}
function renderAdminSocialPhoto(service){
  const box=$(`#admin-social-${service}-preview`),clear=$(`[data-admin-social-clear="${service}"]`);if(!box)return;
  const image=adminSocialDraft?.[`${service}_image`];box.innerHTML=image?`<img src="${esc(image)}" alt="${service==='discord'?'Discord':'Telegram'} — текущее фото">`:'<span>Фото не добавлено</span>';if(clear)clear.disabled=!image;
}
function fillAdminSocialForm(nickname){
  const row=adminSocialRows.find(item=>item.nickname===nickname);adminSocialDraft={...emptyAdminSocial(nickname),...(row||{})};
  const steam=$('#admin-social-steam');if(steam)steam.value=adminSocialDraft.steam_url||'';renderAdminSocialPhoto('discord');renderAdminSocialPhoto('telegram');
}
function adminSocialUrl(value,label){
  const url=String(value||'').trim();if(!url)return null;try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error();return url}catch{throw new Error(`Укажи корректную ссылку ${label}.`)}
}
function bindAdminSocialPanel(){
  const panel=$('#admin-panel-social');if(!panel)return;const member=$('#admin-social-member',panel);fillAdminSocialForm(member.value);member.onchange=()=>fillAdminSocialForm(member.value);
  $('#admin-social-steam',panel).oninput=event=>{if(adminSocialDraft)adminSocialDraft.steam_url=event.target.value};
  $$('[data-admin-social-photo]',panel).forEach(input=>input.onchange=async()=>{const file=input.files?.[0];if(!file||!adminSocialDraft)return;const service=input.dataset.adminSocialPhoto;input.disabled=true;try{adminSocialDraft[`${service}_image`]=await prepareProfileImage(file);renderAdminSocialPhoto(service);toast('Фото готово. Нажми «Сохранить соцсети».')}catch(error){toast(error.message)}finally{input.disabled=false;input.value=''}});
  $$('[data-admin-social-clear]',panel).forEach(button=>button.onclick=()=>{if(!adminSocialDraft)return;adminSocialDraft[`${button.dataset.adminSocialClear}_image`]=null;renderAdminSocialPhoto(button.dataset.adminSocialClear)});
  $('#admin-social-form',panel).onsubmit=async event=>{
    event.preventDefault();if(!adminSocialDraft)return;const button=$('#admin-social-save',panel),nickname=adminSocialDraft.nickname;button.disabled=true;button.textContent='Сохранение...';
    try{
      const saved=await rpc('admin_set_member_social',{p_token:state.session.token,p_nickname:nickname,p_steam_url:adminSocialUrl(adminSocialDraft.steam_url,'Steam'),p_discord_image:adminSocialDraft.discord_image||null,p_telegram_image:adminSocialDraft.telegram_image||null});
      adminSocialRows=[...adminSocialRows.filter(row=>row.nickname!==nickname),{...emptyAdminSocial(nickname),...saved}];invalidateMemberSocial(nickname);fillAdminSocialForm(nickname);toast('Социальные сети сохранены для всех.');
    }catch(error){toast(error.message)}finally{button.disabled=false;button.textContent='Сохранить соцсети'}
  };
}
function scrollToCategoryButtons(){const card=$('#category-primary');if(!card)return 0;const rect=card.getBoundingClientRect(),headerHeight=$('#site-header')?.getBoundingClientRect().height||95,desiredCenter=Math.max(headerHeight+rect.height/2+16,window.innerHeight*.58),maxScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),target=Math.min(maxScroll,Math.max(0,window.scrollY+rect.top+rect.height/2-desiredCenter)),distance=Math.abs(target-window.scrollY),reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;window.scrollTo({top:target,behavior:reducedMotion?'auto':'smooth'});return distance}
let publicEventPollWinner=null,publicEventPollWinnerResolved=false,publicEventPollWinnerRequest=null;
function loadPublicEventPollWinner(){
  if(publicEventPollWinnerResolved)return Promise.resolve(publicEventPollWinner);
  if(publicEventPollWinnerRequest)return publicEventPollWinnerRequest;
  publicEventPollWinnerRequest=rpc('get_event_poll_winner').then(result=>{
    if(!result?.closed)throw new Error('Итоги опроса ещё не опубликованы.');
    const choiceIds=(Array.isArray(result.choice_ids)?result.choice_ids:[]).filter(id=>ceremonyDates[id]).sort((a,b)=>ceremonyDates[a]-ceremonyDates[b]);
    publicEventPollWinnerResolved=true;
    publicEventPollWinner=choiceIds.length?{choiceIds,target:ceremonyDates[choiceIds[0]]}:null;
    return publicEventPollWinner;
  }).catch(error=>{publicEventPollWinnerRequest=null;throw error});
  return publicEventPollWinnerRequest;
}
function initCountdown(){
  const units={days:$('#countdown-days'),hours:$('#countdown-hours'),minutes:$('#countdown-minutes')},minuteLabel=$('#countdown-minutes-label'),status=$('#countdown-status'),label=$('#countdown-title'),values=$('.countdown-values',$('#vote-countdown')),box=$('#vote-countdown');
  let timer,currentPhase=-1,closedHandled=false,pollLoadStarted=false,pollLoadFailed=false;
  const pad=n=>String(n).padStart(2,'0'),digitAnimations=new WeakMap();
  const setDigit=(element,value)=>{
    const previous=element.dataset.value??element.textContent.trim(),hasRendered=element.dataset.value!==undefined||Boolean(element.querySelector('.countdown-digit-stage'));
    if(previous===value){element.dataset.value=value;return}
    element.dataset.value=value;
    const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if(reduceMotion||typeof element.animate!=='function'){element.textContent=value;return}
    let stage=element.querySelector('.countdown-digit-stage');
    if(!stage){
      stage=document.createElement('span');stage.className='countdown-digit-stage';
      [...previous].forEach(digit=>{const slot=document.createElement('span');slot.className='countdown-digit-slot';slot.dataset.value=digit;slot.textContent=digit;stage.append(slot)});
      element.replaceChildren(stage);
    }
    const previousDigits=[...previous],nextDigits=[...value];
    nextDigits.forEach((digit,index)=>{
      let slot=stage.children[index];
      if(!slot){slot=document.createElement('span');slot.className='countdown-digit-slot';stage.append(slot)}
      if(!hasRendered){slot.dataset.value=digit;slot.textContent=digit;return}
      if(previousDigits[index]===digit){slot.dataset.value=digit;return}
      const token=Number(slot.dataset.animationToken||0)+1;slot.dataset.animationToken=String(token);slot.dataset.value=digit;
      digitAnimations.get(slot)?.forEach(animation=>animation.cancel());
      digitAnimations.delete(slot);
      const stack=document.createElement('span'),outgoing=document.createElement('span'),incoming=document.createElement('span');
      stack.className='countdown-digit-stack';
      outgoing.className='countdown-digit-roll countdown-digit-outgoing';outgoing.textContent=previousDigits[index]??digit;
      incoming.className='countdown-digit-roll countdown-digit-incoming';incoming.textContent=digit;
      stack.append(outgoing,incoming);slot.replaceChildren(stack);
      const easing='cubic-bezier(.2,.72,.25,1)';
      const outgoingAnimation=outgoing.animate([{transform:'translate3d(0,0,0)',opacity:1},{transform:'translate3d(0,-105%,0)',opacity:0}],{duration:390,easing,fill:'both'});
      const incomingAnimation=incoming.animate([{transform:'translate3d(0,105%,0)',opacity:0},{transform:'translate3d(0,0,0)',opacity:1}],{duration:460,easing,fill:'both'});
      digitAnimations.set(slot,[outgoingAnimation,incomingAnimation]);
      incomingAnimation.finished.then(()=>{if(slot.dataset.animationToken===String(token)){digitAnimations.delete(slot);outgoingAnimation.cancel();incomingAnimation.cancel();slot.textContent=digit}}).catch(()=>{if(slot.dataset.animationToken===String(token)){digitAnimations.delete(slot);slot.textContent=digit}});
    });
  };
  const showPollRetry=()=>{
    status.replaceChildren(document.createTextNode('Не удалось получить результат опроса. '));
    const retry=document.createElement('button');retry.type='button';retry.className='text-button';retry.textContent='Повторить';
    retry.onclick=()=>{pollLoadFailed=false;pollLoadStarted=false;startPollLoad()};status.append(retry);
  };
  const startPollLoad=()=>{
    if(pollLoadStarted||publicEventPollWinnerResolved)return;
    pollLoadStarted=true;status.textContent='Получаем победившую дату из опроса…';
    loadPublicEventPollWinner().then(()=>{pollLoadStarted=false;currentPhase=-1;tick()}).catch(()=>{pollLoadStarted=false;pollLoadFailed=true;showPollRetry()});
  };
  const tick=()=>{
    const now=Date.now();
    if(now>=winnersReleaseDate.getTime()){
      values.hidden=true;label.textContent='ГОЛОСОВАНИЕ ЗАВЕРШЕНО';status.textContent='Итоги будут опубликованы отдельно.';box.classList.add('is-finished');box.setAttribute('aria-label','Голосование завершено');
      clearInterval(timer);return;
    }
    if(now>=closing.getTime()&&!closedHandled){closedHandled=true;updateProgress()}
    if(now>=closing.getTime()&&!publicEventPollWinnerResolved){
      values.hidden=true;label.textContent='ДАТА ЦЕРЕМОНИИ ПО РЕЗУЛЬТАТАМ ОПРОСА';box.classList.add('is-finished');box.setAttribute('aria-label','Ожидание победившей даты церемонии из опроса');
      if(!pollLoadFailed)startPollLoad();
      return;
    }
    if(now>=closing.getTime()&&!publicEventPollWinner){
      values.hidden=true;label.textContent='ДАТА ЦЕРЕМОНИИ НЕ ОПРЕДЕЛЕНА';status.textContent='В опросе не оказалось голосов. Дату нужно определить отдельно.';box.classList.add('is-finished');box.setAttribute('aria-label','Дата церемонии не определена');return;
    }
    const phaseIndex=now<closing.getTime()?0:now<publicEventPollWinner.target.getTime()?1:2;
    const target=phaseIndex===0?closing:phaseIndex===1?publicEventPollWinner.target:winnersReleaseDate;
    const remaining=Math.max(0,target.getTime()-now),total=Math.floor(remaining/1000);
    values.hidden=false;box.classList.remove('is-finished');
    if(currentPhase!==phaseIndex){
      currentPhase=phaseIndex;
      if(phaseIndex===0){label.textContent='ДО ОКОНЧАНИЯ ГОЛОСОВАНИЯ';status.textContent='Закрытие 22 ноября в 00:00 по МСК'}
      else if(phaseIndex===1){
        const winningDates=publicEventPollWinner.choiceIds.map(id=>eventChoiceLabels[id]),selectedDate=eventChoiceLabels[publicEventPollWinner.choiceIds[0]];
        label.textContent=publicEventPollWinner.choiceIds.length>1?'НИЧЬЯ В ОПРОСЕ · ДО БЛИЖАЙШЕЙ ДАТЫ':'ДО ДАТЫ ЦЕРЕМОНИИ';
        status.textContent=publicEventPollWinner.choiceIds.length>1?`Ничья (${winningDates.join(' и ')}); отсчёт до ${selectedDate}`:`Победившая дата по опросу: ${selectedDate}`;
      }else{label.textContent='ДО ПУБЛИКАЦИИ РЕЗУЛЬТАТОВ';status.textContent='Победители появятся 6 декабря'}
      box.setAttribute('aria-label',label.textContent.toLowerCase());
    }
    const minuteCount=Math.floor(total%3600/60);setDigit(units.days,pad(Math.floor(total/86400)));setDigit(units.hours,pad(Math.floor(total%86400/3600)));setDigit(units.minutes,pad(minuteCount));if(minuteLabel)minuteLabel.textContent=countForm(minuteCount,'минута','минуты','минут');
  };
  tick();if(Date.now()<winnersReleaseDate.getTime())timer=setInterval(tick,1000);
}
function pushNominationHistory(screen,nominationId=null){
  const current=history.state?.flareNomination,depth=current?Math.max(1,Number(current.depth)||1)+1:1;
  const entry={screen,category:state.category,nominationId,depth};
  history.pushState({...(history.state||{}),flareNomination:entry},'');
}
function returnToNominations(){
  if(history.state?.flareNomination?.screen==='detail'){history.back();return}
  renderNominations({fromHistory:true});
}
function syncNominationHistory(){
  const entry=history.state?.flareNomination;
  if(entry&&state.session){
    if(entry.category==='основная'||entry.category==='доп.')state.category=entry.category;
    const nomination=entry.screen==='detail'&&nominations.find(item=>item.id===entry.nominationId);
    if(nomination)showNomination(nomination.id,{fromHistory:true});else renderNominations({fromHistory:true});
    return;
  }
  if($('.nomination-list-modal,.nomination-detail-modal'))closeModal({fromHistory:true});
}
window.addEventListener('popstate',syncNominationHistory);
function renderNominations({fromHistory=false}={}){if(!fromHistory)pushNominationHistory('list');state.nomination=null;const selected=nominations.filter(n=>n.category===state.category);const html=selected.map(n=>{const done=state.votes[n.id];return `<button class="nomination-tile" data-open-nomination="${n.id}"><span class="nomination-art" aria-hidden="true"><img class="nomination-art-icon" src="assets/icons/nominations/${esc(n.icon||'star')}.svg?v=28" alt="" loading="lazy" decoding="async">${done?'<span class="nomination-voted" role="img" aria-label="Голос учтён" title="Голос учтён"><img class="nomination-voted-icon" src="assets/icons/nominations/check.svg?v=8" alt=""></span>':''}</span><span class="nomination-card-body"><span class="nomination-card-copy"><span class="nomination-tile-title">${esc(n.title)}</span><span class="nomination-tile-description">${esc(n.description)}</span></span><span class="nomination-card-meta"><span>${nomineeCountLabel(n.nominees.length)}</span><span class="nomination-card-dot" aria-hidden="true">●</span></span></span></button>`}).join('');const isExtra=state.category!=='основная';const heading=`<h2>${isExtra?'Дополнительные номинации':'Основные номинации'}</h2>`;const content=`<div class="modal-header ${isExtra?'extra-list-header':'primary-list-header'}">${heading}<button class="close-button" aria-label="Закрыть">×</button></div><div class="nomination-grid">${html}</div>`;replaceModalView(content,`nomination-list-modal ${isExtra?'extra-category-list':'primary-category-list'}`);const nominationGrid=$('.nomination-grid');if(nominationGrid)nominationGrid.scrollTop=state.nominationListScrollTop;$$('[data-open-nomination]').forEach(b=>b.onclick=()=>showNomination(b.dataset.openNomination));}
function visualClass(n){if(n.type==='game')return'visual-game';if(n.type==='group')return'visual-group';if(n.type==='conflict')return'visual-conflict';if(n.type==='video')return'visual-event';return''}
function parseYouTubeVideoUrl(value){
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol))return null;
    const host=url.hostname.toLowerCase();
    const acceptedHosts=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','youtube-nocookie.com','www.youtube-nocookie.com'];
    if(!acceptedHosts.includes(host))return null;
    const parts=url.pathname.split('/').filter(Boolean);
    let id='';
    if(host==='youtu.be')id=parts[0]||'';
    else if(url.pathname==='/watch')id=url.searchParams.get('v')||'';
    else if(['embed','shorts','live','v'].includes(parts[0]))id=parts[1]||'';
    if(!/^[A-Za-z0-9_-]{11}$/.test(id))return null;
    const rawStart=url.searchParams.get('start')||url.searchParams.get('t')||'';
    let start=0;
    if(/^\d+$/.test(rawStart))start=Number(rawStart);
    else if(rawStart){const match=rawStart.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);if(match&&(match[1]||match[2]||match[3]))start=(Number(match[1]||0)*3600)+(Number(match[2]||0)*60)+Number(match[3]||0)}
    return{id,start:Number.isSafeInteger(start)&&start>0?start:0};
  }catch{return null}
}
function openYouTubePlayer(title,video){
  const root=$('#modal-root');if(!root)return;
  const previousFocus=document.activeElement,backdrop=document.createElement('div'),start=video.start?`&start=${video.start}`:'';
  backdrop.className='youtube-player-backdrop';
  backdrop.innerHTML=`<section class="youtube-player-dialog" role="dialog" aria-modal="true" aria-labelledby="youtube-player-title"><header class="youtube-player-header"><h2 id="youtube-player-title">${esc(title)}</h2><button type="button" class="close-button youtube-player-close" aria-label="Закрыть плеер">×</button></header><div class="youtube-player-screen"><iframe title="Видео: ${esc(title)}" src="about:blank" data-player-src="https://www.youtube-nocookie.com/embed/${video.id}?autoplay=0&amp;playsinline=1&amp;rel=0${start}" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></section>`;
  root.append(backdrop);
  document.body.classList.add('youtube-player-open');
  const frame=$('iframe',backdrop),closeButton=$('.youtube-player-close',backdrop);
  let closed=false;
  const embedTimer=setTimeout(()=>{if(!closed)frame.src=frame.dataset.playerSrc},180);
  const close=()=>{if(closed)return;closed=true;clearTimeout(embedTimer);document.removeEventListener('keydown',onKeyDown,true);frame.src='about:blank';backdrop.remove();document.body.classList.remove('youtube-player-open');try{previousFocus?.focus({preventScroll:true})}catch{previousFocus?.focus()}};
  const onKeyDown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}};
  closeButton.addEventListener('click',close);
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)close()});
  document.addEventListener('keydown',onKeyDown,true);
  closeButton.focus();
}
const nomineeViewModes=[
  {id:'standard',title:'Стандартный',description:'Обычная сетка номинантов',icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>'},
  {id:'compact',title:'Компактный',description:'Сжатая сетка номинантов',icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="2.5" width="5" height="5" rx="1.2"/><rect x="16.5" y="2.5" width="5" height="5" rx="1.2"/><rect x="2.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="16.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="2.5" y="16.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="16.5" width="5" height="5" rx="1.2"/><rect x="16.5" y="16.5" width="5" height="5" rx="1.2"/></svg>'},
  {id:'list',title:'Список',description:'Один номинант на строку',icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="4" cy="5" r="1.6"/><circle cx="4" cy="12" r="1.6"/><circle cx="4" cy="19" r="1.6"/><rect x="8" y="3.6" width="13" height="2.8" rx="1.4"/><rect x="8" y="10.6" width="13" height="2.8" rx="1.4"/><rect x="8" y="17.6" width="13" height="2.8" rx="1.4"/></svg>'}
];
function renderNomineeViewControl(){
  const selectedMode=nomineeViewModes.find(mode=>mode.id===state.nomineeView)||nomineeViewModes[0];
  return `<div class="nominee-view-control"><button class="nominee-view-toggle" id="nominee-view-toggle" type="button" aria-expanded="false" aria-controls="nominee-view-menu"><span class="nominee-view-current-icon">${selectedMode.icon}</span><span>Вид</span><svg class="nominee-view-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="nominee-view-menu" id="nominee-view-menu" role="group" aria-label="Вид списка номинантов" hidden>${nomineeViewModes.map(mode=>`<button class="nominee-view-option ${state.nomineeView===mode.id?'is-selected':''}" type="button" data-nominee-view="${mode.id}" aria-pressed="${state.nomineeView===mode.id}"><span class="nominee-view-option-icon">${mode.icon}</span><span class="nominee-view-option-copy"><strong>${mode.title}</strong><small>${mode.description}</small></span><svg class="nominee-view-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg></button>`).join('')}</div></div>`;
}
let nomineeViewOutsideHandler=null;
function closeNomineeViewMenu(restoreFocus=false){
  const toggle=$('#nominee-view-toggle'),menu=$('#nominee-view-menu');
  if(menu)menu.hidden=true;
  toggle?.setAttribute('aria-expanded','false');
  if(nomineeViewOutsideHandler){document.removeEventListener('pointerdown',nomineeViewOutsideHandler,true);nomineeViewOutsideHandler=null}
  if(restoreFocus)toggle?.focus();
}
function updateListPhotoAspectRatios(grid){
  if(!grid?.classList.contains('nominee-grid-list'))return;
  $$('.visual-photo',grid).forEach(image=>{
    const applyRatio=()=>{
      const visual=image.closest('.visual');
      if(grid.classList.contains('nominee-grid-list')&&visual?.isConnected&&image.naturalWidth&&image.naturalHeight)visual.style.aspectRatio=`${image.naturalWidth} / ${image.naturalHeight}`;
    };
    if(image.complete)applyRatio();
    else if(image.dataset.listRatioListener!=='true'){
      image.dataset.listRatioListener='true';
      image.addEventListener('load',()=>{delete image.dataset.listRatioListener;applyRatio()},{once:true});
    }
  });
}
function bindVisualPhotoFallbacks(root=document){
  if(!root)return;
  $$('.visual-photo',root).forEach(image=>{
    const sync=()=>{const missing=image.complete&&image.naturalWidth===0;image.classList.toggle('is-missing',missing);image.closest('.visual')?.classList.toggle('no-photo',missing)};
    if(image.dataset.photoFallbackBound!=='true'){image.dataset.photoFallbackBound='true';image.addEventListener('error',sync);image.addEventListener('load',sync)}
    sync();
  });
}
function syncNomineeViewUi(){
  const mode=nomineeViewModes.find(item=>item.id===state.nomineeView)||nomineeViewModes[0],icon=$('.nominee-view-current-icon'),grid=$('.nomination-detail-modal .nominee-grid'),menu=$('#nominee-view-menu');
  if(icon)icon.innerHTML=mode.icon;
  if(grid){grid.classList.toggle('nominee-grid-compact',state.nomineeView==='compact');grid.classList.toggle('nominee-grid-list',state.nomineeView==='list');if(state.nomineeView==='list')updateListPhotoAspectRatios(grid);else $$('.visual',grid).forEach(visual=>visual.style.removeProperty('aspect-ratio'))}
  if(menu)$$('[data-nominee-view]',menu).forEach(item=>{const selected=item.dataset.nomineeView===state.nomineeView;item.classList.toggle('is-selected',selected);item.setAttribute('aria-pressed',String(selected))});
}
function bindNomineeViewControl(){
  const control=$('.nominee-view-control'),toggle=$('#nominee-view-toggle'),menu=$('#nominee-view-menu'),grid=$('.nomination-detail-modal .nominee-grid');
  if(!control||!toggle||!menu||!grid)return;
  toggle.onclick=()=>{
    if(!menu.hidden){closeNomineeViewMenu();return}
    menu.hidden=false;toggle.setAttribute('aria-expanded','true');
    nomineeViewOutsideHandler=event=>{if(!control.contains(event.target))closeNomineeViewMenu()};
    document.addEventListener('pointerdown',nomineeViewOutsideHandler,true);
  };
  $$('[data-nominee-view]',menu).forEach(option=>option.onclick=()=>{
    state.nomineeView=option.dataset.nomineeView;
    persistNomineeViewPreference(state.nomineeView);
    syncNomineeViewUi();
    // Keep the view menu open so another layout can be selected immediately.
  });
  if(state.nomineeView==='list')updateListPhotoAspectRatios(grid);
}
function showNomination(id,{fromHistory=false}={}){const nom=nominations.find(n=>n.id===id);if(!nom)return;if(nom.id==='clip-of-year')sortClipNominees();if(!fromHistory)pushNominationHistory('detail',id);state.nominationListScrollTop=$('.nomination-grid')?.scrollTop||0;state.nomination=nom;state.selected=state.votes[id]||null;const mediaNomination=nom.id!=='scam-of-year'&&(nom.type==='Картинка'||nom.type==='Видео'),clearImageOverlay=['scam-of-year','squad-of-year','conflict-of-year'].includes(nom.id),viewClass=state.nomineeView==='compact'?'nominee-grid-compact':state.nomineeView==='list'?'nominee-grid-list':'';const visibleNominees=nom.nominees;const nominees=visibleNominees.map(x=>{const hiddenForTester=Boolean(state.session?.is_test_account&&state.hiddenOptionIds.includes(x.id));const self=state.session&&x.type==='person'&&x.name.toLowerCase()===state.session.nickname.toLowerCase()&&!nom.allowSelf;const selected=state.selected===x.id?'selected':'';if(x.type==='person'){const photoKey=`avatar:${slugPhotoName(x.name)}`,portrait=hiddenForTester?'<span class="portrait tester-locked-portrait" aria-hidden="true"></span>':`<img class="portrait" src="${esc(photoSource(photoKey))}" data-photo-key="${esc(photoKey)}" alt="" loading="lazy">`;const social=nom.id==='style-of-year'&&!hiddenForTester;if(social)return `<div class="nominee-card ${selected} ${state.votes[id]===x.id?'saved':''} ${self?'self':''} ${self||isClosed()?'locked':''} style-profile-card" data-nominee="${esc(x.id)}" ${self?`data-hover-message="${esc(selfHoverMessages[0])}"`:''}><button class="nominee-style-vote" type="button" ${self||isClosed()?'disabled':''}>${portrait}<span class="nominee-name">${esc(x.name)}</span></button><button class="nominee-social-toggle" type="button" data-social-nickname="${esc(x.name)}" aria-label="Социальные сети: ${esc(x.name)}" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 3l.7 1.8L7.5 5.5 5.7 6.2 5 8l-.7-1.8-1.8-.7 1.8-.7L5 3Z"/></svg></button></div>`;return `<button class="nominee-card ${selected} ${state.votes[id]===x.id?'saved':''} ${self?'self':''} ${self||isClosed()?'locked':''} ${hiddenForTester?'tester-locked':''}" data-nominee="${esc(x.id)}" ${isClosed()||hiddenForTester?'disabled':''} ${self?`aria-disabled="true" data-hover-message="${esc(selfHoverMessages[0])}"`:hiddenForTester?'aria-disabled="true" title="Закрыто для тестового голосования"':''}>${portrait}<span class="nominee-name">${hiddenForTester?'Номинант скрыт':esc(x.name)}</span></button>`}const video=x.type==='video',photoKey=`nominee:${nom.id}:${x.id}`,visual=hiddenForTester?'<div class="visual visual-tester-locked" aria-hidden="true"></div>':`<div class="visual ${visualClass(x)}"><img class="visual-photo" src="${esc(photoSource(photoKey))}" data-photo-key="${esc(photoKey)}" alt="" loading="lazy">${video?`<button class="video-play" aria-label="${x.url?'Открыть видео':'Ссылка на видео не добавлена'}"></button>`:''}</div>`;return `<div class="nominee-card ${selected} ${state.votes[id]===x.id?'saved':''} ${video?'video':''} ${isClosed()?'locked':''} ${hiddenForTester?'tester-locked':''}" data-nominee="${esc(x.id)}" ${hiddenForTester?'aria-disabled="true" title="Закрыто для тестового голосования"':''}>${visual}<span class="nominee-name">${hiddenForTester?'Номинант скрыт':esc(x.name)}</span></div>`}).join('');const current=state.votes[id];const msg=isClosed()?'Голосование завершено — выбор доступен только для просмотра.':!state.session?'Войди, чтобы выбрать номинанта.':current?'Текущий голос сохранён. Можно изменить его до 21 ноября.':'Выбери одного номинанта, затем отдай голос.';const changed=Boolean(current&&state.selected&&state.selected!==current);const voteButton=`<div class="vote-actions"><span class="vote-message">${msg}</span><button class="button" id="cast-vote" ${!state.session||isClosed()||!state.selected||(current&&!changed)?'disabled':''}>${current?(changed?'Изменить выбор':'Выбрать'):'Выбрать'}</button></div>`;replaceModalView(`<div class="nom-detail-top"><button class="back-link" id="back-nominations"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg><span>Вернуться к номинациям</span></button><div class="nom-detail-actions">${renderNomineeViewControl()}<button class="close-button" aria-label="Закрыть">×</button></div></div><div class="nom-detail-scroll"><div class="nom-detail"><h2 class="nom-detail-title">${esc(nom.title)}</h2><p class="description">${esc(nom.description)}</p><div class="nominee-grid ${mediaNomination?'nominee-grid-media':''} ${viewClass}">${nominees}</div></div></div>${voteButton}`,`nomination-detail-modal ${clearImageOverlay?'nomination-no-photo-shade':''}`);
bindVisualPhotoFallbacks($('.nomination-detail-modal'));$('#back-nominations').onclick=returnToNominations;bindNomineeViewControl();bindSocialProfileControls();if(nom.id==='style-of-year')prefetchStyleSocialProfiles();$$('[data-nominee]').forEach(el=>{const item=nom.nominees.find(x=>x.id===el.dataset.nominee);const hiddenForTester=Boolean(state.session?.is_test_account&&state.hiddenOptionIds.includes(item?.id));const self=item?.type==='person'&&state.session&&item.name.toLowerCase()===state.session.nickname.toLowerCase()&&!nom.allowSelf;if(item?.type==='video')$('.video-play',el)?.addEventListener('click',e=>{e.stopPropagation();if(!item.url){toast('Ссылка на это видео будет добавлена организатором.');return}const youtube=CONFIG.inlineYoutubePlayerEnabled!==false?parseYouTubeVideoUrl(item.url):null;if(youtube){openYouTubePlayer(item.name,youtube);return}const link=window.open(item.url,'_blank','noopener,noreferrer');if(link)link.opener=null});if(self){let firstHover=true,lastMessage=selfHoverMessages[0];el.addEventListener('pointerenter',()=>{if(firstHover){firstHover=false;return}const choices=selfHoverMessages.slice(1).filter(message=>message!==lastMessage);lastMessage=choices[Math.floor(Math.random()*choices.length)]||selfHoverMessages[1];el.dataset.hoverMessage=lastMessage})}if(self||hiddenForTester||isClosed())return;el.onclick=()=>{state.selected=el.dataset.nominee;$$('.nominee-card').forEach(c=>c.classList.toggle('selected',c.dataset.nominee===state.selected));const changed=Boolean(current&&state.selected!==current);$('#cast-vote').textContent=current?(changed?'Изменить выбор':'Выбрать'):'Выбрать';$('#cast-vote').disabled=!state.session||!state.selected||isClosed()||Boolean(current&&!changed)};});$('#cast-vote').onclick=async()=>{if(state.busy)return;state.busy=true;try{await rpc('cast_vote',{p_token:state.session.token,p_nomination_id:nom.id,p_option_id:state.selected});state.votes[nom.id]=state.selected;toast('Твой голос учтён.');updateProgress();returnToNominations();}catch(e){toast(e.message)}finally{state.busy=false}};}
let socialPopover=null,socialPopoverButton=null,socialPopoverRequest=0,socialPopoverFrame=0,socialPhotoOverlay=null,socialGlobalEventsBound=false;
const socialProfileCache=new Map(),socialProfileRequests=new Map(),socialProfileVersions=new Map();
const socialProfileCacheKey=nickname=>`${state.session?.token||''}:${nickname}`;
function loadMemberSocials(nickname){
  const key=socialProfileCacheKey(nickname);if(socialProfileCache.has(key))return Promise.resolve(socialProfileCache.get(key));if(socialProfileRequests.has(key))return socialProfileRequests.get(key);
  const version=socialProfileVersions.get(key)||0;
  const request=rpc('get_member_socials',{p_token:state.session?.token||'',p_nickname:nickname}).then(data=>{if((socialProfileVersions.get(key)||0)===version)socialProfileCache.set(key,data);return data}).finally(()=>{if(socialProfileRequests.get(key)===request)socialProfileRequests.delete(key)});
  socialProfileRequests.set(key,request);return request;
}
function invalidateMemberSocial(nickname){const key=socialProfileCacheKey(nickname);socialProfileVersions.set(key,(socialProfileVersions.get(key)||0)+1);socialProfileCache.delete(key);socialProfileRequests.delete(key)}
function prefetchStyleSocialProfiles(){$$('[data-social-nickname]').forEach(button=>{loadMemberSocials(button.dataset.socialNickname).catch(()=>{})})}
function closeSocialPhoto(){if(!socialPhotoOverlay)return;socialPhotoOverlay.remove();socialPhotoOverlay=null}
function closeSocialProfileMenu(){
  socialPopoverRequest++;if(socialPopoverFrame){cancelAnimationFrame(socialPopoverFrame);socialPopoverFrame=0}if(socialPopover)socialPopover.remove();socialPopover=null;if(socialPopoverButton)socialPopoverButton.setAttribute('aria-expanded','false');socialPopoverButton=null;
}
function positionSocialProfileMenu(){
  if(!socialPopover||!socialPopoverButton?.isConnected)return;const buttonRect=socialPopoverButton.getBoundingClientRect(),card=socialPopoverButton.closest('.nominee-card'),anchor=card?.getBoundingClientRect()||buttonRect,center=anchor.left+anchor.width/2,centeredWidth=Math.max(112,2*Math.min(center-10,window.innerWidth-center-10)),width=Math.min(278,window.innerWidth-20,centeredWidth),height=socialPopover.offsetHeight,left=Math.max(10,Math.min(center-width/2,window.innerWidth-width-10));let top=anchor.bottom+9;if(top+height>window.innerHeight-10)top=Math.max(10,anchor.top-height-9);socialPopover.classList.toggle('is-compact',width<220);socialPopover.classList.toggle('is-narrow',width<150);socialPopover.style.width=`${width}px`;socialPopover.style.left=`${left}px`;socialPopover.style.top=`${top}px`;
}
function followSocialProfileCard(){
  if(!socialPopover||!socialPopoverButton?.isConnected){socialPopoverFrame=0;return}positionSocialProfileMenu();socialPopoverFrame=requestAnimationFrame(followSocialProfileCard);
}
// Official brand marks: Simple Icons (CC0) and Font Awesome Brands (CC BY 4.0).
function socialServiceIcon(service){
  const icons={steam:{viewBox:'0 0 24 24',path:'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z'},discord:{viewBox:'0 0 24 24',path:'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'},telegram:{viewBox:'0 0 448 512',path:'M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z'}};
  const icon=icons[service]||icons.steam;return `<svg viewBox="${icon.viewBox}" aria-hidden="true"><path d="${icon.path}"/></svg>`;
}
function socialProfileRows(data){
  const rows=[],steam=safeSocialLink(data.steam_url);
  if(steam)rows.push(`<a class="social-profile-row" href="${esc(steam)}" target="_blank" rel="noopener noreferrer"><span class="social-profile-service">${socialServiceIcon('steam')}</span><span><strong>Steam</strong><small>Открыть профиль</small></span><svg class="social-profile-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></a>`);
  if(data.discord_image)rows.push(`<button class="social-profile-row" type="button" data-social-photo="discord"><span class="social-profile-service">${socialServiceIcon('discord')}</span><span><strong>Discord</strong><small>Открыть фото</small></span><svg class="social-profile-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`);
  if(data.telegram_image)rows.push(`<button class="social-profile-row" type="button" data-social-photo="telegram"><span class="social-profile-service">${socialServiceIcon('telegram')}</span><span><strong>Telegram</strong><small>Открыть фото</small></span><svg class="social-profile-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`);
  return rows;
}
function safeSocialLink(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null}catch{return null}}
function openSocialPhotoPreview(nickname,service,image){
  closeSocialPhoto();closeSocialProfileMenu();const label=service==='discord'?'Discord':'Telegram',overlay=document.createElement('div');overlay.className='social-photo-overlay';overlay.innerHTML=`<figure role="dialog" aria-modal="true" aria-label="${esc(label)} — ${esc(nickname)}"><figcaption><div class="social-photo-title"><span>${esc(label)}</span><strong>${esc(nickname)}</strong></div><button class="social-photo-close" type="button" aria-label="Закрыть фото">×</button></figcaption><div class="social-photo-stage"><img src="${esc(image)}" alt="${esc(label)} — ${esc(nickname)}"></div></figure>`;document.body.append(overlay);socialPhotoOverlay=overlay;$('.social-photo-close',overlay).onclick=closeSocialPhoto;overlay.addEventListener('click',event=>{if(event.target===overlay)closeSocialPhoto()});$('.social-photo-close',overlay).focus();
}
async function openSocialProfileMenu(button){
  if(socialPopoverButton===button&&socialPopover){closeSocialProfileMenu();return}closeSocialPhoto();closeSocialProfileMenu();const nickname=button.dataset.socialNickname,request=++socialPopoverRequest;socialPopoverButton=button;button.setAttribute('aria-expanded','true');socialPopover=document.createElement('div');socialPopover.className='social-profile-popover';socialPopover.setAttribute('role','dialog');socialPopover.setAttribute('aria-label',`Социальные сети: ${nickname}`);socialPopover.innerHTML='<div class="social-profile-loading"><span></span>Загружаем профили…</div>';document.body.append(socialPopover);positionSocialProfileMenu();if(socialPopoverFrame)cancelAnimationFrame(socialPopoverFrame);socialPopoverFrame=requestAnimationFrame(followSocialProfileCard);
  try{
    const data=await loadMemberSocials(nickname);if(request!==socialPopoverRequest||socialPopoverButton!==button||!button.isConnected)return;
    const rows=socialProfileRows(data);socialPopover.innerHTML=`<div class="social-profile-list">${rows.length?rows.join(''):'<p class="social-profile-empty">Социальные сети пока не добавлены.</p>'}</div>`;
    $$('[data-social-photo]',socialPopover).forEach(photoButton=>photoButton.onclick=event=>{event.stopPropagation();const service=photoButton.dataset.socialPhoto;openSocialPhotoPreview(nickname,service,data[`${service}_image`])});positionSocialProfileMenu();
  }catch(error){if(request===socialPopoverRequest&&socialPopover)socialPopover.innerHTML=`<p class="social-profile-empty">${esc(error.message)}</p>`;positionSocialProfileMenu()}
}
function bindSocialProfileControls(){
  $$('.nominee-grid img').forEach(image=>{if(image.dataset.fallbackBound)return;image.dataset.fallbackBound='true';image.addEventListener('error',()=>renderNomineeImageFallback(image),{once:true});if(image.complete&&image.naturalWidth===0)renderNomineeImageFallback(image)});
  $$('[data-social-nickname]').forEach(button=>button.onclick=event=>{event.preventDefault();event.stopPropagation();openSocialProfileMenu(button)});
  if(socialGlobalEventsBound)return;socialGlobalEventsBound=true;
  document.addEventListener('pointerdown',event=>{if(socialPopover&&!socialPopover.contains(event.target)&&event.target!==socialPopoverButton&&!socialPopoverButton?.contains(event.target))closeSocialProfileMenu()});
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(socialPhotoOverlay){event.preventDefault();event.stopImmediatePropagation();closeSocialPhoto()}else if(socialPopover){event.preventDefault();event.stopImmediatePropagation();const button=socialPopoverButton;closeSocialProfileMenu();button?.focus()}},true);
  window.addEventListener('resize',closeSocialProfileMenu);document.addEventListener('scroll',positionSocialProfileMenu,true);
}
let modalPageScrollY=0,modalPageScrollLocked=false,modalInlineScrollBehavior='';
function lockModalPageScroll(){
  if(modalPageScrollLocked)return;modalPageScrollLocked=true;modalPageScrollY=window.scrollY;const root=document.documentElement,body=document.body;modalInlineScrollBehavior=root.style.scrollBehavior;root.style.scrollBehavior='auto';const compensation=getComputedStyle(root).scrollbarGutter==='stable'?0:Math.max(0,window.innerWidth-root.clientWidth);body.style.setProperty('--modal-scrollbar-compensation',`${compensation}px`);root.classList.add('modal-scroll-locked');body.classList.add('modal-scroll-locked');body.style.top=`-${modalPageScrollY}px`;
}
function unlockModalPageScroll(){
  if(!modalPageScrollLocked)return;const root=document.documentElement,body=document.body;root.classList.remove('modal-scroll-locked');body.classList.remove('modal-scroll-locked');body.style.top='';body.style.removeProperty('--modal-scrollbar-compensation');window.scrollTo(0,modalPageScrollY);root.style.scrollBehavior=modalInlineScrollBehavior;modalPageScrollLocked=false;
}
function bindModalClose(modal){$('.close-button',modal)?.addEventListener('click',closeModal)}
function replaceModalView(content,kind=''){const root=$('#modal-root'),modal=$('.modal',root);if(!modal){openModal(content,kind);return}modal.className=`modal ${kind}`;modal.innerHTML=content;modal.scrollTop=0;bindModalClose(modal)}
let modalEscapeHandler=null;
function openModal(content,kind=''){
  if(modalEscapeHandler)document.removeEventListener('keydown',modalEscapeHandler);
  lockModalPageScroll();const root=$('#modal-root'),categoryNavigation=kind.includes('nomination-list-modal')||(kind.includes('auth-modal')&&Boolean(state.pendingCategory));root.innerHTML=`<div class="modal-backdrop${categoryNavigation?' category-navigation-backdrop':''}"><section class="modal ${kind}" role="dialog" aria-modal="true">${content}</section></div>`;
  const backdrop=$('.modal-backdrop',root),modal=$('.modal',root);let pointerStartedInside=false;
  modal.addEventListener('pointerdown',()=>{pointerStartedInside=true},true);
  backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)pointerStartedInside=false},true);
  backdrop.addEventListener('click',e=>{if(e.target!==backdrop)return;if(pointerStartedInside){pointerStartedInside=false;return}closeModal()});
  bindModalClose(modal);modalEscapeHandler=e=>{if(e.key==='Escape')closeModal()};document.addEventListener('keydown',modalEscapeHandler);
}
function closeModal(options={}){const fromHistory=options?.fromHistory===true,nominationEntry=history.state?.flareNomination;if(!fromHistory&&nominationEntry&&$('.nomination-list-modal,.nomination-detail-modal')){history.go(-Math.max(1,Number(nominationEntry.depth)||1));return}if(typeof teardownBoing==='function')teardownBoing(true);if(typeof adminRequestCounter!=='undefined')adminRequestCounter++;if(modalEscapeHandler){document.removeEventListener('keydown',modalEscapeHandler);modalEscapeHandler=null}closeNomineeViewMenu();closeSocialPhoto();closeSocialProfileMenu();closeAllAvatarCrops();$('#modal-root').innerHTML='';state.nomination=null;state.pendingCategory=null;unlockModalPageScroll()}
function renderAuth(){openModal(`<div class="eyebrow">FLARE AWARDS · 2026</div><h2 class="auth-title">Вход / регистрация</h2><form id="auth-form" class="auth-form"><label class="form-field"><span>EMAIL</span><input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="Твой email"></label><label class="form-field form-field-pin"><span>ЛИЧНЫЙ PIN-КОД</span><span class="pin-input-wrap"><input id="auth-pin" name="pin" type="password" autocomplete="current-password" required minlength="4" maxlength="72" pattern="[A-Za-z0-9]{4,72}" placeholder="Придумай PIN из букв и цифр"><button type="button" class="pin-toggle" id="toggle-pin" aria-label="Показать PIN" aria-pressed="false"><svg class="pin-eye-show" aria-hidden="true" viewBox="0 0 24 24"><path d="M2.8 12s3.2-6 9.2-6 9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.8"/></svg><svg class="pin-eye-hide" aria-hidden="true" viewBox="0 0 24 24" hidden><path d="m3 3 18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.2 6 9.2 6a15.8 15.8 0 0 1-2.4 3.1M6.2 6.3C4 7.7 2.8 12 2.8 12s3.2 6 9.2 6c1.3 0 2.5-.3 3.5-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></span></label><p class="auth-error" id="auth-error"></p><button class="button" type="submit">Войти в аккаунт</button></form>`, 'auth-modal');$('#toggle-pin').onclick=e=>{const button=e.currentTarget,input=$('#auth-pin'),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Скрыть PIN':'Показать PIN');$('.pin-eye-show',button).hidden=visible;$('.pin-eye-hide',button).hidden=!visible};$('#auth-form').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target),email=String(form.get('email')).trim().toLowerCase(),pin=String(form.get('pin'));const error=$('#auth-error'),button=$('button[type="submit"]',e.target);button.disabled=true;button.textContent='Загрузка...';button.setAttribute('aria-busy','true');error.textContent='';try{if(!clientReady())throw new Error('Сначала настрой Supabase и заполни URL и anon key в config.js.');const data=await rpc('flare_access',{p_email:email,p_pin:pin});if(data.error)throw new Error(data.error);saveSession(data);await loadVideoCatalog();const pendingCategory=state.pendingCategory;state.pendingCategory=null;if(pendingCategory){state.category=pendingCategory;state.nominationListScrollTop=0;renderNominations()}else closeModal();toast(`Добро пожаловать, ${data.nickname}!`)}catch(err){error.textContent=err.message}finally{button.disabled=false;button.textContent='Войти в аккаунт';button.removeAttribute('aria-busy')}}}
function renderWinners(){const track=$('#winner-track');track.innerHTML=previousWinners.map(([title,name,boldName],i)=>`<article class="winner-card"><div class="winner-card-top"><div class="winner-icon">${String(i+1).padStart(2,'0')}</div></div><div><div class="winner-title">${esc(title)}</div><div class="winner-name">${boldName?`<strong class="winner-name-highlight">${esc(name)}</strong>`:esc(name)}</div></div></article>`).join('');updateCarousel();}
function updateCarousel(){const track=$('#winner-track'),cards=$$('.winner-card',track);if(!cards.length)return;const gap=parseFloat(getComputedStyle(track).gap)||0,width=cards[0].getBoundingClientRect().width+gap;const maxOffset=Math.max(0,track.scrollWidth-track.parentElement.clientWidth),maxIndex=Math.ceil(maxOffset/width);state.carousel=Math.max(0,Math.min(state.carousel,maxIndex));const offset=Math.min(state.carousel*width,maxOffset);track.style.transform=`translate3d(${-offset}px,0,0)`}
let carouselDebounce=false;function moveCarousel(dir){if(carouselDebounce)return;carouselDebounce=true;state.carousel+=dir;updateCarousel();setTimeout(()=>carouselDebounce=false,360)}
function initWinnerSwipe(){const viewport=$('.winner-window');if(!viewport)return;let start=null;viewport.addEventListener('touchstart',event=>{if(event.touches.length!==1){start=null;return}const touch=event.touches[0];start={x:touch.clientX,y:touch.clientY}},{passive:true});viewport.addEventListener('touchend',event=>{if(!start)return;const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;start=null;if(Math.abs(dx)>=42&&Math.abs(dx)>Math.abs(dy)*1.2)moveCarousel(dx<0?1:-1)},{passive:true});viewport.addEventListener('touchcancel',()=>{start=null},{passive:true})}
function displayedEventResults(){
  const results=state.eventResults;
  if(!results)return null;
  const counts={...(results.counts||{})};
  let total=Number(results.total)||0;
  const previousChoice=state.eventSaved,nextChoice=state.eventChoice;
  if(nextChoice&&nextChoice!==previousChoice){
    if(previousChoice)counts[previousChoice]=Math.max(0,(Number(counts[previousChoice])||0)-1);
    else total++;
    counts[nextChoice]=(Number(counts[nextChoice])||0)+1;
  }
  return {...results,counts,total};
}
function renderEventOptions(){
  const box=$('#event-options');
  const results=displayedEventResults();
  const showResults=Boolean(state.eventSaved&&results);
  const counts=results?.counts||{};
  const total=Number(results?.total)||0;
  const max=Math.max(0,...eventChoices.map(([id])=>Number(counts[id])||0));
  const leaders=eventChoices.filter(([id])=>Number(counts[id])===max&&max>0);
  box.innerHTML=eventChoices.map(([id,date,day])=>{
    const count=Number(counts[id])||0;
    const percent=total?Math.round(count/total*100):0;
    const leader=showResults&&max>0&&count===max;
    const selected=state.eventChoice===id;
    const badge=leader?(leaders.length===1?'ЛИДИРУЕТ':'НИЧЬЯ'):'';
    return `<button class="poll-option ${selected?'selected':''} ${showResults?'has-results':''} ${leader?'poll-leader':''}" data-event-choice="${id}" ${isClosed()?'disabled':''}><span class="poll-option-top"><span class="radio"></span><span class="poll-option-date"><strong>${date} (${day[0].toUpperCase()+day.slice(1)})</strong></span>${showResults?`<span class="poll-result-badge">${badge}</span>`:''}</span>${showResults?`<span class="poll-result-track" aria-hidden="true"><span style="width:${percent}%"></span></span><span class="poll-result-meta"><span>${countLabel(count,'голос','голоса','голосов')}</span><strong>${percent}%</strong></span>`:''}</button>`
  }).join('');
  $$('[data-event-choice]',box).forEach(button=>button.onclick=()=>{
    if(!state.session){renderAuth();return}
    if(isClosed())return;
    const choice=button.dataset.eventChoice;
    if(state.eventChoice===choice)return;
    state.eventChoice=choice;
    state.eventChoiceRevision++;
    renderEventOptions();
    saveEvent();
  });
  updateProgress();
}
function renderFaq(){$('#faq-list').innerHTML=faq.map(([q,a])=>`<div class="faq-item"><button class="faq-question"><span>${esc(q)}</span><span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 6.5v11M6.5 12h11"></path></svg></span></button><div class="faq-answer"><div class="faq-answer-content">${esc(a)}</div></div></div>`).join('');$$('.faq-question').forEach(b=>b.onclick=()=>b.parentElement.classList.toggle('open'))}
function initFloatingHeader(){const header=$('#site-header'),logo=$('.intro-logo'),faqSection=$('.faq-section');if(!header||!logo||!faqSection)return;let logoVisible=true,faqActive=false,scheduled=false,faqObserver;const refresh=()=>{const atTop=logoVisible&&!faqActive,scrolled=!logoVisible;header.classList.toggle('is-at-top',atTop);header.classList.toggle('is-scrolled',scrolled);header.classList.toggle('is-faq-hidden',faqActive)};const observeFaqBoundary=()=>{if(!('IntersectionObserver'in window))return;faqObserver?.disconnect();const line=header.offsetHeight,bottom=Math.max(0,innerHeight-line-1);faqObserver=new IntersectionObserver(([entry])=>{faqActive=entry.isIntersecting;refresh()},{rootMargin:`-${line}px 0px -${bottom}px 0px`,threshold:0});faqObserver.observe(faqSection)};if('IntersectionObserver'in window){new IntersectionObserver(([entry])=>{logoVisible=entry.isIntersecting;refresh()},{threshold:0}).observe(logo);observeFaqBoundary();window.addEventListener('resize',observeFaqBoundary)}else{const update=()=>{scheduled=false;const l=logo.getBoundingClientRect(),f=faqSection.getBoundingClientRect(),line=header.offsetHeight;logoVisible=l.bottom>0&&l.top<innerHeight;faqActive=f.top<=line&&f.bottom>line;refresh()};const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}};window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);schedule()}}
async function saveEvent(){if(!state.session||!state.eventChoice||isClosed()||state.eventSaving||state.eventChoice===state.eventSaved)return;state.eventSaving=true;updateProgress();const token=state.session.token;try{while(state.session?.token===token&&state.eventChoice&&state.eventChoice!==state.eventSaved&&!isClosed()){const choice=state.eventChoice;try{const data=await rpc('save_event_choice',{p_token:token,p_choice_id:choice});if(state.session?.token!==token)break;state.eventSaved=choice;state.eventResults=data.event_results||state.eventResults;renderEventOptions()}catch(e){if(state.session?.token!==token)break;if(choice!==state.eventChoice)continue;state.eventChoice=state.eventSaved;toast(e.message);renderEventOptions();break}}}finally{state.eventSaving=false;renderEventOptions();updateProgress()}}
function renderTestBallotContent(ballot){
  if(!ballot)return '<p class="admin-access-note">Чтобы включить просмотр тестовых голосов, выполни SQL из <code>supabase/migrations/20261104_test_ballot_review_and_locked_options.sql</code> в Supabase SQL Editor.</p>';
  const votes=Array.isArray(ballot.votes)?ballot.votes:[];
  const byNomination=new Map(votes.map(vote=>[vote.nomination_id,vote]));
  const event=eventChoices.find(([id])=>id===ballot.event_choice);
  const eventLabel=event?`${event[1]} · ${event[2]}`:'Ещё не выбрал';
  const status=!ballot.exists?'Тестовая учётка пока не создана':ballot.submitted?'Бюллетень отправлен':'Бюллетень заполняется';
  const rows=nominations.map(nom=>{const vote=byNomination.get(nom.id);return `<div class="admin-test-ballot-row"><span>${esc(nom.title)}</span><strong>${vote?esc(vote.option_name):'Ещё не выбрал'}</strong></div>`}).join('');
  return `<p class="admin-test-ballot-status">${status}</p><div class="admin-test-ballot-list">${rows}</div><div class="admin-test-ballot-event"><span>Опрос даты</span><strong>${eventLabel}</strong></div>`;
}
let adminRequestCounter=0;
function adminHeaderMarkup(){return `<div class="admin-head"><nav class="admin-tabs" role="tablist" aria-label="Разделы панели организатора"><button class="admin-tab is-active" id="admin-tab-voting" type="button" role="tab" aria-selected="true" aria-controls="admin-panel-voting" data-admin-tab="voting">Голосование</button><button class="admin-tab" id="admin-tab-poll" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-poll" data-admin-tab="poll">Опрос</button><button class="admin-tab" id="admin-tab-statistics" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-statistics" data-admin-tab="statistics">Статистика</button><button class="admin-tab" id="admin-tab-design" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-design" data-admin-tab="design">Дизайн</button><button class="admin-tab" id="admin-tab-social" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-social" data-admin-tab="social">Соцсети</button><button class="admin-tab" id="admin-tab-access" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-access" data-admin-tab="access">Доступ</button></nav><button class="close-button" aria-label="Закрыть">×</button></div>`}
function setAdminTab(selected){
  const modal=$('.admin-modal');if(!modal)return;
  $$('[data-admin-tab]',modal).forEach(tab=>{const active=tab.dataset.adminTab===selected;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1});
  $$('.admin-tab-panel',modal).forEach(panel=>{panel.hidden=panel.id!==`admin-panel-${selected}`});
  modal.scrollTop=0;
}
function bindAdminTabs(){
  $$('[data-admin-tab]',$('.admin-modal')).forEach(tab=>tab.addEventListener('click',()=>setAdminTab(tab.dataset.adminTab)));
}
async function showAdmin(){
  const requestId=++adminRequestCounter;
  openModal(`${adminHeaderMarkup()}<div class="admin-wrap" aria-live="polite"><div class="admin-loading" role="status"><span class="admin-loading-spinner" aria-hidden="true"></span><strong>Открываю панель организатора…</strong><span>Загружаю данные голосования</span></div></div>`,'admin-modal');
  bindAdminTabs();
  try{
    const [result,,socials]=await Promise.all([rpc('admin_summary',{p_token:state.session.token}),loadVideoCatalog(),rpc('admin_get_member_socials',{p_token:state.session.token})]);
    if(requestId!==adminRequestCounter||!$('.admin-modal'))return;
    adminSocialRows=Array.isArray(socials)?socials:[];
    const buckets=new Map();
    for(const row of result.votes||[]){
      if(!buckets.has(row.nomination_title))buckets.set(row.nomination_title,new Map());
      const options=buckets.get(row.nomination_title);
      if(!options.has(row.option_name))options.set(row.option_name,[]);
      options.get(row.option_name).push(row.nickname);
    }
    const nominationCards=nominations.map(nom=>{
      const options=buckets.get(nom.title)||new Map();
      const candidateNames=[...new Set([...nom.nominees.map(x=>x.name),...options.keys()])];
      const ranked=candidateNames.map(name=>({name,voters:options.get(name)||[],count:(options.get(name)||[]).length}))
        .filter(option=>option.count>0)
        .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ru'));
      const total=ranked.reduce((sum,option)=>sum+option.count,0);
      let previousCount=null,rank=0;
      ranked.forEach((option,index)=>{if(index===0||option.count<previousCount)rank=index+1;option.rank=rank;previousCount=option.count});
      const leaders=ranked.filter(option=>option.rank===1).length;
      const rows=ranked.map(option=>{
        const winner=option.rank===1;
        const place=winner?(leaders>1?'НИЧЬЯ · 1 МЕСТО':'ПОБЕДИТЕЛЬ'):`${option.rank} МЕСТО`;
        const percent=ranked[0]?.count?Math.round(option.count/ranked[0].count*100):0;
        return `<div class="admin-rank-row ${winner?'is-winner':''} ${option.rank===2?'is-second':''} ${option.rank===3?'is-third':''}"><span class="admin-rank-badge"><strong>${winner?'★':option.rank}</strong><small>${place}</small></span><div class="admin-rank-candidate"><strong>${esc(option.name)}</strong><span class="admin-rank-track"><i style="width:${percent}%"></i></span></div><strong class="admin-rank-count">${countLabel(option.count,'голос','голоса','голосов')}</strong><details class="admin-voter-list"><summary>Участники (${option.voters.length})</summary><div>${option.voters.map(name=>`<span>${esc(name)}</span>`).join('')}</div></details></div>`
      }).join('');
      return `<section class="admin-nomination-card"><header><div><span class="admin-nomination-category">${nom.category==='основная'?'ОСНОВНАЯ НОМИНАЦИЯ':'ДОПОЛНИТЕЛЬНАЯ НОМИНАЦИЯ'}</span><h4>${esc(nom.title)}</h4></div><span class="admin-nomination-total">${countLabel(total,'голос','голоса','голосов')}</span></header><div class="admin-rankings">${rows||'<p class="admin-no-votes">Пока нет голосов</p>'}</div></section>`
    }).join('');
    const prefs=result.event_preferences||[];
    const total=prefs.length;
    const pollRows=eventChoices.map(([id,date,day])=>{
      const label=`${date} · ${day}`;
      const voters=prefs.filter(x=>x.choice_label===label);
      const percent=total?Math.round(voters.length/total*100):0;
      return `<div class="admin-poll-row"><div class="admin-poll-choice"><strong>${date}</strong><span>${day}</span></div><div class="admin-poll-meter"><div class="admin-poll-track"><span style="width:${percent}%"></span></div><div class="admin-poll-stats"><strong>${percent}%</strong><span>${countLabel(voters.length,'голос','голоса','голосов')}</span></div></div><div class="admin-poll-voters">${voters.length?voters.map(x=>`<span>${esc(x.nickname)}</span>`).join(''):'<span class="empty">Пока нет голосов</span>'}</div></div>`
    }).join('');
    const statsReady=Boolean(result.statistics&&typeof result.statistics==='object');
    const stats=result.statistics||{};
    const registered=Array.isArray(stats.registered_nicknames)?stats.registered_nicknames:[];
    const voted=Array.isArray(stats.voted_nicknames)?stats.voted_nicknames:[];
    const notVoted=Array.isArray(stats.not_voted_nicknames)?stats.not_voted_nicknames:[];
    const partiallyVoted=Array.isArray(stats.partially_voted_nicknames)?stats.partially_voted_nicknames:[];
    const totalNominations=Number(stats.total_nominations)||nominations.length;
    const partialStatsReady=Array.isArray(stats.partially_voted_nicknames);
    const statsList=(items,empty)=>items.length?`<ul class="admin-stat-list">${items.map(name=>`<li>${esc(name)}</li>`).join('')}</ul>`:`<p class="admin-stat-empty">${empty}</p>`;
    const partialStatsList=partiallyVoted.length?`<ul class="admin-stat-list admin-partial-voter-list">${partiallyVoted.map(item=>`<li><span>${esc(item.nickname)}</span><strong>${Number(item.vote_count)||0}/${totalNominations}</strong></li>`).join('')}</ul>`:`<p class="admin-stat-empty">Пока нет участников с незаполненным бюллетенем.</p>`;
    const statisticsPanel=`<section class="admin-tab-panel admin-statistics-panel" id="admin-panel-statistics" role="tabpanel" aria-labelledby="admin-tab-statistics" hidden>${statsReady?'':`<p class="admin-stat-note">Чтобы загрузить статистику, обнови функцию <code>admin_summary</code> в Supabase: выполни актуальный файл <code>supabase/schema.sql</code>.</p>`}${partialStatsReady?'':`<p class="admin-stat-note">Чтобы увидеть незавершённые бюллетени, выполни актуальный <code>supabase/schema.sql</code> в Supabase SQL Editor.</p>`}<div class="admin-stats-cards"><article class="admin-stat-card"><span>Участники с голосами</span><strong>${statsReady?(Number(stats.voted_count)||voted.length):'—'}</strong></article><article class="admin-stat-card"><span>Всего голосов</span><strong>${statsReady?(Number(stats.total_votes)||0):'—'}</strong></article><article class="admin-stat-card"><span>Зарегистрировано</span><strong>${statsReady?(Number(stats.registered_count)||registered.length):'—'}</strong></article></div><div class="admin-stat-lists"><section class="admin-stat-list-card"><h3>Проголосовали</h3>${statsList(voted,'Пока никто не проголосовал.')}</section><section class="admin-stat-list-card"><h3>Проголосовали не полностью</h3>${partialStatsList}</section><section class="admin-stat-list-card"><h3>Не проголосовали</h3>${statsList(notVoted,'Все зарегистрированные уже оставили голос.')}</section><section class="admin-stat-list-card"><h3>Зарегистрированные участники</h3>${statsList(registered,'Нет зарегистрированных участников.')}</section></div></section>`;
    let accountsClosed=Boolean(result.accounts_closed),testerExists=Boolean(result.test_ballot?.exists);
    const accessControlReady=typeof result.accounts_closed==='boolean';
    const accessPanel=`<section class="admin-tab-panel admin-access-panel" id="admin-panel-access" role="tabpanel" aria-labelledby="admin-tab-access" hidden><article class="admin-access-card"><div><span class="admin-access-kicker">КОНТРОЛЬ ДОСТУПА</span><h3>Вход и регистрация</h3><p>В закрытом режиме войти смогут только <strong>FLARE_TESTER</strong> и <strong>Maronnix</strong>. Обычные уже открытые сессии тоже потеряют доступ к голосованию и аккаунтным действиям.</p></div><div class="admin-access-actions"><strong id="admin-access-status" class="admin-access-status ${accountsClosed?'is-closed':'is-open'}">${accountsClosed?'ЗАКРЫТ':'ОТКРЫТ'}</strong><button type="button" class="button" id="admin-access-toggle" ${accessControlReady?'':'disabled'}>${accountsClosed?'Открыть вход':'Закрыть вход'}</button></div></article>${accessControlReady?'':'<p class="admin-access-note">Сначала выполни актуальный <code>supabase/schema.sql</code> в Supabase SQL Editor.</p>'}<p class="admin-access-note">Голоса FLARE_TESTER хранятся отдельно и не попадают в результаты премии или опрос даты.</p><article class="admin-test-account-card"><div><span class="admin-access-kicker">ТЕСТОВАЯ УЧЁТКА</span><h3>Данные для тестировщика</h3><p>Создай случайные данные и передай их тестировщику. Почта на <code>example.invalid</code> фиктивная, письма на неё не отправляются. Новая генерация сбросит предыдущий PIN и тестовые голоса.</p></div><div class="admin-test-account-actions"><button type="button" class="button" id="admin-test-credentials-generate" ${accessControlReady?'':'disabled'}>Сгенерировать данные</button><button type="button" class="button-quiet admin-test-account-delete" id="admin-test-account-delete" ${accessControlReady&&testerExists?'':'disabled'}>Удалить аккаунт</button></div><div class="admin-test-credentials" id="admin-test-credentials" hidden><label><span>Почта</span><div><input id="admin-test-email" readonly><button type="button" class="button-quiet" data-copy-test="email">Копировать</button></div></label><label><span>PIN</span><div><input id="admin-test-pin" readonly><button type="button" class="button-quiet" data-copy-test="pin">Копировать</button></div></label><p>Сохрани данные до закрытия панели: PIN хранится только в виде хеша и повторно не показывается.</p></div></article><article class="admin-test-ballot-card"><div class="admin-test-ballot-heading"><div><span class="admin-access-kicker">ПРОВЕРКА БЮЛЛЕТЕНЯ</span><h3>Голоса тестировщика</h3><p>Выборы тестового аккаунта не учитываются в официальной статистике.</p></div><button type="button" class="button-quiet" id="admin-test-ballot-refresh">Обновить</button></div><div id="admin-test-ballot-content" aria-live="polite">${renderTestBallotContent(result.test_ballot)}</div></article></section>`;
    const designPanel=renderDesignPanel();
    const adminWrap=$('.admin-wrap',$('.admin-modal'));
    if(requestId!==adminRequestCounter||!adminWrap)return;
    adminWrap.innerHTML=`<section class="admin-tab-panel admin-ballot-results" id="admin-panel-voting" role="tabpanel" aria-labelledby="admin-tab-voting"><div class="admin-results-heading"><h3>Результаты голосования</h3><span>Рейтинг по текущим голосам</span></div><div class="admin-nomination-results">${nominationCards}</div></section><section class="admin-tab-panel admin-poll" id="admin-panel-poll" role="tabpanel" aria-labelledby="admin-tab-poll" hidden><div class="admin-poll-heading"><h3>Результаты опроса</h3><span>${countLabel(total,'ответ','ответа','ответов')}</span></div><div class="admin-poll-results">${pollRows}</div></section>${statisticsPanel}${designPanel}${renderAdminSocialPanel()}${accessPanel}`;
    const selectedTab=$('.admin-tab.is-active',$('.admin-modal'))?.dataset.adminTab||'voting';
    setAdminTab(selectedTab);
    bindDesignPanel();bindAdminSocialPanel();
    $('#admin-test-ballot-refresh')?.addEventListener('click',async event=>{
      const button=event.currentTarget,content=$('#admin-test-ballot-content');button.disabled=true;
      try{const latest=await rpc('admin_summary',{p_token:state.session.token});testerExists=Boolean(latest.test_ballot?.exists);if($('#admin-test-account-delete'))$('#admin-test-account-delete').disabled=!testerExists;if(content?.isConnected)content.innerHTML=renderTestBallotContent(latest.test_ballot)}catch(error){toast(error.message)}finally{if(button.isConnected)button.disabled=false}
    });
    const accessToggle=$('#admin-access-toggle'),accessStatus=$('#admin-access-status');
    accessToggle?.addEventListener('click',async()=>{
      accessToggle.disabled=true;
      try{
        const result=await rpc('admin_set_accounts_closed',{p_token:state.session.token,p_closed:!accountsClosed});
        accountsClosed=Boolean(result.accounts_closed);
        accessStatus.textContent=accountsClosed?'ЗАКРЫТ':'ОТКРЫТ';
        accessStatus.classList.toggle('is-closed',accountsClosed);
        accessStatus.classList.toggle('is-open',!accountsClosed);
        accessToggle.textContent=accountsClosed?'Открыть вход':'Закрыть вход';
        toast(accountsClosed?'Вход закрыт для обычных аккаунтов.':'Вход и регистрация снова открыты.');
      }catch(error){toast(error.message)}finally{if(accessToggle.isConnected)accessToggle.disabled=false}
    });
    const testCredentialsButton=$('#admin-test-credentials-generate'),testAccountDeleteButton=$('#admin-test-account-delete');
    testCredentialsButton?.addEventListener('click',async()=>{
      testCredentialsButton.disabled=true;
      try{
        const credentials=await rpc('admin_rotate_test_credentials',{p_token:state.session.token});
        $('#admin-test-email').value=credentials.email;
        $('#admin-test-pin').value=credentials.pin;
        $('#admin-test-credentials').hidden=false;testerExists=true;if(testAccountDeleteButton)testAccountDeleteButton.disabled=false;
        $('#admin-test-ballot-content').innerHTML=renderTestBallotContent({exists:true,submitted:false,votes:[],event_choice:null});
        toast('Новые данные созданы. Скопируй их до закрытия панели.');
      }catch(error){toast(error.message)}finally{if(testCredentialsButton.isConnected)testCredentialsButton.disabled=false}
    });
    testAccountDeleteButton?.addEventListener('click',async()=>{
      if(!testerExists||!window.confirm('Удалить аккаунт тестировщика? Его сессии, PIN и тестовые голоса будут удалены. Войти по старым данным больше не получится.'))return;
      testAccountDeleteButton.disabled=true;if(testCredentialsButton)testCredentialsButton.disabled=true;
      try{
        const deletion=await rpc('admin_delete_tester_account',{p_token:state.session.token});testerExists=false;
        $('#admin-test-credentials').hidden=true;$('#admin-test-email').value='';$('#admin-test-pin').value='';
        $('#admin-test-ballot-content').innerHTML=renderTestBallotContent({exists:false,submitted:false,votes:[],event_choice:null});
        toast(deletion.deleted?'Аккаунт тестировщика удалён. Старые данные больше не работают.':'Аккаунт тестировщика уже был удалён.');
      }catch(error){toast(error.message)}finally{if(testAccountDeleteButton.isConnected)testAccountDeleteButton.disabled=!testerExists;if(testCredentialsButton?.isConnected)testCredentialsButton.disabled=false}
    });
    $$('[data-copy-test]').forEach(button=>button.addEventListener('click',async()=>{
      const input=$(`#admin-test-${button.dataset.copyTest}`);
      try{await navigator.clipboard.writeText(input.value);toast('Скопировано.')}catch{input.select();document.execCommand('copy');toast('Скопировано.')}
    }));
  }catch(e){
    if(requestId!==adminRequestCounter)return;
    const wrap=$('.admin-wrap',$('.admin-modal'));if(!wrap)return;
    wrap.innerHTML=`<div class="admin-load-error" role="alert"><strong>Не удалось загрузить данные панели</strong><p>${esc(e.message)}</p><button type="button" class="button" id="admin-retry">Повторить</button></div>`;
    $('#admin-retry').onclick=showAdmin;
  }
}
async function initializeSite(){
  $('#auth-button').onclick=()=>{
    if(!state.session){renderAuth();return}
    if(typeof showProfile!=='function'){toast('Профиль ещё загружается. Нажми ещё раз через секунду.');return}
    showProfile().catch(error=>{console.error('Не удалось открыть профиль:',error);toast('Не удалось открыть профиль. Попробуй ещё раз.')});
  };
  await loadPhotoOverrides();
  $$('.intro-link[data-category]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();history.replaceState(null,'',link.getAttribute('href'));scrollToCategoryButtons()}));
  $$('.category-card').forEach(b=>b.onclick=()=>{b.blur();if(!state.session){state.pendingCategory=b.dataset.category;renderAuth();return}state.category=b.dataset.category;state.nominationListScrollTop=0;renderNominations()});$('#winner-prev').onclick=()=>moveCarousel(-1);$('#winner-next').onclick=()=>moveCarousel(1);renderFaq();renderWinners();initWinnerSwipe();renderEventOptions();updateAccount();initCountdown();initFloatingHeader();window.addEventListener('resize',updateCarousel);if(state.session)loadVideoCatalog();
  document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==='a'&&state.session?.nickname.toLowerCase()==='maronnix')showAdmin()});
  syncNominationHistory();
}
initializeSite();
