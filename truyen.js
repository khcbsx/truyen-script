(function(){

// ═══════════════════════════════════════════════════════
// CẤU HÌNH TỪNG TRANG - thêm trang mới vào đây
// ═══════════════════════════════════════════════════════
var SITE_CONFIGS = {
  'truyenfree.org': {
    type: 'spa',
    contentFn: function(){ return window._latestChapter || null; },
    nextBtn: function(){
      var links = [].slice.call(document.querySelectorAll('a[href*="chuong"]'));
      for(var i=0;i<links.length;i++){
        if(links[i].innerText.trim()==='Chuong sau'||links[i].innerText.trim()==='Chương sau') return links[i];
      }
      return null;
    }
  },
  'truyenfull.vision': {
    type: 'html',
    contentSelectors: ['#chapter-c','div[id="chapter-c"]','.chapter-c'],
    titleSelectors: ['h2.chapter-title','h2','.chapter-title','h1'],
    nextSelectors: ['a[title*="Chương sau"]','a[title*="sau"]','a.next-chap','#next_chap'],
    nextText: ['Chương sau','Chương tiếp theo']
  },
  'tvtruyen.co.uk': {
    type: 'html',
    contentSelectors: ['#chapter-content','.chapter-content','#content'],
    titleSelectors: ['.chapter-title','h2','h1'],
    nextSelectors: ['a.btn-chapter-nav','a.chapter-modal-next'],
    nextText: ['Chương tiếp','Tiếp theo']
  },
  'xtruyen.vn': {
    type: 'html',
    contentSelectors: ['.reading-content','.chapter-content','.entry-content','.text-left'],
    titleSelectors: ['h2','.chapter-name','.chapter-title','h1'],
    nextSelectors: ['a.btn.next_page','a.next_page','.next_page'],
    nextText: ['Chương tiếp','Chương sau']
  }
};

// ═══════════════════════════════════════════════════════
// NHẬN DIỆN TRANG ĐANG DÙNG
// ═══════════════════════════════════════════════════════
function getSiteConfig(){
  var host = location.hostname.replace('www.','');
  for(var key in SITE_CONFIGS){
    if(host.indexOf(key)>-1) return {key:key, cfg:SITE_CONFIGS[key]};
  }
  return {key:'unknown', cfg:{type:'html', contentSelectors:[], titleSelectors:['h1','h2'], nextSelectors:[], nextText:[]}};
}

var site = getSiteConfig();
var isSPA = site.cfg.type === 'spa';

// ═══════════════════════════════════════════════════════
// 1. INTERCEPTOR CHO SPA (truyenfree.org)
// ═══════════════════════════════════════════════════════
if(isSPA){
  if(!window._truyen_origLog){
    window._truyen_origLog = console.log;
  }
  console.log = function(){
    var args = Array.prototype.slice.call(arguments);
    var obj = args[0];
    if(obj && typeof obj==='object' && typeof obj.number==='number' &&
       typeof obj.name==='string' && typeof obj.content==='string' && obj.content.length>50){
      window._latestChapter = obj;
    }
    return window._truyen_origLog.apply(console, args);
  };
}

// ═══════════════════════════════════════════════════════
// 2. HELPERS CHUNG
// ═══════════════════════════════════════════════════════
function getNumFromUrl(){
  var m = location.pathname.match(/chuong[-_](\d+)/i);
  return m ? parseInt(m[1],10) : 0;
}

function cleanText(s){
  return (s||'')
    .replace(/\\n/g,'\n')
    .replace(/\\"/g,'"')
    .replace(/\\\\/g,'\\')
    .replace(/\\u([\dA-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));})
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function getElText(selectors){
  for(var i=0;i<selectors.length;i++){
    var el = document.querySelector(selectors[i]);
    if(el && (el.innerText||'').trim().length>0) return (el.innerText||'').trim();
  }
  return '';
}

// ═══════════════════════════════════════════════════════
// 3. LẤY NỘI DUNG CHƯƠNG
// ═══════════════════════════════════════════════════════
function extractFallback(){
  // Lấy đoạn text dài nhất từ DOM
  var best = '', bestLen = 0;
  document.querySelectorAll('div,article,section').forEach(function(el){
    // bỏ qua nav, header, footer, sidebar
    var tag = (el.tagName||'').toLowerCase();
    var id = (el.id||'').toLowerCase();
    var cls = (el.className||'').toLowerCase();
    if(/nav|header|footer|sidebar|menu|comment|advert|banner/.test(id+' '+cls)) return;
    var t = (el.innerText||'').trim();
    if(t.length > bestLen && el.children.length < 100 && el.children.length > 0){
      bestLen = t.length;
      best = t;
    }
  });
  return cleanText(best);
}

function getCurrentChapter(){
  // ── SPA: truyenfree.org ──
  if(isSPA){
    var lc = window._latestChapter;
    if(lc && lc.content && lc.content.length>50){
      return {
        number: lc.number,
        title: lc.name||('Chuong '+lc.number),
        content: cleanText(lc.content)
      };
    }
    // fallback __next_f
    var content = extractFallback();
    var num = getNumFromUrl();
    var title = getElText(['h1','h2','.chapter-title']) || ('Chuong '+num);
    return {number:num, title:title, content:content};
  }

  // ── HTML thuần ──
  var cfg = site.cfg;
  var content = '';

  // Thử từng selector nội dung
  for(var i=0;i<(cfg.contentSelectors||[]).length;i++){
    var el = document.querySelector(cfg.contentSelectors[i]);
    if(el && (el.innerText||'').trim().length > 200){
      content = cleanText(el.innerText);
      break;
    }
  }
  // Fallback nếu không tìm được
  if(!content || content.length < 100) content = extractFallback();

  var title = getElText(cfg.titleSelectors||['h1','h2']) || ('Chuong '+getNumFromUrl());
  var num = getNumFromUrl();

  // Lấy số chương từ title nếu URL không có
  if(!num){
    var m2 = title.match(/\d+/);
    if(m2) num = parseInt(m2[0],10);
  }

  return {number:num, title:title, content:content};
}

// ═══════════════════════════════════════════════════════
// 4. CLICK NÚT CHƯƠNG TIẾP
// ═══════════════════════════════════════════════════════
function clickNext(){
  var cfg = site.cfg;
  var nextTexts = cfg.nextText || ['Chương sau','Chương tiếp','Tiếp theo'];

  // Thử theo selector trước
  for(var i=0;i<(cfg.nextSelectors||[]).length;i++){
    var el = document.querySelector(cfg.nextSelectors[i]);
    if(el && el.href){
      // Kiểm tra không phải nút "trước"
      var txt = (el.innerText||el.title||'').toLowerCase();
      if(!/(tr.*c|prev)/i.test(txt)){
        el.click(); return true;
      }
    }
  }

  // Thử theo text
  var allLinks = [].slice.call(document.querySelectorAll('a'));
  for(var j=0;j<allLinks.length;j++){
    var t = (allLinks[j].innerText||'').trim();
    for(var k=0;k<nextTexts.length;k++){
      if(t===nextTexts[k] || t.indexOf(nextTexts[k])===0){
        allLinks[j].click(); return true;
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// 5. STATE
// ═══════════════════════════════════════════════════════
window._autoStop_cex   = false;
window._collected_cex  = window._collected_cex  || [];
window._targetStart_cex= window._targetStart_cex || 0;
window._targetEnd_cex  = window._targetEnd_cex   || 0;

// ── Khôi phục state từ localStorage (cho trang reload) ──
var LS_KEY = 'truyen_cex_state';
function saveState(){
  if(!isSPA){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify({
        collected: window._collected_cex,
        start: window._targetStart_cex,
        end: window._targetEnd_cex,
        site: site.key,
        ts: Date.now()
      }));
    }catch(e){}
  }
}
function loadState(){
  try{
    var raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    var s = JSON.parse(raw);
    // Bỏ qua nếu quá 2 tiếng hoặc sai trang
    if(!s || !s.collected || Date.now()-s.ts > 7200000) return false;
    if(s.site && s.site !== site.key) return false;
    window._collected_cex   = s.collected;
    window._targetStart_cex = s.start;
    window._targetEnd_cex   = s.end;
    return true;
  }catch(e){ return false; }
}
function clearState(){
  try{ localStorage.removeItem(LS_KEY); }catch(e){}
}

// ═══════════════════════════════════════════════════════
// 6. UI HELPERS
// ═══════════════════════════════════════════════════════
function setStatus(msg){ var el=document.getElementById('cex_status'); if(el)el.innerText=msg; }
function setProgress(msg){ var el=document.getElementById('cex_progress'); if(el)el.innerText=msg; }

// ═══════════════════════════════════════════════════════
// 7. TẢI FILE .TXT
// ═══════════════════════════════════════════════════════
function downloadTxt(){
  if(!window._collected_cex.length){ setStatus('Chua co chuong nao!'); return; }
  var parts = [];
  window._collected_cex.forEach(function(ch){
    parts.push(ch.title + '\n\n' + ch.content);
  });
  var fullText = parts.join('\n\n');
  var slug = (location.pathname.split('/')[1]||location.pathname.split('/')[2]||'truyen')
               .replace(/[^a-z0-9\-]/gi,'-').substring(0,40);
  var fname = slug+'_ch'+window._targetStart_cex+'-'+window._targetEnd_cex+'.txt';
  var blob = new Blob([fullText],{type:'text/plain;charset=utf-8'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href=url; a.download=fname;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},5000);
  setStatus('Da tai: '+fname+' ('+window._collected_cex.length+' chuong)');
  setProgress('');
  clearState();
}

// ═══════════════════════════════════════════════════════
// 8. AUTO-COLLECT LOOP
// ═══════════════════════════════════════════════════════
function finishAuto(){
  window._autoStop_cex = false;
  var b1=document.getElementById('cex_btn_start');
  var b2=document.getElementById('cex_btn_stop');
  if(b1)b1.disabled=false;
  if(b2)b2.style.display='none';
  downloadTxt();
}

// ── Cho SPA: chờ _latestChapter cập nhật ──
function waitForNewChapter(prevNum, timeout, cb){
  var waited=0;
  function check(){
    var urlN = getNumFromUrl();
    var lcN  = (window._latestChapter && window._latestChapter.number) || 0;
    var cur  = lcN || urlN;
    if(cur && cur !== prevNum){ cb(true); return; }
    if(waited >= timeout){ cb(false); return; }
    waited += 400;
    setTimeout(check, 400);
  }
  check();
}

function autoCollect(lastNum){
  if(window._autoStop_cex){ finishAuto(); return; }

  var urlNum = getNumFromUrl();
  var ch     = getCurrentChapter();
  var curNum = ch.number || urlNum;

  if(!curNum || curNum===lastNum){
    setTimeout(function(){ autoCollect(lastNum); }, 1200);
    return;
  }

  // Thu thập nếu trong range và chưa có
  if(curNum>=window._targetStart_cex && curNum<=window._targetEnd_cex){
    var dup=false;
    for(var i=0;i<window._collected_cex.length;i++){
      if(window._collected_cex[i].number===curNum){dup=true;break;}
    }
    if(!dup && ch.content && ch.content.length>50){
      window._collected_cex.push({number:curNum, title:ch.title, content:ch.content});
      window._collected_cex.sort(function(a,b){return a.number-b.number;});
      saveState();
      var total = window._targetEnd_cex - window._targetStart_cex + 1;
      setProgress(window._collected_cex.length+'/'+total+' | Chuong '+curNum);
    }
  }

  if(curNum >= window._targetEnd_cex){ finishAuto(); return; }

  if(!clickNext()){
    setStatus('Khong tim thay nut chuong tiep!');
    finishAuto();
    return;
  }
  setStatus('Dang tai chuong '+(curNum+1)+'...');

  if(isSPA){
    // SPA: chờ _latestChapter thay đổi
    waitForNewChapter(curNum, 10000, function(ok){
      if(!ok){ setStatus('Timeout - trang khong cap nhat!'); finishAuto(); return; }
      setTimeout(function(){ autoCollect(curNum); }, 300);
    });
  } else {
    // HTML: trang sẽ reload, state đã lưu vào localStorage
    // autoCollect sẽ tự gọi lại sau khi trang load (xem bên dưới)
    saveState();
  }
}

// ═══════════════════════════════════════════════════════
// 9. GLOBAL HANDLERS
// ═══════════════════════════════════════════════════════
window.startAuto_cex = function(){
  var s=parseInt(document.getElementById('cex_inp_start').value,10);
  var e=parseInt(document.getElementById('cex_inp_end').value,10);
  if(!s||!e||isNaN(s)||isNaN(e)||s>e){ setStatus('So chuong khong hop le!'); return; }
  if(e-s>500){ setStatus('Toi da 500 chuong moi lan!'); return; }
  window._targetStart_cex = s;
  window._targetEnd_cex   = e;
  window._collected_cex   = [];
  window._autoStop_cex    = false;
  clearState();
  var b1=document.getElementById('cex_btn_start');
  var b2=document.getElementById('cex_btn_stop');
  if(b1)b1.disabled=true;
  if(b2)b2.style.display='inline-block';
  setProgress(''); setStatus('Bat dau tu chuong '+s+' den '+e+'...');
  autoCollect(getNumFromUrl()-1);
};

window.stopAuto_cex = function(){
  window._autoStop_cex = true;
  setStatus('Dang dung...');
};

window.getCurrent_cex = function(){
  var ch=getCurrentChapter();
  var ta=document.getElementById('cex_ta');
  if(ch&&ch.content&&ta){
    ta.value=ch.title+'\n\n'+ch.content;
    setStatus('Chuong '+ch.number+': '+ch.title);
  } else { setStatus('Chua co noi dung!'); }
};

window.copyCurrent_cex = function(){
  var ta=document.getElementById('cex_ta');
  if(!ta||!ta.value){ setStatus('Khong co gi de copy!'); return; }
  ta.focus(); ta.select();
  try{ document.execCommand('copy'); }catch(ex){}
  if(navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function(){});
  setStatus('Da copy!');
};

// ═══════════════════════════════════════════════════════
// 10. BUILD UI
// ═══════════════════════════════════════════════════════
var old=document.getElementById('chapter_export_wrap');
if(old)old.remove();

var curNum  = getNumFromUrl();
var siteTag = '['+site.key+']';

var W=document.createElement('div');
W.id='chapter_export_wrap';
W.style.cssText='position:fixed;left:12px;top:60px;width:500px;z-index:2147483647;background:#fff;border:2px solid #333;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);font-family:Arial,sans-serif;font-size:13px;';

// Header
var hdr=document.createElement('div');
hdr.style.cssText='background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;';
var hdrTitle=document.createElement('b');
hdrTitle.innerText='Trich xuat truyen '+siteTag;
hdr.appendChild(hdrTitle);
var btnX=document.createElement('button');
btnX.innerHTML='&#x2715;';
btnX.style.cssText='background:none;border:0;color:#fff;font-size:20px;cursor:pointer;';
btnX.onclick=function(){W.remove();};
hdr.appendChild(btnX);
W.appendChild(hdr);

// Body
var body=document.createElement('div');
body.style.cssText='padding:12px;display:flex;flex-direction:column;gap:8px;';

// Warning
var warn=document.createElement('div');
warn.style.cssText='background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:8px;font-size:12px;color:#856404;';
warn.innerText='Vao dung chuong bat dau, nhap so chuong roi nhan Bat dau.';
body.appendChild(warn);

// Input row
function mkBtn(txt,bg,handler,id){
  var el=document.createElement('button');
  el.innerHTML=txt;
  el.style.cssText='padding:5px 12px;background:'+bg+';color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;';
  el.onclick=handler;
  if(id)el.id=id;
  return el;
}
function mkInput(id,val){
  var el=document.createElement('input');
  el.type='number'; el.id=id; el.value=val;
  el.style.cssText='width:75px;padding:4px 6px;border:1px solid #aaa;border-radius:4px;font-size:13px;color:#000;background:#fff;';
  return el;
}
function mkLabel(t){
  var el=document.createElement('b');
  el.innerText=t; el.style.cssText='font-size:13px;';
  return el;
}

var row1=document.createElement('div');
row1.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
row1.appendChild(mkLabel('Tu:'));
row1.appendChild(mkInput('cex_inp_start', curNum));
row1.appendChild(mkLabel('Den:'));
row1.appendChild(mkInput('cex_inp_end', curNum+49));
row1.appendChild(mkBtn('&#x1F680; Bat dau','#27ae60',window.startAuto_cex,'cex_btn_start'));
var btnStop=mkBtn('&#x23F9; Dung & Luu','#c0392b',window.stopAuto_cex,'cex_btn_stop');
btnStop.style.display='none';
row1.appendChild(btnStop);
body.appendChild(row1);

// Progress / status
var prog=document.createElement('div');
prog.id='cex_progress';
prog.style.cssText='color:#2980b9;font-size:12px;min-height:14px;font-weight:bold;';
body.appendChild(prog);

var stat=document.createElement('div');
stat.id='cex_status';
stat.style.cssText='color:#555;font-size:12px;min-height:14px;';
stat.innerText='Trang: '+site.key+' | San sang.';
body.appendChild(stat);

var hr=document.createElement('hr');
hr.style.cssText='border:0;border-top:1px solid #eee;margin:4px 0;';
body.appendChild(hr);

// Manual row
var row2=document.createElement('div');
row2.style.cssText='display:flex;gap:8px;align-items:center;';
var lbl=document.createElement('b');
lbl.innerText='Thu cong:'; lbl.style.fontSize='12px';
row2.appendChild(lbl);
row2.appendChild(mkBtn('Lay chuong hien tai','#2980b9',window.getCurrent_cex,null));
row2.appendChild(mkBtn('&#x1F4CB; Copy','#7f8c8d',window.copyCurrent_cex,null));
body.appendChild(row2);

// Textarea
var ta=document.createElement('textarea');
ta.id='cex_ta';
ta.style.cssText='width:100%;height:220px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;';
body.appendChild(ta);

W.appendChild(body);
document.body.appendChild(W);

// ═══════════════════════════════════════════════════════
// 11. AUTO-RESUME (cho trang HTML reload)
// ═══════════════════════════════════════════════════════
if(!isSPA){
  var resumed = loadState();
  if(resumed && window._targetStart_cex && window._targetEnd_cex){
    var urlNumNow = getNumFromUrl();
    var alreadyHave = false;
    for(var ii=0;ii<window._collected_cex.length;ii++){
      if(window._collected_cex[ii].number === urlNumNow){ alreadyHave=true; break; }
    }
    var total2 = window._targetEnd_cex - window._targetStart_cex + 1;
    setProgress(window._collected_cex.length+'/'+total2+' | Tiep tuc...');
    setStatus('Dang tiep tuc: chuong '+urlNumNow);

    // Cập nhật input
    var inpS=document.getElementById('cex_inp_start');
    var inpE=document.getElementById('cex_inp_end');
    if(inpS) inpS.value=window._targetStart_cex;
    if(inpE) inpE.value=window._targetEnd_cex;

    var b1r=document.getElementById('cex_btn_start');
    var b2r=document.getElementById('cex_btn_stop');
    if(b1r)b1r.disabled=true;
    if(b2r)b2r.style.display='inline-block';

    // Bắt đầu lại sau 1 giây (chờ trang render xong)
    setTimeout(function(){ autoCollect(urlNumNow-1); }, 1000);
  } else {
    // Hiện chương hiện tại
    var initCh=getCurrentChapter();
    if(initCh && initCh.content){
      ta.value=initCh.title+'\n\n'+initCh.content;
      setStatus('Trang: '+site.key+' | Chuong '+initCh.number+' da tai.');
    }
  }
} else {
  // SPA: hiện chương hiện tại ngay
  var initChSPA=getCurrentChapter();
  if(initChSPA && initChSPA.content){
    ta.value=initChSPA.title+'\n\n'+initChSPA.content;
    setStatus('Trang: '+site.key+' | Chuong '+initChSPA.number+' | Interceptor san sang.');
  }
}

})(); // end IIFE
