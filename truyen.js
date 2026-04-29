/* ====================================================================
   truyen.js — v8
   Ho tro:
     - truyenfull.vision  : HTML WordPress, fetch + DOMParser
     - tvtruyen.co.uk     : HTML WordPress, fetch + DOMParser
     - xtruyen.vn         : HTML JS-rendered, doc DOM sau 3.5s
     - truyenfree.org     : SPA Next.js, doc DOM sau render, khong reload
   ==================================================================== */
(function () {
  'use strict';

  if (window.__TRUYEN_CEX_RUNNING__) return;
  window.__TRUYEN_CEX_RUNNING__ = true;

  /* ----------------------------------------------------------------
     1. DANH SACH TRANG HO TRO (hien thi tren banner)
  ---------------------------------------------------------------- */
  var SUPPORTED = [
    { label: 'TruyenFull',  host: 'truyenfull.vision' },
    { label: 'TvTruyen',    host: 'tvtruyen.co.uk'    },
    { label: 'XTruyen',     host: 'xtruyen.vn'        },
    { label: 'TruyenFree',  host: 'truyenfree.org'    }
  ];

  /* ----------------------------------------------------------------
     2. CAU HINH TUNG TRANG
     mode: 'fetch' -> dung fetch() + DOMParser (truyenfull, tvtruyen)
           'dom'   -> doc DOM hien tai sau delay (xtruyen, truyenfree)
     spa: true     -> khong dung location.href, chi doc DOM 1 lan (truyenfree)
  ---------------------------------------------------------------- */
  var SITE_CONFIGS = {
    'truyenfull.vision': {
      mode        : 'fetch',
      contentSels : ['#chapter-c', '#chapter-content', '.chapter-c',
                     'div[id*="chapter"]'],
      titleSels   : ['h2.chapter-title', '.chapter-title', 'h2', 'h1'],
      nextSels    : ['a#next_chap', 'a.next_chap', 'a[href*="chuong-"]'],
      nextText    : 'tiep'
    },
    'tvtruyen.co.uk': {
      mode        : 'fetch',
      contentSels : ['#chapter-c', '#chapter-content', '.chapter-content',
                     'div[id*="chapter"]', '.box-chapter-content'],
      titleSels   : ['h2.chapter-title', '.chapter-title', 'h2', 'h1'],
      nextSels    : ['a.btn-chapter-nav', 'a[class*="chapter-nav"]',
                     'a[href*="chuong-"]'],
      nextText    : 'tiep'
    },
    'xtruyen.vn': {
      mode        : 'dom',
      spa         : false,
      contentSels : ['.reading-content .text-left', '.reading-content',
                     '.entry-content', '#chapter-content'],
      titleSels   : ['h2', '.chapter-name', 'h1', '.chapter-title'],
      nextSels    : ['a.btn.next_page', 'a.next_page', 'a[rel="next"]',
                     'a[href*="chuong-"]'],
      nextText    : 'tiep',
      domDelay    : 3500
    },
    'truyenfree.org': {
      mode        : 'dom',
      spa         : true,
      contentSels : ['.chapter-content', '#chapter-content',
                     'div[class*="chapter"] p', '.content-chapter',
                     'article .content', '.reading-content',
                     'div[class*="content"] p'],
      titleSels   : ['h1.chapter-title', '.chapter-title', 'h1', 'h2',
                     '[class*="chapter-name"]'],
      nextSels    : ['a[href*="chuong-"]:last-of-type',
                     'button[class*="next"]', 'a[class*="next"]',
                     'a[aria-label*="next"]', 'a[title*="tiep"]'],
      nextText    : 'tiep',
      domDelay    : 2000
    }
  };

  /* ----------------------------------------------------------------
     3. DETECT SITE
  ---------------------------------------------------------------- */
  var hostname = location.hostname.replace(/^www\./, '');
  var cfg = SITE_CONFIGS[hostname];

  /* ----------------------------------------------------------------
     4. STATE (sessionStorage)
  ---------------------------------------------------------------- */
  var STATE_KEY = 'truyen_cex_state_v8';

  function saveState(obj) {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(obj)); } catch(e) {}
  }
  function loadState() {
    try {
      var s = sessionStorage.getItem(STATE_KEY);
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
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

  function cleanText(raw) {
    return (raw || '')
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  // Tim element co noi dung dai nhat trong danh sach selector
  function findEl(doc, sels, minLen) {
    minLen = minLen || 0;
    var best = null, bestLen = 0;
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = doc.querySelector(sels[i]);
        if (el) {
          var len = (el.textContent || '').trim().length;
          if (len > minLen && len > bestLen) {
            bestLen = len;
            best = el;
          }
        }
      } catch(e) {}
    }
    return best;
  }

  // Tim next URL: quet qua tung selector, loc theo text co 'tiep'
  function findNextUrl(doc, sels, nextText, currentUrl) {
    for (var i = 0; i < sels.length; i++) {
      try {
        var links = doc.querySelectorAll(sels[i]);
        for (var j = 0; j < links.length; j++) {
          var a = links[j];
          var txt = (a.innerText || a.textContent || a.getAttribute('aria-label') || a.title || '').toLowerCase();
          var href = a.href || a.getAttribute('href') || '';
          if (!href || href === '#' || href === currentUrl) continue;
          if (nextText && txt.indexOf(nextText) !== -1) return href;
        }
      } catch(e) {}
    }
    // Fallback: tim tat ca link co chuong-N+1
    try {
      var curN = getNumFromUrl(currentUrl);
      if (!isNaN(curN)) {
        var nextN = curN + 1;
        var allLinks = doc.querySelectorAll('a[href*="chuong-' + nextN + '"]');
        if (allLinks.length > 0) return allLinks[0].href;
      }
    } catch(e) {}
    return null;
  }

  // Xay dung URL chuong ke tiep theo pattern +1
  function buildNextUrl(url, n) {
    var newUrl = url.replace(/chuong[-_](\d+)/i, 'chuong-' + n);
    return newUrl !== url ? newUrl : null;
  }

  /* ----------------------------------------------------------------
     6. FETCH CHAPTER (fetch + DOMParser)
  ---------------------------------------------------------------- */
  function fetchChapter(url, callback) {
    fetch(url, { credentials: 'include' })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function(html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var contentEl = findEl(doc, cfg.contentSels, 200);
        var titleEl   = findEl(doc, cfg.titleSels, 1);
        var nextUrl   = findNextUrl(doc, cfg.nextSels, cfg.nextText, url);
        var num       = getNumFromUrl(url);

        if (!contentEl) {
          callback({ error: 'Khong tim thay noi dung chuong ' + num });
          return;
        }

        var text = cleanText(contentEl.textContent);
        if (text.length < 100) {
          callback({ error: 'Noi dung qua ngan (' + text.length + ' chars) chuong ' + num });
          return;
        }

        // Chuyen URL tuong doi sang tuyet doi
        if (nextUrl && nextUrl.charAt(0) === '/') {
          nextUrl = location.origin + nextUrl;
        }

        callback({
          number  : num,
          title   : titleEl ? titleEl.textContent.trim() : ('Chuong ' + num),
          content : text,
          nextUrl : nextUrl || buildNextUrl(url, num + 1),
          url     : url
        });
      })
      .catch(function(e) {
        callback({ error: 'Fetch loi: ' + e.message });
      });
  }

  /* ----------------------------------------------------------------
     7. READ DOM CHAPTER (doc DOM hien tai sau delay)
  ---------------------------------------------------------------- */
  function readDomChapter(callback) {
    var delay = (cfg && cfg.domDelay) ? cfg.domDelay : 2500;
    setTimeout(function() {
      try {
        var contentEl = findEl(document, cfg.contentSels, 200);
        var titleEl   = findEl(document, cfg.titleSels, 1);
        var nextUrl   = findNextUrl(document, cfg.nextSels, cfg.nextText, location.href);
        var num       = getNumFromUrl(location.href);

        if (!contentEl) {
          // Fallback: tim element co text dai nhat tren trang
          var allDivs = document.querySelectorAll('div, article, section');
          var maxLen = 0;
          allDivs.forEach(function(el) {
            var len = (el.innerText || '').trim().length;
            if (len > maxLen && len < 100000) {
              maxLen = len;
              contentEl = el;
            }
          });
          if (!contentEl || maxLen < 500) {
            callback({ error: 'Khong tim thay noi dung. Trang chua load xong?' });
            return;
          }
        }

        var rawText = contentEl.innerText || contentEl.textContent || '';
        var text = cleanText(rawText);
        if (text.length < 100) {
          callback({ error: 'Noi dung qua ngan tai chuong ' + num });
          return;
        }

        if (nextUrl && nextUrl.charAt(0) === '/') {
          nextUrl = location.origin + nextUrl;
        }

        callback({
          number  : num,
          title   : titleEl ? (titleEl.innerText || titleEl.textContent).trim() : ('Chuong ' + num),
          content : text,
          nextUrl : nextUrl || buildNextUrl(location.href, num + 1),
          url     : location.href
        });
      } catch(e) {
        callback({ error: 'DOM loi: ' + e.message });
      }
    }, delay);
  }

  /* ----------------------------------------------------------------
     8. XAY DUNG UI
  ---------------------------------------------------------------- */
  var oldW = document.getElementById('__truyen_cex_popup__');
  if (oldW) oldW.remove();

  var W = document.createElement('div');
  W.id = '__truyen_cex_popup__';
  W.style.cssText = [
    'position:fixed','top:10px','right:10px','z-index:2147483647',
    'width:320px','background:#fff','border:2px solid #27ae60',
    'border-radius:10px','box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'font-family:Arial,sans-serif','font-size:13px','color:#222',
    'overflow:hidden'
  ].join(';');

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = [
    'background:#27ae60','color:#fff','padding:8px 12px',
    'font-weight:bold','font-size:14px',
    'display:flex','justify-content:space-between','align-items:center',
    'cursor:move'
  ].join(';');
  hdr.innerHTML = '<span>📚 Truyen Extractor v8</span>';

  var closeBtn = document.createElement('span');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'cursor:pointer;font-size:16px;line-height:1;padding:0 4px;';
  closeBtn.onclick = function() {
    W.remove();
    window.__TRUYEN_CEX_RUNNING__ = false;
    clearState();
  };
  hdr.appendChild(closeBtn);
  W.appendChild(hdr);

  // Banner
  var ban = document.createElement('div');
  ban.style.cssText = [
    'display:flex','gap:5px','flex-wrap:wrap',
    'padding:6px 10px','background:#f8f9fa',
    'border-bottom:1px solid #eee'
  ].join(';');
  SUPPORTED.forEach(function(s) {
    var on = (hostname === s.host);
    var chip = document.createElement('span');
    chip.style.cssText = [
      'display:inline-block','padding:2px 8px','border-radius:10px',
      'font-size:11px','font-weight:bold','cursor:pointer',
      'border:1px solid ' + (on ? '#27ae60' : '#bbb'),
      'background:'       + (on ? '#27ae60' : '#f0f0f0'),
      'color:'            + (on ? '#fff'     : '#666'),
      'white-space:nowrap','line-height:1.6'
    ].join(';');
    chip.textContent = (on ? '✓ ' : '') + s.label;
    chip.title = 'Mo ' + s.host + ' trong tab moi';
    chip.onmouseenter = function() { this.style.opacity = '0.75'; };
    chip.onmouseleave = function() { this.style.opacity = '1'; };
    chip.onclick = function() { window.open('https://' + s.host, '_blank'); };
    ban.appendChild(chip);
  });
  W.appendChild(ban);

  // Body
  var body = document.createElement('div');
  body.style.cssText = 'padding:10px 12px;';

  // Thong bao neu trang khong ho tro
  if (!cfg) {
    body.innerHTML = [
      '<div style="color:#e74c3c;text-align:center;padding:12px;">',
      '⚠️ Trang <b>' + hostname + '</b><br>chưa được hỗ trợ.',
      '<br><small style="color:#999">Chỉ hỗ trợ 4 trang trên.</small>',
      '</div>'
    ].join('');
    W.appendChild(body);
    document.body.appendChild(W);
    makeDraggable();
    return;
  }

  // Input tu/den chuong
  var curNum = getNumFromUrl(location.href);

  function makeRow(label, id, placeholder, val) {
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;gap:6px;';
    d.innerHTML = '<label style="width:90px;font-size:12px;color:#555;flex-shrink:0;">' + label + '</label>' +
      '<input id="' + id + '" type="number" min="1" placeholder="' + placeholder + '" ' +
      'value="' + (val || '') + '" style="flex:1;padding:4px 6px;border:1px solid #ccc;' +
      'border-radius:4px;font-size:13px;">';
    return d;
  }

  body.appendChild(makeRow('Từ chương:', 'cex_from', 'VD: 1', isNaN(curNum) ? '' : curNum));
  body.appendChild(makeRow('Đến chương:', 'cex_to', 'VD: 50', ''));

  // Buttons
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';

  function makeBtn(id, text, bg) {
    var b = document.createElement('button');
    b.id = id;
    b.textContent = text;
    b.style.cssText = [
      'flex:1','padding:6px','border:none','border-radius:5px',
      'cursor:pointer','font-size:13px','font-weight:bold',
      'background:' + bg, 'color:#fff'
    ].join(';');
    return b;
  }

  var startBtn = makeBtn('cex_start_btn', '▶ Bắt đầu',  '#27ae60');
  var stopBtn  = makeBtn('cex_stop_btn',  '⏹ Dừng',     '#e74c3c');
  var dlBtn    = makeBtn('cex_dl_btn',    '⬇ Tải TXT',  '#3498db');
  stopBtn.disabled = true;
  dlBtn.disabled   = true;

  btnRow.appendChild(startBtn);
  btnRow.appendChild(stopBtn);
  btnRow.appendChild(dlBtn);
  body.appendChild(btnRow);

  // Progress & Status
  var prog = document.createElement('div');
  prog.id = 'cex_progress';
  prog.style.cssText = 'font-size:12px;color:#27ae60;margin-bottom:4px;min-height:16px;';

  var stat = document.createElement('div');
  stat.id = 'cex_status';
  stat.style.cssText = 'font-size:11px;color:#888;margin-bottom:6px;min-height:14px;word-break:break-all;';
  stat.textContent = 'San sang.';

  body.appendChild(prog);
  body.appendChild(stat);

  // Preview textarea
  var pvToggle = document.createElement('div');
  pvToggle.style.cssText = 'font-size:11px;color:#3498db;cursor:pointer;margin-bottom:4px;';
  pvToggle.textContent   = '▶ Xem nội dung đã thu thập';

  var ta = document.createElement('textarea');
  ta.id = 'cex_textarea';
  ta.readOnly = true;
  ta.style.cssText = [
    'width:100%','height:100px','resize:vertical',
    'font-size:11px','border:1px solid #ddd','border-radius:4px',
    'padding:4px','box-sizing:border-box','display:none'
  ].join(';');
  ta.placeholder = 'Noi dung hien thi sau khi thu thap...';

  pvToggle.onclick = function() {
    if (ta.style.display === 'none') {
      ta.style.display = 'block';
      pvToggle.textContent = '▼ Ẩn nội dung';
    } else {
      ta.style.display = 'none';
      pvToggle.textContent = '▶ Xem nội dung đã thu thập';
    }
  };

  body.appendChild(pvToggle);
  body.appendChild(ta);
  W.appendChild(body);
  document.body.appendChild(W);

  // Keo tha
  function makeDraggable() {
    var drag = false, ox = 0, oy = 0;
    hdr.addEventListener('mousedown', function(e) {
      drag = true;
      ox = e.clientX - W.offsetLeft;
      oy = e.clientY - W.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!drag) return;
      W.style.left  = (e.clientX - ox) + 'px';
      W.style.top   = (e.clientY - oy) + 'px';
      W.style.right = 'auto';
    });
    document.addEventListener('mouseup', function() { drag = false; });
  }
  makeDraggable();

  /* ----------------------------------------------------------------
     9. BIEN TRANG THAI
  ---------------------------------------------------------------- */
  var collected = [];
  var isRunning = false;
  var stopFlag  = false;

  function setStatus(msg) {
    var el = document.getElementById('cex_status');
    if (el) el.textContent = msg;
  }
  function setProgress(done, total) {
    var el = document.getElementById('cex_progress');
    if (el) el.textContent = '✅ ' + done + ' / ' + total + ' chương';
  }
  function appendPreview(chapter) {
    var el = document.getElementById('cex_textarea');
    if (el) el.value += '=== ' + chapter.title + ' ===\n' + chapter.content + '\n\n';
  }
  function enableDl() {
    var b = document.getElementById('cex_dl_btn');
    if (b) b.disabled = false;
  }

  /* ----------------------------------------------------------------
     10. DOWNLOAD
  ---------------------------------------------------------------- */
  function doDownload() {
    if (!collected.length) { alert('Chua co du lieu de tai!'); return; }
    var slug = location.pathname.split('/').filter(Boolean)[0] || 'truyen';
    var f = collected[0].number, l = collected[collected.length - 1].number;
    var fname = slug + '_ch' + f + '-' + l + '.txt';
    var sep   = '\n\n' + '═'.repeat(50) + '\n\n';
    var text  = collected.map(function(c) {
      return '=== ' + c.title + ' ===\n\n' + c.content;
    }).join(sep);

    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('✅ Da tai: ' + fname);
  }
  dlBtn.onclick = doDownload;

  /* ----------------------------------------------------------------
     11. FINISH COLLECTION
  ---------------------------------------------------------------- */
  function finishCollection() {
    isRunning = false; stopFlag = false;
    var sb = document.getElementById('cex_start_btn');
    var xb = document.getElementById('cex_stop_btn');
    if (sb) { sb.disabled = false; sb.textContent = '▶ Bắt đầu'; }
    if (xb) xb.disabled = true;
    if (collected.length > 0) {
      enableDl();
      setStatus('✅ Hoan tat! ' + collected.length + ' chuong. Nhan ⬇ de tai.');
    } else {
      setStatus('Da dung.');
    }
    clearState();
  }

  /* ----------------------------------------------------------------
     12. FETCH LOOP (truyenfull, tvtruyen)
  ---------------------------------------------------------------- */
  function fetchLoop(url, endNum, totalCount) {
    if (stopFlag || !url) { finishCollection(); return; }
    var curN = getNumFromUrl(url);
    if (isNaN(curN) || curN > endNum) { finishCollection(); return; }

    setStatus('Dang tai chuong ' + curN + '...');

    fetchChapter(url, function(res) {
      if (stopFlag) { finishCollection(); return; }
      if (res.error) {
        setStatus('⚠️ ' + res.error + ' — thu lai sau 2s');
        setTimeout(function() { fetchLoop(url, endNum, totalCount); }, 2000);
        return;
      }

      collected.push({ number: res.number, title: res.title, content: res.content });
      setProgress(collected.length, totalCount);
      appendPreview(res);
      enableDl();

      if (res.number >= endNum || !res.nextUrl) {
        finishCollection();
      } else {
        setTimeout(function() { fetchLoop(res.nextUrl, endNum, totalCount); }, 900);
      }
    });
  }

  /* ----------------------------------------------------------------
     13. DOM LOOP (xtruyen – reload sau moi chuong)
  ---------------------------------------------------------------- */
  function domLoop(endNum, totalCount) {
    if (stopFlag) { finishCollection(); return; }
    setStatus('Cho JS render noi dung...');

    readDomChapter(function(res) {
      if (stopFlag) { finishCollection(); return; }
      if (res.error) {
        setStatus('⚠️ ' + res.error);
        finishCollection(); return;
      }

      collected.push({ number: res.number, title: res.title, content: res.content });
      setProgress(collected.length, totalCount);
      appendPreview(res);
      enableDl();

      if (res.number >= endNum || !res.nextUrl) {
        finishCollection(); clearState();
      } else {
        saveState({
          collected : collected,
          endNum    : endNum,
          totalCount: totalCount,
          nextUrl   : res.nextUrl,
          running   : true
        });
        setStatus('Chuyen sang chuong ' + (res.number + 1) + '...');
        setTimeout(function() { location.href = res.nextUrl; }, 800);
      }
    });
  }

  /* ----------------------------------------------------------------
     14. SPA LOOP (truyenfree – chi doc DOM, next click)
  ---------------------------------------------------------------- */
  function spaLoop(endNum, totalCount) {
    if (stopFlag) { finishCollection(); return; }
    setStatus('Cho SPA render noi dung...');

    readDomChapter(function(res) {
      if (stopFlag) { finishCollection(); return; }
      if (res.error) {
        setStatus('⚠️ ' + res.error);
        // Thu click nut next roi thu lai
        var nextBtn = findNextElement();
        if (nextBtn) {
          nextBtn.click();
          setTimeout(function() { spaLoop(endNum, totalCount); }, cfg.domDelay + 1000);
        } else {
          finishCollection();
        }
        return;
      }

      collected.push({ number: res.number, title: res.title, content: res.content });
      setProgress(collected.length, totalCount);
      appendPreview(res);
      enableDl();

      if (res.number >= endNum || !res.nextUrl) {
        finishCollection();
      } else {
        // Chuyen den chuong tiep: click nut hoac thay doi URL qua history
        setStatus('Chuyen sang chuong ' + (res.number + 1) + '...');
        var nextBtn = findNextElement();
        if (nextBtn) {
          nextBtn.click();
        } else {
          // Fallback: thay URL bang history.pushState
          history.pushState({}, '', res.nextUrl);
          window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
        setTimeout(function() { spaLoop(endNum, totalCount); }, cfg.domDelay + 500);
      }
    });
  }

  function findNextElement() {
    for (var i = 0; i < cfg.nextSels.length; i++) {
      try {
        var els = document.querySelectorAll(cfg.nextSels[i]);
        for (var j = 0; j < els.length; j++) {
          var txt = (els[j].innerText || els[j].textContent || '').toLowerCase();
          if (txt.indexOf('tiep') !== -1 || txt.indexOf('next') !== -1) return els[j];
          if (els[j].href && els[j].href !== location.href) return els[j];
        }
      } catch(e) {}
    }
    return null;
  }

  /* ----------------------------------------------------------------
     15. RESUME SAU RELOAD (chi dom mode, khong spa)
  ---------------------------------------------------------------- */
  function tryResume() {
    if (!cfg || cfg.spa) return false;
    if (cfg.mode !== 'dom') return false;
    var state = loadState();
    if (!state || !state.running) return false;

    // Kiem tra dang o dung URL tiep theo
    var stateN = getNumFromUrl(state.nextUrl || '');
    var curN   = getNumFromUrl(location.href);
    if (isNaN(stateN) || stateN !== curN) { clearState(); return false; }

    // Khoi phuc
    collected   = state.collected   || [];
    var endNum  = state.endNum      || 1;
    var total   = state.totalCount  || endNum;

    // Cap nhat UI
    var ta2 = document.getElementById('cex_textarea');
    if (ta2 && collected.length) {
      ta2.value = collected.map(function(c) {
        return '=== ' + c.title + ' ===\n' + c.content;
      }).join('\n\n' + '─'.repeat(40) + '\n\n');
    }
    if (collected.length) { enableDl(); setProgress(collected.length, total); }

    isRunning = true;
    var sb = document.getElementById('cex_start_btn');
    var xb = document.getElementById('cex_stop_btn');
    if (sb) { sb.disabled = true; sb.textContent = '⏳ Dang chay...'; }
    if (xb) xb.disabled = false;

    setStatus('↩️ Tiep tuc tu chuong da luu...');
    domLoop(endNum, total);
    return true;
  }

  /* ----------------------------------------------------------------
     16. START BUTTON
  ---------------------------------------------------------------- */
  startBtn.onclick = function() {
    var fromEl = document.getElementById('cex_from');
    var toEl   = document.getElementById('cex_to');
    var fromN  = parseInt(fromEl ? fromEl.value : '', 10);
    var toN    = parseInt(toEl   ? toEl.value   : '', 10);

    if (isNaN(fromN) || fromN < 1) {
      alert('Nhap so chuong bat dau hop le!'); return;
    }
    if (isNaN(toN) || toN < fromN) {
      alert('So chuong ket thuc phai >= bat dau!'); return;
    }

    collected = []; isRunning = true; stopFlag = false;
    clearState();

    var sb = document.getElementById('cex_start_btn');
    var xb = document.getElementById('cex_stop_btn');
    var db = document.getElementById('cex_dl_btn');
    if (sb) { sb.disabled = true; sb.textContent = '⏳ Dang chay...'; }
    if (xb) xb.disabled = false;
    if (db) db.disabled = true;

    var ta2 = document.getElementById('cex_textarea');
    if (ta2) ta2.value = '';

    var totalCount = toN - fromN + 1;
    var curN = getNumFromUrl(location.href);

    if (cfg.mode === 'fetch') {
      // Xay dung URL chuong dau tien
      var startUrl;
      if (!isNaN(curN) && curN === fromN) {
        startUrl = location.href;
      } else {
        startUrl = location.href.replace(/chuong[-_]\d+/i, 'chuong-' + fromN);
        if (startUrl === location.href && !startUrl.match(/chuong-\d+/)) {
          alert('Khong the xac dinh URL chuong. Hay mo dung chuong bat dau!');
          finishCollection(); return;
        }
      }
      fetchLoop(startUrl, toN, totalCount);

    } else if (cfg.spa) {
      // SPA: neu chua o dung chuong, chuyen truoc
      if (!isNaN(curN) && curN === fromN) {
        spaLoop(toN, totalCount);
      } else {
        var targetUrl = location.href.replace(/chuong[-_]\d+/i, 'chuong-' + fromN);
        history.pushState({}, '', targetUrl);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        setTimeout(function() { spaLoop(toN, totalCount); }, cfg.domDelay + 500);
      }

    } else {
      // DOM + reload (xtruyen)
      if (!isNaN(curN) && curN === fromN) {
        domLoop(toN, totalCount);
      } else {
        var targetUrl2 = location.href.replace(/chuong[-_]\d+/i, 'chuong-' + fromN);
        saveState({
          collected: [], endNum: toN, totalCount: totalCount,
          nextUrl: targetUrl2, running: true
        });
        setStatus('Chuyen den chuong ' + fromN + '...');
        setTimeout(function() { location.href = targetUrl2; }, 500);
      }
    }
  };

  /* ----------------------------------------------------------------
     17. STOP BUTTON
  ---------------------------------------------------------------- */
  stopBtn.onclick = function() {
    stopFlag = true;
    var xb = document.getElementById('cex_stop_btn');
    if (xb) xb.disabled = true;
    setStatus('Dang dung...');
    clearState();
  };

  /* ----------------------------------------------------------------
     18. AUTO RESUME khi load lai trang (chi dom mode)
  ---------------------------------------------------------------- */
  if (!tryResume()) {
    setStatus('San sang. Nhap so chuong va nhan Bat dau.');
  }

})();
