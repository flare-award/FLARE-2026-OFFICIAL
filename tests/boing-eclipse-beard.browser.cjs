// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});





for(const width of [1360,390,320]){
 await page.setViewport({width,height:900});await page.evaluate(()=>{
  teardownBoing(false);state.session={nickname:'Maronnix',token:'test'};
  const frames=['gold','aurora','eclipse','inferno'].map((name,i)=>({id:'frame-'+name,kind:'frame',name:name.toUpperCase()+' FRAME',price:[10000,35000,55000,75000][i],level:0,max_level:1}));
  profileState.data={nickname:'Maronnix',boing:{bob_name:'BOB',coins:100000,best_score:0,inventory:[],badges:[],economy_version:3,shop:[{id:'banner-custom',kind:'banner',name:'PHOTO BANNER',price:25000},...frames,{id:'legend',kind:'badge',name:'LEGEND BADGE',price:1500000},{id:'bob-beard',kind:'accessory',name:'BOB BEARD',price:1000},{id:'bob-face-upload',kind:'face',name:'BOB PNG FACE',price:30000}]}};
  window.buys=[];rpc=async(name,args)=>{buys.push({name,args});return {boing:profileState.data.boing}};showBoingShop('profile');
 });await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,150));
 assert.deepEqual(await page.$$eval('[data-buy-item]',es=>es.map(e=>e.dataset.buyItem)),['frame-gold','frame-aurora','frame-eclipse','frame-inferno','banner-custom','legend']);
 assert.equal(await page.$$eval('.boing-frame-preview',es=>es.length),4);
 if(width===1360){const pos=await page.evaluate(()=>['banner-custom','legend'].map(id=>{const r=document.querySelector(`[data-buy-item="${id}"]`).closest('article').getBoundingClientRect();return {x:r.x,y:r.y}}));assert(pos[0].x<pos[1].x);assert(Math.abs(pos[0].y-pos[1].y)<1)}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/eclipseshop-${width}.png`});
 const frame=await page.$eval('.frame-eclipse',e=>({animation:getComputedStyle(e,'::before').animationName,mask:getComputedStyle(e,'::before').maskImage}));assert.equal(frame.animation,'profileEclipseCorona');assert(frame.mask.includes('radial-gradient'));
 await page.click('[data-shop-category="cosmetics"]');assert.equal(await page.$$eval('.boing-picture-preview svg circle',es=>es.length),1);assert.equal(await page.$$eval('.bob-beard path',es=>es.length),27);
 const geometry=await page.$$eval('.bob-beard path',es=>es.flatMap(e=>{const n=e.getAttribute('d').match(/[\d.]+/g).map(Number);return [{x:n[0],y:n[1]},{x:n[2],y:n[3]}]}));assert(geometry.every(p=>p.y>73&&p.x>0&&p.x<100));assert(Math.max(...geometry.map(p=>p.y))>100);assert(Math.max(...geometry.map(p=>p.y))<104);
 assert((await page.$eval('[data-buy-item="bob-beard"]',e=>e.textContent)).replace(/\s/g,'').includes('1000'));
 await page.screenshot({path:`/tmp/beardshop-${width}.png`});
 await page.click('[data-buy-item="bob-beard"]');assert.equal(await page.evaluate(()=>buys.at(-1).args.p_item_id),'bob-beard');
 console.log('PASS four frame previews/order, banner left badge right, Lucide image, lower-arc beard 27 hairs/1000 coins, purchase',width);
}
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluate(()=>showBoingShop('profile'));assert.equal(await page.$eval('.frame-eclipse',e=>getComputedStyle(e,'::before').animationName),'none');
await page.evaluate(()=>replaceModalView('<div class="nom-detail-actions"><button class="nominee-view-toggle">Вид</button></div>','nomination-detail-modal'));await page.hover('.nominee-view-toggle');assert.equal(await page.$eval('.nominee-view-toggle',e=>getComputedStyle(e).transform),'none');
assert.equal(await page.evaluate(()=>nominations.find(n=>n.id==='sos-of-year').nominees.find(n=>n.id==='sos-1').type),'image');
assert.deepEqual(errors,[]);console.log('PASS reduced motion, no View hover lift, CYBERSHOKE image, no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
