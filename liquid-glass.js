/* Optional device-local presentation preference; never changes profile/account data. */
(()=>{
 'use strict';
 const key='flare-liquid-glass',root=document.documentElement;
 const read=()=>{try{return localStorage.getItem(key)==='1'}catch{return false}};
 function apply(enabled){
  if(enabled)root.dataset.theme='liquid-glass';else delete root.dataset.theme;
  const chrome=document.querySelector('meta[name="theme-color"]');if(chrome)chrome.content=enabled?'#101c30':'#010101';
  document.querySelectorAll('[data-liquid-glass-toggle]').forEach(button=>button.setAttribute('aria-checked',String(enabled)));
  document.querySelectorAll('[data-liquid-glass-status]').forEach(label=>{label.textContent=enabled?'Включена · в этом браузере':'Выключена';});
 }
 apply(read());
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-liquid-glass-toggle]');if(!button)return;
  const enabled=root.dataset.theme!=='liquid-glass';apply(enabled);
  try{localStorage.setItem(key,enabled?'1':'0')}catch{
   const status=document.querySelector('[data-liquid-glass-status]');if(status)status.textContent='Применено до перезагрузки · сохранение недоступно';
  }
 });
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(read());});
})();
