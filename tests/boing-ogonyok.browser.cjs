// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});





for(const width of [1360,700,390,320]){
 await page.setViewport({width,height:900});
 await page.evaluate(()=>{
  state.session={nickname:'Maronnix',token:'test'};teardownBoing(false);
  window.sampleProfile={nickname:'Maronnix',email_masked:'m***@mail.test',created_at:'2026-01-01',days_with_flare:20,votes_done:4,total_nominations:20,reputation:{up:3,down:0},boing:{bob_name:'Супер BOB',best_score:20000,coins:5000,inventory:[],badges:[],streak:{days:10,best:20,bonus:6,today_score:500,qualified_today:false},points_per_click:7,economy_version:3,integrity_version:1}};
  profileState.data=sampleProfile;profileState.publicData=sampleProfile;renderPublicFlareProfile();
 });await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,200));
 async function geometry(){return page.evaluate(()=>{const card=document.querySelector('.public-profile-bob-card').getBoundingClientRect(),banner=document.querySelector('.profile-identity').getBoundingClientRect(),layout=document.querySelector('.public-profile-layout,.own-profile-layout').getBoundingClientRect(),modal=document.querySelector('.modal').getBoundingClientRect();return {x:card.left,bannerRight:banner.right,delta:card.top-banner.top,overflow:document.documentElement.scrollWidth>innerWidth,modalOverflow:document.querySelector('.profile-scroll').scrollWidth>document.querySelector('.profile-scroll').clientWidth,sideBottom:card.bottom,layoutBottom:layout.bottom,modalHeight:modal.height}})}
 let g=await geometry();assert(g.x>=g.bannerRight);assert(Math.abs(g.delta)<2);assert(!g.overflow);assert(!g.modalOverflow);assert.equal(await page.$eval('.profile-streak-record strong',e=>e.textContent),'20 дн. подряд');
 await page.screenshot({path:`/tmp/ogonyok-public-${width}.png`});
 await page.evaluate(()=>{profileState.data=sampleProfile;renderProfile()});g=await geometry();assert(g.x>=g.bannerRight);assert(Math.abs(g.delta)<2);assert(!g.overflow);assert(!g.modalOverflow);
 await page.screenshot({path:`/tmp/ogonyok-own-${width}.png`});
 await page.evaluate(()=>{renderBoingGame()});assert.equal(await page.$$eval('.ogonyok-game .ogonyok-mark',es=>es.length),1);assert((await page.$eval('.ogonyok-mini',e=>e.getAttribute('aria-label'))).includes('+6 к клику'));assert.equal(await page.$eval('.ogonyok-mini-progress i',e=>e.style.height),'50%');assert(await page.$('.boing-game-footer>.ogonyok-game'));
 assert.equal(await page.$('.ogonyok-help'),null);assert.equal(await page.$('#boing-back'),null);assert.equal(await page.$('.boing-level'),null);
 await page.evaluate(async()=>{
  rpc=async(name,args)=>name==='get_boing_leaders'?{leaders:[3,10,30].map((days,i)=>({nickname:'Maronnix',rank:i+1,bob_name:'ОченьДлинноеИмя16',best_score:3000,coins:1000,streak:{days,best:days,bonus:3}}))}:name==='get_public_flare_profile'?sampleProfile:{up:3,down:0};
  await showBoingLeaders();
 });assert.equal(await page.$$eval('.boing-leader-identity .ogonyok-mark',es=>es.length),3);assert((await page.$eval('.boing-leaders-tip',e=>e.textContent)).includes('Нажми на никнейм'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.click('.boing-leader-name');await page.waitForSelector('.public-profile-layout');assert.equal(await page.$eval('.public-profile-head h2',e=>e.textContent),'Maronnix');
 console.log('PASS Ogonyok profiles/game/leaders/profile link',width,g);
}
await page.setViewport({width:1100,height:900});
await page.evaluate(()=>{replaceModalView(`<div class="ogonyok-showcase">${[0,1,3,5,10,15,20,30,40,50,60].map(days=>`<div>${ogonyokMark({days})}<span>${ogonyokStage(days).name} · ${days}</span></div>`).join('')}</div>`,'profile-modal');});await page.screenshot({path:'/tmp/ogonyok-stages.png'});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await page.$eval('.ogonyok-flame',e=>getComputedStyle(e).animationName),'none');
assert.deepEqual(errors,[]);console.log('PASS stages and reduced motion, no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
