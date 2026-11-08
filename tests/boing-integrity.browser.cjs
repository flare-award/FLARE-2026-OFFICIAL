// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});




await page.setViewport({width:390,height:844});
async function protectedGame({rejectSync=false,failDiscardOnce=false,failFinalOnce=false}={}){
 await page.evaluate(({rejectSync,failDiscardOnce,failFinalOnce})=>{
  teardownBoing(false);state.session={nickname:'Maronnix',token:'test'};window.calls=[];window.discardAttempts=0;window.finalAttempts=0;
  const boing={bob_name:'BOB',coins:300,best_score:20,total_clicks:100,total_score:100,points_per_click:1,inventory:[],badges:[],economy_version:2,integrity_version:1,active_run:null};profileState.data={nickname:'Maronnix',boing};
  rpc=async(name,args)=>{calls.push({name,args});if(name==='start_boing_run'){await new Promise(r=>setTimeout(r,100));return {run_id:'mock-run',boing:{...boing,active_run:{id:'mock-run',clicks:0,score:0}}}}
   if(name==='discard_boing_run'){if(failDiscardOnce&&++discardAttempts===1)throw Error('Temporary timeout');return {rejected:true,boing}}
   if(args?.p_failed&&failFinalOnce&&++finalAttempts===1)throw Error('Temporary final timeout');
   return {rejected:rejectSync,boing:rejectSync?boing:{...boing,active_run:{id:'mock-run',clicks:args.p_clicks,score:args.p_clicks}}};};renderBoingGame();
 },{rejectSync,failDiscardOnce,failFinalOnce});await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,350));
}
await protectedGame();await page.focus('#bob');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await page.evaluate(()=>boingScene.clicks),1);await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>boingScene.clicks),2);
await page.waitForFunction(()=>calls.some(c=>c.name==='sync_boing_checked_run'));const batch=await page.evaluate(()=>calls.find(c=>c.name==='sync_boing_checked_run').args);assert.equal(batch.p_times.length,2);assert.deepEqual(batch.p_times.map(x=>x.n),[1,2]);assert.equal(await page.$eval('#boing-coins',el=>el.textContent),'300');
for(const failDiscardOnce of [false,true]){
 await protectedGame({failDiscardOnce});const point=await page.$eval('#bob',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await page.mouse.move(point.x,point.y);await page.mouse.down();
 // The run is still starting. Synthetic automation must queue cancellation behind start, not settle it.
 await page.evaluate(()=>document.querySelector('#bob').click());assert.equal(await page.evaluate(()=>boingScene.rejected&&boingScene.locked&&!boingScene.running),true);await page.mouse.up();
 await page.waitForFunction(()=>!boingScene.failed&&boingScene.clicks===0,{timeout:7000});
 const result=await page.evaluate(()=>({calls,coins:profileState.data.boing.coins,best:profileState.data.boing.best_score}));assert.equal(result.coins,300);assert.equal(result.best,20);assert(result.calls.some(x=>x.name==='discard_boing_run'));assert(!result.calls.some(x=>x.args?.p_failed===true));assert.equal(await page.$eval('#bob-face-edit',el=>el.disabled),false);
}
await protectedGame({failFinalOnce:true});await page.focus('#bob');await page.keyboard.press('Enter');await page.waitForFunction(()=>!!boingScene.runId);await page.evaluate(()=>failBoingRound(boingScene));assert.equal(await page.evaluate(()=>boingScene.failed&&boingScene.locked),true);await page.waitForFunction(()=>!boingScene.failed&&boingScene.clicks===0,{timeout:7000});assert.equal(await page.evaluate(()=>calls.filter(x=>x.args?.p_failed).length),2);
await protectedGame({rejectSync:true});await page.focus('#bob');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#boing-hint').textContent.includes('НЕ ЗАСЧИТАН'));assert.equal(await page.evaluate(()=>boingScene.score),0);assert.equal(await page.evaluate(()=>profileState.data.boing.best_score),20);
const n=await page.evaluate(()=>calls.length);await new Promise(r=>setTimeout(r,700));assert.equal(await page.evaluate(()=>calls.length),n);
assert.deepEqual(errors,[]);console.log('PASS protected input: native Enter/Space, held-key repeat ignored, telemetry sent, synthetic run stopped, in-flight start cancellation, temporary cancellation retry, no premature credit, server rejection / no retry loop');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
