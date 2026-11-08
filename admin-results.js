/* Read-only exploration of the existing, server-authorized admin_summary payload. */
function adminResultModel(summary,catalog){
 const known=new Map(catalog.map(n=>[n.title,n])),byId=new Map(catalog.map(n=>[n.id,n])),extra=new Map(),unique=new Map();
 for(const row of Array.isArray(summary?.votes)?summary.votes:[]){
  if(!row||typeof row.nickname!=='string'||typeof row.option_name!=='string'||typeof row.nomination_title!=='string'||!row.nickname.trim()||!row.option_name.trim()||!row.nomination_title.trim())continue;
  let nomination=byId.get(row.nomination_id)||known.get(row.nomination_title);
  if(!nomination){if(!extra.has(row.nomination_title))extra.set(row.nomination_title,{id:'archive-'+extra.size,title:row.nomination_title,category:'архив',nominees:[]});nomination=extra.get(row.nomination_title);}
  const vote={nomination,option:row.option_name,voter:row.nickname};unique.set(nomination.id+'\0'+row.nickname,vote);
 }
 return {nominations:[...catalog,...extra.values()],votes:[...unique.values()]};
}
function adminResultMatchesPerson(option,person,includeGroups){
 const lower=s=>s.normalize('NFKC').toLocaleLowerCase('ru');
 return lower(option)===lower(person)||(includeGroups&&lower(option).split(/[^\p{L}\p{N}_]+/u).includes(lower(person)));
}
function adminResultFilter(model,filters){
 const q=filters.query.trim().toLocaleLowerCase('ru');
 return model.votes.filter(v=>(!filters.voter||v.voter===filters.voter)&&(!filters.recipient||adminResultMatchesPerson(v.option,filters.recipient,filters.groups))&&(!filters.nomination||v.nomination.id===filters.nomination)&&(!q||[v.option,v.voter,v.nomination.title].some(s=>s.toLocaleLowerCase('ru').includes(q))));
}
function adminResultRanking(votes){
 const choices=new Map();for(const vote of votes){if(!choices.has(vote.option))choices.set(vote.option,[]);choices.get(vote.option).push(vote.voter);}
 const ranked=[...choices].map(([name,voters])=>({name,voters:voters.sort((a,b)=>a.localeCompare(b,'ru')),count:voters.length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ru'));
 let rank=0,previous=null;ranked.forEach((choice,i)=>{if(choice.count!==previous)rank=i+1;choice.rank=rank;previous=choice.count;});return ranked;
}
function adminResultStandings(model){
 const byNomination=new Map();
 for(const nomination of model.nominations)byNomination.set(nomination.id,new Map(adminResultRanking(model.votes.filter(v=>v.nomination.id===nomination.id)).map(c=>[c.name,c])));
 return byNomination;
}
function mountAdminResults(host,initial){
 let summary=initial,model=adminResultModel(summary,nominations),revision=0,updated=new Date();
 const filters={voter:'',recipient:'',nomination:'',query:'',groups:true},expanded=new Set();
 host.innerHTML=`<div class="admin-results-heading"><div><h3>Результаты голосования</h3></div><button class="profile-small-button" id="admin-results-refresh" type="button">Обновить голоса</button></div><form class="admin-result-filters" id="admin-result-filters" aria-label="Фильтры результатов"><label><span>Кто голосовал</span><select id="admin-filter-voter"><option value="">Все участники</option></select></label><label><span>За кого голосовали</span><select id="admin-filter-recipient"><option value="">Все номинанты</option></select></label><label><span>Номинация</span><select id="admin-filter-nomination"><option value="">Все номинации</option></select></label><label><span>Поиск по голосам</span><input id="admin-filter-query" type="search" placeholder="Ник, состав или название" autocomplete="off" maxlength="200"></label><div class="admin-result-filter-footer"><label class="admin-result-checkbox"><input type="checkbox" id="admin-filter-groups" checked><span>Составы и противостояния</span></label><button class="admin-result-reset" id="admin-results-reset" type="button">Сбросить фильтры</button></div></form><p class="admin-result-error" id="admin-results-error" role="alert" hidden></p><div id="admin-result-summary" class="admin-result-summary" role="status" aria-live="polite"></div><div id="admin-result-output" aria-live="off"></div>`;
 const find=s=>host.querySelector(s),voter=find('#admin-filter-voter'),recipient=find('#admin-filter-recipient'),nomination=find('#admin-filter-nomination'),query=find('#admin-filter-query'),groups=find('#admin-filter-groups'),output=find('#admin-result-output'),status=find('#admin-result-summary'),reset=find('#admin-results-reset'),refresh=find('#admin-results-refresh'),error=find('#admin-results-error');
 const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
 function fillOptions(){
  const names=[...new Set([...MEMBERS,...(Array.isArray(summary.statistics?.registered_nicknames)?summary.statistics.registered_nicknames:[]),...model.votes.map(v=>v.voter)].filter(n=>typeof n==='string'))].sort((a,b)=>a.localeCompare(b,'ru'));
  const candidates=[...new Set([...MEMBERS,...nominations.flatMap(n=>n.nominees.filter(c=>c.type==='person').map(c=>c.name))])].sort((a,b)=>a.localeCompare(b,'ru'));
  voter.innerHTML=option('','Все участники')+names.map(n=>option(n,n)).join('');recipient.innerHTML=option('','Все номинанты')+candidates.map(n=>option(n,n)).join('');nomination.innerHTML=option('','Все номинации')+model.nominations.map(n=>option(n.id,n.title)).join('');
  for(const [control,key] of [[voter,'voter'],[recipient,'recipient'],[nomination,'nomination']]){if(filters[key]&&![...control.options].some(o=>o.value===filters[key]))control.insertAdjacentHTML('beforeend',option(filters[key],filters[key]));control.value=filters[key];}
 }
 function render(){
  const standings=adminResultStandings(model),votes=adminResultFilter(model,filters),active=Boolean(filters.voter||filters.recipient||filters.nomination||filters.query.trim()),ballot=Boolean(filters.voter&&!filters.recipient),nomCount=new Set(votes.map(v=>v.nomination.id)).size;
  status.innerHTML=`<span><strong>${votes.length}</strong><span>Голосов${active?' в выборке':''}</span></span><span><strong>${new Set(votes.map(v=>v.voter)).size}</strong><span>Участников</span></span><span><strong>${nomCount}<small> / ${model.nominations.length}</small></strong><span>Номинаций</span></span><small>${active?'Фильтры применены':'Все голоса'} · обновлено в ${updated.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</small>`;
  reset.disabled=!active&&filters.groups;groups.disabled=!filters.recipient;groups.closest('label').classList.toggle('is-muted',!filters.recipient);
  const selectedNoms=model.nominations.filter(n=>(!filters.nomination||n.id===filters.nomination));
  if(ballot){
   const rows=selectedNoms.filter(n=>!filters.query.trim()||votes.some(v=>v.nomination.id===n.id)||n.title.toLocaleLowerCase('ru').includes(filters.query.trim().toLocaleLowerCase('ru'))).map(n=>{const vote=votes.find(v=>v.nomination.id===n.id),standing=vote?standings.get(n.id)?.get(vote.option):null;return `<div class="admin-result-ballot-row" data-result-nomination="${esc(n.id)}"><span>${esc(n.title)}</span><strong class="${vote?'':'is-empty'}">${vote?esc(vote.option):'Ещё не выбрал'}</strong>${standing?`<span class="admin-ballot-standing" data-rank="${standing.rank}"><b>${standing.rank} место</b><small>${countLabel(standing.count,'голос','голоса','голосов')} всего</small></span>`:''}</div>`;}).join('');
   output.innerHTML=`<div class="admin-result-context"><h4>Выборы: ${esc(filters.voter)}</h4><p>Место выбранного номинанта — в общем рейтинге, по всем голосам.</p></div>${rows?`<div class="admin-result-ballot">${rows}</div>`:empty()}`;return;
  }
  const cards=selectedNoms.filter(n=>!active||votes.some(v=>v.nomination.id===n.id)).map(n=>{
   const rows=votes.filter(v=>v.nomination.id===n.id),ranked=adminResultRanking(rows).sort((a,b)=>standings.get(n.id).get(a.name).rank-standings.get(n.id).get(b.name).rank||a.name.localeCompare(b.name,'ru')),leaders=ranked.filter(c=>c.rank===1);
   const allVotes=model.votes.filter(v=>v.nomination.id===n.id).length;
   const details=ranked.map(choice=>{
    const standing=standings.get(n.id).get(choice.name),rank=standing.rank,tied=[...standings.get(n.id).values()].filter(c=>c.rank===rank).length>1;
    return `<div class="admin-rank-row ${rank===1?'is-winner':rank===2?'is-second':rank===3?'is-third':''}" data-rank="${rank}" data-option="${esc(choice.name)}"><span class="admin-rank-badge" aria-label="${rank} место${tied?', делит место':''}"><strong>${rank}</strong><small>место${tied?' · ничья':''}</small></span><div class="admin-rank-candidate"><strong>${esc(choice.name)}</strong><span class="admin-rank-track" aria-hidden="true"><i style="width:${allVotes?Math.round(standing.count/allVotes*100):0}%"></i></span></div><div class="admin-rank-count"><strong>${countLabel(choice.count,'голос','голоса','голосов')}</strong>${active&&choice.count!==standing.count?`<small>из ${standing.count} всего</small>`:''}</div><details class="admin-voter-list" ${active?'open':''}><summary>Проголосовали · ${choice.voters.length}</summary><div>${choice.voters.map(name=>`<span>${esc(name)}</span>`).join('')}</div></details></div>`;
   }).join('');
   return `<details class="admin-nomination-card admin-result-card ${active?'is-filtered':''}" data-result-nomination="${esc(n.id)}" ${active||expanded.has(n.id)?'open':''}><summary><div><span class="admin-nomination-category">${n.category==='основная'?'Основная':n.category==='архив'?'Архивная':'Дополнительная'}</span><h4>${esc(n.title)}</h4>${!active&&leaders.length?`<p class="admin-result-leader">${leaders.length>1?'Лидеры — ':'Лидер — '}${leaders.map(c=>esc(c.name)).join(' · ')}</p>`:''}</div><span class="admin-nomination-total">${countLabel(rows.length,'голос','голоса','голосов')}</span></summary><div class="admin-rankings">${details||'<p class="admin-no-votes">Пока нет голосов</p>'}</div></details>`;
  }).join('');
  output.innerHTML=`${filters.recipient?`<div class="admin-result-context"><h4>Голоса за: ${esc(filters.recipient)}</h4><p>${filters.groups?'Личные номинации, составы и противостояния. Места — по всем голосам.':'Только личные номинации. Места — по всем голосам.'}</p></div>`:active?'<p class="admin-result-rank-note">Места — в общем рейтинге номинации. Фильтры меняют только список голосов.</p>':''}${cards?`<div class="admin-nomination-results">${cards}</div>`:empty()}`;
  output.querySelectorAll('.admin-result-card').forEach(card=>card.addEventListener('toggle',()=>{if(!active){if(card.open)expanded.add(card.dataset.resultNomination);else expanded.delete(card.dataset.resultNomination);}}));
 }
 function empty(){return '<div class="admin-result-empty"><strong>Нет подходящих голосов</strong><p>Измени фильтры или сбрось их, чтобы увидеть все результаты.</p></div>';}
 find('form').addEventListener('submit',event=>event.preventDefault());
 for(const [control,key] of [[voter,'voter'],[recipient,'recipient'],[nomination,'nomination']])control.addEventListener('change',()=>{filters[key]=control.value;render();});
 query.addEventListener('input',()=>{filters.query=query.value;render();});groups.addEventListener('change',()=>{filters.groups=groups.checked;render();});
 reset.addEventListener('click',()=>{Object.assign(filters,{voter:'',recipient:'',nomination:'',query:'',groups:true});voter.value=recipient.value=nomination.value=query.value='';groups.checked=true;render();});
 refresh.addEventListener('click',async()=>{
  const current=++revision,token=state.session?.token;if(!token)return;
  refresh.disabled=true;refresh.textContent='Обновляю…';error.hidden=true;
  try{const latest=await rpc('admin_summary',{p_token:token});if(!host.isConnected||state.session?.token!==token||current!==revision)return;if(!latest||!Array.isArray(latest.votes))throw Error('Сервер не вернул список голосов.');summary=latest;model=adminResultModel(summary,nominations);updated=new Date();fillOptions();render();}
  catch(e){if(host.isConnected&&state.session?.token===token&&current===revision){error.textContent='Не удалось обновить голоса. Показаны ранее загруженные данные. '+(e.message||'Попробуй ещё раз.');error.hidden=false;}}
  finally{if(host.isConnected&&current===revision){refresh.disabled=false;refresh.textContent='Обновить голоса';}}
 });
 fillOptions();render();
}
