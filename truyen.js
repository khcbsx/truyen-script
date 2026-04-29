(function(){
'use strict';

var SITE_CONFIGS = {
  'truyenfree.org': {
    type: 'spa', label: 'TruyenFree',
    nextText: ['Chương sau','Chuong sau'],
    nextSelectors: []
  },
  'truyenfull.vision': {
    type: 'html', label: 'TruyenFull',
    contentSelectors: ['#chapter-c','.chapter-c'],
    titleSelectors: ['h2.chapter-title','.chapter-title','h2','h1'],
    nextSelectors: ['a[title*="sau"]','a[title*="tiep"]','#next_chap','.next-chap'],
    nextText: ['Chương sau','Chương tiếp theo','Tiếp theo']
  },
  'tvtruyen.co.uk': {
    type: 'html', label: 'TvTruyen',
    contentSelectors: ['#chapter-content','.chapter-content','#content'],
    titleSelectors: ['.chapter-title','h2','h1'],
    nextSelectors: ['a.btn-chapter-nav','a.chapter-modal-next'],
    nextText: ['Chương tiếp','Tiếp theo']
  },
  'xtruyen.vn': {
    type: 'html', label: 'XTruyen',
    contentSelectors: ['.reading-content .text-left','.reading-content','.chapter-content','.entry-content','.text-left'],
    titleSelectors: ['h2','.chapter-name','.chapter-title','h1'],
    nextSelectors: ['a.btn.next_page','a.next_page'],
    nextText: ['Chương tiếp','Chương sau','Tiếp theo']
  }
};

var SUPPORTED = [
  {label:'TruyenFree', host:'truyenfree.org'},
  {label:'TruyenFull', host:'truyenfull.vision'},
  {label:'TvTruyen',   host:'tvtruyen.co.uk'},
  {label:'XTruyen',    host:'xtruyen.vn'}
];

var LS_KEY       = 'truyen_cex_v5';
var LS_STATE_KEY = 'truyen_cex_state_v5';

function getSite(){
  var host = location.hostname.replace('www.','');
  for(var k in SITE_CONFIGS){
    if(host.indexOf(k)>-1) return {key:k, cfg:SITE_CONFIGS[k]};
  }
  return {key:'unknown', cfg:{type:'html',label:'Unknown',contentSelectors:[],titleSelectors:['h1','h2'],nextSelectors:[],nextText:['Chương tiếp','Chương sau','Tiếp theo']}};
}

var site  = getSite();
var isSPA = site.cfg.type === 'spa';

// ── INTERCEPTOR (SPA only) ──────────────────────────────
if(isSPA && !window._truyen_origLog){
  window._truyen_origLog = console.log;
  console.log = function(){
    var a = Array.prototype.slice.call(arguments);
    var o = a[0];
    if(o && typeof o==='object' && typeof o.number==='number' && typeof o.name==='string' && typeof o.content==='string' && o.content.length>50)
      window._latestChapter = o;
    return window._truyen_origLog.apply(console, a);
  };
}

// ── HELPERS ────────────────────────────────────────────
function getNum(){
  var m = location.pathname.match(/chuong[-_](\d+)/i);
  return m ? parseInt(m[1],10) : 0;
}
function clean(s){
  return (s||'').replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\')
    .replace(/\\u([\dA-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));})
    .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function qText(sels){
  for(var i=0;i<sels.length;i++){
    try{var e=document.querySelector(sels[i]); if(e&&(e.innerText||'').trim()) return e.innerText.trim();}catch(x){}
  }
  return '';
}
function fallback(){
  var best='',bl=0;
  try{
    document.querySelectorAll('div,article,section').forEach(function(e){
      var ic=(e.id+' '+e.className).toLowerCase();
      if(/nav|header|footer|sidebar|menu|comment|advert|banner|widget/.test(ic)) return;
      var t=(e.innerText||'').trim();
      if(t.length>bl && e.children.length<100 && e.children.length>0){bl=t.length;best=t;}
    });
  }catch(x){}
  return clean(best);
}
function getChapter(){
  var num=getNum(), title='', content='';
  if(isSPA){
    var lc=window._latestChapter;
    if(lc&&lc.content&&lc.content.length>50)
      return {number:lc.number, title:lc.name||'Chuong '+lc.number, content:clean(lc.content)};
    content=fallback();
    title=qText(['h1','h2','.chapter-title'])||'Chuong '+num;
    return {number:num, title:title, content:content};
  }
  var cfg=site.cfg;
  for(var i=0;i<(cfg.contentSelectors||[]).length;i++){
    try{var e=document.querySelector(cfg.contentSelectors[i]); if(e&&(e.innerText||'').trim().length>200){content=clean(e.innerText);break;}}catch(x){}
  }
  if(!content||content.length<100) content=fallback();
  title=qText(cfg.titleSelectors||['h1','h2'])||'Chuong '+num;
  if(!num){var m2=title.match(/\d+/);if(m2)num=parseInt(m2[0],10);}
  return {number:num, title:title, content:content};
}
function clickNext(){
  var cfg=site.cfg, nextTexts=cfg.nextText||['Chương tiếp','Chương sau','Tiếp theo'];
  for(var i=0;i<(cfg.nextSelectors||[]).length;i++){
    try{
      var els=document.querySelectorAll(cfg.nextSelectors[i]);
      for(var j=0;j<els.length;j++){
        if(els[j]&&els[j].href&&!/(tr.*c|prev|truoc)/i.test(els[j].innerText+els[j].title)){
          els[j].click(); return true;
        }
      }
    }catch(x){}
  }
  var all=[].slice.call(document.querySelectorAll('a'));
  for(var a=0;a<all.length;a++){
    var t=(all[a].innerText||'').trim();
    for(var k=0;k<nextTexts.length;k++){
      if(t===nextTexts[k]||(t.length<60&&t.indexOf(nextTexts[k])===0)){all[a].click();return true;}
    }
  }
  return false;
}

// ── LOCALSTORAGE STATE ──────────────────────────────────
function saveState(col,s,e){
  if(isSPA) return;
  try{localStorage.setItem(LS_STATE_KEY,JSON.stringify({col:col,s:s,e:e,site:site.key,ts:Date.now()}));}catch(x){}
}
function loadState(){
  try{
    var r=localStorage.getItem(LS_STATE_KEY); if(!r) return null;
    var d=JSON.parse(r);
    if(!d||!d.col) return null;
    if(Date.now()-d.ts>4*3600*1000){localStorage.removeItem(LS_STATE_KEY);return null;}
    if(d.site&&d.site!==site.key) return null;
    return d;
  }catch(x){return null;}
}
function clearState(){ try{localStorage.removeItem(LS_STATE_KEY);}catch(x){} }

// ── GLOBAL STATE ────────────────────────────────────────
window._cex_stop=false;
window._cex_col=[];
window._cex_s=0;
window._cex_e=0;

// ── UI SAFE SETTERS ─────────────────────────────────────
function setStat(m){try{document.getElementById('cex_status').innerText=m;}catch(x){}}
function setProg(m){try{document.getElementById('cex_progress').innerText=m;}catch(x){}}
function setTA(v){try{document.getElementById('cex_ta').value=v;}catch(x){}}

// ── DOWNLOAD ────────────────────────────────────────────
function doDownload(col,s,e){
  if(!col||!col.length){setStat('Chua co chuong!');return;}
  var txt=col.map(function(c){return c.title+'\n\n'+c.content;}).join('\n\n');
  var slug=(location.pathname.split('/')[1]||location.pathname.split('/')[2]||'truyen').replace(/[^a-z0-9\-]/gi,'-').substring(0,40);
  var fname=slug+'_ch'+s+'-'+e+'.txt';
  var blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download=fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},5000);
  setStat('Da tai: '+fname+' ('+col.length+' chuong)');
  setProg(''); clearState();
}

// ── AUTO COLLECT ────────────────────────────────────────
function finish(){
  window._cex_stop=false;
  try{document.getElementById('cex_btn_start').disabled=false;}catch(x){}
  try{document.getElementById('cex_btn_stop').style.display='none';}catch(x){}
  doDownload(window._cex_col,window._cex_s,window._cex_e);
}

function waitSPA(prev,timeout,cb){
  var w=0;
  function chk(){
    var lc=(window._latestChapter&&window._latestChapter.number)||0;
    var un=getNum();
    if((lc&&lc!==prev)||(un&&un!==prev)){cb(true);return;}
    if(w>=timeout){cb(false);return;}
    w+=400; setTimeout(chk,400);
  }
  chk();
}

function autoCollect(last){
  if(window._cex_stop){finish();return;}
  var un=getNum(), ch=getChapter(), cur=ch.number||un;
  if(!cur||cur===last){setTimeout(function(){autoCollect(last);},1200);return;}

  if(cur>=window._cex_s&&cur<=window._cex_e){
    var dup=false;
    for(var i=0;i<window._cex_col.length;i++) if(window._cex_col[i].number===cur){dup=true;break;}
    if(!dup&&ch.content&&ch.content.length>50){
      window._cex_col.push({number:cur,title:ch.title,content:ch.content});
      window._cex_col.sort(function(a,b){return a.number-b.number;});
      saveState(window._cex_col,window._cex_s,window._cex_e);
      var tot=window._cex_e-window._cex_s+1;
      setProg(window._cex_col.length+'/'+tot+' | Chuong '+cur);
    }
  }

  if(cur>=window._cex_e){finish();return;}
  if(!clickNext()){setStat('Khong co nut chuong tiep!');finish();return;}
  setStat('Dang tai chuong '+(cur+1)+'...');

  if(isSPA){
    waitSPA(cur,10000,function(ok){
      if(!ok){setStat('Timeout!');finish();return;}
      setTimeout(function(){autoCollect(cur);},300);
    });
  }
  // HTML: trang reload → doResume() sẽ tiếp tục
}

// ── BUTTON HANDLERS ─────────────────────────────────────
window.cex_start=function(){
  var s=parseInt((document.getElementById('cex_inp_start')||{}).value,10);
  var e=parseInt((document.getElementById('cex_inp_end')||{}).value,10);
  if(!s||!e||isNaN(s)||isNaN(e)||s>e){setStat('So chuong khong hop le!');return;}
  if(e-s>500){setStat('Toi da 500 chuong!');return;}
  window._cex_s=s; window._cex_e=e; window._cex_col=[]; window._cex_stop=false;
  clearState();
  try{document.getElementById('cex_btn_start').disabled=true;}catch(x){}
  try{document.getElementById('cex_btn_stop').style.display='inline-block';}catch(x){}
  setProg(''); setStat('Bat dau: chuong '+s+' → '+e);
  autoCollect(getNum()-1);
};
window.cex_stop=function(){ window._cex_stop=true; setStat('Dang dung...'); };
window.cex_get=function(){
  var ch=getChapter();
  if(ch&&ch.content){setTA(ch.title+'\n\n'+ch.content);setStat('Chuong '+ch.number);}
  else setStat('Chua co noi dung!');
};
window.cex_copy=function(){
  var ta=document.getElementById('cex_ta');
  if(!ta||!ta.value){setStat('Khong co gi!');return;}
  ta.focus();ta.select();
  try{document.execCommand('copy');}catch(x){}
  if(navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function(){});
  setStat('Da copy!');
};

// ── BUILD UI ────────────────────────────────────────────
var old=document.getElementById('chapter_export_wrap');
if(old) old.remove();

var cur=getNum();
var W=document.createElement('div');
W.id='chapter_export_wrap';
W.style.cssText='position:fixed;left:12px;top:60px;width:520px;z-index:2147483647;background:#fff;border:2px solid #2c3e50;border-radius:8px;box-shadow:0 6px 28px rgba(0,0,0,.45);font-family:Arial,sans-serif;font-size:13px;';

// Header
var hdr=document.createElement('div');
hdr.style.cssText='background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;';
var htxt=document.createElement('b'); htxt.innerText='Trich xuat truyen tu dong'; hdr.appendChild(htxt);
var bX=document.createElement('button'); bX.innerHTML='&#x2715;';
bX.style.cssText='background:none;border:0;color:#fff;font-size:20px;cursor:pointer;';
bX.onclick=function(){W.remove();}; hdr.appendChild(bX); W.appendChild(hdr);

// Banner
var ban=document.createElement('div');
ban.style.cssText='background:#eaf4fb;border-bottom:1px solid #bee3f8;padding:7px 14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
var bl=document.createElement('span'); bl.style.cssText='font-size:11px;color:#2980b9;font-weight:bold;margin-right:4px;';
bl.innerText='Ho tro:'; ban.appendChild(bl);
SUPPORTED.forEach(function(s){
  var on=(site.key===s.host);
  var c=document.createElement('span');
  c.style.cssText='display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:bold;border:1px solid '+(on?'#27ae60':'#bbb')+';background:'+(on?'#27ae60':'#f0f0f0')+';color:'+(on?'#fff':'#666')+';white-space:nowrap;cursor:pointer;';
  c.innerText=(on?'✓ ':'')+s.label;
  c.title='Mo '+s.label+' - '+s.host;
  c.onclick=function(){ window.open('https://'+s.host,'_blank'); };
  c.onmouseenter=function(){ this.style.opacity='0.75'; };
  c.onmouseleave=function(){ this.style.opacity='1'; };
  ban.appendChild(c);
}); 
  W.appendChild(ban);

// Body
var body=document.createElement('div');
body.style.cssText='padding:12px;display:flex;flex-direction:column;gap:8px;';

var warn=document.createElement('div');
warn.style.cssText='background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:7px 10px;font-size:12px;color:#856404;';
warn.innerText='Vao dung chuong bat dau, nhap so chuong roi nhan Bat dau.';
body.appendChild(warn);

function mkB(html,bg,fn,id){
  var b=document.createElement('button'); b.innerHTML=html;
  b.style.cssText='padding:5px 12px;background:'+bg+';color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;white-space:nowrap;';
  if(fn) b.onclick=fn; if(id) b.id=id; return b;
}
function mkI(id,v){
  var i=document.createElement('input'); i.type='number'; i.id=id; i.value=v;
  i.style.cssText='width:75px;padding:4px 6px;border:1px solid #aaa;border-radius:4px;font-size:13px;color:#000;background:#fff;'; return i;
}
function mkL(t){ var b=document.createElement('b'); b.innerText=t; b.style.fontSize='13px'; return b; }

var r1=document.createElement('div'); r1.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
r1.appendChild(mkL('Tu:')); r1.appendChild(mkI('cex_inp_start',cur));
r1.appendChild(mkL('Den:')); r1.appendChild(mkI('cex_inp_end',cur+49));
r1.appendChild(mkB('&#x1F680; Bat dau','#27ae60',window.cex_start,'cex_btn_start'));
var bs=mkB('&#x23F9; Dung & Luu','#c0392b',window.cex_stop,'cex_btn_stop'); bs.style.display='none';
r1.appendChild(bs); body.appendChild(r1);

var pg=document.createElement('div'); pg.id='cex_progress'; pg.style.cssText='color:#2980b9;font-size:12px;min-height:14px;font-weight:bold;'; body.appendChild(pg);
var st=document.createElement('div'); st.id='cex_status'; st.style.cssText='color:#555;font-size:12px;min-height:14px;'; st.innerText='Trang: '+site.key+' | San sang.'; body.appendChild(st);

var hr=document.createElement('hr'); hr.style.cssText='border:0;border-top:1px solid #eee;margin:2px 0;'; body.appendChild(hr);

var r2=document.createElement('div'); r2.style.cssText='display:flex;gap:8px;align-items:center;';
var ml=document.createElement('b'); ml.innerText='Thu cong:'; ml.style.fontSize='12px'; r2.appendChild(ml);
r2.appendChild(mkB('Lay chuong hien tai','#2980b9',window.cex_get,null));
r2.appendChild(mkB('&#x1F4CB; Copy','#7f8c8d',window.cex_copy,null));
body.appendChild(r2);

var ta=document.createElement('textarea'); ta.id='cex_ta';
ta.style.cssText='width:100%;height:210px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;';
body.appendChild(ta);
W.appendChild(body); document.body.appendChild(W);

// ── AUTO-RESUME (HTML sites sau reload) ─────────────────
function doResume(){
  var saved=loadState();
  if(!saved){
    // Không có state → hiện chương hiện tại
    try{ var ic=getChapter(); if(ic&&ic.content) setTA(ic.title+'\n\n'+ic.content); }catch(x){}
    setStat('Trang: '+site.key+' | San sang.'); return;
  }
  // Có state → tiếp tục tự động
  window._cex_col=saved.col; window._cex_s=saved.s; window._cex_e=saved.e;
  try{document.getElementById('cex_inp_start').value=saved.s;}catch(x){}
  try{document.getElementById('cex_inp_end').value=saved.e;}catch(x){}
  try{document.getElementById('cex_btn_start').disabled=true;}catch(x){}
  try{document.getElementById('cex_btn_stop').style.display='inline-block';}catch(x){}
  var tot=saved.e-saved.s+1;
  setProg(saved.col.length+'/'+tot+' | Tiep tuc...');
  setStat('Tiep tuc tu chuong '+getNum()+' / '+saved.e);
  setTimeout(function(){ autoCollect(getNum()-1); }, 1500);
}

if(isSPA){
  try{ var ic2=getChapter(); if(ic2&&ic2.content) setTA(ic2.title+'\n\n'+ic2.content); }catch(x){}
  setStat('Trang: '+site.key+' | Interceptor san sang.');
} else {
  // Chờ DOM ổn định rồi mới chạy (fix lỗi null DOM)
  function runWhenReady(){
    if(document.readyState==='complete'){
      setTimeout(doResume, 800);
    } else {
      window.addEventListener('load', function(){ setTimeout(doResume, 800); }, {once:true});
    }
  }
  runWhenReady();
}

})();
