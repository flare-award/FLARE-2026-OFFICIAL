// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});
for(const width of [1360,700,390,320]){
 await page.setViewport({width,height:900});
 for(const service of ['discord','telegram']){
  const label=service==='discord'?'Discord':'Telegram';
  await page.evaluate(service=>openSocialPhotoPreview('Maronnix',service,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6bJkAAAAASUVORK5CYII='),service);
  await page.evaluate(()=>document.fonts.ready);
  const title=await page.evaluate(()=>{const t=document.querySelector('.social-photo-title>span'),c=document.querySelector('.social-photo-close'),r=t.getBoundingClientRect(),b=c.getBoundingClientRect();return {text:t.textContent,size:getComputedStyle(t).fontSize,weight:getComputedStyle(t).fontWeight,center:Math.abs(r.top+r.height/2-b.top-b.height/2),fits:r.right<=b.left-8,overflow:document.documentElement.scrollWidth>innerWidth,strong:!!document.querySelector('.social-photo-title strong')}});
  assert.equal(title.text,label+' - Maronnix');assert.equal(title.weight,'600');assert.equal(title.size,width>700?'14px':'13px');assert(title.center<1&&title.fits&&!title.overflow&&!title.strong,JSON.stringify(title));
  await page.click('.social-photo-close');assert.equal(await page.$('.social-photo-overlay'),null);
 }
 console.log('PASS uniform Discord/Telegram title, hyphen, vertical alignment, close and no overflow',width);
}
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
