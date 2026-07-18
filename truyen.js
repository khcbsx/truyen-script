/* ====================================================================
   truyen.js — v8.8
   Ho tro: truyenfull.live, tvtruyen.site, xtruyen.net
   Update: Khac phuc hieu ung Ping-Pong (Chong lay nham nut Chuong Truoc)
   ==================================================================== */
(function () {
  'use strict';

  if (window.__TRUYEN_CEX_RUNNING__) return;
  window.__TRUYEN_CEX_RUNNING__ = true;

  var SUPPORTED = [
    { label: 'TruyenFull', host: 'truyenfull.live' },
    { label: 'TvTruyen',   host: 'tvtruyen.site'   },
    { label: 'XTruyen',    host: 'xtruyen.net'     }
  ];

  var SITE_CONFIGS = {
    'truyenfull.live': {
      mode         : 'fetch',
      contentSel   : '#chapter-c',
      contentInner : 'p',
      titleSels    : ['.chapter-title', '.chapter-text', 'h2 a', 'h2', 'h1'],
      nextSel      : 'a#next_chap'
    },
    'tvtruyen.site': {
      mode         : 'fetch', 
      contentSel   : '#chapter-content',
      contentInner : 'p',
      titleSels    : ['.chapter-title', 'h2.chapter-title', 'h2', 'h1'],
      nextSel      : 'a#next_chap, a.btn-chapter-nav, a.next, .chapter-nav a, a[href*="chuong-"]'
    },
    'xtruyen.net': {
      mode         : 'dom',
      spa          : false,
      contentSel   : '.reading-content .text-left',
      contentInner : 'p',
      titleSels    : ['h2', '.chapter-name', 'h1', '.chapter-title'],
      nextSel      : 'a.btn.next_page',
      domDelay     : 3500
    }
  };

  var hostname = location.hostname.replace(/^www\./, '');
  var cfg = SITE_CONFIGS[hostname];
  var STATE_KEY = 'truyen_cex_state_v8';

  function saveState(obj) { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(obj)); } catch(e) {} }
  function loadState() { try { var s = sessionStorage.getItem(STATE_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; } }
  function clearState() { try { sessionStorage.removeItem(STATE_KEY); } catch(e) {} }

  function getNumFromUrl(url) {
    var m = (url || '').match(/(?:chuong|chap)[-_]*(\d+)/i);
    return m ? parseInt(m[1], 10) : NaN;
  }

  function cleanLine(line) { return line.replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ').trim(); }

  var NAV_PATTERNS = [
    /chuong\s*(truoc|tiep|ti[eê]p)/i, /ch.*\d+.*ch/i, /tai\s*pdf/i, /nghe\s*truy[eê]n/i, 
    /bao\s*loi/i, /binh\s*luan/i, /^#\d+\s*\./, /function\s+\w+\(/, /document\./, /style\s*=/i,
    /^(ch|chuong)\s*truoc$/i, /^(ch|chuong)\s*tiep$/i, /^chuong\s*\d+\s*$/i, /click\s*ads/i, /mo\s*khoa/i, /quang\s*cao/i, /vui\s*long/i
  ];

  function isNavOrJunk(text) {
    var t = text.trim();
    if (t.length < 5) return true;
    for (var i = 0; i < NAV_PATTERNS.length; i++) { if (NAV_PATTERNS[i].test(t)) return true; }
    return false;
  }

  function extractCleanContent(containerEl, innerTag) {
    if (!containerEl) return '';
    var lines = [];
    if (innerTag) {
      var pTags = containerEl.querySelectorAll(innerTag);
      if (pTags.length > 0) {
        pTags.forEach(function(p) {
          var parent = p.parentElement, skip = false;
          while (parent && parent !== containerEl) {
            var pid = (parent.id || '').toLowerCase(), pcls = (parent.className || '').toLowerCase();
            if (pid.indexOf('ads') !== -1 || pcls.indexOf('ads') !== -1 || pid.indexOf('unlock') !== -1 || pcls.indexOf('unlock') !== -1) { skip = true; break; }
            parent = parent.parentElement;
          }
          if (skip) return;
          var txt = (p.innerText || p.textContent || '').replace(/\n+/g, ' ').trim();
          if (!isNavOrJunk(txt)) lines.push(txt);
        });
        if (lines.length > 0) return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
      }
    }

    var walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        var p = node.parentNode;
        while (p && p !== containerEl) {
          var tag = (p.tagName || '').toUpperCase(), id2 = (p.id || '').toLowerCase(), cls = (p.className || '').toLowerCase();
          if (tag === 'SCRIPT' || tag === 'STYLE' || id2.indexOf('ads') !== -1 || cls.indexOf('ads') !== -1 || id2.indexOf('unlock') !== -1 || cls.indexOf('unlock') !== -1) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    var rawLines = [], node;
    while ((node = walker.nextNode())) { var t = cleanLine(node.nodeValue); if (t) rawLines.push(t); }
    return rawLines.filter(function(l) { return !isNavOrJunk(l); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function findEl(doc, sels, minLen) {
    minLen = minLen || 0;
    if (typeof sels === 'string') sels = [sels];
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = doc.querySelector(sels[i]);
        if (el) { 
          var len = (el.textContent || '').trim().length; 
          if (len > minLen) return el; 
        }
      } catch(e) {}
    }
    return null;
  }

  function findNextUrl(doc, nextSel, currentUrl) {
    try {
      var links = doc.querySelectorAll(nextSel);
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = a.href || a.getAttribute('href') || '';
        var txt = (a.textContent || '').toLowerCase();
        var cls = (a.className || '').toLowerCase();
        var id = (a.id || '').toLowerCase();

        // CHỐT CHẶN MỚI: Bỏ qua tất cả các link có dấu hiệu là nút "Chương trước"
        if (txt.indexOf('trước') !== -1 || txt.indexOf('prev') !== -1 || cls.indexOf('prev') !== -1 || id.indexOf('prev') !== -1) {
            continue; 
        }

        if (href && href !== '#' && href !== currentUrl && href.indexOf('javascript') === -1 && href.match(/(chuong|chap)[-_]\d+/i)) return href;
      }
    } catch(e) {}
    
    // Fallback: Tự động cộng số chương nếu không tìm thấy nút Next
    var curN = getNumFromUrl(currentUrl);
    if (!isNaN(curN)) {
      var next = currentUrl.replace(/(chuong|chap)([-_])\d+/i, '$1$2' + (curN + 1));
      if (next !== currentUrl) return next;
    }
    return null;
  }

  function fetchChapter(url, callback) {
    fetch(url, { credentials: 'include' }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var titleEl = findEl(doc, cfg.titleSels, 1);
        var title = titleEl ? titleEl.textContent.trim() : ('Chuong ' + getNumFromUrl(url));
        var containerEl = doc.querySelector(cfg.contentSel);
        var text = extractCleanContent(containerEl, cfg.contentInner);
        if (!text || text.length < 100) { callback({ error: 'Noi dung ngan chuong ' + getNumFromUrl(url) }); return; }
        var nextUrl = findNextUrl(doc, cfg.nextSel, url);
        if (nextUrl && nextUrl.charAt(0) === '/') nextUrl = location.origin + nextUrl;
        callback({ number: getNumFromUrl(url), title: title, content: text, nextUrl: nextUrl, url: url });
      }).catch(function(e) { callback({ error: 'Fetch loi: ' + e.message }); });
  }

  function readDomChapter(callback) {
    var delay = cfg.domDelay || 2500;
    setTimeout(function() {
      try {
        var containerEl = null;
        try { containerEl = document.querySelector(cfg.contentSel); } catch(e) {}
        var text = extractCleanContent(containerEl, cfg.contentInner);
        if (!text || text.length < 100) { callback({ error: 'Khong tim thay noi dung.' }); return; }
        var titleEl = findEl(document, cfg.titleSels, 1);
        var title = titleEl ? (titleEl.innerText || titleEl.textContent).trim() : ('Chuong ' + getNumFromUrl(location.href));
        var nextUrl = findNextUrl(document, cfg.nextSel, location.href);
        if (nextUrl && nextUrl.charAt(0) === '/') nextUrl = location.origin + nextUrl;
        callback({ number: getNumFromUrl(location.href), title: title, content: text, nextUrl: nextUrl, url: location.href });
      } catch(e) { callback({ error: 'DOM loi: ' + e.message }); }
    }, delay);
  }

  /* --- GIAO DIEN UI --- */
  var oldW = document.getElementById('__truyen_cex_popup__');
  if (oldW) oldW.remove();
  var W = document.createElement('div');
  W.id = '__truyen_cex_popup__';
  W.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;width:320px;background:#fff;border:2px solid #27ae60;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Arial,sans-serif;font-size:13px;color:#222;overflow:hidden;';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:#27ae60;color:#fff;padding:8px 12px;font-weight:bold;font-size:14px;display:flex;justify-content:space-between;align-items:center;cursor:move;';
  hdr.innerHTML = '<span>📚 Truyen Extractor v8.8</span>';
  var closeBtn = document.createElement('span'); closeBtn.textContent = '✕'; closeBtn.style.cssText = 'cursor:pointer;font-size:16px;line-height:1;padding:0 4px;';
  closeBtn.onclick = function() { W.remove(); window.__TRUYEN_CEX_RUNNING__ = false; clearState(); };
  hdr.appendChild(closeBtn); W.appendChild(hdr);

  var ban = document.createElement('div');
  ban.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 10px;background:#f8f9fa;border-bottom:1px solid #eee;';
  SUPPORTED.forEach(function(s) {
    var on = (hostname === s.host);
    var chip = document.createElement('span');
    chip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;cursor:pointer;border:1px solid '+(on?'#27ae60':'#bbb')+';background:'+(on?'#27ae60':'#f0f0f0')+';color:'+(on?'#fff':'#666')+';white-space:nowrap;line-height:1.6;';
    chip.textContent = (on ? '✓ ' : '') + s.label; chip.title = 'Mo ' + s.host;
    chip.onmouseenter = function() { this.style.opacity = '0.75'; }; chip.onmouseleave = function() { this.style.opacity = '1'; };
    chip.onclick = function() { window.open('https://' + s.host, '_blank'); };
    ban.appendChild(chip);
  });
  W.appendChild(ban);

  var body = document.createElement('div'); body.style.cssText = 'padding:10px 12px;';
  if (!cfg) {
    body.innerHTML = '<div style="color:#e74c3c;text-align:center;padding:12px;">⚠️ Trang <b>' + hostname + '</b><br>chưa được hỗ trợ.</div>';
    W.appendChild(body); document.body.appendChild(W);
    makeDraggable(); return;
  }

  var curNum = getNumFromUrl(location.href);
  function makeRow(label, id, ph, val) {
    var d = document.createElement('div'); d.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;gap:6px;';
    d.innerHTML = '<label style="width:90px;font-size:12px;color:#555;flex-shrink:0;">' + label + '</label><input id="'+id+'" type="number" min="1" placeholder="'+ph+'" value="'+(val||'')+'" style="flex:1;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;">';
    return d;
  }
  body.appendChild(makeRow('Từ chương:', 'cex_from', 'VD: 1', isNaN(curNum) ? '' : curNum)); body.appendChild(makeRow('Đến chương:', 'cex_to', 'VD: 50', ''));

  var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
  function makeBtn(id, text, bg) {
    var b = document.createElement('button'); b.id = id; b.textContent = text;
    b.style.cssText = 'flex:1;padding:6px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:bold;background:'+bg+';color:#fff;';
    return b;
  }
  var startBtn = makeBtn('cex_start_btn', '▶ Bắt đầu',  '#27ae60'), stopBtn  = makeBtn('cex_stop_btn',  '⏹ Dừng', '#e74c3c'), dlBtn = makeBtn('cex_dl_btn', '⬇ Tải File',  '#3498db');
  stopBtn.disabled = true; dlBtn.disabled = true;
  btnRow.appendChild(startBtn); btnRow.appendChild(stopBtn); btnRow.appendChild(dlBtn); body.appendChild(btnRow);

  var prog = document.createElement('div'); prog.id = 'cex_progress'; prog.style.cssText = 'font-size:12px;color:#27ae60;margin-bottom:4px;min-height:16px;';
  var stat = document.createElement('div'); stat.id = 'cex_status'; stat.style.cssText = 'font-size:11px;color:#888;margin-bottom:6px;min-height:14px;word-break:break-all;'; stat.textContent = 'San sang.';
  body.appendChild(prog); body.appendChild(stat);

  var pvToggle = document.createElement('div'); pvToggle.style.cssText = 'font-size:11px;color:#3498db;cursor:pointer;margin-bottom:4px;'; pvToggle.textContent = '▶ Xem nội dung';
  var ta = document.createElement('textarea'); ta.id = 'cex_textarea'; ta.readOnly = true; ta.style.cssText = 'width:100%;height:100px;resize:vertical;font-size:11px;border:1px solid #ddd;border-radius:4px;padding:4px;box-sizing:border-box;display:none;';
  pvToggle.onclick = function() { if (ta.style.display === 'none') { ta.style.display = 'block'; pvToggle.textContent = '▼ Ẩn nội dung'; } else { ta.style.display = 'none'; pvToggle.textContent = '▶ Xem nội dung'; } };
  body.appendChild(pvToggle); body.appendChild(ta); W.appendChild(body); document.body.appendChild(W);

  function makeDraggable() {
    var drag=false, ox=0, oy=0;
    hdr.addEventListener('mousedown', function(e){ drag=true; ox=e.clientX-W.offsetLeft; oy=e.clientY-W.offsetTop; e.preventDefault(); });
    document.addEventListener('mousemove', function(e){ if(!drag)return; W.style.left=(e.clientX-ox)+'px'; W.style.top=(e.clientY-oy)+'px'; W.style.right='auto'; });
    document.addEventListener('mouseup', function(){ drag=false; });
  }
  makeDraggable();

  var collected = [], isRunning = false, stopFlag = false;

  function setStatus(msg) { var e=document.getElementById('cex_status'); if(e) e.textContent=msg; }
  function setProgress(d,t) { var e=document.getElementById('cex_progress'); if(e) e.textContent='✅ '+d+' / '+t+' chương'; }
  function appendPreview(c) { var e=document.getElementById('cex_textarea'); if(e) e.value+='=== '+c.title+' ===\n'+c.content+'\n\n'; }
  function enableDl() { var b=document.getElementById('cex_dl_btn'); if(b) b.disabled=false; }

  function doDownload() {
    if (!collected.length) { alert('Chua co du lieu!'); return; }
    var slug = location.pathname.split('/').filter(Boolean)[0] || 'truyen';
    var f = collected[0].number, l = collected[collected.length-1].number;
    var fname = slug + '_ch' + f + '-' + l + '.doc';

    var htmlContent = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    htmlContent += '<head><meta charset="utf-8"><title>Truyen Extractor</title></head><body>';

    collected.forEach(function(c) {
      htmlContent += '<h2 style="text-align:center; color:#27ae60; font-family: Arial;">' + c.title + '</h2>';
      var paragraphs = c.content.split('\n').map(function(line) {
           if (line.trim() === '') return '';
           return '<p style="font-size: 14pt; line-height: 1.5; font-family: Arial;">' + line + '</p>';
      }).join('');
      htmlContent += paragraphs;
      htmlContent += '<br clear="all" style="page-break-before:always" />'; 
    });
    htmlContent += '</body></html>';

    var blob = new Blob(['\ufeff', htmlContent], {type: 'application/msword'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fname; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setStatus('✅ Da tai file Word: ' + fname);
  }
  dlBtn.onclick = doDownload;

  function finishCollection() {
    isRunning=false; stopFlag=false;
    var sb=document.getElementById('cex_start_btn'), xb=document.getElementById('cex_stop_btn');
    if(sb){ sb.disabled=false; sb.textContent='▶ Bắt đầu'; }
    if(xb) xb.disabled=true;
    if(collected.length>0){ enableDl(); setStatus('✅ Hoan tat! Nhan ⬇ de tai file Word.'); }
    else setStatus('Da dung.');
    clearState();
  }

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
      if(res.number>=endNum || collected.length >= total || !res.nextUrl){ finishCollection(); }
      else setTimeout(function(){ fetchLoop(res.nextUrl,endNum,total); },900);
    });
  }

  function domLoop(endNum, total) {
    if(stopFlag){ finishCollection(); return; }
    setStatus('Cho JS render...');
    readDomChapter(function(res){
      if(stopFlag){ finishCollection(); return; }
      if(res.error){ setStatus('⚠️ '+res.error); finishCollection(); return; }
      collected.push({number:res.number,title:res.title,content:res.content});
      setProgress(collected.length,total); appendPreview(res); enableDl();
      if(res.number>=endNum || collected.length >= total || !res.nextUrl){ finishCollection(); clearState(); }
      else {
        saveState({collected:collected,endNum:endNum,totalCount:total,nextUrl:res.nextUrl,running:true});
        setStatus('Chuyen sang chuong '+(res.number+1)+'...');
        setTimeout(function(){ location.href=res.nextUrl; },800);
      }
    });
  }

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

  startBtn.onclick = function() {
    var curN=getNumFromUrl(location.href);
    if(isNaN(curN)) {
       alert("LỖI: Bạn phải BẤM VÀO ĐỌC một chương bất kỳ rồi mới được nhấn Bắt đầu!");
       return;
    }

    var fromN=parseInt((document.getElementById('cex_from')||{}).value||'',10), toN=parseInt((document.getElementById('cex_to')||{}).value||'',10);
    if(isNaN(fromN)||fromN<1){ alert('Nhap so chuong bat dau!'); return; }
    if(isNaN(toN)||toN<fromN){ alert('So chuong ket thuc phai >= bat dau!'); return; }
    collected=[]; isRunning=true; stopFlag=false; clearState();
    var sb=document.getElementById('cex_start_btn'), xb=document.getElementById('cex_stop_btn'), db=document.getElementById('cex_dl_btn');
    if(sb){sb.disabled=true;sb.textContent='⏳ Dang chay...';}
    if(xb) xb.disabled=false; if(db) db.disabled=true;
    var ta2=document.getElementById('cex_textarea'); if(ta2) ta2.value='';
    var total=toN-fromN+1;

    if(cfg.mode==='fetch'){
      var startUrl=(!isNaN(curN)&&curN===fromN)?location.href:location.href.replace(/(chuong|chap)([-_])\d+/i,'$1$2'+fromN);
      fetchLoop(startUrl,toN,total);
    } else {
      if(!isNaN(curN)&&curN===fromN){ domLoop(toN,total); }
      else {
        var su2=location.href.replace(/(chuong|chap)([-_])\d+/i,'$1$2'+fromN);
        saveState({collected:[],endNum:toN,totalCount:total,nextUrl:su2,running:true});
        setStatus('Chuyen den chuong '+fromN+'...');
        setTimeout(function(){ location.href=su2; },500);
      }
    }
  };

  stopBtn.onclick = function() { stopFlag=true; var xb=document.getElementById('cex_stop_btn'); if(xb) xb.disabled=true; setStatus('Dang dung...'); clearState(); };
  if(!tryResume()) setStatus('San sang. Nhap so chuong va nhan Bat dau.');
})();
