// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});






for(const width of [1360,768,700,390,320]){
 await page.setViewport({width,height:900});
 for(const own of [true,false]){
  await page.evaluate(own=>{
   teardownBoing(false);state.session={nickname:'Maronnix',token:'test'};
   const badges=['legacy-king-2','legacy-multigaming-2','legacy-conflict-1','legacy-conflict-2','legacy-laureate-7','creator'].map(id=>({id,name:id,description:'Старое длинное описание. Лишняя вторая фраза.',rarity:'legendary',equipped:true}));
   const profile={nickname:'Maronnix',email_masked:'m***@mail.test',created_at:'2026-01-01',days_with_flare:20,votes_done:4,total_nominations:20,reputation:{up:3,down:0},boing:{bob_name:'BOB',best_score:20000,coins:5000,inventory:[],badges,streak:{days:10,best:20,bonus:6,today_score:500},points_per_click:7,economy_version:3,game_intro_seen:true}};
   profileState.data=profile;profileState.publicData=profile;own?renderProfile():renderPublicFlareProfile();
  },own);await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,100));
  const g=await page.evaluate(()=>{
   const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height}};
   return {banner:r('.profile-identity'),bob:r('.public-profile-bob-card'),stats:r('.profile-stats'),record:r('.profile-streak-record'),footer:r('.profile-footer-actions'),rep:r('.profile-reputation-buttons'),overflow:document.documentElement.scrollWidth>innerWidth,currentFlames:document.querySelectorAll('.public-profile-bob-card .ogonyok-mark').length,descriptions:[...document.querySelectorAll('.profile-badge-description')].map(e=>e.textContent)};
  });
  assert(Math.abs(g.banner.top-g.bob.top)<1);assert(Math.abs(g.banner.height-g.bob.height)<1);assert(Math.abs(g.stats.top-g.record.top)<1);assert(Math.abs(g.stats.height-g.record.height)<1);assert.equal(g.currentFlames,0);assert(!g.overflow);assert(g.footer.top>=g.stats.bottom);assert(Math.abs(g.footer.left-g.banner.left)<1);assert(Math.abs(g.footer.right-g.bob.right)<1);assert(g.descriptions.every(d=>d.length<=75&&!d.includes('Лишняя')));
  if(own){const exit=await page.$eval('#profile-logout',e=>{const r=e.getBoundingClientRect();return {right:r.right,top:r.top}});assert(Math.abs(exit.right-g.bob.right)<1);assert(Math.abs(exit.top-g.rep.top)<2)}
  // Force a right-edge hover to prove the tooltip paints over the adjacent BOB card.
  await page.evaluate(()=>{const badge=document.querySelector('.profile-badge');badge.style.position='absolute';badge.style.top='28px';badge.style.right='8px';positionProfileBadgeTooltips()});
  await page.hover('.profile-badge');await new Promise(r=>setTimeout(r,220));
  const overlay=await page.evaluate(()=>{const tip=document.querySelector('.profile-badge-tooltip');tip.style.pointerEvents='auto';const t=tip.getBoundingClientRect(),b=document.querySelector('.public-profile-bob-card').getBoundingClientRect();const x=Math.min(t.right,b.right)-4,y=Math.max(t.top,b.top)+8;return {visible:getComputedStyle(tip).visibility,left:t.left,right:t.right,intersects:x>b.left&&y<Math.min(t.bottom,b.bottom),onTop:tip.contains(document.elementFromPoint(x,y))}});
  assert.equal(overlay.visible,'visible');assert(overlay.left>=0&&overlay.right<=width);if(overlay.intersects)assert(overlay.onTop);
  await page.screenshot({path:`/tmp/profile-fixed-${own?'own':'public'}-${width}.png`});console.log('PASS matched banner/BOB, 2x2/record heights, footer alignment, short copy, tooltip stacking',width,own);
 }
}
await page.evaluate(()=>{profileState.data.boing.badges=[];renderBoingGame()});assert.equal(await page.$('#boing-back'),null);assert.equal(await page.$('.boing-level'),null);assert.equal(await page.$('.ogonyok-help'),null);assert.equal(await page.$$eval('.boing-game-footer>.ogonyok-game',es=>es.length),1);
assert.deepEqual(errors,[]);console.log('PASS removed account/level/question controls and moved live streak into footer, no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
