const CONFIG=window.FLARE_CONFIG||{};
const state={session:JSON.parse(localStorage.getItem('flare-session')||'null'),votes:{},eventChoice:null,eventSaved:null,eventResults:null,eventSaving:false,eventChoiceRevision:0,category:'основная',nomination:null,selected:null,carousel:0,busy:false,nominationListScrollTop:0};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const closing=new Date('2026-11-22T00:00:00+03:00');
const selfHoverMessages=['ЗА СЕБЯ НЕЛЬЗЯ ГОЛОСОВАТЬ','УБЕРИ КУРСОР','МНОГО ХОЧЕШЬ','КУДА ЛЕЗЕШЬ?','ЧИТАЙ ПРАВИЛА','ИДИ НАХУЙ','ТЫ СЛУЧАЕМ НЕ АХУЕЛ?','ДОСТУП ОТКЛОНЁН','СПАСИБО ЗА ПОНИМАНИЕ','НЕ ПОЛУЧАЕТСЯ?','ЭГОИСТ','ПИДОРАС ОБНАРУЖЕН','НЕ СЕЙЧАС','Я СКАЗАЛ НЕЛЬЗЯ','ПОПРОБУЙ ЕЩЁ РАЗ','ЩА ПОЧИНЮ, ПОДОЖДИ'];
const isClosed=()=>Date.now()>=closing.getTime();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clientReady=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&!CONFIG.supabaseUrl.includes('YOUR_')&&!CONFIG.supabaseAnonKey.includes('YOUR_'));
function toast(message){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.append(el)}el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2800)}
async function rpc(name,args={}){if(!clientReady())throw new Error('Сначала добавьте URL и anon key Supabase в config.js.');const headers={'Content-Type':'application/json','apikey':CONFIG.supabaseAnonKey,'Authorization':`Bearer ${CONFIG.supabaseAnonKey}`};const response=await fetch(`${CONFIG.supabaseUrl.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args)});let result;try{result=await response.json()}catch{result={}}if(!response.ok)throw new Error(result.message||result.details||'Не удалось связаться с Supabase.');return result}
function saveSession(s){state.session=s;localStorage.setItem('flare-session',JSON.stringify(s));updateAccount()}
function updateAccount(){const s=state.session;$('#auth-button').textContent=s?'Выйти':'Войти';$('#account-status').innerHTML=s?`<span class="status-dot"></span>${esc(s.nickname)}${s.nickname.toLowerCase()==='maronnix'?' <button class="text-button" id="admin-entry">Админ</button>':''}`:'';$('#admin-entry')?.addEventListener('click',showAdmin);updateProgress();if(s){const accountToken=s.token,choiceRevision=state.eventChoiceRevision;rpc('get_my_ballot',{p_token:accountToken}).then(data=>{if(state.session?.token!==accountToken)return;state.votes=data.votes||{};state.eventSaved=data.event_choice||null;if(state.eventChoiceRevision===choiceRevision)state.eventChoice=state.eventSaved;state.eventResults=data.event_results||null;state.session.ballot_submitted=Boolean(data.ballot_submitted);localStorage.setItem('flare-session',JSON.stringify(state.session));if(state.eventChoiceRevision!==choiceRevision&&state.eventChoice&&state.eventChoice!==state.eventSaved)saveEvent();updateProgress();renderEventOptions();}).catch(e=>{console.warn(e);if(state.session?.token===accountToken&&/session|token|авторизац/i.test(e.message)){localStorage.removeItem('flare-session');state.session=null;updateAccount()}})}else{state.votes={};state.eventChoice=null;state.eventSaved=null;state.eventResults=null;updateProgress();renderEventOptions()}}
function updateProgress(){const total=nominations.length,done=Object.keys(state.votes).length;$('#overall-progress').textContent=state.session?`Проголосовано: ${done}/${total}`:'Войди, чтобы голосовать';$('#deadline-banner').hidden=!isClosed();$('#event-poll-status').textContent=!state.session?'Войди в аккаунт, чтобы ответить на опрос.':state.eventSaving?'Сохраняем твой ответ…':state.eventSaved?'Твой ответ сохранён. Нажми другой вариант, чтобы изменить его.':'Нажми на вариант — ответ сохранится сразу.';}
function countLabel(count,one,few,many){const n=Math.abs(Number(count)||0)%100,last=n%10,word=n>10&&n<20?many:last===1?one:last>=2&&last<=4?few:many;return `${count} ${word}`}
function nomineeCountLabel(count){return countLabel(count,'номинант','номинанта','номинантов')}

const photoOverrides=Object.create(null);
let photoDatabasePromise;
async function loadClipCatalog(){
  if(!clientReady())return false;
  try{
    const catalog=await rpc('get_clip_options');
    const clipNomination=nominations.find(nomination=>nomination.id==='clip-of-year');
    for(const row of Array.isArray(catalog)?catalog:[]){
      const item=clipNomination?.nominees.find(nominee=>nominee.id===row.id);
      if(item){item.name=row.name||item.name;item.url=row.video_url||''}
    }
    return true;
  }catch(error){console.info('Названия и ссылки клипов не загружены:',error.message);return false}
}
function slugPhotoName(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function buildPhotoSlots(){
  const slots=[],people=new Set();
  nominations.forEach(nom=>{
    slots.push({key:`nomination:${nom.id}`,group:'Обложки номинаций',groupKey:'covers',label:nom.title,path:`assets/photos/nominations/${nom.id}.jpg`});
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
function renderClipOptionsEditor(){
  const clips=nominations.find(nomination=>nomination.id==='clip-of-year')?.nominees||[];
  return `<section class="admin-clip-editor" aria-labelledby="admin-clip-editor-title"><div><h3 id="admin-clip-editor-title">Названия и ссылки клипов</h3><p>Сохраняются в Supabase и отображаются всем. Перед первым использованием выполни актуальный <code>supabase/schema.sql</code> в Supabase SQL Editor. ID вариантов не меняются, поэтому уже отданные голоса сохранятся.</p></div><div class="admin-clip-list">${clips.map(item=>`<div class="admin-clip-row" data-clip-row="${esc(item.id)}"><label class="admin-clip-field"><span>Клип ${esc(item.id.replace('clip-',''))} · название</span><input type="text" maxlength="120" required data-clip-name="${esc(item.id)}" value="${esc(item.name)}" placeholder="Например, решающий гол"></label><label class="admin-clip-field"><span>Ссылка на видео</span><input type="url" data-clip-url="${esc(item.id)}" value="${esc(item.url||'')}" placeholder="https://youtu.be/..."></label><button type="button" class="button admin-clip-save" data-clip-save="${esc(item.id)}">Сохранить</button></div>`).join('')}</div></section>`;
}
function renderDesignPanel(){
  const cards=photoSlots.map(slot=>{
    const avatar=slot.groupKey==='avatars';
    const image=`<img src="${esc(photoSource(slot.key))}" data-photo-key="${esc(slot.key)}" alt="${esc(slot.label)}" loading="lazy">`;
    const preview=avatar?`<div class="admin-design-preview is-avatar">${image}<div class="admin-avatar-reference" aria-label="Круглый кадр аватарки"><div class="admin-avatar-reference-circle"><img src="${esc(photoSource(slot.key))}" data-photo-key="${esc(slot.key)}" alt="" loading="lazy"></div><small>В круге</small></div></div>`:`<div class="admin-design-preview">${image}</div>`;
    const cropEditor=avatar?`<section class="admin-avatar-editor" data-avatar-editor hidden><h4>${esc(slot.label)} · кадр аватарки</h4><p>Перетащи фото в круге. Точная круглая обрезка сохранится и в карточке номинанта.</p><canvas class="admin-avatar-crop-canvas" data-avatar-canvas width="512" height="512" aria-label="Круглый предпросмотр кадра аватарки"></canvas><div class="admin-avatar-crop-controls"><label>Размер <output data-avatar-zoom-value>100%</output><input type="range" min="100" max="300" step="1" value="100" data-avatar-zoom aria-label="Размер кадра"></label><label>По горизонтали<input type="range" min="-100" max="100" step="1" value="0" data-avatar-pan-x aria-label="Положение по горизонтали"></label><label>По вертикали<input type="range" min="-100" max="100" step="1" value="0" data-avatar-pan-y aria-label="Положение по вертикали"></label></div><div class="admin-avatar-crop-actions"><button type="button" class="button admin-avatar-crop-save" data-avatar-crop-save>Применить кадр</button><button type="button" class="button-quiet admin-avatar-crop-cancel" data-avatar-crop-cancel>Отмена</button></div></section>`:'';
    return `<article class="admin-design-card" data-design-key="${esc(slot.key)}" data-design-category="${slot.groupKey}" data-design-search="${esc(`${slot.label} ${slot.path}`.toLowerCase())}">${preview}<div class="admin-design-info"><h4>${esc(slot.label)}</h4><span class="admin-design-local-badge" data-local-photo-badge hidden>Локальная замена</span><code>${esc(slot.path)}</code></div><div class="admin-design-actions"><label class="admin-design-upload">Заменить<input type="file" accept="image/*" data-design-upload="${esc(slot.key)}" aria-label="Заменить фото: ${esc(slot.label)}"></label>${avatar?`<button type="button" class="admin-design-crop" data-design-crop>Настроить кадр</button>`:''}<button type="button" class="admin-design-download" data-design-download="${esc(slot.key)}">Скачать</button><button type="button" class="admin-design-reset" data-design-reset="${esc(slot.key)}" ${photoOverrides[slot.key]?'':'disabled'}>Сбросить</button></div>${cropEditor}</article>`;
  }).join('');
  return `<section class="admin-tab-panel admin-design-panel" id="admin-panel-design" role="tabpanel" aria-labelledby="admin-tab-design" hidden><div class="admin-design-intro"><div><h3>Фото на сайте</h3><p>Загруженное фото уменьшается без искажения. Для аватаров настрой кадр в круглом предпросмотре — он совпадает с видом у номинанта.</p><p class="admin-design-note">Предпросмотр сохраняется только в этом браузере. Чтобы опубликовать изменения, скачай их и замени файлы по указанным путям.</p></div><div class="admin-design-export-actions"><button type="button" class="button admin-design-export" id="export-design-changes" disabled>Скачать изменения</button><button type="button" class="button-quiet admin-design-export" id="export-design-photos">Скачать полный набор</button></div></div><div class="admin-design-sync" id="admin-design-sync-status" role="status" aria-live="polite"><div><strong data-design-sync-title></strong><p data-design-sync-copy></p></div><details data-design-sync-files hidden><summary data-design-sync-summary></summary><ul data-design-sync-list></ul></details></div>${renderClipOptionsEditor()}<div class="admin-design-toolbar"><div class="admin-design-filters" role="group" aria-label="Фильтр фотографий"><button type="button" class="is-active" data-design-filter="all">Все (${photoSlots.length})</button><button type="button" data-design-filter="covers">Обложки</button><button type="button" data-design-filter="avatars">Аватары</button><button type="button" data-design-filter="nominees">Картинки</button><button type="button" data-design-filter="videos">Видео</button></div><input id="admin-design-search" type="search" placeholder="Найти фото…" aria-label="Найти фото"></div><div class="admin-design-grid">${cards}</div></section>`;
}
function updatePhotoSyncStatus(){const status=$('#admin-design-sync-status');if(!status)return;const pending=photoSlots.filter(slot=>Boolean(photoOverrides[slot.key])),title=$('[data-design-sync-title]',status),copy=$('[data-design-sync-copy]',status),details=$('[data-design-sync-files]',status),summary=$('[data-design-sync-summary]',status),list=$('[data-design-sync-list]',status),changedButton=$('#export-design-changes');if(title)title.textContent=pending.length?`Локально изменено: ${pending.length} фото`:'Нет локальных изменений';if(copy)copy.textContent=pending.length?'Эти замены видны только в этом браузере. На сайте пока прежние файлы. Скачай изменения и замени перечисленные файлы в репозитории.':'Предпросмотр использует опубликованные файлы. Новые замены сохранятся локально, пока ты не выгрузишь их.';if(details){details.hidden=!pending.length;if(summary)summary.textContent=`Показать файлы для публикации (${pending.length})`;if(list)list.innerHTML=pending.map(slot=>`<li><strong>${esc(slot.label)}</strong><code>${esc(slot.path)}</code></li>`).join('')}if(changedButton){changedButton.disabled=!pending.length;changedButton.textContent=`Скачать изменения${pending.length?` (${pending.length})`:''}`}const grid=$('.admin-design-grid');if(grid)$$('.admin-design-card',grid).forEach(card=>{const changed=Boolean(photoOverrides[card.dataset.designKey]),badge=$('[data-local-photo-badge]',card),reset=$('[data-design-reset]',card);card.classList.toggle('has-local-photo',changed);if(badge)badge.hidden=!changed;if(reset)reset.disabled=!changed})}
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
  const applyFilter=()=>{const category=$('.admin-design-filters .is-active')?.dataset.designFilter||'all',query=$('#admin-design-search').value.trim().toLowerCase();$$('.admin-design-card',grid).forEach(card=>{card.hidden=(category!=='all'&&card.dataset.designCategory!==category)||Boolean(query&&!card.dataset.designSearch.includes(query))})};
  $$('[data-design-filter]').forEach(button=>button.onclick=()=>{$$('.admin-design-filters button').forEach(item=>item.classList.toggle('is-active',item===button));applyFilter()});
  $('#admin-design-search').oninput=applyFilter;
  $$('[data-clip-save]',panel).forEach(button=>button.onclick=async()=>{
    const id=button.dataset.clipSave,nameInput=$(`[data-clip-name="${id}"]`,panel),urlInput=$(`[data-clip-url="${id}"]`,panel),nominee=nominations.find(nomination=>nomination.id==='clip-of-year')?.nominees.find(item=>item.id===id);
    const name=nameInput.value.trim(),url=urlInput.value.trim();if(!name){nameInput.focus();toast('Укажи название клипа.');return}
    button.disabled=true;
    try{
      const saved=await rpc('admin_update_clip_option',{p_token:state.session.token,p_option_id:id,p_name:name,p_video_url:url||null});
      if(nominee){nominee.name=saved.name;nominee.url=saved.video_url||''}
      nameInput.value=saved.name;urlInput.value=saved.video_url||'';toast('Название и ссылка клипа сохранены для всех.');
    }catch(error){toast(error.message)}finally{button.disabled=false}
  });
  $$('[data-design-upload]',grid).forEach(input=>input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const key=input.dataset.designUpload,slot=photoSlotByKey.get(key),card=input.closest('.admin-design-card');input.disabled=true;try{const blob=await resizePhoto(file);if(slot.groupKey==='avatars'){const url=URL.createObjectURL(blob);await openAvatarCrop(card,url,url);toast('Перетащи и настрой кадр в круглом предпросмотре.')}else{await savePhotoOverride(key,blob);card.querySelector(`[data-design-reset="${key}"]`).disabled=false;toast('Фото заменено для этого браузера.')}}catch(error){toast(error.message)}finally{input.disabled=false;input.value=''}});
  $$('[data-design-reset]',grid).forEach(button=>button.onclick=async()=>{const key=button.dataset.designReset;finishAvatarCrop(key);try{await resetPhotoOverride(key);button.disabled=true;toast('Вернул опубликованное фото для этого браузера.')}catch(error){toast(error.message)}});
  $$('[data-design-download]',grid).forEach(button=>button.onclick=()=>{const slot=photoSlotByKey.get(button.dataset.designDownload);const link=document.createElement('a');link.href=photoSource(slot.key);link.download=slot.path.split('/').pop();link.click()});
  bindAvatarCropControls(grid);
  $('#export-design-changes').onclick=()=>exportPhotoPack(true);$('#export-design-photos').onclick=()=>exportPhotoPack(false);updatePhotoSyncStatus();
}
function scrollToVoteHeading(){const heading=$('.vote-hub .section-heading');if(!heading)return;const header=$('#site-header'),headerHeight=header?.getBoundingClientRect().height||95,portraitPhone=matchMedia('(max-width:600px) and (orientation:portrait)').matches,topOffset=portraitPhone?Math.max(0,headerHeight-16):Math.max(170,headerHeight+70),target=window.scrollY+heading.getBoundingClientRect().top-topOffset;window.scrollTo({top:Math.max(0,target),behavior:'smooth'})}
function initCountdown(){const units={days:$('#countdown-days'),hours:$('#countdown-hours'),minutes:$('#countdown-minutes'),seconds:$('#countdown-seconds')},status=$('#countdown-status'),box=$('#vote-countdown');let timer;const pad=n=>String(n).padStart(2,'0');const tick=()=>{const remaining=Math.max(0,closing.getTime()-Date.now()),total=Math.floor(remaining/1000);units.days.textContent=pad(Math.floor(total/86400));units.hours.textContent=pad(Math.floor(total%86400/3600));units.minutes.textContent=pad(Math.floor(total%3600/60));units.seconds.textContent=pad(total%60);if(remaining<=0){box.classList.add('is-finished');status.textContent='Голосование завершено';clearInterval(timer);updateProgress()}};tick();if(!isClosed())timer=setInterval(tick,1000)}
function renderNominations(){const selected=nominations.filter(n=>n.category===state.category);const html=selected.map(n=>{const done=state.votes[n.id],photoKey=`nomination:${n.id}`;return `<button class="nomination-tile" data-open-nomination="${n.id}"><span class="nomination-art" aria-hidden="true"><img class="nomination-art-photo" src="${esc(photoSource(photoKey))}" data-photo-key="${esc(photoKey)}" alt="" loading="lazy">${done?'<span class="nomination-voted" role="img" aria-label="Голос учтён" title="Голос учтён">✓</span>':''}</span><span class="nomination-card-body"><span class="nomination-card-copy"><span class="nomination-tile-title">${esc(n.title)}</span><span class="nomination-tile-description">${esc(n.description)}</span></span><span class="nomination-card-meta"><span>${nomineeCountLabel(n.nominees.length)}</span><span class="nomination-card-dot" aria-hidden="true">●</span></span></span></button>`}).join('');const isExtra=state.category!=='основная';const heading=`<h2>${isExtra?'Дополнительные номинации':'Основные номинации'}</h2>`;const content=`<div class="modal-header ${isExtra?'extra-list-header':'primary-list-header'}">${heading}<button class="close-button" aria-label="Закрыть">×</button></div><div class="nomination-grid">${html}</div>`;replaceModalView(content,`nomination-list-modal ${isExtra?'extra-category-list':'primary-category-list'}`);const nominationGrid=$('.nomination-grid');if(nominationGrid)nominationGrid.scrollTop=state.nominationListScrollTop;$$('[data-open-nomination]').forEach(b=>b.onclick=()=>showNomination(b.dataset.openNomination));}
function visualClass(n){if(n.type==='game')return'visual-game';if(n.type==='group')return'visual-group';if(n.type==='conflict')return'visual-conflict';if(n.type==='video')return'visual-event';return''}
function showNomination(id){const nom=nominations.find(n=>n.id===id);if(!nom)return;state.nominationListScrollTop=$('.nomination-grid')?.scrollTop||0;state.nomination=nom;state.selected=state.votes[id]||null;const mediaNomination=nom.id!=='scam-of-year'&&(nom.type==='Картинка'||nom.type==='Видео');const nominees=nom.nominees.map(x=>{const self=state.session&&x.type==='person'&&x.name.toLowerCase()===state.session.nickname.toLowerCase()&&!nom.allowSelf;const selected=state.selected===x.id?'selected':'';if(x.type==='person'){const photoKey=`avatar:${slugPhotoName(x.name)}`;return `<button class="nominee-card ${selected} ${state.votes[id]===x.id?'saved':''} ${self?'self':''} ${self||isClosed()?'locked':''}" data-nominee="${esc(x.id)}" ${isClosed()?'disabled':''} ${self?`aria-disabled="true" data-hover-message="${esc(selfHoverMessages[0])}"`:''}><img class="portrait" src="${esc(photoSource(photoKey))}" data-photo-key="${esc(photoKey)}" alt="" loading="lazy"><span class="nominee-name">${esc(x.name)}</span></button>`}const video=x.type==='video',photoKey=`nominee:${nom.id}:${x.id}`;return `<div class="nominee-card ${selected} ${state.votes[id]===x.id?'saved':''} ${video?'video':''} ${isClosed()?'locked':''}" data-nominee="${esc(x.id)}"><div class="visual ${visualClass(x)}"><img class="visual-photo" src="${esc(photoSource(photoKey))}" data-photo-key="${esc(photoKey)}" alt="" loading="lazy">${video?`<button class="video-play" aria-label="${x.url?'Открыть видео':'Ссылка на видео не добавлена'}" title="${x.url?'Открыть видео':'Ссылка на видео не добавлена'}"></button>`:''}</div><span class="nominee-name">${esc(x.name)}</span></div>`}).join('');const current=state.votes[id];const msg=isClosed()?'Голосование завершено — выбор доступен только для просмотра.':!state.session?'Войди, чтобы выбрать номинанта.':current?'Текущий голос сохранён. Можно изменить его до 21 ноября.':'Выбери одного номинанта, затем отдай голос.';const changed=Boolean(current&&state.selected&&state.selected!==current);const voteButton=`<div class="vote-actions"><span class="vote-message">${msg}</span><button class="button" id="cast-vote" ${!state.session||isClosed()||!state.selected||(current&&!changed)?'disabled':''}>${current?(changed?'Изменить выбор':'Выбрать'):'Выбрать'}</button></div>`;replaceModalView(`<div class="nom-detail-top"><button class="back-link" id="back-nominations"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg><span>Вернуться к спискам</span></button><button class="close-button" aria-label="Закрыть">×</button></div><div class="nom-detail-scroll"><div class="nom-detail"><h2 class="nom-detail-title">${esc(nom.title)}</h2><p class="description">${esc(nom.description)}</p><div class="nominee-grid ${mediaNomination?'nominee-grid-media':''}">${nominees}</div></div></div>${voteButton}`,'nomination-detail-modal');
$('#back-nominations').onclick=renderNominations;$$('[data-nominee]').forEach(el=>{const item=nom.nominees.find(x=>x.id===el.dataset.nominee);const self=item?.type==='person'&&state.session&&item.name.toLowerCase()===state.session.nickname.toLowerCase()&&!nom.allowSelf;if(item?.type==='video')$('.video-play',el)?.addEventListener('click',e=>{e.stopPropagation();if(item.url){const link=window.open(item.url,'_blank','noopener,noreferrer');if(link)link.opener=null;}else toast('Ссылка на этот клип будет добавлена организатором.');});if(self){let firstHover=true,lastMessage=selfHoverMessages[0];el.addEventListener('pointerenter',()=>{if(firstHover){firstHover=false;return}const choices=selfHoverMessages.slice(1).filter(message=>message!==lastMessage);lastMessage=choices[Math.floor(Math.random()*choices.length)]||selfHoverMessages[1];el.dataset.hoverMessage=lastMessage})}if(self||isClosed())return;el.onclick=()=>{state.selected=el.dataset.nominee;$$('.nominee-card').forEach(c=>c.classList.toggle('selected',c.dataset.nominee===state.selected));const changed=Boolean(current&&state.selected!==current);$('#cast-vote').textContent=current?(changed?'Изменить выбор':'Выбрать'):'Выбрать';$('#cast-vote').disabled=!state.session||!state.selected||isClosed()||Boolean(current&&!changed)};});$('#cast-vote').onclick=async()=>{if(state.busy)return;state.busy=true;try{await rpc('cast_vote',{p_token:state.session.token,p_nomination_id:nom.id,p_option_id:state.selected});state.votes[nom.id]=state.selected;toast('Твой голос учтён.');updateProgress();renderNominations();}catch(e){toast(e.message)}finally{state.busy=false}};}
function bindModalClose(modal){$('.close-button',modal)?.addEventListener('click',closeModal)}
function replaceModalView(content,kind=''){const root=$('#modal-root'),modal=$('.modal',root);if(!modal){openModal(content,kind);return}modal.className=`modal ${kind}`;modal.innerHTML=content;modal.scrollTop=0;bindModalClose(modal)}
let modalEscapeHandler=null;
function openModal(content,kind=''){
  if(modalEscapeHandler)document.removeEventListener('keydown',modalEscapeHandler);
  const root=$('#modal-root');root.innerHTML=`<div class="modal-backdrop"><section class="modal ${kind}" role="dialog" aria-modal="true">${content}</section></div>`;
  const backdrop=$('.modal-backdrop',root),modal=$('.modal',root);let pointerStartedInside=false;
  modal.addEventListener('pointerdown',()=>{pointerStartedInside=true},true);
  backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)pointerStartedInside=false},true);
  backdrop.addEventListener('click',e=>{if(e.target!==backdrop)return;if(pointerStartedInside){pointerStartedInside=false;return}closeModal()});
  bindModalClose(modal);modalEscapeHandler=e=>{if(e.key==='Escape')closeModal()};document.addEventListener('keydown',modalEscapeHandler);
}
function closeModal(){if(typeof adminRequestCounter!=='undefined')adminRequestCounter++;if(modalEscapeHandler){document.removeEventListener('keydown',modalEscapeHandler);modalEscapeHandler=null}closeAllAvatarCrops();$('#modal-root').innerHTML='';state.nomination=null}
function renderAuth(){openModal(`<div class="eyebrow">FLARE AWARDS · 2026</div><h2 class="auth-title">Вход / регистрация</h2><form id="auth-form" class="auth-form"><label class="form-field"><span>EMAIL</span><input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="Твой email"></label><label class="form-field form-field-pin"><span>ЛИЧНЫЙ PIN-КОД</span><span class="pin-input-wrap"><input id="auth-pin" name="pin" type="password" autocomplete="current-password" required minlength="4" maxlength="72" pattern="[A-Za-z0-9]{4,72}" placeholder="Придумай PIN из букв и цифр"><button type="button" class="pin-toggle" id="toggle-pin" aria-label="Показать PIN" aria-pressed="false"><svg class="pin-eye-show" aria-hidden="true" viewBox="0 0 24 24"><path d="M2.8 12s3.2-6 9.2-6 9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.8"/></svg><svg class="pin-eye-hide" aria-hidden="true" viewBox="0 0 24 24" hidden><path d="m3 3 18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.2 6 9.2 6a15.8 15.8 0 0 1-2.4 3.1M6.2 6.3C4 7.7 2.8 12 2.8 12s3.2 6 9.2 6c1.3 0 2.5-.3 3.5-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></span></label><p class="auth-error" id="auth-error"></p><button class="button" type="submit">Войти в аккаунт</button></form>`, 'auth-modal');$('#toggle-pin').onclick=e=>{const button=e.currentTarget,input=$('#auth-pin'),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Скрыть PIN':'Показать PIN');$('.pin-eye-show',button).hidden=visible;$('.pin-eye-hide',button).hidden=!visible};$('#auth-form').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target),email=String(form.get('email')).trim().toLowerCase(),pin=String(form.get('pin'));const error=$('#auth-error'),button=$('button[type="submit"]',e.target);button.disabled=true;error.textContent='';try{if(!clientReady())throw new Error('Сначала настрой Supabase и заполни URL и anon key в config.js.');const data=await rpc('flare_access',{p_email:email,p_pin:pin});if(data.error)throw new Error(data.error);saveSession(data);closeModal();toast(`Добро пожаловать, ${data.nickname}!`)}catch(err){error.textContent=err.message}finally{button.disabled=false}}}
function renderWinners(){const track=$('#winner-track');track.innerHTML=previousWinners.map(([title,name],i)=>`<article class="winner-card"><div class="winner-icon">${String(i+1).padStart(2,'0')}</div><div><div class="winner-title">${esc(title)}</div><div class="winner-name">${esc(name)}</div></div></article>`).join('');updateCarousel();}
function updateCarousel(){const track=$('#winner-track'),cards=$$('.winner-card',track);if(!cards.length)return;const gap=parseFloat(getComputedStyle(track).gap)||0,width=cards[0].getBoundingClientRect().width+gap;const maxOffset=Math.max(0,track.scrollWidth-track.parentElement.clientWidth),maxIndex=Math.ceil(maxOffset/width);state.carousel=Math.max(0,Math.min(state.carousel,maxIndex));const offset=Math.min(state.carousel*width,maxOffset);track.style.transform=`translate3d(${-offset}px,0,0)`;$('#winner-counter').textContent=`${String(state.carousel+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`}
let carouselDebounce=false;function moveCarousel(dir){if(carouselDebounce)return;carouselDebounce=true;state.carousel+=dir;updateCarousel();setTimeout(()=>carouselDebounce=false,360)}
function initWinnerSwipe(){const viewport=$('.winner-window');if(!viewport)return;let start=null;viewport.addEventListener('touchstart',event=>{if(event.touches.length!==1){start=null;return}const touch=event.touches[0];start={x:touch.clientX,y:touch.clientY}},{passive:true});viewport.addEventListener('touchend',event=>{if(!start)return;const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;start=null;if(Math.abs(dx)>=42&&Math.abs(dx)>Math.abs(dy)*1.2)moveCarousel(dx<0?1:-1)},{passive:true});viewport.addEventListener('touchcancel',()=>{start=null},{passive:true})}
function renderEventOptions(){
  const box=$('#event-options');
  const showResults=Boolean(state.eventSaved&&state.eventResults);
  const counts=state.eventResults?.counts||{};
  const total=Number(state.eventResults?.total)||0;
  const max=Math.max(0,...eventChoices.map(([id])=>Number(counts[id])||0));
  const leaders=eventChoices.filter(([id])=>Number(counts[id])===max&&max>0);
  box.innerHTML=eventChoices.map(([id,date,day])=>{
    const count=Number(counts[id])||0;
    const percent=total?Math.round(count/total*100):0;
    const leader=showResults&&max>0&&count===max;
    const saved=state.eventSaved===id;
    const selected=state.eventChoice===id;
    const pending=Boolean(state.eventSaved&&selected&&!saved);
    const choiceStatus=saved?(selected?'ТВОЙ ОТВЕТ':'СОХРАНЁННЫЙ ОТВЕТ'):pending?'НОВЫЙ ВЫБОР':'';
    const badge=leader?(leaders.length===1?'ЛИДИРУЕТ':'НИЧЬЯ'):'';
    return `<button class="poll-option ${selected?'selected':''} ${saved?'saved-choice':''} ${pending?'pending-choice':''} ${showResults?'has-results':''} ${leader?'poll-leader':''}" data-event-choice="${id}" ${isClosed()?'disabled':''}><span class="poll-option-top"><span class="radio"></span><span class="poll-option-date"><strong>${date} (${day[0].toUpperCase()+day.slice(1)})</strong>${choiceStatus?`<small class="poll-choice-status">${choiceStatus}</small>`:''}</span>${showResults?`<span class="poll-result-badge">${badge}</span>`:''}</span>${showResults?`<span class="poll-result-track" aria-hidden="true"><span style="width:${percent}%"></span></span><span class="poll-result-meta"><span>${countLabel(count,'голос','голоса','голосов')}</span><strong>${percent}%</strong></span>`:''}</button>`
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
function renderFaq(){$('#faq-list').innerHTML=faq.map(([q,a])=>`<div class="faq-item"><button class="faq-question"><span>${esc(q)}</span><span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 6.5v11M6.5 12h11"></path></svg></span></button><div class="faq-answer">${esc(a)}</div></div>`).join('');$$('.faq-question').forEach(b=>b.onclick=()=>b.parentElement.classList.toggle('open'))}
function initFloatingHeader(){const header=$('#site-header'),logo=$('.intro-logo'),faqSection=$('.faq-section');if(!header||!logo||!faqSection)return;let logoVisible=true,faqActive=false,scheduled=false,faqObserver;const refresh=()=>{const atTop=logoVisible&&!faqActive,scrolled=!logoVisible;header.classList.toggle('is-at-top',atTop);header.classList.toggle('is-scrolled',scrolled);header.classList.toggle('is-faq-hidden',faqActive)};const observeFaqBoundary=()=>{if(!('IntersectionObserver'in window))return;faqObserver?.disconnect();const line=header.offsetHeight,bottom=Math.max(0,innerHeight-line-1);faqObserver=new IntersectionObserver(([entry])=>{faqActive=entry.isIntersecting;refresh()},{rootMargin:`-${line}px 0px -${bottom}px 0px`,threshold:0});faqObserver.observe(faqSection)};if('IntersectionObserver'in window){new IntersectionObserver(([entry])=>{logoVisible=entry.isIntersecting;refresh()},{threshold:0}).observe(logo);observeFaqBoundary();window.addEventListener('resize',observeFaqBoundary)}else{const update=()=>{scheduled=false;const l=logo.getBoundingClientRect(),f=faqSection.getBoundingClientRect(),line=header.offsetHeight;logoVisible=l.bottom>0&&l.top<innerHeight;faqActive=f.top<=line&&f.bottom>line;refresh()};const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}};window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);schedule()}}
async function saveEvent(){if(!state.session||!state.eventChoice||isClosed()||state.eventSaving||state.eventChoice===state.eventSaved)return;state.eventSaving=true;updateProgress();const token=state.session.token;try{while(state.session?.token===token&&state.eventChoice&&state.eventChoice!==state.eventSaved&&!isClosed()){const choice=state.eventChoice;try{const data=await rpc('save_event_choice',{p_token:token,p_choice_id:choice});if(state.session?.token!==token)break;state.eventSaved=choice;state.eventResults=data.event_results||state.eventResults;renderEventOptions()}catch(e){if(state.session?.token!==token)break;if(choice!==state.eventChoice)continue;state.eventChoice=state.eventSaved;toast(e.message);renderEventOptions();break}}}finally{state.eventSaving=false;renderEventOptions();updateProgress()}}
let adminRequestCounter=0;
function adminHeaderMarkup(){return `<div class="admin-head"><nav class="admin-tabs" role="tablist" aria-label="Разделы панели организатора"><button class="admin-tab is-active" id="admin-tab-voting" type="button" role="tab" aria-selected="true" aria-controls="admin-panel-voting" data-admin-tab="voting">Голосование</button><button class="admin-tab" id="admin-tab-poll" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-poll" data-admin-tab="poll">Опрос</button><button class="admin-tab" id="admin-tab-statistics" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-statistics" data-admin-tab="statistics">Статистика</button><button class="admin-tab" id="admin-tab-design" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="admin-panel-design" data-admin-tab="design">Дизайн</button></nav><button class="close-button" aria-label="Закрыть">×</button></div>`}
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
    const [result]=await Promise.all([rpc('admin_summary',{p_token:state.session.token}),loadClipCatalog()]);
    if(requestId!==adminRequestCounter||!$('.admin-modal'))return;
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
    const designPanel=renderDesignPanel();
    const adminWrap=$('.admin-wrap',$('.admin-modal'));
    if(requestId!==adminRequestCounter||!adminWrap)return;
    adminWrap.innerHTML=`<section class="admin-tab-panel admin-ballot-results" id="admin-panel-voting" role="tabpanel" aria-labelledby="admin-tab-voting"><div class="admin-results-heading"><h3>Результаты голосования</h3><span>Рейтинг по текущим голосам</span></div><div class="admin-nomination-results">${nominationCards}</div></section><section class="admin-tab-panel admin-poll" id="admin-panel-poll" role="tabpanel" aria-labelledby="admin-tab-poll" hidden><div class="admin-poll-heading"><h3>Результаты опроса</h3><span>${countLabel(total,'ответ','ответа','ответов')}</span></div><div class="admin-poll-results">${pollRows}</div></section>${statisticsPanel}${designPanel}`;
    const selectedTab=$('.admin-tab.is-active',$('.admin-modal'))?.dataset.adminTab||'voting';
    setAdminTab(selectedTab);
    bindDesignPanel();
  }catch(e){
    if(requestId!==adminRequestCounter)return;
    const wrap=$('.admin-wrap',$('.admin-modal'));if(!wrap)return;
    wrap.innerHTML=`<div class="admin-load-error" role="alert"><strong>Не удалось загрузить данные панели</strong><p>${esc(e.message)}</p><button type="button" class="button" id="admin-retry">Повторить</button></div>`;
    $('#admin-retry').onclick=showAdmin;
  }
}
async function initializeSite(){
  await loadPhotoOverrides();
  $('#auth-button').onclick=async()=>{if(state.session){const current=state.session;state.session=null;localStorage.removeItem('flare-session');updateAccount();rpc('flare_logout',{p_token:current.token}).catch(()=>{});toast('Ты вышел из аккаунта.')}else{renderAuth()}};
  $$('.category-card').forEach(b=>b.onclick=()=>{b.blur();scrollToVoteHeading();state.category=b.dataset.category;state.nominationListScrollTop=0;renderNominations()});$('#winner-prev').onclick=()=>moveCarousel(-1);$('#winner-next').onclick=()=>moveCarousel(1);renderFaq();renderWinners();initWinnerSwipe();renderEventOptions();updateAccount();initCountdown();initFloatingHeader();window.addEventListener('resize',updateCarousel);loadClipCatalog();
  document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==='a'&&state.session?.nickname.toLowerCase()==='maronnix')showAdmin()});
}
initializeSite();
