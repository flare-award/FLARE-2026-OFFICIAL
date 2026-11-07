// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(200);
async function input(selector,value){await page.$eval(selector,(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},value)}
async function admin(fail=false){await page.evaluate(async fail=>{
 state.session={nickname:'Maronnix',token:'admin-test'};window.rpcCalls=[];window.failCatalog=fail;window.failSave=false;
 rpc=async(name,args)=>{
  rpcCalls.push({name,args});
  if(name==='get_video_options'){if(failCatalog)throw Error('Тестовая ошибка загрузки');return nominations.flatMap(n=>n.nominees.filter(i=>i.type==='video').map(i=>({id:i.id,name:i.name,video_url:`https://example.test/${i.id}`})))}
  if(name==='admin_summary')return {votes:[{nomination_title:nominations[0].title,option_name:nominations[0].nominees[0].name,nickname:'Rezo1n'}],event_preferences:[{choice_label:`${eventChoices[0][1]} · ${eventChoices[0][2]}`,nickname:'Maronnix'}],statistics:{registered_nicknames:['Maronnix'],voted_nicknames:['Maronnix'],not_voted_nicknames:[],partially_voted_nicknames:[],registered_count:1,voted_count:1,total_votes:1},accounts_closed:false,test_ballot:{exists:false}};
  if(name==='admin_get_member_socials')return [];
  if(name==='admin_update_video_option'){if(failSave)throw Error('Тестовая ошибка сохранения');return {id:args.p_option_id,name:args.p_name,video_url:args.p_video_url}}
  throw Error('Unexpected RPC '+name);
 };await showAdmin();
 },fail);await page.waitForSelector('#admin-panel-voting')}
await admin();
const idsBefore=await page.evaluate(()=>nominations.flatMap(n=>n.nominees.map(i=>i.id)));
assert.equal(await page.$$eval('[data-admin-tab]',es=>es.length),5);
assert.equal(await page.$('#admin-tab-poll'),null);assert.equal(await page.$('#admin-panel-poll'),null);
assert.equal(await page.$$eval('#admin-panel-voting .admin-rank-row',es=>es.length),1);
await page.click('.admin-date-poll>summary');assert((await page.$eval('.admin-date-poll',e=>e.textContent)).includes('Maronnix'));
assert.equal(await page.$eval('.admin-date-poll>summary>span',e=>e.textContent),'1 ответ');
await page.click('#admin-tab-design');
assert.equal(await page.$eval('#admin-design-photos',e=>e.hidden),false);assert.equal(await page.$eval('#admin-design-videos',e=>e.hidden),true);
assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),12);
assert(await page.$('.admin-design-card[data-design-key="avatar:liwersi"]'));
const first=await page.$eval('.admin-design-card:not([hidden])',e=>e.dataset.designKey);
await page.click('button[data-photo-page="1"]');assert.notEqual(await page.$eval('.admin-design-card:not([hidden])',e=>e.dataset.designKey),first);
await input('#admin-design-search','unfindable987');assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),0);assert.equal(await page.$eval('#admin-design-empty',e=>e.hidden),false);
await page.click('#admin-design-clear');assert.equal(await page.$eval('#admin-panel-design',e=>e.dataset.photoPage),'1');
await page.select('#admin-photo-category','conflict-of-year');
assert(await page.$$eval('.admin-design-card:not([hidden])',es=>es.every(e=>e.dataset.designKey.startsWith('nominee:conflict-of-year:'))));
await page.click('#admin-design-clear');await page.click('[data-design-filter="changed"]');assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),0);
await page.click('#admin-design-clear');await page.click('[data-design-filter="avatars"]');
await input('#admin-design-search','Maronnix');
const card='.admin-design-card[data-design-key="avatar:maronnix"]';
await page.click(card+' [data-design-crop]');await page.waitForSelector('.admin-avatar-editor.is-open');
assert.equal(await page.$eval('.admin-avatar-editor.is-open',e=>document.activeElement===e),true);
await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');assert.equal(await page.$eval('.admin-avatar-editor.is-open [data-avatar-crop-cancel]',e=>document.activeElement===e),true);
await page.keyboard.press('Tab');assert.equal(await page.$eval('.admin-avatar-editor.is-open [data-avatar-zoom]',e=>document.activeElement===e),true);
await page.keyboard.press('Escape');assert.equal(await page.$('.admin-avatar-editor.is-open'),null);assert(await page.$('.admin-modal'));assert.equal(await page.evaluate(()=>Boolean(photoOverrides['avatar:maronnix'])),false);
await page.click(card+' [data-design-crop]');await page.waitForSelector('.admin-avatar-editor.is-open');
await input('.admin-avatar-editor.is-open [data-avatar-zoom]','145');await input('.admin-avatar-editor.is-open [data-avatar-pan-x]','30');
await page.click('.admin-avatar-editor.is-open [data-avatar-crop-save]');await page.waitForFunction(()=>Boolean(photoOverrides['avatar:maronnix']));
assert.equal(await page.$eval(card+' [data-local-photo-badge]',e=>e.hidden),false);
assert.equal(await page.evaluate(async()=> (await (await fetch(photoOverrides['avatar:maronnix'])).blob()).type),'image/jpeg');
await page.click('[data-design-mode="publish"]');assert.equal(await page.$eval('#export-design-changes',e=>e.disabled),false);
assert((await page.$eval('[data-design-sync-copy]',e=>e.textContent)).includes('только в этом браузере'));
// Exercise the actual export click and validate the ZIP's signature and member path.
await page.evaluate(()=>{window.zipNames=[];window.zipBlobs=[];window.originalCreateURL=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='application/zip')zipBlobs.push(blob);return originalCreateURL.call(this,blob)};window.originalAnchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download.endsWith('.zip'))zipNames.push(this.download);else originalAnchorClick.call(this)}});
await page.click('#export-design-changes');await page.waitForFunction(()=>zipBlobs.length===1);
const zip=await page.evaluate(async()=>{const bytes=new Uint8Array(await zipBlobs[0].arrayBuffer());return {sig:[...bytes.slice(0,4)],text:new TextDecoder().decode(bytes),names:zipNames}});
assert.deepEqual(zip.sig,[80,75,3,4]);assert(zip.text.includes('assets/photos/avatars/maronnix.jpg'));assert.deepEqual(zip.names,['flare-photo-changes.zip']);
// Full export remains atomic: a missing file reports its path, never a fake successful archive.
await page.click('#export-design-photos');await page.waitForFunction(()=>document.querySelector('#admin-export-feedback').textContent.includes('Не удалось загрузить'));
assert.equal(await page.evaluate(()=>zipBlobs.length),1);assert.equal(await page.$eval('#export-design-photos',e=>e.disabled),false);
// Mock only missing checkout assets (unrelated user deletions) to exercise a complete full ZIP.
await page.evaluate(()=>{window.originalFetch=fetch;fetch=async(...args)=>{const response=await originalFetch(...args);return !response.ok&&String(args[0]).startsWith('assets/photos/')?new Response(new Uint8Array([1,2,3]),{status:200}):response}});
await page.click('#export-design-photos');await page.waitForFunction(()=>zipBlobs.length===2);
const fullZip=await page.evaluate(async()=>{const bytes=new Uint8Array(await zipBlobs[1].arrayBuffer()),dv=new DataView(bytes.buffer);return {entries:dv.getUint16(bytes.length-22+10,true),count:photoSlots.length,name:zipNames.at(-1)}});
assert.equal(fullZip.entries,fullZip.count);assert.equal(fullZip.name,'flare-photos.zip');await page.evaluate(()=>fetch=originalFetch);
await page.evaluate(()=>{URL.createObjectURL=originalCreateURL;HTMLAnchorElement.prototype.click=originalAnchorClick});
await page.evaluate(()=>closeModal());await admin();await page.click('#admin-tab-design');
assert.equal(await page.$eval('#export-design-changes',e=>e.disabled),false);
await page.click('[data-design-filter="changed"]');assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),1);
await page.click(card+' .admin-asset-more>summary');await page.click(card+' [data-design-reset]');await page.waitForFunction(()=>!photoOverrides['avatar:maronnix']);
assert.equal(await page.$eval('#export-design-changes',e=>e.disabled),true);
// Real upload handler: avatar upload opens crop without persisting until Apply.
await page.click('#admin-design-clear');await input('#admin-design-search','Maronnix');
const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=120;c.getContext('2d').fillRect(0,0,80,120);return c.toDataURL('image/png').split(',')[1]});fs.writeFileSync('/tmp/flare-admin-upload.png',Buffer.from(png,'base64'));
await (await page.$(card+' [data-design-upload]')).uploadFile('/tmp/flare-admin-upload.png');await page.waitForSelector('.admin-avatar-editor.is-open');assert.equal(await page.evaluate(()=>Boolean(photoOverrides['avatar:maronnix'])),false);await page.keyboard.press('Escape');
// Non-avatar upload is a local-only replacement and is persisted in IndexedDB.
await page.click('#admin-design-clear');await input('#admin-design-search','game-1');
const imageCard=await page.$eval('.admin-design-card:not([hidden])',e=>e.dataset.designKey);
await (await page.$(`.admin-design-card[data-design-key="${imageCard}"] [data-design-upload]`)).uploadFile('/tmp/flare-admin-upload.png');await page.waitForFunction(key=>Boolean(photoOverrides[key]),{},imageCard);
await page.evaluate(async key=>{await resetPhotoOverride(key)},imageCard);
// Metadata is separate: local edits survive workspace switches but do not save implicitly.
await page.click('[data-design-mode="videos"]');
const row='.admin-video-row[data-video-row="conflict-2"]';
await input('#admin-video-search','conflict-2'); // ID isn't the public search label.
assert.equal(await page.$eval('#admin-video-empty',e=>e.hidden),false);
await input('#admin-video-search','');await page.select('#admin-video-category','conflict-of-year');assert(await page.$$eval('.admin-video-row:not([hidden])',es=>es.every(e=>e.dataset.videoCategory==='conflict-of-year')));
await page.click(row+'>summary');await input(row+' [data-video-name]','Новое название тестового видео');await input(row+' [data-video-url]','ftp://example.test/wrong');
await page.click(row+' [data-video-save]');assert((await page.$eval(row+' [data-video-feedback]',e=>e.textContent)).includes('http://'));
assert.equal(await page.evaluate(()=>rpcCalls.filter(c=>c.name==='admin_update_video_option').length),0);
await input(row+' [data-video-url]','https://example.test/new');
await page.click('[data-design-mode="publish"]');await page.click('[data-design-mode="videos"]');assert.equal(await page.$eval(row+' [data-video-name]',e=>e.value),'Новое название тестового видео');
await page.evaluate(()=>failSave=true);await page.click(row+' [data-video-save]');await page.waitForFunction(()=>document.querySelector('[data-video-row="conflict-2"] [data-video-feedback]').textContent.includes('Тестовая ошибка'));
assert.equal(await page.$eval(row+' [data-video-save]',e=>e.disabled),false);
await page.evaluate(()=>failSave=false);await page.click(row+' [data-video-save]');await page.waitForFunction(()=>document.querySelector('[data-video-row="conflict-2"] [data-video-feedback]').textContent.includes('для всех участников'));
assert.equal(await page.$eval(row+' [data-video-save]',e=>e.disabled),true);
const saved=await page.evaluate(()=>({item:nominations.flatMap(n=>n.nominees).find(i=>i.id==='conflict-2'),calls:rpcCalls.filter(c=>c.name==='admin_update_video_option')}));
assert.equal(saved.item.type,'video');assert.equal(saved.item.url,'https://example.test/new');assert.equal(saved.calls.at(-1).args.p_option_id,'conflict-2');
await page.click('[data-design-mode="photos"]');await input('#admin-design-search','Новое название тестового видео');assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),1);
assert.equal(await page.$eval('#export-design-changes',e=>e.disabled),true);
console.log('PASS merged results, filters/pagination, upload/crop/cancel/reset, local publication/ZIP, video validation/drafts/error/save');
await page.evaluate(()=>closeModal());await admin(true);await page.click('#admin-tab-design');await page.click('[data-design-mode="videos"]');
assert.equal(await page.$$eval('[data-video-name]',es=>es.every(e=>e.disabled)),true);assert(await page.$('[data-video-reload]'));
await page.evaluate(()=>failCatalog=false);await page.click('[data-video-reload]');await page.waitForFunction(()=>document.querySelector('.admin-video-editor').dataset.videoReady==='true');assert.equal(await page.$$eval('[data-video-name]',es=>es.some(e=>e.disabled)),false);
console.log('PASS failed catalog cannot overwrite live URLs, retry restores editor');
for(const width of [1360,768,700,390,320]){
 await page.setViewport({width,height:900});await page.click('#admin-tab-design');await page.click('[data-design-mode="photos"]');await page.click('#admin-design-clear').catch(()=>{});
 for(const mode of ['photos','videos','publish']){
  await page.click(`[data-design-mode="${mode}"]`);if(mode==='videos')await page.$eval('.admin-video-row',e=>e.open=true);
  await sleep(80);
  const geo=await page.evaluate(()=>{const m=document.querySelector('.admin-modal'),v=document.querySelector('[data-design-workspace]:not([hidden])'),r=v.getBoundingClientRect();return {root:document.documentElement.scrollWidth>innerWidth,modal:m.scrollWidth>m.clientWidth+1,view:v.scrollWidth>v.clientWidth+1,left:r.left,right:r.right,w:innerWidth}});
  assert(!geo.root&&!geo.modal&&!geo.view,JSON.stringify({width,mode,geo}));assert(geo.left>=0&&geo.right<=geo.w);
  await page.screenshot({path:`/tmp/flare-admin-${mode}-${width}.png`});
 }
 await page.click('[data-design-mode="photos"]');await page.focus('#design-tab-photos');await page.keyboard.press('ArrowRight');assert.equal(await page.$eval('#design-tab-videos',e=>e.getAttribute('aria-selected')),'true');
 await page.focus('#admin-tab-design');await page.keyboard.press('ArrowLeft');assert.equal(await page.$eval('#admin-tab-statistics',e=>e.getAttribute('aria-selected')),'true');
 console.log('PASS responsive admin workspaces/keyboard',width);
}
assert.deepEqual(await page.evaluate(()=>nominations.flatMap(n=>n.nominees.map(i=>i.id))),idsBefore);
assert.equal(await page.evaluate(()=>previousWinners.find(row=>row[0]==='КОНФЛИКТ ГОДА')[1]),'Akirakume, Eozik, Flourin, Maronnix, Nodben vs Denis_185, Fines Stark');
assert.equal(await page.evaluate(()=>nominations.flatMap(n=>n.nominees).find(i=>i.id==='conflict-4').type),'video');
// IndexedDB survives an actual reload, not just switching tabs or reopening the modal.
await page.evaluate(async()=>{const blob=await (await fetch('assets/photos/avatars/maronnix.jpg')).blob();await savePhotoOverride('avatar:maronnix',blob)});
await page.reload({waitUntil:'load'});await page.waitForFunction(()=>Boolean(photoOverrides['avatar:maronnix']));
await admin();await page.click('#admin-tab-design');await page.click('[data-design-filter="changed"]');assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),1);
await page.click(card+' .admin-asset-more>summary');await page.click(card+' [data-design-reset]');await page.waitForFunction(()=>!photoOverrides['avatar:maronnix']);
await page.click('#admin-design-clear');await input('#admin-design-search','Maronnix');
await page.evaluate(async()=>{const card=document.querySelector('.admin-design-card[data-design-key="avatar:maronnix"]'),pending=openAvatarCrop(card,photoSource('avatar:maronnix'));closeModal();await pending});
assert.equal(await page.$('.admin-avatar-editor.is-open'),null);assert.equal(await page.$('.admin-crop-backdrop'),null);
console.log('PASS IndexedDB reload, stale crop cleanup, winner text/IDs and video types preserved');
assert.deepEqual(errors,[]);console.log('PASS admin no JS errors');

}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
