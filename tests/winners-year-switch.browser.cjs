// Browser regression for the archive-year selector and the nomination read-only notice.
// Uses external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');

(async()=>{
 const dir=path.dirname(require.resolve('@sparticuz/chromium'));
 await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));
 require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');
 const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  await page.evaluateOnNewDocument(()=>{
   const NativeDate=Date,fixed=NativeDate.parse('2026-10-23T00:00:01Z');
   class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}
   globalThis.Date=FixedDate;
  });
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.origin==='http://flare.test'){
    try{
     const file=path.join(process.cwd(),url.pathname==='/'?'index.html':url.pathname),ext=path.extname(file);
     return request.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(file)});
    }catch{return request.respond({status:404,body:''})}
   }
   request.abort();
  });
  await page.goto('http://flare.test/',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelectorAll('#winner-track .winner-card').length===18);
  await page.waitForFunction(()=>{const banner=document.querySelector('#deadline-banner');return banner&&!banner.hidden});

  const initial=await page.evaluate(()=>({
   year:state.winnerYear,
   count:document.querySelectorAll('#winner-track .winner-card').length,
   pressed:document.querySelector('[data-winner-year="2025"]').getAttribute('aria-pressed'),
   bannerText:document.querySelector('#deadline-banner').textContent.replace(/\s+/g,' ').trim(),
   bannerRadius:getComputedStyle(document.querySelector('#deadline-banner')).borderRadius,
   bannerLayout:getComputedStyle(document.querySelector('#deadline-banner')).display
  }));
  assert.equal(initial.year,2025);
  assert.equal(initial.count,18);
  assert.equal(initial.pressed,'true');
  assert.equal(initial.bannerText,'Голосование за номинации завершено. Голоса доступны только для просмотра.');
  assert.equal(initial.bannerRadius,'15px');
  assert.equal(initial.bannerLayout,'flex');

  await page.click('[data-winner-year="2024"]');
  await page.waitForFunction(()=>document.querySelectorAll('#winner-track .winner-card').length===8);
  const winners2024=await page.evaluate(()=>({
   year:state.winnerYear,
   pressed2024:document.querySelector('[data-winner-year="2024"]').getAttribute('aria-pressed'),
   pressed2025:document.querySelector('[data-winner-year="2025"]').getAttribute('aria-pressed'),
   cards:[...document.querySelectorAll('#winner-track .winner-card')].map(card=>[
    card.querySelector('.winner-title').textContent.trim(),
    card.querySelector('.winner-name').textContent.trim()
   ]),
   firstRank:document.querySelector('#winner-track .winner-icon').textContent.trim()
  }));
  assert.equal(winners2024.year,2024);
  assert.equal(winners2024.pressed2024,'true');
  assert.equal(winners2024.pressed2025,'false');
  assert.equal(winners2024.firstRank,'01');
  assert.deepEqual(winners2024.cards,[
   ['FLARE KING','Maronnix'],
   ['MULTIGAMING ГОДА','Maronnix'],
   ['ЛУЧШИЙ CS-УЧАСТНИК','Akirakume'],
   ['ЛУЧШИЙ FORTNITE-УЧАСТНИК','Dony_zq'],
   ['КИДАЛОВО ГОДА','Nodben'],
   ['КОНФЛИКТ ГОДА','Flourin'],
   ['ЧЕЛОВЕК-МЕМ ГОДА','Qusti'],
   ['ПРОРЫВ ГОДА','Eozik']
  ]);

  await page.click('[data-winner-year="2025"]');
  await page.waitForFunction(()=>document.querySelectorAll('#winner-track .winner-card').length===18);
  assert.equal(await page.evaluate(()=>state.winnerYear),2025);
  for(const width of [390,320]){
   await page.setViewport({width,height:844});
   await page.evaluate(()=>{
    document.documentElement.style.scrollBehavior='auto';
    const section=document.querySelector('.winners-section');
    window.scrollTo({top:section.getBoundingClientRect().top+window.scrollY,behavior:'instant'});
   });
   const layout=await page.evaluate(()=>{
    const wrap=document.querySelector('.winners-section .wrap').getBoundingClientRect();
    const selector=document.querySelector('.winner-year-switch').getBoundingClientRect();
    const banner=document.querySelector('#deadline-banner');
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,selectorLeft:selector.left,selectorRight:selector.right,wrapLeft:wrap.left,wrapRight:wrap.right,bannerOverflows:banner.scrollWidth>banner.clientWidth};
   });
   assert.equal(layout.documentWidth,width);
   assert(layout.selectorLeft>=layout.wrapLeft-1&&layout.selectorRight<=layout.wrapRight+1);
   assert.equal(layout.bannerOverflows,false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: rounded read-only notice, accessible year buttons, all eight 2024 winners, and return to 2025.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
