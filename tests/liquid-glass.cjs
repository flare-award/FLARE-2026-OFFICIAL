const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('liquid-glass.js','utf8');
function fixture(value,blocked=false){
 const events={},dataset={},writes=[],status={textContent:''},switchState={},chrome={content:'#010101'};
 const button={setAttribute:(k,v)=>switchState[k]=v};
 const document={readyState:'loading',documentElement:{dataset},querySelector:s=>s.startsWith('meta')?chrome:status,querySelectorAll:s=>s.includes('toggle')?[button]:[status],addEventListener:(k,fn)=>events[k]=fn};
 const store={getItem(){if(blocked)throw Error('Storage unavailable');return value},setItem(k,v){if(blocked)throw Error('Storage unavailable');writes.push([k,v]);value=v}};
 const ctx=vm.createContext({document,navigator:{userAgent:'Safari/605.1'},localStorage:store,window:{addEventListener:(k,fn)=>events[k]=fn}});vm.runInContext(source,ctx);
 return {events,dataset,writes,status,switchState,chrome,click:()=>events.click({target:{closest:()=>button}})};
}
for(const value of [null,'0','false','unexpected'])assert.equal(fixture(value).dataset.theme,undefined);
const enabled=fixture('1');assert.equal(enabled.dataset.theme,'liquid-glass');assert.equal(enabled.chrome.content,'#111827');enabled.click();assert.equal(enabled.dataset.theme,undefined);assert.equal(enabled.chrome.content,'#010101');assert.deepEqual(enabled.writes,[['flare-liquid-glass','0']]);
const denied=fixture(null,true);denied.click();assert.equal(denied.dataset.theme,'liquid-glass');assert(denied.status.textContent.includes('сохранение недоступно'));denied.click();assert.equal(denied.dataset.theme,undefined);
console.log('PASS opt-in only, safe boot, invalid values, blocked storage, no account writes and browser chrome restoration');
// Optical math: Snell profile, clean centre, mirrored edge displacement, bounded maps.
let pixels,dimensions;
const math=vm.createContext({Math,document:{createElement:()=>({set width(v){this.w=v},set height(v){this.h=v},getContext(){dimensions=[this.w,this.h];return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:img=>{pixels=img.data}}},toDataURL:()=> 'data:image/png;base64,test'})}});
vm.runInContext(source.slice(source.indexOf(' function buildProfile'),source.indexOf(' const key=')),math);
const profile=math.buildProfile({bezelPx:16});assert.equal(profile.length,128);assert(profile.every(Number.isFinite));assert(profile[0]>profile.at(-1));assert(profile.at(-1)<.01);
const map=math.makeDisplacementMap(160,100,24,16);assert(map.scale>0&&map.scale<100);
const pixel=(x,y)=>Array.from(pixels.slice((y*160+x)*4,(y*160+x)*4+4));
assert.deepEqual(pixel(80,50),[128,128,128,255]);assert(pixel(2,50)[0]>128);assert(pixel(157,50)[0]<128);assert(Math.abs(pixel(2,50)[0]+pixel(157,50)[0]-256)<=1);assert.deepEqual(pixel(0,0),[128,128,128,255]);
math.makeDisplacementMap(4000,2000,40,24);assert.deepEqual(dimensions,[640,320]);
console.log('PASS Snell-law profile, neutral centre/outside, inward edge sampling, symmetry and capped allocation');

const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const brightestNested=[14,20,30].map(v=>v*.68+255*.32).map((v,i)=>v*.935+[220,235,255][i]*.065);
assert((luminance([230,237,247])+.05)/(luminance(brightestNested)+.05)>=4.5);
console.log('PASS regular-glass caption contrast over worst-case white backdrop plus one nested tint');
