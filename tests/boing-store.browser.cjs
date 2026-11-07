// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});



const cosmetics=['bob-shades','bob-cap','bob-crown','bob-beanie','bob-fedora','bob-sneakers','bob-bowtie'];
for(const width of [1360,390,320]){
 await page.setViewport({width,height:900});
 await page.evaluate(ids=>{
 state.session={nickname:'Maronnix',token:'test'};teardownBoing(false);
 profileState.data={nickname:'Maronnix',boing:{bob_name:'BOB',coins:100000,best_score:0,inventory:[],badges:[],economy_version:2,shop:[{id:'click-power',kind:'click',name:'POWER CLICK',description:'Очки за клик.',price:5000,level:0,max_level:5},{id:'coin-boost',kind:'coin',name:'COINS BOOST',description:'+10% за уровень.',price:10000,level:0,max_level:5},...ids.map((id,i)=>({id,kind:'accessory',name:id.toUpperCase(),description:'Аксессуар для BOB.',price:5000+i*1000,owned:false,level:0,max_level:1}))]}};
 rpc=async()=>({leaders:[{rank:1,nickname:'VeryLongNickname',bob_name:'ОченьДлинноеИмя16',best_score:999999,coins:999999},{rank:2,nickname:'Maronnix',bob_name:'BOB',best_score:50,coins:300},{rank:3,nickname:'Hidden',bob_name:null,best_score:30,coins:100}]});
 showBoingShop('upgrades');
 },cosmetics);
 assert.equal(await page.$$eval('.boing-shop-categories button svg',es=>es.length),3);
 assert((await page.$eval('.boing-shop-note',el=>el.textContent)).includes('10%'));
 await page.click('[data-shop-category="cosmetics"]');assert.equal(await page.$$eval('.boing-shop-preview',es=>es.length),7);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/flare-boing-cosmetics-${width}.png`});
 await page.evaluate(()=>showBoingLeaders());
 await page.waitForSelector('.boing-leader-bob-name');
 const rows=await page.$$eval('.boing-leader-row',rows=>rows.map(row=>{const n=row.querySelector('.boing-leader-name'),b=row.querySelector('.boing-leader-bob-name'),nr=n.getBoundingClientRect(),br=b?.getBoundingClientRect();return {nickWidth:nr.width,bobWidth:br?.width||0,aligned:!br||(br.left>=nr.right&&Math.abs((br.top+br.height/2)-(nr.top+nr.height/2))<1),different:!b||getComputedStyle(n.querySelector('strong')).color!==getComputedStyle(b).color,overflow:row.scrollWidth>row.clientWidth}}));
 for(let i=0;i<rows.length;i++){const row=rows[i];assert(row.aligned&&row.different&&!row.overflow);assert(row.nickWidth>10);if(i<2)assert(row.bobWidth>10);else assert.equal(row.bobWidth,0)}
 await page.screenshot({path:`/tmp/flare-boing-leaders-${width}.png`});
 console.log('PASS store/leaders',width,'official category icons, 7 cosmetic previews, inline differently colored BOB names, privacy and no overflow');
}
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
