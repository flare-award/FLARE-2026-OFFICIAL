// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});



const setup=()=>page.evaluate(()=>{teardownBoing(false);state.session={nickname:'Maronnix',token:'test'};profileState.data={nickname:'Maronnix',email_masked:'m***@mail.test',created_at:'2026-01-01',days_with_flare:20,votes_done:4,total_nominations:20,reputation:{up:3,down:0},boing:{bob_name:'BOB',best_score:20000,coins:5000,inventory:[],badges:[],streak:{days:10,best:20,bonus:6,today_score:500},points_per_click:7,economy_version:3,reward_step_score:100}};renderProfile()});
assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),undefined);
for(const width of [1360,768,390,320]){
 await page.setViewport({width,height:900});await setup();await page.evaluate(()=>document.fonts.ready);
 const before=await page.$eval('.profile-stat',e=>getComputedStyle(e).background);
 const statsBefore=await page.$eval('.profile-stats',e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
 const toggle=await page.$('[data-liquid-glass-toggle]');await toggle.focus();await page.keyboard.press('Space');
 await page.waitForSelector('.profile-stat.lg');await page.screenshot();await new Promise(r=>setTimeout(r,600));await page.screenshot();assert.equal(await page.$eval('[data-liquid-glass-toggle]',e=>e.getAttribute('aria-checked')),'true');
 assert.equal(await page.evaluate(()=>localStorage.getItem('flare-liquid-glass')),'1');
 assert.notEqual(await page.$eval('.profile-stat',e=>getComputedStyle(e).background),before);
 const statsAfter=await page.$eval('.profile-stats',e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));assert(Math.abs(statsAfter.w-statsBefore.w)<1&&Math.abs(statsAfter.h-statsBefore.h)<40);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.profile-scroll').scrollWidth>document.querySelector('.profile-scroll').clientWidth),false);
 await page.screenshot({path:`/tmp/liquid-glass-profile-${width}.png`});
 await setup();await page.waitForSelector('.profile-stat.lg');await page.screenshot();await new Promise(r=>setTimeout(r,600));await page.screenshot();assert.equal(await page.$eval('[data-liquid-glass-toggle]',e=>e.getAttribute('aria-checked')),'true');
 await page.evaluate(()=>renderBoingGame());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert(await page.$('.boing-arena'));await page.screenshot({path:`/tmp/liquid-glass-game-${width}.png`});
 await page.evaluate(()=>showNomination('squad-of-year',{fromHistory:true}));await page.click('[data-nominee="squad-4"]');assert.equal(await page.evaluate(()=>state.selected),'squad-4');assert.equal(await page.$eval('#cast-vote',e=>e.disabled),false);
 await page.screenshot({path:`/tmp/liquid-glass-voting-${width}.png`});
 await page.evaluate(()=>{openModal(`${adminHeaderMarkup()}<div class="admin-wrap">${renderDesignPanel()}</div>`,'admin-modal');bindAdminTabs();setAdminTab('design');bindDesignPanel()});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/liquid-glass-admin-${width}.png`});
 await setup();await page.$eval('[data-liquid-glass-toggle]',e=>e.click());assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),undefined);
 assert.equal(await page.$eval('.profile-stat',e=>getComputedStyle(e).background),before);
 console.log('PASS default off, keyboard switch, persistence, profile/game/voting/admin, no overflow and exact standard-theme restoration',width);
}
await setup();await page.$eval('[data-liquid-glass-toggle]',e=>e.click());await page.reload({waitUntil:'load'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'liquid-glass');await setup();await page.waitForSelector('.profile-stat.lg');await page.screenshot();await new Promise(r=>setTimeout(r,600));await page.screenshot();assert.equal(await page.$eval('[data-liquid-glass-toggle]',e=>e.getAttribute('aria-checked')),'true');
await page.evaluate(()=>{localStorage.setItem('flare-liquid-glass','0');dispatchEvent(new StorageEvent('storage',{key:'flare-liquid-glass',newValue:'0'}))});assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),undefined);
await page.evaluate(()=>{localStorage.setItem('flare-liquid-glass','1');dispatchEvent(new StorageEvent('storage',{key:'flare-liquid-glass',newValue:'1'}))});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert(parseFloat(await page.$eval('.liquid-glass-switch',e=>getComputedStyle(e,'::after').transitionDuration))<=.15);
await page.evaluate(()=>{const sheet=[...document.styleSheets].find(s=>s.href?.includes('liquid-glass.css'));for(let i=sheet.cssRules.length-1;i>=0;i--)if(sheet.cssRules[i].type===CSSRule.SUPPORTS_RULE)sheet.deleteRule(i)});await new Promise(r=>setTimeout(r,400));assert.equal(await page.$eval('.modal',e=>getComputedStyle(e).backdropFilter),'none');assert.notEqual(await page.$eval('.modal',e=>getComputedStyle(e).background),'none');
await page.evaluate(()=>{localStorage.clear();dispatchEvent(new StorageEvent('storage',{key:null}))});assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),undefined);
assert.deepEqual(errors,[]);console.log('PASS reload, cross-tab changes/storage clear, reduced motion, no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
