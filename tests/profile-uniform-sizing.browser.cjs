// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});


await new Promise(r=>setTimeout(r,150));
const members=await page.evaluate(()=>MEMBERS);assert.equal(members.length,12);
for(const width of [1360,960,768,701,700,540,430,390,320]){
 await page.setViewport({width,height:900});let reference;
 for(const own of [true,false])for(const nickname of ['Maronnix',...members.filter(n=>n!=='Maronnix')]){
  await page.evaluate(({own,nickname})=>{
   teardownBoing(false);resetProfileAppearanceDraft();profileState.email=null;state.session={nickname:own?nickname:'Maronnix',token:'test'};
   const ids=nickname==='Maronnix'?['legacy-king-2','legacy-multigaming-2','legacy-conflict-1','legacy-conflict-2','legacy-laureate-7','creator']:nickname==='Rezo1n'?['legacy-king-2']:[];
   const profile={nickname,email_masked:'x***@mail.test',created_at:'2026-01-01',days_with_flare:20,votes_done:4,total_nominations:20,reputation:{up:3,down:0},banner:nickname==='Maronnix'?'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6bJkAAAAASUVORK5CYII=':null,boing:{bob_name:'BOB',best_score:20000,coins:5000,inventory:[],badges:ids.map(id=>({id,name:id,description:'Короткое описание.',rarity:'legendary',equipped:true})),streak:{days:10,best:20,bonus:6,today_score:500},points_per_click:7,economy_version:3,game_intro_seen:true}};
   profileState.data=profile;profileState.publicData=profile;own?renderProfile():renderPublicFlareProfile();
  },{own,nickname});await page.evaluate(()=>document.fonts.ready);
  const g=await page.evaluate(()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return {w:x.width,h:x.height,x:x.left,y:x.top,right:x.right,bottom:x.bottom}};const scroll=document.querySelector('.profile-scroll');return {banner:r('.profile-identity'),stats:r('.profile-stats'),bob:r('.public-profile-bob-card'),record:r('.profile-streak-record'),modal:r('.modal'),overflow:document.documentElement.scrollWidth>innerWidth||scroll.scrollWidth>scroll.clientWidth+1}});
  if(!reference)reference=g;
  for(const key of ['banner','stats'])for(const dim of ['w','h'])assert(Math.abs(g[key][dim]-reference[key][dim])<1,JSON.stringify({width,own,nickname,key,dim,g,reference}));
  assert(Math.abs(g.banner.x-g.stats.x)<1&&Math.abs(g.banner.right-g.stats.right)<1);assert(Math.abs(g.banner.h-g.bob.h)<1&&Math.abs(g.stats.h-g.record.h)<1);assert(!g.overflow);
  if(['Maronnix','Awal'].includes(nickname)&&[1360,390,320].includes(width))await page.screenshot({path:`/tmp/uniform-profile-${nickname}-${own?'own':'public'}-${width}.png`});
 }
 console.log('PASS all 12 accounts own/public: same banner and stats dimensions as Maronnix, aligned BOB/flame, no overflow',width);
}
assert.deepEqual(errors,[]);

}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
