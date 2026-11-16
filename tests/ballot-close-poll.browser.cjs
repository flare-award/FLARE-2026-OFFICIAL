// Browser regression: nomination voting is read-only after close; ceremony-date poll remains independent.
// Uses external puppeteer-core@24.31.0 + @sparticuz/chromium@143.0.4 via NODE_PATH.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),p=require('puppeteer-core'),C=require('@sparticuz/chromium');
const app=fs.readFileSync('app.js','utf8'),schema=fs.readFileSync('supabase/schema.sql','utf8'),migration=fs.readFileSync('supabase/migrations/20261109_close_nomination_ballot_keep_event_poll.sql','utf8');
assert.match(app,/const closing=new Date\('2026-10-23T00:00:00Z'\)/);
assert.match(schema,/select now\(\) >= timestamptz '2026-10-23 00:00:00\+00'/);
assert.match(schema,/if flare_closed\(\) then raise exception 'Голосование завершено\. Голоса больше нельзя изменить\.'/);
assert.match(schema,/if flare_event_poll_closed\(\) then raise exception 'Опрос даты премии закрыт\.'/);
assert.match(migration,/interval '2 days'/);
assert.match(app,/data-event-choice="\$\{id\}" \$\{pollClosed\?'disabled':''\}/);
assert.match(app,/if\(!state\.session\|\|!state\.eventChoice\|\|isEventPollClosed\(\)/);

(async()=>{
 const dir=path.dirname(require.resolve('@sparticuz/chromium'));
 await require(path.join(dir,'lambdafs.cjs')).inflate(path.join(dir,'../../bin/al2023.tar.br'));
 require(path.join(dir,'helper.cjs')).setupLambdaEnvironment('/tmp/al2023/lib');
 const browser=await p.launch({executablePath:await C.executablePath(),args:C.args,headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const u=new URL(r.url());
   if(u.origin==='http://flare.test'){
    try{
     const f=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname),ext=path.extname(f);
     return r.respond({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream',body:fs.readFileSync(f)});
    }catch{return r.respond({status:404,body:''})}
   }
   r.abort();
  });
  await page.goto('http://flare.test/',{waitUntil:'load'});
  const result=await page.evaluate(async()=>{
   const calls=[];
   rpc=async(name,args={})=>{
    calls.push({name,args});
    if(name==='get_event_poll_winner')return {closed:false,choice_ids:['dec-4'],closes_at:'2026-12-02T00:00:00+03:00'};
    if(name==='save_event_choice')return {ok:true,event_poll_closed:false,event_results:{total:11,counts:{'dec-4':6,'dec-5':4,'dec-6':1}}};
    if(name==='get_my_ballot')return {votes:{},event_choice:'dec-4',event_results:{total:11,counts:{'dec-4':7,'dec-5':3,'dec-6':1}}};
    return {};
   };
   state.session={nickname:'Maronnix',token:'mock-token',is_test_account:false};
   const nomination=nominations.find(n=>n.id==='flare-king'),choice=nomination.nominees.find(n=>n.name==='Akirakume');
   state.votes={[nomination.id]:choice.id};
   publicEventPollWinnerResolved=false;publicEventPollWinner=null;publicEventPollWinnerRequest=null;
   await loadPublicEventPollWinner({force:true});
   const closed=isClosed();
   renderNominations({fromHistory:true});
   const tile=document.querySelector('[data-open-nomination="flare-king"]');
   showNomination('flare-king',{fromHistory:true});
   const selected=document.querySelector(`[data-nominee="${choice.id}"]`);
   const ballotView={
    ballotClosed:closed,
    categoryTileEnabled:tile&&!tile.disabled,
    savedChoiceHighlighted:selected?.classList.contains('saved'),
    savedChoiceDisabled:selected?.disabled,
    voteActionDisabled:document.querySelector('#cast-vote')?.disabled,
    readOnlyMessage:document.querySelector('.vote-message')?.textContent.includes('только для просмотра')
   };
   state.eventSaved='dec-4';state.eventChoice='dec-4';state.eventResults={total:11,counts:{'dec-4':7,'dec-5':3,'dec-6':1}};
   renderEventOptions();
   const pollEnabledBefore=[...document.querySelectorAll('[data-event-choice]')].every(button=>!button.disabled);
   state.eventChoice='dec-5';state.eventChoiceRevision++;
   await saveEvent();
   await loadPublicEventPollWinner({force:true});
   const pollSaved=state.eventSaved==='dec-5'&&calls.some(call=>call.name==='save_event_choice'&&call.args.p_choice_id==='dec-5');
   publicEventPollWinner.closed=true;renderEventOptions();
   const pollDisabledAfter=[...document.querySelectorAll('[data-event-choice]')].every(button=>button.disabled);
   return {ballotView,pollEnabledBefore,pollSaved,pollDisabledAfter};
  });
  assert.deepEqual(result.ballotView,{ballotClosed:true,categoryTileEnabled:true,savedChoiceHighlighted:true,savedChoiceDisabled:true,voteActionDisabled:true,readOnlyMessage:true});
  assert.equal(result.pollEnabledBefore,true);
  assert.equal(result.pollSaved,true);
  assert.equal(result.pollDisabledAfter,true);
  assert.deepEqual(errors,[]);
  console.log('PASS: nomination categories remain browsable; saved choices are visible/read-only; date poll can still be changed and disables independently after its close.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
