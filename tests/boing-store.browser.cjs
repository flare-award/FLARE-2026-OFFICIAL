// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});



const cosmetics=['bob-shades','bob-cap','bob-crown','bob-beanie','bob-fedora','bob-sneakers','bob-bowtie'];
for(const width of [1360,390,320]){
 await page.setViewport({width,height:900});
 await page.evaluate(ids=>{
 state.session={nickname:'Maronnix',token:'test'};teardownBoing(false);
 profileState.data={nickname:'Maronnix',boing:{bob_name:'BOB',coins:100000,best_score:0,inventory:[],badges:[],economy_version:3,shop:[{id:'click-power',kind:'click',name:'POWER CLICK',description:'Очки за клик.',price:5000,level:0,max_level:5},{id:'coin-boost',kind:'coin',name:'COINS BOOST',description:'+10% за уровень.',price:10000,level:0,max_level:5},...ids.map((id,i)=>({id,kind:'accessory',name:id.toUpperCase(),description:'Аксессуар для BOB.',price:({'bob-shades':5000,'bob-cap':10000,'bob-crown':30000,'bob-beanie':8000,'bob-fedora':15000,'bob-sneakers':20000,'bob-bowtie':12000})[id],owned:false,level:0,max_level:1})),...['frame-gold','frame-aurora','frame-inferno'].map(id=>({id,kind:'frame',name:id.toUpperCase(),description:'Рамка аватара.',price:({'frame-gold':10000,'frame-aurora':35000,'frame-inferno':75000})[id],owned:false,level:0,max_level:1}))]}};
 rpc=async()=>({leaders:[{rank:1,nickname:'VeryLongNickname',bob_name:'ОченьДлинноеИмя16',best_score:999999,coins:999999},{rank:2,nickname:'Maronnix',bob_name:'BOB',best_score:50,coins:300},{rank:3,nickname:'Hidden',bob_name:null,best_score:30,coins:100}]});
 showBoingShop('upgrades');
 },cosmetics);
 assert.equal(await page.$('.boing-shop-balance'),null);assert.equal(await page.$eval('.boing-head #boing-coins',e=>e.textContent.replace(/\s/g,'')),'100000');
 assert.equal(await page.$$eval('.boing-shop-categories button svg',es=>es.length),3);
 const rewardNote=await page.$eval('.boing-shop-note',el=>el.textContent);
 assert(rewardNote.includes('10%'));assert(rewardNote.includes('100 COINS за каждые полные 200 очков одного раунда'));assert(rewardNote.includes('Остаток не переносится'));assert(!rewardNote.includes('100 кликов'));
 await page.click('[data-shop-category="cosmetics"]');assert.equal(await page.$$eval('.boing-shop-preview',es=>es.length),7);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/flare-boing-cosmetics-${width}.png`});
 const cap=await page.$eval('.boing-shop-item:has([data-buy-item="bob-cap"]) .bob-cap',el=>{const c=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return {centre:c.left+c.width/2-(b.left+b.width/2),top:c.top-b.top,bottom:c.bottom-b.top,transform:getComputedStyle(el).transform}});
 assert(Math.abs(cap.centre)<1);assert.equal(cap.transform,'none');assert(cap.top<0&&cap.bottom>20&&cap.bottom<30);
 await page.click('[data-shop-category="profile"]');assert.equal(await page.$$eval('.boing-frame-preview',es=>es.length),3);
 const frames=await page.$$eval('.boing-frame-preview .profile-avatar',es=>es.map(el=>({className:el.className,border:getComputedStyle(el).borderColor,shadow:getComputedStyle(el).boxShadow,animation:getComputedStyle(el,'::before').animationName,overflow:el.parentElement.scrollWidth>el.parentElement.clientWidth})));
 assert.deepEqual(frames.map(x=>x.className.trim()),['profile-avatar frame-gold','profile-avatar frame-aurora','profile-avatar frame-inferno']);
 assert.equal(new Set(frames.map(x=>x.border)).size,3);for(const frame of frames){assert.notEqual(frame.shadow,'none');assert(!frame.overflow)}assert.equal(frames[0].animation,'profileGoldFrameTurn');
 assert.equal(await page.evaluate(()=>profileState.data.boing.selected_frame),undefined); // Preview must not equip or buy anything.
 await page.screenshot({path:`/tmp/flare-boing-frames-${width}.png`});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await page.$eval('.frame-gold',el=>getComputedStyle(el,'::before').animationName),'none');await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.evaluate(()=>showBoingLeaders());
 await page.waitForSelector('.boing-leader-bob-name');
 const rows=await page.$$eval('.boing-leader-row',rows=>rows.map(row=>{const n=row.querySelector('.boing-leader-name'),b=row.querySelector('.boing-leader-bob-name'),nr=n.getBoundingClientRect(),br=b?.getBoundingClientRect();return {nickWidth:nr.width,bobWidth:br?.width||0,aligned:!br||(br.left>=nr.right&&Math.abs((br.top+br.height/2)-(nr.top+nr.height/2))<1),different:!b||getComputedStyle(n.querySelector('strong')).color!==getComputedStyle(b).color,overflow:row.scrollWidth>row.clientWidth}}));
 for(let i=0;i<rows.length;i++){const row=rows[i];assert(row.aligned&&row.different&&!row.overflow);assert(row.nickWidth>10);if(i<2)assert(row.bobWidth>10);else assert.equal(row.bobWidth,0)}
 await page.screenshot({path:`/tmp/flare-boing-leaders-${width}.png`});
 console.log('PASS store/leaders',width,'centred cap, all 3 real frame previews / reduced motion / no accidental equip, category icons, BOB names / privacy and no overflow');
}
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
