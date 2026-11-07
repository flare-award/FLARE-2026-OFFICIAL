const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const seed=JSON.parse(fs.readFileSync('supabase/seeds/legacy_awards.json','utf8'));
const expected={Maronnix:7,Nodben:5,Flourin:4,Eozik:4,Dony_zq:3,Qusti:3,Rezo1n:3,Akirakume:2,Cloury:1};
assert.deepEqual(Object.keys(seed.awards).sort(),Object.keys(expected).sort());
const definitions=new Map(seed.badges.map(row=>[row[0],row]));
for(const [nick,awards] of Object.entries(seed.awards)){
 assert.equal(new Set(awards).size,awards.length);
 assert.equal(awards.reduce((sum,id)=>sum+Number(id.split('-').at(-1)),0),expected[nick]);
 for(const id of awards)assert(definitions.has(id));
}
assert.equal(Object.values(expected).reduce((a,b)=>a+b),32);
for(const nick of ['Maronnix','Nodben','Eozik','Akirakume'])assert(seed.awards[nick].includes('conflict-1'));
assert(seed.awards.Flourin.includes('conflict-2'));
for(const [nicks,id] of [[['Nodben','Dony_zq'],'duo-1'],[['Eozik','Maronnix'],'track-1'],[['Flourin','Nodben'],'fail-1']])for(const nick of nicks)assert(seed.awards[nick].includes(id));
const src=fs.readFileSync('profile.js','utf8'),a=src.indexOf('function profileBadgeIcon('),b=src.indexOf('const profileBadgeRarityRank',a),ctx=vm.createContext({});vm.runInContext(src.slice(a,b),ctx);
const icons=new Set();for(const [id] of seed.badges){const svg=ctx.profileBadgeIcon('legacy-'+id);assert(svg.startsWith('<svg'));assert(!svg.includes('undefined'));icons.add(svg)}assert.equal(icons.size,18);
for(const [id,,description,rarity] of seed.badges){assert(description.length>=65&&description.length<=180);assert.equal(rarity,id.endsWith('-2')?'legendary':'rare')}
console.log('PASS: all 9 winners, 32 wins, shared awards, repeated-win tiers, 18 category SVGs and concise descriptions');

for(const id of ['legacy-king-2','legacy-multigaming-2'])assert(!ctx.profileBadgeIcon(id).includes('M3 2h2m14 0h2'));
