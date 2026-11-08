// Browser regression: install puppeteer-core@24.31.0 and @sparticuz/chromium@143.0.4 externally,
// then run from repo root with NODE_PATH pointing at those node_modules.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
const seed=JSON.parse(fs.readFileSync('supabase/seeds/legacy_awards.json','utf8'));
const badges=seed.badges.map(([id,name,description,rarity])=>({id:'legacy-'+id,name,description,rarity,equipped:true}));
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});

for(const width of [1360,768,700,390,320]){
 await page.setViewport({width,height:844});
 for(const count of [1,6,30,60])for(const publicView of [false,true]){
  await page.evaluate(({badges,count,publicView})=>{
    state.session={nickname:'Maronnix',token:'test'};rpc=async()=>({});
    const many=Array.from({length:count},(_,i)=>({...badges[i%badges.length],id:i<badges.length?badges[i].id:`legacy-test-${i}`,equipped:true}));
    window.fixture={nickname:'Maronnix',created_at:'2025-01-01',email_masked:'m•••@test.invalid',votes_done:0,total_nominations:18,days_with_flare:10,boing:{badges:many,inventory:[],selected_frame:'frame-default',best_score:0,coins:0,bob_name:'BOB'}};
    if(publicView){profileState.publicData=fixture;renderPublicFlareProfile()}else{profileState.data=fixture;resetProfileAppearanceDraft();renderProfile()}
  },{badges,count,publicView});
  const layout=await page.evaluate(()=>{
   const scroll=document.querySelector('.profile-scroll'),r=scroll.getBoundingClientRect(),els=[...document.querySelectorAll('.profile-equipped-badges .profile-badge')],rects=els.map(el=>el.getBoundingClientRect()),name=document.querySelector('.profile-nickname-line h3').getBoundingClientRect();
   const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
   return {count:els.length,noOverflow:scroll.scrollWidth<=scroll.clientWidth,inside:rects.every(x=>x.left>=r.left&&x.right<=r.right),stable:rects.every(x=>x.width>=29&&x.height>=29),noOverlap:rects.every((x,i)=>!overlap(x,name)&&rects.every((y,j)=>i===j||!overlap(x,y))),scrollable:scroll.scrollHeight>scroll.clientHeight};
  });
  assert.equal(layout.count,count);assert(layout.noOverflow&&layout.inside&&layout.stable&&layout.noOverlap,JSON.stringify({width,count,publicView,layout}));
  if(!publicView){await page.evaluate(()=>beginProfileAppearanceEdit());const edit=await page.evaluate(()=>{const es=[...document.querySelectorAll('.profile-equipped-badges .profile-badge')];return {count:es.length,remove:es.every(e=>e.querySelector('[data-badge-remove]')),overflow:document.querySelector('.profile-scroll').scrollWidth>document.querySelector('.profile-scroll').clientWidth}});assert.equal(edit.count,count);assert(edit.remove&&!edit.overflow);}
  if(count===60){await (await page.$('.profile-equipped-badges .profile-badge')).hover();await new Promise(r=>setTimeout(r,180));const tip=await page.$eval('.profile-badge-tooltip',el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth}});assert(tip.left>=0&&tip.right<=tip.width);await page.screenshot({path:`/tmp/flare-badge-layout-${width}-${publicView?'public':'own'}.png`});}
  console.log('PASS',width,count,publicView?'public':'own','stable wrapping / no overlaps / no overflow');
 }
}
await page.evaluate(()=>{profileState.data=fixture;profileState.data.boing.badges=[{id:'legacy-king-2',name:'FLARE KING',rarity:'legendary',equipped:true,description:'test'}];resetProfileAppearanceDraft();renderProfile()});
const normal=await page.$eval('[data-badge-id="legacy-king-2"]',el=>({animation:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration,transform:getComputedStyle(el).transform,icon:el.querySelector('svg').innerHTML}));assert.equal(normal.animation,'legacyDoubleHonor');assert.equal(normal.duration,'8s');assert.equal(normal.transform,'none');assert(!normal.icon.includes('M3 2h2m14 0h2'));
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await page.$eval('[data-badge-id="legacy-king-2"]',el=>getComputedStyle(el).animationName),'none');assert.deepEqual(errors,[]);console.log('PASS subtle 8s effect, no transforms/extra strokes, reduced motion, no JavaScript errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
