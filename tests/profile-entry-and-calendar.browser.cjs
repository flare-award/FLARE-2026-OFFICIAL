// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});





const svg=fs.readFileSync('assets/icons/nominations/calendar-star.svg','utf8');
const pixels=await page.evaluate(async svg=>{
 const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3];
 const cutout=alpha(128,140),body=alpha(64,140),header=alpha(128,60),outside=alpha(10,10);
 ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#1267ac';ctx.fillRect(0,0,256,256);return {cutout,body,header,outside,background:Array.from(ctx.getImageData(128,140,1,1).data)};
},svg);
assert.deepEqual(pixels,{cutout:0,body:255,header:0,outside:0,background:[18,103,172,255]});
for(const width of [1360,390,320]){
 await page.setViewport({width,height:900});
 for(const mode of ['locked','server-unlocked','local-unlocked','other-profile']){
  const result=await page.evaluate(async mode=>{
   teardownBoing(false);localStorage.removeItem(boingSeenKey('Maronnix'));state.session={nickname:'Maronnix',token:'test'};
   const boing={bob_name:'BOB',game_intro_seen:mode==='server-unlocked'||mode==='other-profile',inventory:[],badges:[],coins:0,best_score:0};
   profileState.data={nickname:mode==='other-profile'?'Other':'Maronnix',boing};
   if(mode==='local-unlocked')writeBoingSeen('Maronnix');
   updateBoingQuickEntry();
   const markup=profileHeader('Ваш аккаунт',true);const holder=document.createElement('div');holder.innerHTML=markup;
   const mystery=!!holder.querySelector('#open-boing'),divider=!!holder.querySelector('.profile-title-divider'),quickVisible=!document.querySelector('#boing-quick-entry').hidden;
   if(mode!=='other-profile'){
    rpc=async name=>name==='get_my_profile'?{nickname:'Maronnix',boing}:{up:0,down:0};
    await showProfile();
    if(!!document.querySelector('#open-boing')!==mystery)throw Error('Loading/final header mismatch');
   }
   return {mystery,divider,quickVisible};
  },mode);
  const unlocked=mode==='server-unlocked'||mode==='local-unlocked';assert.equal(result.mystery,!unlocked);assert.equal(result.divider,!unlocked);assert.equal(result.quickVisible,unlocked);
 }
 console.log('PASS mystery/divider vs quick entry: locked, server/local unlocked, unrelated profile',width);
}
const eventKinds=await page.evaluate(()=>Object.fromEntries(nominations.find(n=>n.id==='event-of-year').nominees.map(n=>[n.id,n.type])));assert.equal(eventKinds['event-2'],'image');assert.equal(eventKinds['event-1'],'video');assert.equal(eventKinds['event-3'],'image');
await page.evaluate(svg=>{replaceModalView(`<div style="padding:30px;background:linear-gradient(135deg,#172638,#45213b)"><img width="160" height="160" src="data:image/svg+xml;base64,${btoa(svg)}"></div>`,'profile-modal')},svg);await page.screenshot({path:'/tmp/sos-transparent-star.png'});
assert.deepEqual(errors,[]);console.log('PASS real SVG raster alpha: star is transparent, background visible, calendar body unchanged; nominee IDs/types preserved; no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
