// Browser regression: use external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('fs'),path=require('path'),assert=require('assert'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
(async()=>{const dir=path.dirname(require.resolve('@sparticuz/chromium'));await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://flare.test'){try{const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)})}catch{return r.respond({status:404,body:''})}}r.abort()});await page.goto('http://flare.test/',{waitUntil:'load'});

async function open(){await page.evaluate(async()=>{
 state.session={nickname:'Maronnix',token:'admin-test'};window.calls=[];window.failRefresh=false;window.injected=false;
 const title=id=>nominations.find(n=>n.id===id).title;
 window.resultFixture={votes:[
 ['flare-king','Maronnix','Awal'],['flare-king','Maronnix','Nodben'],['flare-king','Nodben','Maronnix'],['flare-king','Awal','Qusti'],
 ['multigaming','Maronnix','Rezo1n'],['squad-of-year','Akirakume, Dony_zq, Maronnix, Nodben','Qusti'],['squad-of-year','Akirakume, Nodben, Rezo1n','Awal'],['squad-of-year','Eozik, Flourin, Maronnix','Maronnix'],
 ['conflict-of-year','Akirakume, Dony_zq, Nodben vs Maronnix','Izumrudik'],['meme-of-year','Maronnix_extra','Balabol'],
 ['shame-of-year','<img src=x onerror="window.injected=true">ОченьДлинноеНазваниеБезПробелов1234567890','ОченьДлинныйНикнеймБезПробелов1234567890']
 ].map(([id,option_name,nickname])=>({nomination_title:title(id),option_name,nickname})),event_preferences:[],accounts_closed:false,test_ballot:{exists:false},statistics:{registered_nicknames:['Maronnix','Awal'],voted_nicknames:['Maronnix'],not_voted_nicknames:[],partially_voted_nicknames:[]}};
 window.originalFixture=JSON.stringify(resultFixture);
 rpc=async(name,args)=>{calls.push({name,args});if(name==='admin_summary'){if(failRefresh)throw Error('Тестовая ошибка');return JSON.parse(JSON.stringify(resultFixture));}if(name==='admin_get_member_socials')return [];if(name==='get_video_options')return [];throw Error('Unexpected RPC '+name)};
 await showAdmin();
});await page.waitForSelector('#admin-result-filters');}
const select=async(id,value)=>{await page.select(id,value)};
const search=async value=>{await page.$eval('#admin-filter-query',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},value)};
for(const width of [1360,1000,768,390,320]){
 await page.setViewport({width,height:900});await open();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.$$eval('.admin-result-card',es=>es.length),18);
 await page.screenshot({path:`/tmp/admin-results-overview-${width}.png`});
 await select('#admin-filter-voter','Maronnix');assert.equal(await page.$$eval('.admin-result-ballot-row',es=>es.length),18);assert.equal(await page.$$eval('.admin-result-ballot-row>.is-empty',es=>es.length),16);
 assert((await page.$eval('[data-result-nomination="flare-king"]',e=>e.textContent)).includes('Nodben'));assert((await page.$eval('[data-result-nomination="squad-of-year"]',e=>e.textContent)).includes('Eozik, Flourin, Maronnix'));
 await page.screenshot({path:`/tmp/admin-results-ballot-${width}.png`});
 await select('#admin-filter-voter','');await select('#admin-filter-recipient','Maronnix');assert.equal(await page.$$eval('.admin-result-card',es=>es.length),4);assert.equal(await page.$$eval('.admin-rank-row',es=>es.length),5);
 await page.click('#admin-filter-groups');assert.equal(await page.$$eval('.admin-result-card',es=>es.length),2);assert.equal(await page.$$eval('.admin-rank-row',es=>es.length),2);await page.click('#admin-filter-groups');
 await select('#admin-filter-nomination','flare-king');assert.equal(await page.$$eval('.admin-result-card',es=>es.length),1);assert.equal(await page.$$eval('.admin-voter-list>div>span',es=>es.length),2);
 await select('#admin-filter-voter','Awal');assert.equal(await page.$$eval('.admin-voter-list>div>span',es=>es.length),1);
 await select('#admin-filter-voter','Qusti');assert(await page.$('.admin-result-empty'));
 await page.click('#admin-results-reset');assert.equal(await page.$$eval('.admin-result-card',es=>es.length),18);
 await search('ОченьДлинное');assert.equal(await page.$$eval('.admin-result-card',es=>es.length),1);assert.equal(await page.$('#admin-result-output img'),null);assert.equal(await page.evaluate(()=>injected),false);
 const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,modal:document.querySelector('.admin-modal').scrollWidth>document.querySelector('.admin-modal').clientWidth,rows:[...document.querySelectorAll('.admin-rank-row,.admin-result-card,.admin-result-filters')].some(e=>e.scrollWidth>e.clientWidth+1),overlap:[...document.querySelectorAll('.admin-rank-row')].some(e=>{const name=e.querySelector('.admin-rank-candidate').getBoundingClientRect(),count=e.querySelector('.admin-rank-count').getBoundingClientRect();return name.top<count.bottom&&count.top<name.bottom&&name.right>count.left+1})}));assert.deepEqual(overflow,{page:false,modal:false,rows:false,overlap:false});
 await page.screenshot({path:`/tmp/admin-results-long-names-${width}.png`});
 await page.click('#admin-results-reset');await select('#admin-filter-recipient','Maronnix');await page.screenshot({path:`/tmp/admin-results-recipient-${width}.png`});
 await page.click('#admin-results-refresh');await page.waitForFunction(()=>!document.querySelector('#admin-results-refresh').disabled);assert.equal(await page.$eval('#admin-filter-recipient',e=>e.value),'Maronnix');
 assert.equal(await page.evaluate(()=>JSON.stringify(resultFixture)===originalFixture),true);
 await page.evaluate(()=>{failRefresh=true});const count=await page.$$eval('.admin-rank-row',es=>es.length);await page.click('#admin-results-refresh');await page.waitForFunction(()=>!document.querySelector('#admin-results-error').hidden);assert.equal(await page.$$eval('.admin-rank-row',es=>es.length),count);assert.equal(await page.$eval('#admin-results-refresh',e=>e.disabled),false);
 await page.evaluate(()=>{failRefresh=false;resultFixture.votes[3].option_name='Maronnix'});await page.click('#admin-results-refresh');await page.waitForFunction(()=>document.querySelector('#admin-results-error').hidden&&!document.querySelector('#admin-results-refresh').disabled);assert((await page.$eval('#admin-result-summary',e=>e.textContent)).includes('7'));
 assert.equal(await page.evaluate(()=>calls.some(c=>/save|update|delete|set_/.test(c.name))),false);
 console.log('PASS overview, individual ballot, votes for person/groups/exact mode, combined filters/search/reset, long names/XSS/no overlap, readonly refresh/error/retry',width);
}
for(const width of [1360,768,390,320]){
 await page.setViewport({width,height:900});await open();
 await page.evaluate(()=>{const title=nominations.find(n=>n.id==='flare-king').title;resultFixture.votes=['Akirakume','Awal','Balabol','Cloury','Dony_zq','Eozik','Flourin','Izumrudik','Nodben','Rezo1n'].map((nickname,i)=>({nomination_title:title,option_name:i<4?'Maronnix':i<7?'Nodben':i<9?'Awal':'Qusti',nickname}))});
 await page.click('#admin-results-refresh');await page.waitForFunction(()=>!document.querySelector('#admin-results-refresh').disabled);
 const rows='.admin-result-card[data-result-nomination="flare-king"] .admin-rank-row';
 assert.deepEqual(await page.$$eval(rows,es=>es.map(e=>e.dataset.rank)),['1','2','3','4']);
 const palette=await page.$$eval(rows,es=>es.map(e=>({bg:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderLeftColor,text:getComputedStyle(e.querySelector('.admin-rank-candidate>strong')).color})));
 assert.equal(new Set(palette.slice(0,3).map(x=>x.bg)).size,3);assert.equal(new Set(palette.slice(0,3).map(x=>x.border)).size,3);assert.equal(new Set(palette.slice(0,3).map(x=>x.text)).size,3);
 await page.$eval('.admin-result-card[data-result-nomination="flare-king"]',e=>e.open=true);await (await page.$('.admin-result-card[data-result-nomination="flare-king"]')).screenshot({path:`/tmp/admin-results-podium-${width}.png`});
 await select('#admin-filter-recipient','Awal');assert.equal(await page.$eval('.admin-rank-row',e=>e.dataset.rank),'3');assert(await page.$('.admin-rank-row.is-third'));assert.notEqual(await page.$eval('.admin-rank-badge',e=>getComputedStyle(e).display),'none');
 await select('#admin-filter-voter','Nodben');assert.equal(await page.$eval('.admin-rank-row',e=>e.dataset.rank),'3');assert.equal(await page.$eval('.admin-rank-count small',e=>e.textContent),'из 2 всего');
 await (await page.$('.admin-result-card')).screenshot({path:`/tmp/admin-results-filtered-rank-${width}.png`});
 await select('#admin-filter-recipient','');await select('#admin-filter-voter','Eozik');assert.equal(await page.$eval('[data-result-nomination="flare-king"] .admin-ballot-standing',e=>e.dataset.rank),'2');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.admin-modal').scrollWidth>document.querySelector('.admin-modal').clientWidth),false);
 console.log('PASS readable podium palette and actual global places 1–4, third place retained under recipient/voter filters, overall totals and ballot place',width);
}
for(const width of [1360,768,390,320]){
 await page.setViewport({width,height:900});await open();
 await page.evaluate(()=>{const defs=[['flare-king',[4,4,2,2,2]],['multigaming',[6,4,4]],['squad-of-year',[6,5,3,3,3]],['conflict-of-year',[7,6,5,2,2,2]],['shame-of-year',[7,6,5,4,2,2,2]]];resultFixture.votes=defs.flatMap(([id,counts])=>counts.flatMap((count,i)=>Array.from({length:count},(_,v)=>({nomination_title:nominations.find(n=>n.id===id).title,option_name:i===0?'Maronnix':i===1?'Nodben':i===2?'<img src=x onerror="window.injected=true">ОченьДлинноеИмяБезПробелов1234567890':'Кандидат '+i,nickname:id+'-'+i+'-'+v}))));});
 await page.$eval('#admin-results-refresh',e=>e.click());await page.waitForFunction(()=>!document.querySelector('#admin-results-refresh').disabled);
 assert.equal(await page.$$eval('.admin-issue',es=>es.length),3);assert.equal(await page.$$eval('.admin-issue-tie',es=>es.length),4);assert.equal(await page.$eval('.admin-issues-count',e=>e.textContent),'3 номинации');
 const toggle=await page.$('.admin-result-issues>summary');await toggle.focus();await page.keyboard.press('Enter');assert.equal(await page.$eval('.admin-result-issues',e=>e.open),true);
 await select('#admin-filter-voter','Maronnix');await select('#admin-filter-recipient','Nodben');await search('Не существующий результат');assert.equal(await page.$$eval('.admin-issue',es=>es.length),3);assert.equal(await page.$eval('.admin-result-issues',e=>e.open),true);
 await (await page.$('.admin-result-issues')).screenshot({path:`/tmp/admin-results-issues-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.admin-modal').scrollWidth>document.querySelector('.admin-modal').clientWidth),false);assert.equal(await page.evaluate(()=>window.injected),false);
 await page.$eval('[data-issue-open="squad-of-year"]',e=>e.click());assert.equal(await page.$eval('#admin-filter-voter',e=>e.value),'');assert.equal(await page.$eval('#admin-filter-recipient',e=>e.value),'');assert.equal(await page.$eval('#admin-filter-query',e=>e.value),'');assert.equal(await page.$eval('#admin-filter-nomination',e=>e.value),'squad-of-year');assert.equal(await page.$eval('.admin-result-card',e=>e.open),true);assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('.admin-result-card>summary')),true);
 await page.evaluate(()=>{resultFixture.votes=[];failRefresh=true});await page.$eval('#admin-results-refresh',e=>e.click());await page.waitForFunction(()=>!document.querySelector('#admin-results-refresh').disabled);assert.equal(await page.$$eval('.admin-issue',es=>es.length),3);
 await page.evaluate(()=>failRefresh=false);await page.$eval('#admin-results-refresh',e=>e.click());await page.waitForFunction(()=>!document.querySelector('#admin-results-refresh').disabled);assert.equal(await page.$$eval('.admin-issue',es=>es.length),0);assert.equal(await page.$eval('.admin-issues-count',e=>e.textContent),'Всё спокойно');assert.equal(await page.$eval('.admin-result-issues',e=>e.open),true);assert.equal(await page.$eval('#admin-filter-nomination',e=>e.value),'squad-of-year');
 assert.equal(await page.evaluate(()=>calls.some(c=>!['admin_summary','admin_get_member_socials','get_video_options'].includes(c.name))),false);
 console.log('PASS compact tie audit, full-vote scope, allowed pairs, multiple ties, XSS/overflow, keyboard, jump/reset/focus, refresh/error/empty state',width);
}
await open();
await page.$eval('#admin-results-reset',e=>e.click());const first=await page.$('.admin-result-card>summary');const wasOpen=await page.$eval('.admin-result-card',e=>e.open);await first.focus();await page.keyboard.press('Space');assert.equal(await page.$eval('.admin-result-card',e=>e.open),!wasOpen);
await page.focus('#admin-filter-query');await page.type('#admin-filter-query','Maronnix');assert.equal(await page.evaluate(()=>document.activeElement.id),'admin-filter-query');await page.keyboard.press('Enter');assert(await page.$('#admin-result-filters'));
await page.evaluate(()=>{window.oldRpc=rpc;rpc=(name,args)=>name==='admin_summary'?new Promise(resolve=>{window.finishOldRequest=resolve}):oldRpc(name,args)});await page.$eval('#admin-results-refresh',e=>e.click());await page.waitForFunction(()=>typeof window.finishOldRequest==='function');await page.evaluate(()=>{openModal('<h2 id="new-view-marker">Другой экран</h2>','auth-modal');finishOldRequest(resultFixture)});await new Promise(r=>setTimeout(r,30));assert(await page.$('#new-view-marker'));assert.equal(await page.$('#admin-result-filters'),null);
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
