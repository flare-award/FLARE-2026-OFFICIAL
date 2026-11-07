// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,200));
await page.evaluate(()=>{
 state.session={nickname:'Maronnix',token:'test'};state.votes={};window.calls=[];
 rpc=async(name,args)=>{calls.push({name,args});return name==='get_video_options'?[]:name==='get_member_socials'?{nickname:args.p_nickname}: {ok:true}};
});
const additions=[['multigaming','multigaming-dony-zq','Dony_zq','person'],['conflict-of-year','conflict-5','Awal vs Izumrudik','video'],['scam-of-year','person-8-flourin','Flourin','person'],['clip-of-year','clip-7','Izumrudik взорвал дом Awal','video']];
for(const [nom,id,name,type] of additions){
 const item=await page.evaluate(({nom,id})=>nominations.find(n=>n.id===nom).nominees.find(i=>i.id===id),{nom,id});assert.equal(item.name,name);assert.equal(item.type,type);
 await page.evaluate(nom=>{state.votes={};showNomination(nom,{fromHistory:true})},nom);await page.click(`[data-nominee="${id}"]`);assert.equal(await page.$eval('#cast-vote',e=>e.disabled),false);await page.click('#cast-vote');await page.waitForFunction(()=>!state.busy);assert.equal(await page.evaluate(nom=>state.votes[nom],nom),id);
}
assert.equal(await page.evaluate(()=>nominations.find(n=>n.id==='multigaming').nominees.find(i=>i.id==='person-2-dony-zq').name),'Nodben');
assert.equal(await page.evaluate(()=>new Set(nominations.flatMap(n=>n.nominees.map(i=>i.id))).size===nominations.flatMap(n=>n.nominees).length),true);
console.log('PASS four new candidates selectable/savable, video types and existing Nodben ID retained');
// Load the actual media workspace; an accountless nominee still has a photo slot.
await page.evaluate(()=>{openModal(`${adminHeaderMarkup()}<div class="admin-wrap">${renderDesignPanel()}</div>`,'admin-modal');bindAdminTabs();setAdminTab('design');bindDesignPanel()});
await page.$eval('#admin-design-search',e=>{e.value='Liwersi';e.dispatchEvent(new Event('input'))});
const card='.admin-design-card[data-design-key="avatar:liwersi"]';assert.equal(await page.$$eval('.admin-design-card:not([hidden])',es=>es.length),1);assert(await page.$(card+' [data-design-upload]'));
const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=250;const x=c.getContext('2d');x.fillStyle='#6a88a6';x.fillRect(0,0,200,250);return c.toDataURL('image/png').split(',')[1]});fs.writeFileSync('/tmp/flare-liwersi-upload.png',Buffer.from(png,'base64'));
await (await page.$(card+' [data-design-upload]')).uploadFile('/tmp/flare-liwersi-upload.png');await page.waitForSelector('.admin-avatar-editor.is-open');await page.click('.admin-avatar-editor.is-open [data-avatar-crop-save]');await page.waitForFunction(()=>Boolean(photoOverrides['avatar:liwersi']));
assert.equal(await page.$eval('#export-design-changes',e=>e.disabled),false);
await page.evaluate(()=>showNomination('scam-of-year',{fromHistory:true}));await page.waitForFunction(()=>document.querySelector('[data-nominee="person-8-akirakume"] img')?.naturalWidth>0);assert.equal(await page.evaluate(()=>MEMBERS.includes('Liwersi')),false);await page.click('[data-nominee="person-8-akirakume"]');assert.equal(await page.$eval('#cast-vote',e=>e.disabled),false);
await page.evaluate(()=>resetPhotoOverride('avatar:liwersi'));
console.log('PASS Liwersi upload/crop/local preview/export availability without creating a member/account');
for(const width of [1360,700,390,320]){
 await page.setViewport({width,height:900});
 for(const mode of ['standard','compact','list']){
  await page.mouse.move(0,0);await page.evaluate(mode=>{closeSocialProfileMenu();state.nomineeView=mode;state.votes={};showNomination('style-of-year',{fromHistory:true})},mode);
  await new Promise(r=>setTimeout(r,300));const button='[data-social-nickname="Maronnix"]';
  const geometry=await page.$eval(button,e=>{const b=e.getBoundingClientRect(),s=e.querySelector('svg').getBoundingClientRect(),style=getComputedStyle(e);return {color:style.color,bg:style.backgroundColor,radius:style.borderRadius,circles:e.querySelectorAll('circle').length,paths:e.querySelectorAll('path').length,dx:Math.abs(b.left+b.width/2-s.left-s.width/2),dy:Math.abs(b.top+b.height/2-s.top-s.height/2)}});
  assert.equal(geometry.color,'rgb(255, 255, 255)');assert.equal(geometry.radius,'50%');assert.equal(geometry.circles,3);assert.equal(geometry.paths,0);assert(geometry.dx<1&&geometry.dy<1);assert.equal(geometry.bg,'rgba(0, 0, 0, 0)');
  await page.$eval(button,e=>e.closest('.nominee-card').scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,100));await page.hover(button);await new Promise(r=>setTimeout(r,220));await page.screenshot();assert.notEqual(await page.$eval(button,e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await page.$eval(button,e=>getComputedStyle(e).transform),'none');
  await page.focus(button);await page.keyboard.press('Enter');await page.waitForSelector('.social-profile-popover');assert.equal(await page.evaluate(()=>state.selected),null);assert.equal(await page.$eval(button,e=>e.getAttribute('aria-expanded')),'true');await page.keyboard.press('Escape');assert.equal(await page.$('.social-profile-popover'),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 console.log('PASS white Lucide ellipsis, circular hover, centered SVG, keyboard/menu (no accidental vote), all views',width);
}
assert.deepEqual(errors,[]);

}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
