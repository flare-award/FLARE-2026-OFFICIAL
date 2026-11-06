// Run with: node tests/clip-self-vote.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function isSelfNominee('),end=source.indexOf('function showNomination(',start);
const context=vm.createContext({state:{session:{nickname:'Qusti'}}});
vm.runInContext(source.slice(start,end),context);
const cases=[['Qusti въебал все коины','Qusti',true],['Клип (QUSTI)!','qusti',true],['Qusti2 победил','Qusti',false],['NotQusti','Qusti',false],['Dony_zq — клип','Dony_zq',true],['Qusti и Eozik','Eozik',true],['Клип 03 · скоро','Qusti',false]];
for(const [name,nick,expected] of cases)assert.equal(context.isSelfNominee({id:'clip-of-year'},{name,type:'video'},nick),expected,name);
assert.equal(context.isSelfNominee({id:'event-of-year'},{name:'Qusti',type:'video'},'Qusti'),false);
assert.equal(context.isSelfNominee({id:'scam-of-year',allowSelf:true},{name:'Qusti',type:'person'},'Qusti'),false);
assert.equal(context.isSelfNominee({id:'flare-king'},{name:'Qusti',type:'person'},'qusti'),true);
assert.equal(context.isSelfNominee({id:'clip-of-year'},{name:'Qusti',type:'video'},''),false);
console.log('11 self-vote matching/regression checks passed');
