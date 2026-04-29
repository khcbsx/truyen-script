(function(){
'use strict';

// ═══════════════════════════════════════════════════════
// CẤU HÌNH TỪNG TRANG
// ═══════════════════════════════════════════════════════
var SITE_CONFIGS = {
  'truyenfree.org': {
    type: 'spa',
    label: 'TruyenFree',
    nextText: ['Chuong sau','Chương sau'],
    nextSelectors: []
  },
  'truyenfull.vision': {
    type: 'html',
    label: 'TruyenFull',
    contentSelectors: ['#chapter-c','.chapter-c','div[id="chapter-c"]'],
    titleSelectors: ['h2.chapter-title','.chapter-title','h2','h1'],
    nextSelectors: ['a[title*="sau"]','a[title*="tiep"]','#next_chap','.next-chap'],
    nextText: ['Chương sau','Chương tiếp theo','Tiếp theo']
  },
  'tvtruyen.co.uk': {
    type: 'html',
    label: 'TvTruyen',
    contentSelectors: ['#chapter-content','.chapter-content','#content'],
    titleSelectors: ['.chapter-title','h2','h1'],
    nextSelectors: ['a.btn-chapter-nav','a.chapter-modal-next'],
    nextText: ['Chương tiếp','Tiếp theo']
  },
  'xtruyen.vn': {
    type: 'html',
    label: 'XTruyen',
    contentSelectors: [
      '.reading-content .text-left',
      '.reading-content',
      '.chapter-content',
      '.entry-content',
      '.text-left'
    ],
    titleSelectors: ['h2','.chapter-name','.chapter-title','h1'],
    nextSelectors: ['a.btn.next_page','a.next_page'],
    nextText: ['Chương tiếp','Chương sau','Tiếp theo']
  }
};

var SUPPORTED_SITES = [
  { label: 'TruyenFree', host: 'truyenfree.org' },
  { label: 'TruyenFull', host: 'truyenfull.vision' },
  { label: 'TvTruyen',   host: 'tvtruyen.co.uk'  },
  { label: 'XTruyen',    host: 'xtruyen.vn'       }
];

// ═══════════════════════════════════════════════════════
// NHẬN DIỆN TRANG
// ═══════════════════════════════════════════════════════
function getSiteConfig(){
  var host = location.hostname.replace('www.','');
  for(var key in SITE_CONFIGS){
    if(host.indexOf(key) > -1) return { key: key, cfg: SITE_CONFIGS[key] };
  }
  return { key: 'unknown', cfg: {
    type: 'html', label: 'Unknown',
    contentSelectors: [], titleSelectors: ['h1','h2'],
    nextSelectors: [], nextText: ['Chương tiếp','Chương sau','Tiếp theo']
  }};
}

var site  = getSiteConfig();
var isSPA = site.cfg.type === 'spa';
var LS_KEY = 'truyen_cex_v4';

// ═══════════════════════════════════════════════════════
// INTERCEPTOR CHO SPA
// ═══════════════════════════════════════════════════════
if(isSPA){
  if(!window._truyen_origLog) window._truyen_origLog = console.log;
  console.log = function(){
    var args = Array.prototype.slice.call(arguments);
    var obj  = args[0];
    if(obj && typeof obj === 'object' &&
       typeof obj.number === 'number' &&
       typeof obj.name   === 'string' &&
       typeof obj.content=== 'string' && obj.content.length > 50){
      window._latestChapter = obj;
    }
    return window._truyen_origLog.apply(console, args);
  };
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function getNumFromUrl(){
  var m = location.pathname.match(/chuong[-_](\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function cleanText(s){
  return (s||'')
    .replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\')
    .replace(/\\u([\dA-Fa-f]{4})/g, function(_,h){ return String.fromCharCode(parseInt(h,16)); })
    .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

function queryText(selectors){
  for(var i=0;i<selectors.length;i++){
    try{
      var el = document.querySelector(selectors[i]);
      if(el && (el.innerText||'').trim().length > 0) return (el.innerText||'').trim();
    }catch(e){}
  }
  return '';
}

function extractFallback(){
  var best='', bestLen=0;
  try{
    document.querySelectorAll('div,article,section').forEach(function(el){
      var id  = (el.id||'').toLowerCase();
      var cls = (el.className||'').toLowerCase();
      if(/nav|header|footer|sidebar|menu|comment|advert|banner|widget/.test(id+' '+cls)) return;
      var t = (el.innerText||'').trim();
      if(t.length > bestLen && el.children.length < 100 && el.children.length > 0){
        bestLen = t.length; best = t;
      }
    });
  }catch(e){}
  return cleanText(best);
}

// ═══════════════════════════════════════════════════════
// LẤY NỘI DUNG CHƯƠNG
// ═══════════════════════════════════════════════════════
function getCurrentChapter(){
  var num   = getNumFromUrl();
  var title = '';
  var content = '';

  if(isSPA){
    var lc = window._latestChapter;
    if(lc && lc.content && lc.content.length > 50){
      return {
        number:  lc.number,
        title:   lc.name || ('Chuong ' + lc.number),
        content: cleanText(lc.content)
      };
    }
    content = extractFallback();
    title   = queryText(['h1','h2','.chapter-title']) || ('Chuong ' + num);
    return { number: num, title: title, content: content };
  }

  // HTML sites
  var cfg = site.cfg;
  for(var i=0; i<(cfg.contentSelectors||[]).length; i++){
    try{
      var el = document.querySelector(cfg.contentSelectors[i]);
      if(el && (el.innerText||'').trim().length > 200){
        content = cleanText(el.innerText); break;
      }
    }catch(e){}
  }
  if(!content || content.length < 100) content = extractFallback();

  title = queryText(cfg.titleSelectors || ['h1','h2']) || ('Chuong ' + num);
  if(!num){ var m2=title.match(/\d+/); if(m2) num=parseInt(m2[0],10); }

  return { number: num, title: title, content: content };
}

// ═══════════════════════════════════════════════════════
// CLICK NÚT CHƯƠNG TIẾP
// ═══════════════════════════════════════════════════════
function clickNext(){
  var cfg       = site.cfg;
  var nextTexts = cfg.nextText || ['Chương tiếp','Chương sau','Tiếp theo'];

  // Thử selector trước
  for(var i=0; i<(cfg.nextSelectors||[]).length; i++){
    try{
      var els = document.querySelectorAll(cfg.nextSelectors[i]);
      for(var j=0;j<els.length;j++){
        var el = els[j];
        if(el && el.href){
          var txt = (el.innerText||el.title||'').toLowerCase();
          if(!/(tr.*c|prev|truoc)/i.test(txt)){ el.click(); return true; }
        }
      }
    }catch(e){}
  }

  // Thử theo text
  var allLinks = [].slice.call(document.querySelectorAll('a'));
  for(var a=0; a<allLinks.length; a++){
    var t = (allLinks[a].innerText||'').trim();
    for(var k=0; k<nextTexts.length; k++){
      if(t === nextTexts[k] || (t.length<60 && t.indexOf(nextTexts[k])===0)){
        allLinks[a].click(); return true;
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// LOCALSTORAGE STATE
// ═══════════════════════════════════════════════════════
function saveState(collected, start, end){
  if(isSPA) return; // SPA không cần localStorage
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      collected: collected,
      start: start,
      end:   end,
      site:  site.key,
      ts:    Date.now()
    }));
  }catch(e){}
}

function loadState(){
  try{
    var raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    var s = JSON.parse(raw);
    if(!s || !s.collected) return null;
    if(Date.now() - s.ts > 3 * 3600 * 1000) { localStorage.removeItem(LS_KEY); return null; } // hết hạn 3h
    if(s.site && s.site !== site.key) return null; // sai trang
    return s;
  }catch(e){ return null; }
}

function clearState(){
  try{ localStorage.removeItem(LS_KEY); }catch(e){}
}

// ═══════════════════════════════════════════════════════
// STATE TOÀN CỤC
// ═══════════════════════════════════════════════════════
window._autoStop_cex    = false;
window._collected_cex   = [];
window._targetStart_cex = 0;
window._targetEnd_cex   = 0;

// ═══════════════════════════════════════════════════════
// UI HELPERS — dùng hàm an toàn, tránh null error
// ═══════════════════════════════════════════════════════
function setStatus(msg){
  var el = document.getElementById('cex_status');
  if(el) el.innerText = msg;
}
function setProgress(msg){
  var el = document.getElementById('cex_progress');
  if(el) el.innerText = msg;
}
function setTA(val){
  var el = document.getElementById('cex_ta');
  if(el) el.value = val;
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD .TXT
// ═══════════════════════════════════════════════════════
function downloadTxt(collected, start, end){
  if(!collected || !collected.length){ setStatus('Chua co chuong nao!'); return; }
  var parts = [];
  collected.forEach(function(ch){ parts.push(ch.title + '\n\n' + ch.content); });
  var fullText = parts.join('\n\n');
  var slug = (location.pathname.split('/')[1]||location.pathname.split('/')[2]||'truyen')
               .replace(/[^a-z0-9\-]/gi,'-').substring(0,40);
  var fname = slug + '_ch' + start + '-' + end + '.txt';
  var blob  = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  var url   = URL.createObjectURL(blob);
  var a     = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  setStatus('Da tai: ' + fname + ' (' + collected.length + ' chuong)');
  setProgress('');
  clearState();
}

// ═══════════════════════════════════════════════════════
// AUTO-COLLECT LOOP
// ═══════════════════════════════════════════════════════
function finishAuto(){
  window._autoStop_cex = false;
  var b1 = document.getElementById('cex_btn_start');
  var b2 = document.getElementById('cex_btn_stop');
  if(b1) b1.disabled = false;
  if(b2) b2.style.display = 'none';
  downloadTxt(window._collected_cex, window._targetStart_cex, window._targetEnd_cex);
}

function waitForNewChapterSPA(prevNum, timeout, cb){
  var waited = 0;
  function check(){
    var lcN = (window._latestChapter && window._latestChapter.number) || 0;
    var urlN = getNumFromUrl();
    if((lcN && lcN !== prevNum) || (urlN && urlN !== prevNum)){ cb(true); return; }
    if(waited >= timeout){ cb(false); return; }
    waited += 400; setTimeout(check, 400);
  }
  check();
}

function autoCollect(lastNum){
  if(window._autoStop_cex){ finishAuto(); return; }

  var urlNum = getNumFromUrl();
  var ch     = getCurrentChapter();
  var curNum = ch.number || urlNum;

  if(!curNum || curNum === lastNum){
    setTimeout(function(){ autoCollect(lastNum); }, 1200);
    return;
  }

  // Thu thập nếu trong range và chưa có
  if(curNum >= window._targetStart_cex && curNum <= window._targetEnd_cex){
    var dup = false;
    for(var i=0; i<window._collected_cex.length; i++){
      if(window._collected_cex[i].number === curNum){ dup=true; break; }
    }
    if(!dup && ch.content && ch.content.length > 50){
      window._collected_cex.push({ number: curNum, title: ch.title, content: ch.content });
      window._collected_cex.sort(function(a,b){ return a.number - b.number; });

      // Lưu vào localStorage ngay sau mỗi chương
      saveState(window._collected_cex, window._targetStart_cex, window._targetEnd_cex);

      var total = window._targetEnd_cex - window._targetStart_cex + 1;
      setProgress(window._collected_cex.length + '/' + total + ' | Chuong ' + curNum);
    }
  }

  if(curNum >= window._targetEnd_cex){ finishAuto(); return; }

  if(!clickNext()){
    setStatus('Khong tim thay nut chuong tiep!');
    finishAuto(); return;
  }
  setStatus('Dang tai chuong ' + (curNum + 1) + '...');

  if(isSPA){
    waitForNewChapterSPA(curNum, 10000, function(ok){
      if(!ok){ setStatus('Timeout!'); finishAuto(); return; }
      setTimeout(function(){ autoCollect(curNum); }, 300);
    });
  }
  // HTML: trang sẽ reload → script tự resume qua localStorage (xem phần AUTO-RESUME)
}

// ═══════════════════════════════════════════════════════
// GLOBAL BUTTON HANDLERS
// ═══════════════════════════════════════════════════════
window.startAuto_cex = function(){
  var s = parseInt((document.getElementById('cex_inp_start')||{}).value, 10);
  var e = parseInt((document.getElementById('cex_inp_end')||{}).value,   10);
  if(!s||!e||isNaN(s)||isNaN(e)||s>e){ setStatus('So chuong khong hop le!'); return; }
  if(e-s > 500){ setStatus('Toi da 500 chuong moi lan!'); return; }
  window._targetStart_cex = s;
  window._targetEnd_cex   = e;
  window._collected_cex   = [];
  window._autoStop_cex    = false;
  clearState();
  var b1=document.getElementById('cex_btn_start');
  var b2=document.getElementById('cex_btn_stop');
  if(b1) b1.disabled = true;
  if(b2) b2.style.display = 'inline-block';
  setProgress(''); setStatus('Bat dau tu chuong ' + s + ' den ' + e + '...');
  autoCollect(getNumFromUrl() - 1);
};

window.stopAuto_cex = function(){
  window._autoStop_cex = true;
  setStatus('Dang dung...');
};

window.getCurrent_cex = function(){
  var ch = getCurrentChapter();
  if(ch && ch.content){
    setTA(ch.title + '\n\n' + ch.content);
    setStatus('Chuong ' + ch.number + ': ' + ch.title);
  } else { setStatus('Chua co noi dung!'); }
};

window.copyCurrent_cex = function(){
  var ta = document.getElementById('cex_ta');
  if(!ta || !ta.value){ setStatus('Khong co gi de copy!'); return; }
  ta.focus(); ta.select();
  try{ document.execCommand('copy'); }catch(ex){}
  if(navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function(){});
  setStatus('Da copy!');
};

// ═══════════════════════════════════════════════════════
// BUILD UI
// ═══════════════════════════════════════════════════════
var oldWrap = document.getElementById('chapter_export_wrap');
if(oldWrap) oldWrap.remove();

var curNum = getNumFromUrl();

var W = document.createElement('div');
W.id = 'chapter_export_wrap';
W.style.cssText = [
  'position:fixed','left:12px','top:60px','width:520px',
  'z-index:2147483647','background:#fff','border:2px solid #2c3e50',
  'border-radius:8px','box-shadow:0 6px 28px rgba(0,0,0,.45)',
  'font-family:Arial,sans-serif','font-size:13px'
].join(';');

// ── Header ──
var hdr = document.createElement('div');
hdr.style.cssText = 'background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;';
var hdrTitle = document.createElement('b');
hdrTitle.innerText = 'Trich xuat truyen tu dong';
hdr.appendChild(hdrTitle);
var btnX = document.createElement('button');
btnX.innerHTML = '&#x2715;';
btnX.style.cssText = 'background:none;border:0;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:0;';
btnX.onclick = function(){ W.remove(); };
hdr.appendChild(btnX);
W.appendChild(hdr);

// ── Banner web được hỗ trợ ──
var banner = document.createElement('div');
banner.style.cssText = 'background:#eaf4fb;border-bottom:1px solid #bee3f8;padding:7px 14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

var bannerLabel = document.createElement('span');
bannerLabel.style.cssText = 'font-size:11px;color:#2980b9;font-weight:bold;margin-right:4px;white-space:nowrap;';
bannerLabel.innerText = 'Ho tro:';
banner.appendChild(bannerLabel);

SUPPORTED_SITES.forEach(function(s){
  var isActive = (site.key === s.host);
  var chip = document.createElement('span');
  chip.style.cssText = [
    'display:inline-block',
    'padding:2px 9px',
    'border-radius:12px',
    'font-size:11px',
    'font-weight:bold',
    'border:1px solid ' + (isActive ? '#27ae60' : '#bbb'),
    'background:'       + (isActive ? '#27ae60' : '#f0f0f0'),
    'color:'            + (isActive ? '#fff'     : '#666'),
    'white-space:nowrap'
  ].join(';');
  chip.innerText = (isActive ? '✓ ' : '') + s.label;
  chip.title = s.host;
  banner.appendChild(chip);
});

W.appendChild(banner);

// ── Body ──
var body = document.createElement('div');
body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:8px;';

// Cảnh báo
var warn = document.createElement('div');
warn.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:7px 10px;font-size:12px;color:#856404;';
warn.innerText = 'Vao dung chuong bat dau, nhap so chuong roi nhan Bat dau.';
body.appendChild(warn);

// Helper tạo element
function mkBtn(html, bg, handler, id){
  var el = document.createElement('button');
  el.innerHTML = html;
  el.style.cssText = 'padding:5px 12px;background:'+bg+';color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;white-space:nowrap;';
  if(handler) el.onclick = handler;
  if(id) el.id = id;
  return el;
}
function mkInput(id, val){
  var el = document.createElement('input');
  el.type='number'; el.id=id; el.value=val;
  el.style.cssText = 'width:75px;padding:4px 6px;border:1px solid #aaa;border-radius:4px;font-size:13px;color:#000;background:#fff;';
  return el;
}
function mkLabel(t){
  var el = document.createElement('b');
  el.innerText = t; el.style.fontSize='13px';
  return el;
}

// Input row
var row1 = document.createElement('div');
row1.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
row1.appendChild(mkLabel('Tu:'));
row1.appendChild(mkInput('cex_inp_start', curNum));
row1.appendChild(mkLabel('Den:'));
row1.appendChild(mkInput('cex_inp_end', curNum + 49));
row1.appendChild(mkBtn('&#x1F680; Bat dau', '#27ae60', window.startAuto_cex, 'cex_btn_start'));
var btnStop = mkBtn('&#x23F9; Dung & Luu', '#c0392b', window.stopAuto_cex, 'cex_btn_stop');
btnStop.style.display = 'none';
row1.appendChild(btnStop);
body.appendChild(row1);

// Progress & status
var prog = document.createElement('div');
prog.id = 'cex_progress';
prog.style.cssText = 'color:#2980b9;font-size:12px;min-height:14px;font-weight:bold;';
body.appendChild(prog);

var stat = document.createElement('div');
stat.id = 'cex_status';
stat.style.cssText = 'color:#555;font-size:12px;min-height:14px;';
stat.innerText = 'Trang: ' + site.key + ' | San sang.';
body.appendChild(stat);

var hr = document.createElement('hr');
hr.style.cssText = 'border:0;border-top:1px solid #eee;margin:2px 0;';
body.appendChild(hr);

// Thủ công
var row2 = document.createElement('div');
row2.style.cssText = 'display:flex;gap:8px;align-items:center;';
var manualLabel = document.createElement('b');
manualLabel.innerText = 'Thu cong:'; manualLabel.style.fontSize='12px';
row2.appendChild(manualLabel);
row2.appendChild(mkBtn('Lay chuong hien tai', '#2980b9', window.getCurrent_cex, null));
row2.appendChild(mkBtn('&#x1F4CB; Copy', '#7f8c8d', window.copyCurrent_cex, null));
body.appendChild(row2);

// Textarea
var ta = document.createElement('textarea');
ta.id = 'cex_ta';
ta.style.cssText = 'width:100%;height:210px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;';
body.appendChild(ta);

W.appendChild(body);
document.body.appendChild(W);

// ═══════════════════════════════════════════════════════
// AUTO-RESUME KHI TRANG RELOAD (HTML sites)
// ═══════════════════════════════════════════════════════
function doResume(){
  var saved = loadState();
  if(!saved){ 
    // Không có state → hiện chương hiện tại
    var initCh = getCurrentChapter();
    if(initCh && initCh.content) setTA(initCh.title + '\n\n' + initCh.content);
    setStatus('Trang: ' + site.key + ' | San sang.');
    return;
  }

  // Có state → tiếp tục
  window._collected_cex   = saved.collected;
  window._targetStart_cex = saved.start;
  window._targetEnd_cex   = saved.end;

  var inpS = document.getElementById('cex_inp_start');
  var inpE = document.getElementById('cex_inp_end');
  if(inpS) inpS.value = saved.start;
  if(inpE) inpE.value = saved.end;

  var b1 = document.getElementById('cex_btn_start');
  var b2 = document.getElementById('cex_btn_stop');
  if(b1) b1.disabled = true;
  if(b2) b2.style.display = 'inline-block';

  var total = saved.end - saved.start + 1;
  setProgress(saved.collected.length + '/' + total + ' | Tiep tuc...');
  setStatus('Tiep tuc: chuong ' + getNumFromUrl() + ' / ' + saved.end);

  // Chờ 1.2 giây để trang render xong rồi mới collect
  setTimeout(function(){
    autoCollect(getNumFromUrl() - 1);
  }, 1200);
}

if(isSPA){
  var initCh = getCurrentChapter();
  if(initCh && initCh.content) setTA(initCh.title + '\n\n' + initCh.content);
  setStatus('Trang: ' + site.key + ' | Interceptor san sang.');
} else {
  // Đợi DOM ổn định rồi mới resume
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(doResume, 600);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(doResume, 600); });
  }
}

})();
