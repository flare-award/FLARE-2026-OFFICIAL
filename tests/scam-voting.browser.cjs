// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,200));
const items=await page.evaluate(()=>nominations.find(n=>n.id==='scam-of-year').nominees.map(i=>({id:i.id,name:i.name})));
for(const width of [1360,390,320]){
 await page.setViewport({width,height:900});
 for(const nickname of ['Maronnix','Akirakume','Dony_zq','Nodben','Eozik','Qusti']){
  for(const item of items){
   const self=item.name===nickname||(item.id==='scam-group'&&['Akirakume','Dony_zq','Nodben'].includes(nickname));
   await page.evaluate(nickname=>{state.session={nickname,token:'test'};state.votes={};state.selected=null;state.busy=false;state.category='основная';window.voteCalls=[];rpc=async(name,args)=>{if(name==='cast_vote')voteCalls.push(args);return name==='get_video_options'?[]:{ok:true}};showNomination('scam-of-year',{fromHistory:true})},nickname);
   assert(await page.$('[data-nominee="person-8-akirakume"] .portrait-placeholder'));
   await page.click(`[data-nominee="${item.id}"]`);
   if(self){assert.equal(await page.$eval('#cast-vote',e=>e.disabled),true);assert.equal(await page.evaluate(()=>state.selected),null)}
   else{
    assert.equal(await page.$eval('#cast-vote',e=>e.disabled),false);
    await page.click('#cast-vote');await page.waitForFunction(()=>!state.busy);
    const result=await page.evaluate(()=>({saved:state.votes['scam-of-year'],calls:voteCalls}));assert.equal(result.saved,item.id);assert.equal(result.calls.length,1);assert.equal(result.calls[0].p_option_id,item.id);assert.equal(result.calls[0].p_nomination_id,'scam-of-year');
   }
  }
 }
 console.log('PASS scam: all 5 candidates / 6 voters, missing-photo fallback, select/save and self/group restrictions',width);
}
// A later image error in another nomination must not throw or break its controls either.
await page.evaluate(()=>{state.votes={};showNomination('game-of-year',{fromHistory:true});const image=document.querySelector('.visual-photo');image.dispatchEvent(new Event('error'))});
assert(await page.$('.visual.no-photo'));await page.click('[data-nominee="game-1"]');assert.equal(await page.$eval('#cast-vote',e=>e.disabled),false);
assert.deepEqual(errors,[]);console.log('PASS delayed missing image in another nomination, no JavaScript errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
