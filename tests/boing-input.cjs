const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('profile.js','utf8'),ctx=vm.createContext({Set,Math});
vm.runInContext(src.slice(src.indexOf('function boingAutomationPattern'),src.indexOf('function acceptBobInput')),ctx);
const sequence=(n,gap,jitter=()=>0)=>Array.from({length:n},(_,i)=>({n:i+1,t:1700000000000+i*gap+jitter(i)}));
for(const samples of [sequence(63,2),sequence(80,120,i=>Math.sin(i)*7),sequence(80,60,i=>Math.cos(i)*3),sequence(80,100),sequence(80,200),sequence(80,1000,i=>Math.sin(i)*.1),sequence(80,100,i=>i>45?5000:0)])assert.equal(ctx.boingAutomationPattern(samples),false);
assert.equal(ctx.boingAutomationPattern(sequence(64,8)),true);
assert.equal(ctx.boingAutomationPattern(sequence(80,80,i=>[-.2,.1,.25,-.05][i%4])),true);
console.log('PASS: conservative automatic-series detection, human rhythms, short bursts, coarse clocks, slow clicks and pauses');
