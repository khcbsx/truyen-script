// ==UserScript==
// @name         Truyen Extractor v8.2
// @namespace    http://tampermonkey.net/
// @version      8.2
// @description  Hỗ trợ tải truyện từ truyenfull.live, tvtruyen.site, xtruyen.net
// @author       You
// @match        *://*.truyenfull.live/*
// @match        *://*.tvtruyen.site/*
// @match        *://*.xtruyen.net/*
// @grant        none
// ==/UserScript==

/* ====================================================================
   truyen.js — v8.2
   Ho tro:
     - truyenfull.live  : fetch + lay the <p> ben trong #chapter-c
     - tvtruyen.site     : fetch + lay the <p> ben trong #chapter-c
     - xtruyen.net         : doc DOM sau 3.5s + lay <p> hoac textContent
   ==================================================================== */
(function () {
  'use strict';

  if (window.__TRUYEN_CEX_RUNNING__) return;
  window.__TRUYEN_CEX_RUNNING__ = true;

  /* ----------------------------------------------------------------
     1. DANH SACH TRANG HO TRO
  ---------------------------------------------------------------- */
  var SUPPORTED = [
    { label: 'TruyenFull', host: 'truyenfull.live' },
    { label: 'TvTruyen',   host: 'tvtruyen.site'   },
    { label: 'XTruyen',    host: 'xtruyen.net'     }
  ];

  /* ----------------------------------------------------------------
     2. CAU HINH TUNG TRANG
  ---------------------------------------------------------------- */
  var SITE_CONFIGS = {
    'truyenfull.live': {
      mode         : 'fetch',
      contentSel   : '#chapter-c',          // container chinh
      contentInner : 'p',                   // lay the <p> ben trong
      titleSels    : ['h2 a.chapter-title', 'h2 .chapter-title', 'h2', 'h1'],
      nextSel      : 'a#next_chap'          // selector chinh xac
    },
    'tvtruyen.site': {
      mode         : 'dom', // Đổi sang chế độ DOM để vượt qua chống bot chặn Fetch
      spa          : false,
      contentSel   : '#chapter-c, .chapter-content, .reading-content, #chapter-content, .chapter-c, .content', // Quét mọi tên thẻ phổ biến
      contentInner : '', // Để trống, không ép buộc phải có thẻ <p> mới lấy chữ
      titleSels    : ['h2.chapter-title', 'h2 a', 'h2', 'h1', '.title'],
      nextSel      : 'a#next_chap, a.btn-chapter-nav, a.next, a[href*="chuong-"]',
      domDelay     : 2500 // Chờ 2.5 giây cho web tải xong chữ rồi mới copy
    },
    'xtruyen.net': {
      mode         : 'dom',
      spa          : false,
      contentSel   : '.reading-content .text-left',
      contentInner : 'p',                   // thu <p> truoc, fallback textContent
      titleSels    : ['h2', '.chapter-name', 'h1', '.chapter-title'],
      nextSel      : 'a.btn.next_page',
      domDelay     : 3500
    }
  };

  /* ----------------------------------------------------------------
     3. DETECT SITE
  ---------------------------------------------------------------- */
  var hostname = location.hostname.replace(/^www\./, '');
  var cfg = SITE_CONFIGS[hostname];

  /* ----------------------------------------------------------------
     4. STATE
  ---------------------------------------------------------------- */
  var STATE_KEY = 'truyen_cex_state_v8';

  function saveState(obj) {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(obj)); } catch(e) {}
  }
  function loadState() {
    try { var s = sessionStorage.getItem(STATE_KEY); return s ? JSON.parse(s) : null; }
    catch(e) { return null; }
  }
  function clearState() {
    try { sessionStorage.removeItem(STATE_KEY); } catch(e) {}
  }

  /* ----------------------------------------------------------------
     5. HELPERS
  ---------------------------------------------------------------- */
  function getNumFromUrl(url) {
    var m = (url || '').match(/chuong[-_](\d+)/i);
    return m ? parseInt(m[1], 10) : NaN;
  }

  function cleanLine(line) {
    return line
      .replace(/\r/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  /* ----------------------------------------------------------------
     6. HAM LAY NOI DUNG SACH - QUAN TRONG NHAT
  ---------------------------------------------------------------- */
  var NAV_PATTERNS = [
    /chuong\s*(truoc|tiep|ti[eê]p)/i,
    /ch.*\d+.*ch/i,
    /tai\s*pdf/i, /nghe\s*truy[eê]n/i, /bao\s*loi/i,
    /binh\s*luan/i, /^#\d+\s*\./,
    /function\s+\w+\(/,            // JS inline
    /document\./,
    /style\s*=/i,
    /^(ch|chuong)\s*truoc$/i,
    /^(ch|chuong)\s*tiep$/i,
    /^chuong\s*\d+\s*$/i,
    /click\s*ads/i, /mo\s*khoa/i,
    /quang\s*cao/i,
    /vui\s*long/i
  ];

  function isNavOrJunk(text) {
    var t = text.trim();
    if (t.length < 5) return true;
    for (var i = 0; i < NAV_PATTERNS.length; i++) {
      if (NAV_PATTERNS[i].test(t)) return true;
    }
    return false;
  }

  function extractCleanContent(containerEl, innerTag) {
    if (!containerEl) return '';

    var lines = [];

    if (innerTag) {
      var pTags = containerEl.querySelectorAll(innerTag);
      if (pTags.length > 0) {
        pTags.forEach(function(p) {
          var parent = p.parentElement;
          var skip = false;
          while (parent && parent !== containerEl) {
            var pid = (parent.id || '').toLowerCase();
            var pcls = (parent.className || '').toLowerCase();
            if (pid.indexOf('ads') !== -1 || pcls.indexOf('ads') !== -1 ||
                pid.indexOf('unlock') !== -1 || pcls.indexOf('unlock') !== -1) {
              skip = true; break;
            }
            parent = parent.parentElement;
          }
          if (skip) return;

          var txt = (p.innerText || p.textContent || '').replace(/\n+/g, ' ').trim();
          if (!isNavOrJunk(txt)) {
            lines.push(txt);
          }
        });
        if (lines.length > 0) {
          return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
        }
      }
    }

    var walker = document.createTreeWalker(
      containerEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          var p = node.parentNode;
          while (p && p !== containerEl) {
            var tag = (p.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
            var id2 = (p.id || '').toLowerCase();
            var cls = (p.className || '').toLowerCase();
            if (id2.indexOf('ads') !== -1 || cls.indexOf('ads') !== -1 ||
                id2.indexOf('unlock') !== -1 || cls.indexOf('unlock') !== -1) {
              return NodeFilter.FILTER_REJECT;
            }
            p = p.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    var rawLines = [];
    var node;
    while ((node = walker.nextNode())) {
      var t = cleanLine(node.nodeValue);
      if (t) rawLines.push(t);
    }

    return rawLines.filter(function(l) { return !isNavOrJunk(l); })
                   .join('\n')
                   .replace(/\n{3,}/g, '\n\n')
                   .trim();
  }

  /* ----------------------------------------------------------------
     7. TIM ELEMENT THEO SELECTOR LIST
  ---------------------------------------------------------------- */
  function findEl(doc, sels, minLen) {
    minLen = minLen || 0;
    if (typeof sels === 'string') sels = [sels];
    var best = null, bestLen = 0;
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = doc.querySelector(sels[i]);
        if (el) {
          var len = (el.textContent || '').trim().length;
          if (len > minLen && len > bestLen) { bestLen = len; best = el; }
        }
      } catch(e) {}
    }
    return best;
  }

  /* ----------------------------------------------------------------
     8. TIM NEXT URL
  ---------------------------------------------------------------- */
  function findNextUrl(doc, nextSel, currentUrl) {
    try {
      var links = doc.querySelectorAll(nextSel);
      for (var i = 0; i < links.length; i++) {
        var href = links[i].href || links[i].getAttribute('href') || '';
        if (href && href !== '#' && href !== currentUrl &&
            href.indexOf('javascript') === -1 &&
            href.match(/chuong[-_]\d+/i)) {
          return href;
        }
      }
    } catch(e) {}

    var curN = getNumFromUrl(currentUrl);
    if (!isNaN(curN)) {
      var next = currentUrl.replace(/chuong[-_]\d+/i, 'chuong-' + (curN + 1));
      if (next !== currentUrl) return next;
    }
    return null;
  }

  /* ----------------------------------------------------------------
     9. FETCH CHAPTER
  ---------------------------------------------------------------- */
  function fetchChapter(url, callback) {
    fetch(url, { credentials: 'include' })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function(html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        var titleEl = findEl(doc, cfg.titleSels, 1);
        var title = titleEl ? titleEl.textContent.trim() : ('Chuong ' + getNumFromUrl(url));

        var containerEl = doc.querySelector(cfg.contentSel);
        var text = extractCleanContent(containerEl, cfg.contentInner);

        if (!text || text.length < 100) {
          callback({ error: 'Noi dung qua ngan (' + (text ? text.length : 0) + ' chars) chuong ' + getNumFromUrl(url) });
          return;
        }

        var nextUrl = findNextUrl(doc, cfg.nextSel, url);
        if (nextUrl && nextUrl.charAt(0) === '/') nextUrl = location.origin + nextUrl;

        callback({
          number  : getNumFromUrl(url),
          title   : title,
          content : text,
          nextUrl : nextUrl,
          url     : url
        });
      })
      .catch(function(e) {
        callback({ error: 'Fetch loi: ' + e.message });
      });
  }

  /* ----------------------------------------------------------------
     10. DOM CHAPTER (xtruyen)
  ---------------------------------------------------------------- */
  function readDomChapter(callback) {
    var delay = cfg.domDelay || 2500;
    setTimeout(function() {
      try {
        var containerEl = null;
        try { containerEl = document.querySelector(cfg.contentSel); } catch(e) {}

        var text = extractCleanContent(containerEl, cfg.contentInner);

        if (!text || text.length < 100) {
          callback({ error: 'Khong tim thay noi dung. Trang chua load xong hoac sai selector.' });
          return;
        }

        var titleEl = findEl(document, cfg.titleSels, 1);
        var title = titleEl ? (titleEl.innerText || titleEl.textContent).trim() : ('Chuong ' + getNumFromUrl(location.href));

        var nextUrl = findNextUrl(document, cfg.nextSel, location.href);
        if (nextUrl && nextUrl.charAt(0) === '/') nextUrl = location.origin + nextUrl;

        callback({
          number  : getNumFromUrl(location.href),
          title   : title,
          content : text,
          nextUrl : nextUrl,
          url     : location.href
        });
      } catch(e) {
        callback({ error: 'DOM loi: ' + e.message });
      }
    }, delay);
  }

  /* ----------------------------------------------------------------
     11. XAY DUNG UI
  ---------------------------------------------------------------- */
  var oldW = document.getElementById('__truyen_cex_popup__');
  if (oldW) oldW.remove();

  var W = document.createElement('div');
  W.id = '__truyen_cex_popup__';
  W.style.cssText = [
    'position:fixed','top:10px','right:10px','z-index:2147483647',
    'width:320px','background:#fff','border:2px solid #27ae60',
    'border-radius:10px','box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'font-family:Arial,sans-serif','font-size:13px','color:#222','overflow:hidden'
  ].join(';');

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:#27ae60;color:#fff;padding:8px 12px;font-weight:bold;font-size:14px;display:flex;justify-content:space-between;align-items:center;cursor:move;';
  hdr.innerHTML = '<span>📚 Truyen Extractor v8.2</span>';
  var closeBtn = document.createElement('span');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'cursor:pointer;font-size:16px;line-height:1;padding:0 4px;';
  closeBtn.onclick = function() { W.remove(); window.__TRUYEN_CEX_RUNNING__ = false; clearState(); };
  hdr.appendChild(closeBtn);
  W.appendChild(hdr);

  // Banner
  var ban = document.createElement('div');
  ban.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 10px;background:#f8f9fa;border-bottom:1px solid #eee;';
  SUPPORTED.forEach(function(s) {
    var on = (hostname === s.host);
    var chip = document.createElement('span');
    chip.style.cssText = [
      'display:inline-block','padding:2px 8px','border-radius:10px',
      'font-size:11px','font-weight:bold','cursor:pointer',
      'border:1px solid '+(on?'#27ae60':'#bbb'),
      'background:'+(on?'#27ae60':'#f0f0f0'),
      'color:'+(on?'#fff':'#666'),
      'white-space:nowrap','line-height:1.6'
    ].join(';');
    chip.textContent = (on ? '✓ ' : '') + s.label;
    chip.title = 'Mo ' + s.host;
    chip.onmouseenter = function() { this.style.opacity = '0.75'; };
    chip.onmouseleave = function() { this.style.opacity = '1'; };
    chip.onclick = function() { window.open('https://' + s.host, '_blank'); };
    ban.appendChild(chip);
  });
  W.appendChild(ban);

  // Body
  var body = document.createElement('div');
  body.style.cssText = 'padding:10px 12px;';

  if (!cfg) {
    body.innerHTML = '<div style="color:#e74c3c;text-align:center;padding:12px;">⚠️ Trang <b>' + hostname + '</b><br>chưa được hỗ trợ.</div>';
    W.appendChild(body);
    document.body.appendChild(W);
    makeDraggable(); return;
  }

  // Inputs
  var curNum = getNumFromUrl(location.href);
  function makeRow(label, id, ph, val) {
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;gap:6px;';
    d.innerHTML = '<label style="width:90px;font-size:12px;color:#555;flex-shrink:0;">' + label + '</label>' +
      '<input id="'+id+'" type="number" min="1" placeholder="'+ph+'" value="'+(val||'')+'" ' +
      'style="flex:1;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;">';
    return d;
  }
  body.appendChild(makeRow('Từ chương:', 'cex_from', 'VD: 1', isNaN(curNum) ? '' : curNum));
  body.appendChild(makeRow('Đến chương:', 'cex_to', 'VD: 50', ''));

  // Buttons
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
  function makeBtn(id, text, bg) {
    var b = document.createElement('button');
    b.id = id; b.textContent = text;
    b.style.cssText = 'flex:1;padding:6px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:bold;background:'+bg+';color:#fff;';
    return b;
  }
  var startBtn = makeBtn('cex_start_btn', '▶ Bắt đầu',  '#27ae60');
  var stopBtn  = makeBtn('cex_stop_btn',  '⏹ Dừng',     '#e74c3c');
  var dlBtn    = makeBtn('cex_dl_btn',    '⬇ Tải TXT',  '#3498db');
  stopBtn.disabled = true; dlBtn.disabled = true;
  btnRow.appendChild(startBtn); btnRow.appendChild(stopBtn); btnRow.appendChild(dlBtn);
  body.appendChild(btnRow);

  // Progress & Status
  var prog = document.createElement('div');
  prog.id = 'cex_progress';
  prog.style.cssText = 'font-size:12px;color:#27ae60;margin-bottom:4px;min-height:16px;';
  var stat = document.createElement('div');
  stat.id = 'cex_status';
  stat.style.cssText = 'font-size:11px;color:#888;margin-bottom:6px;min-height:14px;word-break:break-all;';
  stat.textContent = 'San sang.';
  body.appendChild(prog); body.appendChild(stat);

  // Preview
  var pvToggle = document.createElement('div');
  pvToggle.style.cssText = 'font-size:11px;color:#3498db;cursor:pointer;margin-bottom:4px;';
  pvToggle.textContent = '▶ Xem nội dung';
  var ta = document.createElement('textarea');
  ta.id = 'cex_textarea'; ta.readOnly = true;
  ta.style.cssText = 'width:100%;height:100px;resize:vertical;font-size:11px;border:1px solid #ddd;border-radius:4px;padding:4px;box-sizing:border-box;display:none;';
  pvToggle.onclick = function() {
    if (ta.style.display === 'none') { ta.style.display = 'block'; pvToggle.textContent = '▼ Ẩn nội dung'; }
    else { ta.style.display = 'none'; pvToggle.textContent = '▶ Xem nội dung'; }
  };
  body.appendChild(pvToggle); body.appendChild(ta);
  W.appendChild(body);
  document.body.appendChild(W);

  function makeDraggable() {
    var drag=false, ox=0, oy=0;
    hdr.addEventListener('mousedown', function(e){ drag=true; ox=e.clientX-W.offsetLeft; oy=e.clientY-W.offsetTop; e.preventDefault(); });
    document.addEventListener('mousemove', function(e){ if(!drag)return; W.style.left=(e.clientX-ox)+'px'; W.style.top=(e.clientY-oy)+'px'; W.style.right='auto'; });
    document.addEventListener('mouseup', function(){ drag=false; });
  }
  makeDraggable();

  /* ----------------------------------------------------------------
     12. BIEN TRANG THAI
  ---------------------------------------------------------------- */
  var collected = [], isRunning = false, stopFlag = false;

  function setStatus(msg) { var e=document.getElementById('cex_status'); if(e) e.textContent=msg; }
  function setProgress(d,t) { var e=document.getElementById('cex_progress'); if(e) e.textContent='✅ '+d+' / '+t+' chương'; }
  function appendPreview(c) { var e=document.getElementById('cex_textarea'); if(e) e.value+='=== '+c.title+' ===\n'+c.content+'\n\n'; }
  function enableDl() { var b=document.getElementById('cex_dl_btn'); if(b) b.disabled=false; }

  /* ----------------------------------------------------------------
     13. DOWNLOAD
  ---------------------------------------------------------------- */
  function doDownload() {
    if (!collected.length) { alert('Chua co du lieu!'); return; }
    var slug = location.pathname.split('/').filter(Boolean)[0] || 'truyen';
    var f=collected[0].number, l=collected[collected.length-1].number;
    var fname = slug+'_ch'+f+'-'+l+'.txt';
    var sep = '\n\n'+'═'.repeat(50)+'\n\n';
    var text = collected.map(function(c){ return '=== '+c.title+' ===\n\n'+c.content; }).join(sep);
    var blob = new Blob([text],{type:'text/plain;charset=utf-8'});
    var url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=fname; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setStatus('✅ Da tai: '+fname);
  }
  dlBtn.onclick = doDownload;

  /* ----------------------------------------------------------------
     14. FINISH
  ---------------------------------------------------------------- */
  function finishCollection() {
    isRunning=false; stopFlag=false;
    var sb=document.getElementById('cex_start_btn'), xb=document.getElementById('cex_stop_btn');
    if(sb){ sb.disabled=false; sb.textContent='▶ Bắt đầu'; }
    if(xb) xb.disabled=true;
    if(collected.length>0){ enableDl(); setStatus('✅ Hoan tat! '+collected.length+' chuong. Nhan ⬇ de tai.'); }
    else setStatus('Da dung.');
    clearState();
  }

  /* ----------------------------------------------------------------
     15. FETCH LOOP
  ---------------------------------------------------------------- */
  function fetchLoop(url, endNum, total) {
    if(stopFlag||!url){ finishCollection(); return; }
    var curN=getNumFromUrl(url);
    if(isNaN(curN)||curN>endNum){ finishCollection(); return; }
    setStatus('Dang tai chuong '+curN+'...');
    fetchChapter(url, function(res) {
      if(stopFlag){ finishCollection(); return; }
      if(res.error){ setStatus('⚠️ '+res.error+' — thu lai 2s'); setTimeout(function(){ fetchLoop(url,endNum,total); },2000); return; }
      collected.push({number:res.number,title:res.title,content:res.content});
      setProgress(collected.length,total); appendPreview(res); enableDl();
      if(res.number>=endNum||!res.nextUrl){ finishCollection(); }
      else setTimeout(function(){ fetchLoop(res.nextUrl,endNum,total); },900);
    });
  }

  /* ----------------------------------------------------------------
     16. DOM LOOP (xtruyen - reload)
  ---------------------------------------------------------------- */
  function domLoop(endNum, total) {
    if(stopFlag){ finishCollection(); return; }
    setStatus('Cho JS render...');
    readDomChapter(function(res){
      if(stopFlag){ finishCollection(); return; }
      if(res.error){ setStatus('⚠️ '+res.error); finishCollection(); return; }
      collected.push({number:res.number,title:res.title,content:res.content});
      setProgress(collected.length,total); appendPreview(res); enableDl();
      if(res.number>=endNum||!res.nextUrl){ finishCollection(); clearState(); }
      else {
        saveState({collected:collected,endNum:endNum,totalCount:total,nextUrl:res.nextUrl,running:true});
        setStatus('Chuyen sang chuong '+(res.number+1)+'...');
        setTimeout(function(){ location.href=res.nextUrl; },800);
      }
    });
  }

  /* ----------------------------------------------------------------
     17. RESUME (sau reload - chi dom mode)
  ---------------------------------------------------------------- */
  function tryResume() {
    if(!cfg||cfg.spa||cfg.mode!=='dom') return false;
    var state=loadState();
    if(!state||!state.running) return false;
    var stateN=getNumFromUrl(state.nextUrl||''), curN=getNumFromUrl(location.href);
    if(isNaN(stateN)||stateN!==curN){ clearState(); return false; }
    collected=state.collected||[];
    var endNum=state.endNum||1, total=state.totalCount||endNum;
    var ta2=document.getElementById('cex_textarea');
    if(ta2&&collected.length) ta2.value=collected.map(function(c){return'=== '+c.title+' ===\n'+c.content;}).join('\n\n'+'─'.repeat(40)+'\n\n');
    if(collected.length){ enableDl(); setProgress(collected.length,total); }
    isRunning=true;
    var sb=document.getElementById('cex_start_btn'), xb=document.getElementById('cex_stop_btn');
    if(sb){ sb.disabled=true; sb.textContent='⏳ Dang chay...'; }
    if(xb) xb.disabled=false;
    setStatus('↩️ Tiep tuc tu chuong da luu...');
    domLoop(endNum,total);
    return true;
  }

  /* ----------------------------------------------------------------
     18. START
  ---------------------------------------------------------------- */
  startBtn.onclick = function() {
    var fromN=parseInt((document.getElementById('cex_from')||{}).value||'',10);
    var toN  =parseInt((document.getElementById('cex_to')||{}).value||'',10);
    if(isNaN(fromN)||fromN<1){ alert('Nhap so chuong bat dau!'); return; }
    if(isNaN(toN)||toN<fromN){ alert('So chuong ket thuc phai >= bat dau!'); return; }
    collected=[]; isRunning=true; stopFlag=false; clearState();
    var sb=document.getElementById('cex_start_btn'), xb=document.getElementById('cex_stop_btn'), db=document.getElementById('cex_dl_btn');
    if(sb){sb.disabled=true;sb.textContent='⏳ Dang chay...';}
    if(xb) xb.disabled=false; if(db) db.disabled=true;
    var ta2=document.getElementById('cex_textarea'); if(ta2) ta2.value='';
    var total=toN-fromN+1, curN=getNumFromUrl(location.href);

    if(cfg.mode==='fetch'){
      var startUrl=(!isNaN(curN)&&curN===fromN)?location.href:location.href.replace(/chuong[-_]\d+/i,'chuong-'+fromN);
      fetchLoop(startUrl,toN,total);
    } else {
      if(!isNaN(curN)&&curN===fromN){ domLoop(toN,total); }
      else {
        var su2=location.href.replace(/chuong[-_]\d+/i,'chuong-'+fromN);
        saveState({collected:[],endNum:toN,totalCount:total,nextUrl:su2,running:true});
        setStatus('Chuyen den chuong '+fromN+'...');
        setTimeout(function(){ location.href=su2; },500);
      }
    }
  };

  /* ----------------------------------------------------------------
     19. STOP
  ---------------------------------------------------------------- */
  stopBtn.onclick = function() {
    stopFlag=true;
    var xb=document.getElementById('cex_stop_btn'); if(xb) xb.disabled=true;
    setStatus('Dang dung...'); clearState();
  };

  /* ----------------------------------------------------------------
     20. AUTO RESUME
  ---------------------------------------------------------------- */
  if(!tryResume()) setStatus('San sang. Nhap so chuong va nhan Bat dau.');

})();
