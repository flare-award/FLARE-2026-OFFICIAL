const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('admin-results.js','utf8').split('function mountAdminResults(')[0],ctx);
const catalog=[{id:'king',title:'KING'},{id:'squad',title:'SQUAD'}],rows=[{nomination_title:'KING',option_name:'Maronnix',nickname:'Awal'},{nomination_title:'KING',option_name:'Nodben',nickname:'Maronnix'},{nomination_title:'SQUAD',option_name:'Akirakume, Maronnix, Nodben',nickname:'Qusti'},{nomination_title:'SQUAD',option_name:'Maronnix_extra',nickname:'Awal'},{nomination_title:'OLD',option_name:'Maronnix',nickname:'Nodben'},null,{option_name:'bad'}];
const before=JSON.stringify(rows),model=ctx.adminResultModel({votes:rows},catalog),base={voter:'',recipient:'',nomination:'',query:'',groups:true};
assert.equal(model.votes.length,5);assert.equal(model.nominations.length,3);
assert.equal(ctx.adminResultFilter(model,{...base,recipient:'Maronnix'}).length,3);
assert.equal(ctx.adminResultFilter(model,{...base,recipient:'Maronnix',groups:false}).length,2);
assert.equal(ctx.adminResultFilter(model,{...base,voter:'Maronnix'}).length,1);
assert.equal(ctx.adminResultFilter(model,{...base,voter:'Maronnix',recipient:'Maronnix'}).length,0);
assert.equal(ctx.adminResultFilter(model,{...base,recipient:'Maronnix',nomination:'squad'}).length,1);
assert.equal(ctx.adminResultFilter(model,{...base,query:'  nodBEN  '}).length,3);
assert.equal(ctx.adminResultFilter(model,{...base,query:'<script>'}).length,0);
assert.equal(ctx.adminResultMatchesPerson('Akirakume, Dony_zq и Nodben','Dony_zq',true),true);
assert.equal(ctx.adminResultMatchesPerson('Maronnix_extra','Maronnix',true),false);
const rank=ctx.adminResultRanking([{option:'A',voter:'Awal'},{option:'B',voter:'Qusti'},{option:'A',voter:'Nodben'},{option:'B',voter:'Maronnix'},{option:'C',voter:'Rezo1n'}]);assert.equal(rank.map(r=>r.rank).join(','),'1,1,3');
assert.equal(ctx.adminResultModel({votes:[rows[0],{...rows[0],option_name:'Last'}]},catalog).votes.length,1);
assert.equal(JSON.stringify(rows),before);
console.log('PASS independent/combined filters, exact nickname tokens, groups toggle, archive votes, search, ties, duplicate guard and immutable source');

const rankModel=ctx.adminResultModel({votes:[...rows,{...rows[0],nickname:'Qusti'}]},catalog),standings=ctx.adminResultStandings(rankModel);assert.equal(standings.get('king').get('Nodben').rank,2);
const selected=ctx.adminResultFilter(model,{...base,voter:'Maronnix'});assert.equal(selected.length,1);assert.equal(standings.get(selected[0].nomination.id).get(selected[0].option).rank,2);
console.log('PASS global standing remains second place even when the selected ballot contains only that candidate');

// Competition ranks span occupied positions: 1,2,2,2,5, not dense 1,2,2,2,3.
function audit(counts){const votes=counts.flatMap((count,i)=>Array.from({length:count},(_,v)=>({nomination_title:'KING',option_name:'Candidate '+i,nickname:i+'-'+v})));return ctx.adminResultIssues(ctx.adminResultModel({votes},catalog));}
assert.equal(audit([]).length,0);assert.equal(audit([3]).length,0);
for(const counts of [[5,3,3],[5,2,2,2,1],[5,3,3,3],[5,4,2,2],[6,5,4,2,2],[6,5,4,3,2,2,2]])assert.equal(audit(counts).length,0);
for(const [counts,rank] of [[[3,3],1],[[5,3,3,3,3],2],[[5,4,2,2,2],3],[[6,5,4,2,2,2],4]]){const issue=audit(counts);assert.equal(issue.length,1);assert.equal(issue[0].ties[0].rank,rank);assert.equal(issue[0].ties[0].choices.length,rank===1?2:rank===2?4:3);}
assert.equal(audit([5,5,2,2,2])[0].ties.map(t=>t.rank).join(','),'1,3');
assert.equal(audit([5,5,5,2,2,2])[0].ties.map(t=>t.rank).join(','),'1,4');
assert.equal(JSON.stringify(rows),before);
console.log('PASS tie audit: all first-place ties, 4+ sharing second, 3+ sharing third/fourth, allowed pairs and top-four trio, skipped ranks, multiple issues and no zero-vote/low-ranking false positives');
