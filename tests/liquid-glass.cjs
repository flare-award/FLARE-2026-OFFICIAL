const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('liquid-glass.js','utf8');
function fixture(value,blocked=false){
 const events={},dataset={},writes=[],status={textContent:''},switchState={},chrome={content:'#010101'};
 const button={setAttribute:(k,v)=>switchState[k]=v};
 const document={documentElement:{dataset},querySelector:s=>s.startsWith('meta')?chrome:status,querySelectorAll:s=>s.includes('toggle')?[button]:[status],addEventListener:(k,fn)=>events[k]=fn};
 const store={getItem(){if(blocked)throw Error('Storage unavailable');return value},setItem(k,v){if(blocked)throw Error('Storage unavailable');writes.push([k,v]);value=v}};
 const ctx=vm.createContext({document,localStorage:store,window:{addEventListener:(k,fn)=>events[k]=fn}});vm.runInContext(source,ctx);
 return {events,dataset,writes,status,switchState,chrome,click:()=>events.click({target:{closest:()=>button}})};
}
for(const value of [null,'0','false','unexpected'])assert.equal(fixture(value).dataset.theme,undefined);
const enabled=fixture('1');assert.equal(enabled.dataset.theme,'liquid-glass');assert.equal(enabled.chrome.content,'#101c30');enabled.click();assert.equal(enabled.dataset.theme,undefined);assert.equal(enabled.chrome.content,'#010101');assert.deepEqual(enabled.writes,[['flare-liquid-glass','0']]);
const denied=fixture(null,true);denied.click();assert.equal(denied.dataset.theme,'liquid-glass');assert(denied.status.textContent.includes('сохранение недоступно'));denied.click();assert.equal(denied.dataset.theme,undefined);
console.log('PASS opt-in only, safe boot, invalid values, blocked storage, no account writes and browser chrome restoration');
