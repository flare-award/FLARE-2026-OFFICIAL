/* Opt-in Liquid Glass. Backdrop pixels are displaced; text/images are never filtered.
   Device-local preference only. No account, vote or game-state writes. */
(()=>{
 'use strict';
 function buildProfile({ior=1.5,bezelPx,thickness=20,samples=128}){
  const eta=1/ior,f=t=>Math.pow(1-Math.pow(1-t,4),.25),out=[];
  for(let i=0;i<samples;i++){
   const t=i/(samples-1),dt=1e-4,slope=(f(Math.min(t+dt,1))-f(Math.max(t-dt,0)))/(2*dt);
   const len=Math.hypot(slope,1),nx=-slope/len,nz=1/len,dot=-nz,k=1-eta*eta*(1-dot*dot);
   if(k<0){out.push(0);continue;}
   const a=eta*dot+Math.sqrt(k),rx=-a*nx,rz=-eta-a*nz;
   out.push(rx*(f(t)*bezelPx+thickness)/-rz);
  }
  return out;
 }
 function makeDisplacementMap(w,h,radius,bezel){
  const profile=buildProfile({bezelPx:bezel,thickness:Math.min(24,h*.32)}),maxD=Math.max(...profile.map(Math.abs))||1;
  // Bounded, CSS-pixel maps: never allocate a full-screen/DPR-sized canvas.
  const ratio=Math.min(1,640/Math.max(w,h)),cw=Math.max(1,Math.round(w*ratio)),ch=Math.max(1,Math.round(h*ratio));
  const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const img=ctx.createImageData(cw,ch);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
   const px=(x+.5)*w/cw-w/2,py=(y+.5)*h/ch-h/2,qx=Math.abs(px)-(w/2-radius),qy=Math.abs(py)-(h/2-radius);
   const outside=Math.hypot(Math.max(qx,0),Math.max(qy,0)),d=-(outside+Math.min(Math.max(qx,qy),0)-radius);
   let dx=0,dy=0;
   if(d>=0&&d<bezel){
    const m=profile[Math.min(profile.length-1,Math.floor(d/bezel*(profile.length-1)))]/maxD;
    let gx,gy;
    if(qx>0&&qy>0){gx=Math.sign(px)*qx/outside;gy=Math.sign(py)*qy/outside;}
    else if(qx>qy){gx=Math.sign(px);gy=0;}else{gx=0;gy=Math.sign(py);}
    dx=-gx*m;dy=-gy*m;
   }
   const i=(y*cw+x)*4;img.data[i]=128+dx*127;img.data[i+1]=128+dy*127;img.data[i+2]=128;img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  // feDisplacementMap uses (channel - .5) * scale: encode the full +/- displacement.
  return {url:canvas.toDataURL(),scale:2*maxD};
 }
 const key='flare-liquid-glass',root=document.documentElement,ns='http://www.w3.org/2000/svg';
 const read=()=>{try{return localStorage.getItem(key)==='1'}catch{return false}};
 const media=query=>window.matchMedia?.(query),motion=media('(prefers-reduced-motion: reduce)'),transparency=media('(prefers-reduced-transparency: reduce)'),forced=media('(forced-colors: active)');
 const ua=navigator.userAgent||'',brands=navigator.userAgentData?.brands||[];
 const chromium=!/iPad|iPhone|iPod/.test(ua)&&(brands.some(b=>/Chromium|Google Chrome|Microsoft Edge/.test(b.brand))||/\b(?:HeadlessChrome|Chrome|Chromium|Edg|OPR)\//.test(ua));
 const surfaces='.topbar,.modal,.boing-tabs,.boing-shop-categories,.admin-tabs,.category-card,.winner-card,.poll-option,.faq-item,.nomination-tile,.nominee-card,.profile-stat,.profile-identity,.public-profile-bob-card,.profile-streak-record,.profile-site-theme,.boing-shop-item,.boing-leader-row,.admin-stat-card,.admin-stat-list-card,.admin-nomination-card,.admin-poll-row,.admin-rank-row,.admin-design-card,.admin-design-intro,.admin-design-sync,.profile-appearance-controls,.boing-header-balance,.toast,.nominee-view-menu,.nominee-social-menu,.profile-badge-tooltip';
 const controls='button,.profile-small-button,.profile-badge,.form-field input,.form-field select,.admin-wrap input,.admin-wrap select,.admin-wrap textarea,input[type="range"]';
 const groups='.boing-tabs,.boing-shop-categories,.admin-tabs,.profile-frame-options,.nominee-view-menu';
 const skip='.boing-arena,.bob-face-palette,.bob-face-brushes,.bob-face-canvas-shell,.admin-crop-stage';
 const tracked=new Map(),cache=new Map(),segments=new Map(),animations=new Set();
 let ready=false,observer=null,resize=null,svg=null,defs=null,veil=null,frame=0,timer=0,serial=0,lastPoint=null,lightFrame=0,lightTarget=null;
 const enabled=()=>root.dataset.theme==='liquid-glass';
 const noMotion=()=>Boolean(motion?.matches);
 const refracts=()=>chromium&&!transparency?.matches&&!forced?.matches;
 function animate(el,frames,options){
  if(noMotion()||!el.animate)return;
  const animation=el.animate(frames,options);animations.add(animation);animation.onfinish=animation.oncancel=()=>animations.delete(animation);return animation;
 }
 function element(name,attrs={}){const el=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));return el;}
 function ensureSVG(){
  if(svg)return;
  svg=element('svg',{'aria-hidden':'true','data-lg-filter-root':'',width:0,height:0});svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  defs=element('defs');svg.append(defs);document.body.append(svg);
 }
 function makeFilter(id,w,h,map){
  const filter=element('filter',{id,x:0,y:0,width:w,height:h,filterUnits:'userSpaceOnUse',primitiveUnits:'userSpaceOnUse','color-interpolation-filters':'sRGB'});
  filter.append(element('feImage',{href:map.url,x:0,y:0,width:w,height:h,result:'map'}));
  const matrices=['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0','0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0','0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'];
  ['R','G','B'].forEach((channel,i)=>{
   filter.append(element('feDisplacementMap',{in:'SourceGraphic',in2:'map',scale:map.scale*(1-i*.035),xChannelSelector:'R',yChannelSelector:'G',result:'d'+channel}));
   filter.append(element('feColorMatrix',{in:'d'+channel,type:'matrix',values:matrices[i],result:channel}));
  });
  filter.append(element('feBlend',{in:'R',in2:'G',mode:'screen',result:'RG'}),element('feBlend',{in:'RG',in2:'B',mode:'screen'}));return filter;
 }
 function clearFilter(el,item){
  item.filter?.remove();item.filter=null;item.size=null;el.classList.remove('lg--refract');el.style.removeProperty('--lg-filter');resize?.unobserve(el);
 }
 function release(el,item){for(const a of animations)if(a.effect?.target===el)a.cancel();clearFilter(el,item);item.optics?.remove();el.classList.remove('lg','lg--positioned','lg--control','lg--backdrop','lg--modal','lg--pressed','lg--clear');['--mx','--my','--lg-origin'].forEach(p=>el.style.removeProperty(p));tracked.delete(el);}
 function initGlass(el){
  if(tracked.has(el)||el.closest(skip)||el.matches('input[type="hidden"],input[type="file"],.pin-toggle,.profile-email-toggle'))return;
  const control=el.matches(controls),item={optics:null,filter:null,size:null};tracked.set(el,item);el.classList.add('lg');
  if(getComputedStyle(el).position==='static')el.classList.add('lg--positioned');
  if(control)el.classList.add('lg--control');
  // A separate clipped optical layer avoids stealing component pseudo-elements or clipping tooltips.
  if(!el.matches('input,select,textarea')){const optics=document.createElement('span');optics.className='lg__optics';optics.setAttribute('aria-hidden','true');el.prepend(optics);item.optics=optics;}
  if(el.matches('.modal')){
   el.classList.add('lg--modal');const rect=el.getBoundingClientRect();
   if(lastPoint)el.style.setProperty('--lg-origin',`${Math.max(0,Math.min(rect.width,lastPoint.x-rect.left))}px ${Math.max(0,Math.min(rect.height,lastPoint.y-rect.top))}px`);
   if(!el.classList.contains('boing-modal'))animate(el,[{transform:'scale(.94)'},{transform:'scale(1.008)',offset:.76},{transform:'scale(1)'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
  }
 }
 function updateFilters(){
  if(!enabled())return;
  root.classList.toggle('lg-refract-on',refracts());root.classList.toggle('lg-refract-off',!refracts());
  if(veil){const header=document.querySelector('.topbar'),rect=header?.getBoundingClientRect();if(rect){veil.style.top=(rect.bottom+1)+'px';veil.hidden=rect.bottom<=0||Number(getComputedStyle(header).opacity)<.1;}}
  let count=0;
  for(const [el,item] of tracked){
   if(!el.isConnected){release(el,item);continue;}
   const nested=Boolean(el.parentElement?.closest('.lg'));
   el.classList.toggle('lg--backdrop',!nested);
   const rect=el.getBoundingClientRect(),visible=rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth&&rect.width>0&&rect.height>0;
   const keySurface=el.matches('.topbar,.modal,.boing-tabs,.button,.boing-quick-entry,.account-button');
   if(nested||!visible||!keySurface||!refracts()||count>=8){if(item.filter)clearFilter(el,item);continue;}
   count++;
   const w=Math.round(el.offsetWidth),h=Math.round(el.offsetHeight);if(!w||!h)continue;
   const css=getComputedStyle(el),raw=parseFloat(css.borderTopLeftRadius)||0,r=Math.min(w/2,h/2,raw),bezel=Math.min(28,Math.max(6,h*.22),w/4,h/3),size=[w,h,r,bezel].join(':');
   if(item.size===size)continue;
   try{
    let map=cache.get(size);if(!map){map=makeDisplacementMap(w,h,r,bezel);if(!map)continue;cache.set(size,map);if(cache.size>16)cache.delete(cache.keys().next().value);}
    ensureSVG();item.filter?.remove();const id='flare-lg-'+(++serial);item.filter=makeFilter(id,w,h,map);defs.append(item.filter);item.size=size;
    el.style.setProperty('--lg-filter',`url("#${id}")`);el.classList.add('lg--refract');resize?.observe(el);
   }catch{clearFilter(el,item);/* Unsupported/blocked canvas remains the regular CSS variant. */}
  }
 }
 function syncSegments(){
  document.querySelectorAll(groups).forEach(group=>{
   const active=group.querySelector('button.is-active,button.is-selected,button[aria-pressed="true"],button[aria-selected="true"]');
   if(!active||!active.getClientRects().length)return;
   if(!group.classList.contains('lg-segment'))group.classList.add('lg-segment');
   let bubble=group.querySelector(':scope > .lg__bubble');if(!bubble){bubble=document.createElement('span');bubble.className='lg__bubble';bubble.setAttribute('aria-hidden','true');group.prepend(bubble);resize?.observe(group);}
   const g=group.getBoundingClientRect(),a=active.getBoundingClientRect(),next={left:a.left-g.left+group.scrollLeft,top:a.top-g.top+group.scrollTop,width:a.width,height:a.height};
   const name=group.className.replace(/\blg[-\w]*\b/g,'').trim(),old=segments.get(name);segments.set(name,next);
   if(old&&Object.keys(next).every(k=>Math.abs(next[k]-old[k])<.5))return;
   const frameFor=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v+'px']));Object.assign(bubble.style,frameFor(next));
   if(old)animate(bubble,[{...frameFor(old),transform:'scaleX(1)'},{...frameFor({left:(old.left+next.left)/2,top:(old.top+next.top)/2,width:(old.width+next.width)/2,height:next.height}),transform:'scaleX(1.18)',offset:.5},{...frameFor(next),transform:'scaleX(1)'}],{duration:500,easing:'cubic-bezier(.22,.8,.25,1)'});
  });
 }
 function refresh(){frame=0;if(!enabled()||!ready)return;document.querySelectorAll(surfaces+','+controls).forEach(initGlass);syncSegments();updateFilters();}
 function schedule(){if(enabled()&&ready&&!frame)frame=requestAnimationFrame(refresh);}
 function scheduleSizes(){clearTimeout(timer);timer=setTimeout(()=>{if(enabled()){syncSegments();updateFilters();}},90);}
 function stop(){
  observer?.disconnect();resize?.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(lightFrame);clearTimeout(timer);frame=lightFrame=0;
  for(const animation of animations)animation.cancel();animations.clear();
  for(const [el,item] of tracked)release(el,item);
  veil?.remove();veil=null;
  document.querySelectorAll('.lg__bubble').forEach(el=>el.remove());document.querySelectorAll('.lg-segment').forEach(el=>el.classList.remove('lg-segment'));
  svg?.remove();svg=defs=null;cache.clear();segments.clear();root.classList.remove('lg-refract-on','lg-refract-off');lightTarget=null;lastPoint=null;
 }
 function start(){
  if(!enabled()||!ready)return;
  if(!veil){veil=document.createElement('span');veil.className='lg-scroll-veil';veil.setAttribute('aria-hidden','true');document.body.append(veil);}
  if(!observer){observer=new MutationObserver(records=>{if(records.some(r=>(r.type==='attributes'&&!r.target.closest(skip))||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.matches('.lg__optics,.lg__bubble,[data-lg-filter-root],filter,defs'))))schedule();});resize=typeof ResizeObserver==='function'?new ResizeObserver(scheduleSizes):null;}
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-pressed','aria-selected','hidden']});schedule();
 }
 function apply(value){
  if(value)root.dataset.theme='liquid-glass';else delete root.dataset.theme;
  const chrome=document.querySelector('meta[name="theme-color"]');if(chrome)chrome.content=value?'#111827':'#010101';
  document.querySelectorAll('[data-liquid-glass-toggle]').forEach(button=>button.setAttribute('aria-checked',String(value)));
  document.querySelectorAll('[data-liquid-glass-status]').forEach(label=>{label.textContent=value?'Включена · в этом браузере':'Выключена';});
  if(ready){if(value)start();else stop();}
 }
 function point(event){
  if(!enabled())return;
  const el=event.target.closest?.('.lg');if(!el)return;
  const r=el.getBoundingClientRect();lightTarget={el,x:event.clientX-r.left,y:event.clientY-r.top};
  if(!lightFrame)lightFrame=requestAnimationFrame(()=>{lightFrame=0;if(lightTarget?.el.isConnected){lightTarget.el.style.setProperty('--mx',lightTarget.x+'px');lightTarget.el.style.setProperty('--my',lightTarget.y+'px');}});
 }
 document.addEventListener('pointermove',point,{passive:true});
 document.addEventListener('pointerdown',event=>{
  lastPoint={x:event.clientX,y:event.clientY};point(event);if(!enabled()||noMotion())return;
  const el=event.target.closest?.('.lg--control');if(el&&!el.disabled){el.classList.add('lg--pressed');}
 },{passive:true});
 const releasePress=()=>{document.querySelectorAll('.lg--pressed').forEach(el=>{el.classList.remove('lg--pressed');if(enabled())animate(el,[{scale:'1.045'},{scale:'.995',offset:.6},{scale:'1'}],{duration:480,easing:'cubic-bezier(.22,.8,.25,1)'});});};
 document.addEventListener('pointerup',releasePress,{passive:true});document.addEventListener('pointercancel',releasePress,{passive:true});window.addEventListener('blur',releasePress);
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-liquid-glass-toggle]');if(!button)return;
  const value=!enabled();apply(value);try{localStorage.setItem(key,value?'1':'0')}catch{const status=document.querySelector('[data-liquid-glass-status]');if(status)status.textContent='Применено до перезагрузки · сохранение недоступно';}
 });
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(read());});
 window.addEventListener('resize',scheduleSizes,{passive:true});window.addEventListener('scroll',scheduleSizes,{passive:true,capture:true});
 [motion,transparency,forced].forEach(m=>m?.addEventListener?.('change',()=>{if(noMotion()){for(const a of animations)a.cancel();releasePress();}schedule();}));
 apply(read());
 const boot=()=>{ready=true;if(enabled())start();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
