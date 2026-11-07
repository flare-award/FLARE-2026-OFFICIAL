// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});


async function resetGame(){await page.evaluate(()=>{
 teardownBoing(false);state.session={nickname:'Maronnix',token:'test'};window.calls=[];
 profileState.data={nickname:'Maronnix',boing:{bob_name:'BOB',best_score:0,coins:100,points_per_click:1,inventory:[],badges:[],free_renames_left:2,rename_price:0,game_intro_seen:true}};
 rpc=async(name,args)=>{calls.push({name,args});return {run_id:'mock-run',boing:profileState.data.boing}};
 renderBoingGame();
});await new Promise(r=>setTimeout(r,350))}
for(const [width,height] of [[1360,1000],[768,900],[700,850],[390,844],[320,700],[844,390]]){
 await page.setViewport({width,height});await resetGame();
 const layout=await page.evaluate(()=>{
  const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const name=rect('#bob-name'),body=rect('#bob'),rename=rect('#boing-rename'),face=rect('#bob-face-edit'),level=rect('.ogonyok-game'),arena=rect('.boing-arena'),modal=rect('.boing-modal'),tabs=rect('.boing-tabs');
  return {name,body,rename,face,level,arena,modal,tabs,nameInBody:!!document.querySelector('#bob #bob-name'),faceInArena:!!document.querySelector('.boing-arena #bob-face-edit'),headBorder:getComputedStyle(document.querySelector('.boing-head')).borderBottomWidth,divider:getComputedStyle(document.querySelector('.boing-tabs'),'::after').left,dividerRight:getComputedStyle(document.querySelector('.boing-tabs'),'::after').right,headBackground:getComputedStyle(document.querySelector('.boing-head')).backgroundColor,tabsBackground:getComputedStyle(document.querySelector('.boing-tabs')).backgroundColor,headWidth:document.querySelector('.boing-head').getBoundingClientRect().width,scroll:document.querySelector('.boing-game-layout').scrollHeight>document.querySelector('.boing-game-layout').clientHeight,overflow:document.documentElement.scrollWidth>innerWidth,text:document.querySelector('.boing-game-footer').textContent,hintSize:parseFloat(getComputedStyle(document.querySelector('.boing-hint')).fontSize)};
 });
 assert(!layout.nameInBody&&!layout.faceInArena);assert(Math.abs(layout.name.y-layout.body.bottom-8)<1);if(width>=540){assert(layout.face.x>=layout.rename.right+7);assert(Math.abs(layout.face.y-layout.rename.y)<1)}else{assert(layout.face.y>=layout.rename.bottom+5);assert(layout.level.x>=layout.face.right+6)}assert(layout.level.y>=layout.arena.bottom);assert(layout.level.right<=layout.modal.right-10);assert(!layout.overflow);assert.equal(layout.headBorder,'0px');assert.equal(layout.divider,'0px');assert.equal(layout.dividerRight,'0px');assert.equal(layout.headBackground,layout.tabsBackground);assert.equal(layout.headWidth,layout.tabs.width);assert(Math.abs(layout.tabs.right-(layout.modal.right-1))<1);assert(layout.hintSize>=10);assert(!layout.text.includes('COINS'));assert(layout.text.includes('Сменить имя'));assert(layout.text.includes('Изменить лицо'));
 for(const accessory of [null,'bob-crown','bob-cap','bob-fedora','bob-beanie','bob-sneakers','bob-bowtie']){await page.evaluate(accessory=>{profileState.data.boing.selected_accessory=accessory;renderBoingGame()},accessory);for(const rotation of [0,45,90,180,270]){
  const result=await page.evaluate(({accessory,rotation})=>{profileState.data.boing.selected_accessory=accessory;boingScene.rotation=rotation;paintBob(boingScene);const n=document.querySelector('#bob-name').getBoundingClientRect(),a=document.querySelector('.boing-arena').getBoundingClientRect(),hat=document.querySelector('.bob-accessory-outside'),h=hat?.getBoundingClientRect();return {nameY:n.y,bodyBottom:a.y+1+boingScene.y+boingScene.size,hatBottom:h?.bottom||0,transform:getComputedStyle(document.querySelector('#bob-name')).transform}}, {accessory,rotation});
  assert(result.nameY>=result.bodyBottom+7);assert(result.nameY>=result.hatBottom+6);assert(result.transform.startsWith('matrix(1, 0, 0, 1,'));
 }
 }
 await page.evaluate(()=>{profileState.data.boing.bob_name='ОченьДлинноеИмя16';profileState.data.boing.selected_accessory=null;renderBoingGame()});
 for(const side of ['left','right']){
  const nameBounds=await page.evaluate(side=>{boingScene.x=side==='left'?0:boingScene.arena.clientWidth-boingScene.size;paintBob(boingScene);const n=document.querySelector('#bob-name').getBoundingClientRect(),a=boingScene.arena.getBoundingClientRect();return {left:n.left-a.left,right:a.right-n.right}},side);assert(nameBounds.left>=5&&nameBounds.right>=5);
 }
 assert.equal(await page.evaluate(()=>{boingScene.y=boingScene.arena.clientHeight-boingScene.size-10;paintBob(boingScene);return getComputedStyle(document.querySelector('#bob-name')).visibility}),'hidden');
 await resetGame();assert.equal(await page.$eval('.boing-modal',el=>el.offsetWidth-el.clientWidth),2);await page.screenshot({path:`/tmp/flare-boing-${width}x${height}.png`});
 await page.click('#bob-face-edit');assert.equal(await page.evaluate(()=>profileState.view),'face');await page.waitForFunction(()=>bobFaceEditor?.ready);await page.click('#bob-face-cancel');assert.equal(await page.evaluate(()=>profileState.view),'game');
 await page.click('#boing-rename');assert.equal(await page.$eval('#boing-name-input',el=>el.value),'BOB');await page.click('#boing-rename-cancel');
 // Keyboard centre hit: no arbitrary rotation. A real off-centre pointer hit produces torque.
 await page.focus('#bob');await page.keyboard.press('Enter');await page.evaluate(()=>{cancelAnimationFrame(boingScene.raf);boingScene.raf=0;boingScene.running=false});
 assert.equal(await page.evaluate(()=>boingScene.spin),0);assert.equal(await page.$eval('#bob-face-edit',el=>el.disabled),true);assert.equal(await page.$eval('#boing-rename',el=>el.disabled),true);
 assert.equal(await page.$eval('#boing-score',el=>el.textContent),'1');
 await resetGame();const r=await page.$eval('#bob',el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y}});await page.mouse.click(r.x+77,r.y+70);
 const run=await page.evaluate(()=>{cancelAnimationFrame(boingScene.raf);boingScene.raf=0;boingScene.running=false;return {spin:boingScene.spin,vy:boingScene.vy,clicks:boingScene.clicks}});assert(run.spin<0);assert(run.vy<0);assert.equal(run.clicks,1);
 await page.evaluate(()=>failBoingRound(boingScene));await page.waitForFunction(()=>!boingScene.failed);assert.equal(await page.$eval('#boing-score',el=>el.textContent),'0');assert.equal(await page.$eval('#bob-face-edit',el=>el.disabled),false);assert.equal(await page.$eval('#boing-rename',el=>el.disabled),false);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.name==='sync_boing_run'&&x.args.p_failed).length),1);
 await resetGame();const down=await page.$eval('#bob',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await page.mouse.move(down.x,down.y);await page.mouse.down();
 assert.equal(await page.evaluate(()=>boingScene.clicks),1); // credited on down, before any release
 await page.evaluate(()=>{cancelAnimationFrame(boingScene.raf);boingScene.raf=0;boingScene.running=false;boingScene.x=Math.min(boingScene.arena.clientWidth-boingScene.size,boingScene.x+100);boingScene.y+=40;paintBob(boingScene)});await page.mouse.up();assert.equal(await page.evaluate(()=>boingScene.clicks),1);
 await resetGame();const touch=await page.$eval('#bob',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await page.touchscreen.tap(touch.x,touch.y);assert.equal(await page.evaluate(()=>boingScene.clicks),1);
 await resetGame();const pair=await page.$eval('#bob',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}),cdp=await page.createCDPSession();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:pair.x-16,y:pair.y},{id:2,x:pair.x+16,y:pair.y}]});assert.equal(await page.evaluate(()=>boingScene.clicks),2);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>boingScene.clicks),2);await cdp.detach();
 await resetGame();const fallingKick=await page.evaluate(()=>{boingScene.vy=600;clickBob(boingScene);cancelAnimationFrame(boingScene.raf);boingScene.raf=0;boingScene.running=false;return boingScene.vy});assert.equal(fallingKick,-357.5*1.05);
 console.log('PASS',width,height,'name/rotating hats, footer/actions, unclipped borders, face/name navigation, keyboard/pointer impulses and failed-run sync');
}
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await resetGame();assert.equal(await page.$eval('.boing-arena',el=>getComputedStyle(el).overflow),'hidden');
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
