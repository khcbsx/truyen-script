(function () {
  /* ================================================================
     truyen.js — v7
     Ho tro: truyenfree.org (SPA) + 14 trang HTML khac
     Tampermonkey tu dong chay lai sau moi reload
  ================================================================ */

  var LS_STATE_KEY = 'truyen_cex_state_v7';

  // ── 1. DANH SACH TRANG HO TRO ────────────────────────────────────
  var SUPPORTED = [
    { label: 'TruyenFree',  host: 'truyenfree.org'      },
    { label: 'TruyenFull',  host: 'truyenfull.vision'    },
    { label: 'TvTruyen',    host: 'tvtruyen.co.uk'       },
    { label: 'XTruyen',     host: 'xtruyen.vn'           },
    { label: 'MeTruyenChu', host: 'metruyenchu.com.vn'   },
    { label: 'TangThuVien', host: 'tangthuvien.net'      },
    { label: 'SSTruyen',    host: 'sstruyen.com.vn'      },
    { label: 'TruyenYY',    host: 'truyenyy.co'          },
    { label: 'TruyenTV',    host: 'truyentv.vn'          },
    { label: 'HemTruyen',   host: 'hemtruyen.vn'         },
    { label: 'TruyenChu',   host: 'truyenchu.com.vn'     },
    { label: 'MeTruyenVN',  host: 'metruyenvn.com'       },
    { label: 'Convert',     host: 'truyenconvert.net'    },
    { label: 'WikiDich',    host: 'wikidich.com'         },
    { label: 'TruyenHay',   host: 'truyenhay.vn'         }
  ];

  // ── 2. CAU HINH TUNG TRANG ────────────────────────────────────────
  var SITE_CONFIGS = {
    'truyenfree.org': {
      type: 'spa', label: 'TruyenFree'
    },
    'truyenfull.vision': {
      type: 'html', label: 'TruyenFull',
      contentSel: '#chapter-c',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap'
    },
    'tvtruyen.co.uk': {
      type: 'html', label: 'TvTruyen',
      contentSel: '#chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    'a.btn-chapter-nav'
    },
    'xtruyen.vn': {
      type: 'html', label: 'XTruyen',
      contentSel: '.reading-content .text-left, .reading-content, .entry-content',
      titleSel:   'h2, .chapter-name',
      nextSel:    'a.btn.next_page, a.next_page'
    },
    'metruyenchu.com.vn': {
      type: 'html', label: 'MeTruyenChu',
      contentSel: '.chapter-content, #chapter-content, .content-chapter',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a.next-chap, a[id*="next"]'
    },
    'tangthuvien.net': {
      type: 'html', label: 'TangThuVien',
      contentSel: '#box-chapter-content, .box-chapter-content',
      titleSel:   'h2, .chapter-title',
      nextSel:    'a#next-chapter, a.next-chapter, a[title*="sau"], a[title*="tiep"]'
    },
    'sstruyen.com.vn': {
      type: 'html', label: 'SSTruyen',
      contentSel: '#chapter-c, .chapter-c, #chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a.next-chap'
    },
    'truyenyy.co': {
      type: 'html', label: 'TruyenYY',
      contentSel: '#chapter-c, .chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    },
    'truyentv.vn': {
      type: 'html', label: 'TruyenTV',
      contentSel: '#chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a.next-chap, a[title*="tiep"]'
    },
    'hemtruyen.vn': {
      type: 'html', label: 'HemTruyen',
      contentSel: '#chapter-c, .chapter-c, #chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    },
    'truyenchu.com.vn': {
      type: 'html', label: 'TruyenChu',
      contentSel: '#chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    },
    'metruyenvn.com': {
      type: 'html', label: 'MeTruyenVN',
      contentSel: '#chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    },
    'truyenconvert.net': {
      type: 'html', label: 'Convert',
      contentSel: '#chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    },
    'wikidich.com': {
      type: 'html', label: 'WikiDich',
      contentSel: '#chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    },
    'truyenhay.vn': {
      type: 'html', label: 'TruyenHay',
      contentSel: '#chapter-c, #chapter-content, .chapter-content',
      titleSel:   '.chapter-title, h2',
      nextSel:    '#next_chap, a[id*="next"]'
    }
  };

  // ── 3. PHAT HIEN TRANG ────────────────────────────────────────────
  var hostname = location.hostname.replace(/^www\./, '');
  var siteCfg  = SITE_CONFIGS[hostname] || null;
  var isSPA    = siteCfg && siteCfg.type === 'spa';

  // ── 4. SPA INTERCEPTOR (truyenfree.org) ───────────────────────────
  if (isSPA) {
    if (!window._truyen_origLog) {
      window._truyen_origLog = console.log;
    }
    console.log = function () {
      var args = Array.prototype.slice.call(arguments);
      var obj  = args[0];
      if (
        obj && typeof obj === 'object' &&
        typeof obj.number  === 'number' &&
        typeof obj.name    === 'string' &&
        typeof obj.content === 'string' &&
        obj.content.length > 50
      ) {
        window._latestChapter = obj;
      }
      return window._truyen_origLog.apply(console, args);
    };
  }

  // ── 5. HELPERS ────────────────────────────────────────────────────
  function getNum() {
    var m = location.pathname.match(/chuong[-_](\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function getNumFromUrl(url) {
    var m = (url || '').match(/chuong[-_](\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function cleanText(s) {
    return (s || '')
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  function queryFirst(selStr) {
    var sels = selStr.split(',');
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = document.querySelector(sels[i].trim());
        if (el) {
          var t = (el.innerText || el.textContent || '').trim();
          if (t.length > 0) return { el: el, text: t };
        }
      } catch (e) {}
    }
    return null;
  }

  function getContentFromDOM() {
    if (!siteCfg || !siteCfg.contentSel) return '';
    var r = queryFirst(siteCfg.contentSel);
    return r ? cleanText(r.text) : '';
  }

  function getTitleFromDOM() {
    if (!siteCfg || !siteCfg.titleSel) return document.title;
    var r = queryFirst(siteCfg.titleSel);
    return r ? r.text : document.title;
  }

  function getNextUrl() {
    if (!siteCfg || !siteCfg.nextSel) return null;
    var sels = siteCfg.nextSel.split(',');
    for (var i = 0; i < sels.length; i++) {
      try {
        var els = document.querySelectorAll(sels[i].trim());
        for (var j = 0; j < els.length; j++) {
          var el  = els[j];
          var txt = (el.innerText || el.title || el.id || '').toLowerCase();
          if (/(tr.?c|prev|truoc)/i.test(txt)) continue;
          if (el.href && /chuong/i.test(el.href)) return el.href;
        }
      } catch (e) {}
    }
    // Fallback: tim link so chuong = hien tai + 1
    var cur = getNum();
    if (cur > 0) {
      var links = [].slice.call(document.querySelectorAll('a[href*="chuong"]'));
      for (var k = 0; k < links.length; k++) {
        var m = (links[k].href || '').match(/chuong[-_]?(\d+)/i);
        if (m && parseInt(m[1], 10) === cur + 1) return links[k].href;
      }
    }
    return null;
  }

  function getCurrentChapter() {
    if (isSPA) {
      var lc = window._latestChapter;
      if (lc && lc.content && lc.content.length > 50) {
        return {
          number:  lc.number,
          title:   lc.name || ('Chuong ' + lc.number),
          content: cleanText(lc.content)
        };
      }
      return { number: getNum(), title: document.title, content: '' };
    }
    var num     = getNum();
    var title   = getTitleFromDOM();
    var content = getContentFromDOM();
    if (!num) {
      var mm = (title.match(/\d+/) || [])[0];
      num = mm ? parseInt(mm, 10) : 0;
    }
    return { number: num, title: title, content: content };
  }

  // ── 6. STATE ──────────────────────────────────────────────────────
  function saveState(collected, start, end) {
    if (isSPA) return;
    try {
      sessionStorage.setItem(LS_STATE_KEY, JSON.stringify({
        collected: collected,
        start:     start,
        end:       end,
        site:      hostname,
        ts:        Date.now()
      }));
    } catch (e) {}
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(LS_STATE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.site !== hostname) return null;
      if (Date.now() - s.ts > 3 * 3600 * 1000) {
        sessionStorage.removeItem(LS_STATE_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function clearState() {
    try { sessionStorage.removeItem(LS_STATE_KEY); } catch (e) {}
  }

  // ── 7. GLOBAL STATE ───────────────────────────────────────────────
  window._cex_stop      = false;
  window._cex_collected = [];
  window._cex_start     = 0;
  window._cex_end       = 0;

  // ── 8. UI HELPERS ─────────────────────────────────────────────────
  function setStatus(msg) {
    try { var el = document.getElementById('cex_status'); if (el) el.innerText = msg; } catch (e) {}
  }
  function setProgress(msg) {
    try { var el = document.getElementById('cex_progress'); if (el) el.innerText = msg; } catch (e) {}
  }
  function setBusy(on) {
    try {
      var b1 = document.getElementById('cex_btn_start');
      var b2 = document.getElementById('cex_btn_stop');
      if (b1) b1.disabled = on;
      if (b2) b2.style.display = on ? 'inline-block' : 'none';
    } catch (e) {}
  }

  // ── 9. DOWNLOAD ───────────────────────────────────────────────────
  function doDownload() {
    var col = window._cex_collected;
    if (!col || !col.length) { setStatus('Chua co chuong nao!'); return; }
    var parts = col.map(function (ch) { return ch.title + '\n\n' + ch.content; });
    var text  = parts.join('\n\n────────────────────\n\n');
    var slug  = (location.pathname.split('/')[1] || 'truyen').replace(/[^a-z0-9\-]/gi, '-');
    var fname = slug + '_ch' + window._cex_start + '-' + window._cex_end + '.txt';
    try {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      setStatus('Da tai: ' + fname + ' (' + col.length + ' chuong)');
      setProgress('');
    } catch (e) { setStatus('Loi tao file: ' + e.message); }
  }

  // ── 10. AUTO COLLECT ──────────────────────────────────────────────
  function finishAuto() {
    window._cex_stop = false;
    clearState();
    setBusy(false);
    doDownload();
  }

  function waitForContent(callback, waited) {
    waited = waited || 0;
    var content = getContentFromDOM();
    if (content && content.length > 50) {
      callback();
    } else if (waited >= 8000) {
      setStatus('Het thoi gian cho noi dung!');
      finishAuto();
    } else {
      setTimeout(function () { waitForContent(callback, waited + 500); }, 500);
    }
  }

  function autoCollect(lastNum) {
    if (window._cex_stop) { finishAuto(); return; }

    var urlNum = getNum();
    var ch     = getCurrentChapter();
    var curNum = ch.number || urlNum;

    // Van o chuong cu, cho them
    if (!curNum || curNum === lastNum) {
      setTimeout(function () { autoCollect(lastNum); }, 800);
      return;
    }

    // Thu thap neu trong khoang
    if (curNum >= window._cex_start && curNum <= window._cex_end) {
      var dup = window._cex_collected.some(function (c) { return c.number === curNum; });
      if (!dup && ch.content && ch.content.length > 50) {
        window._cex_collected.push({ number: curNum, title: ch.title, content: ch.content });
        window._cex_collected.sort(function (a, b) { return a.number - b.number; });
        saveState(window._cex_collected, window._cex_start, window._cex_end);
        var total = window._cex_end - window._cex_start + 1;
        setProgress(window._cex_collected.length + '/' + total + ' | Chuong ' + curNum);
      }
    }

    // Xong chua?
    if (curNum >= window._cex_end) { finishAuto(); return; }

    if (isSPA) {
      // SPA: click nut chuong sau
      var nextBtn = null;
      try {
        var links = [].slice.call(document.querySelectorAll('a[href*="chuong"]'));
        for (var i = 0; i < links.length; i++) {
          var t = (links[i].innerText || '').trim();
          if (t === 'Chuong sau' || t === 'Ch\u01b0\u01a1ng sau') { nextBtn = links[i]; break; }
        }
      } catch (e) {}
      if (!nextBtn) { setStatus('Khong tim thay nut Chuong sau!'); finishAuto(); return; }
      setStatus('Dang tai chuong ' + (curNum + 1) + '...');
      window._latestChapter = null;
      try { nextBtn.click(); } catch (e) {}
      var waited = 0;
      function waitSPA() {
        var lc  = window._latestChapter;
        var num = (lc && lc.number) || getNum();
        if (num && num !== curNum) {
          setTimeout(function () { autoCollect(curNum); }, 300);
        } else if (waited >= 10000) {
          setStatus('Het thoi gian cho SPA!'); finishAuto();
        } else {
          waited += 400; setTimeout(waitSPA, 400);
        }
      }
      setTimeout(waitSPA, 600);
    } else {
      // HTML: navigate bang location.href
      var nextUrl = null;
      try { nextUrl = getNextUrl(); } catch (e) {}
      if (!nextUrl) { setStatus('Khong tim thay link chuong tiep!'); finishAuto(); return; }
      setStatus('Chuyen sang chuong ' + (curNum + 1) + '...');
      saveState(window._cex_collected, window._cex_start, window._cex_end);
      setTimeout(function () { location.href = nextUrl; }, 500);
    }
  }

  // ── 11. RESUME sau reload ─────────────────────────────────────────
  function doResume(state) {
    window._cex_start     = state.start;
    window._cex_end       = state.end;
    window._cex_collected = state.collected || [];
    window._cex_stop      = false;
    setBusy(true);
    var total = state.end - state.start + 1;
    setProgress(window._cex_collected.length + '/' + total + ' | Dang tiep tuc...');
    setStatus('Tu dong tiep tuc sau reload...');
    waitForContent(function () {
      autoCollect(getNum() - 1);
    });
  }

  // ── 12. GLOBAL HANDLERS ───────────────────────────────────────────
  window.cex_start = function () {
    try {
      var s = parseInt(document.getElementById('cex_inp_start').value, 10);
      var e = parseInt(document.getElementById('cex_inp_end').value,   10);
      if (isNaN(s) || isNaN(e) || s < 1 || e < s) { setStatus('So chuong khong hop le!'); return; }
      if (e - s > 500) { setStatus('Toi da 500 chuong/lan!'); return; }
      window._cex_start     = s;
      window._cex_end       = e;
      window._cex_collected = [];
      window._cex_stop      = false;
      clearState();
      setBusy(true);
      setProgress('');
      setStatus('Bat dau tu chuong ' + s + ' den ' + e + '...');
      if (isSPA) {
        autoCollect(getNum() - 1);
      } else {
        var curNum = getNum();
        if (curNum === s) {
          waitForContent(function () { autoCollect(s - 1); });
        } else {
          var baseUrl = location.href.replace(/chuong[-_]?\d+/i, 'chuong-' + s);
          saveState([], s, e);
          location.href = baseUrl;
        }
      }
    } catch (e) { setStatus('Loi: ' + e.message); setBusy(false); }
  };

  window.cex_stop = function () {
    window._cex_stop = true;
    setStatus('Dang dung...');
  };

  window.cex_getCurrent = function () {
    try {
      var ch = getCurrentChapter();
      var ta = document.getElementById('cex_ta');
      if (ch && ch.content && ta) {
        ta.value = ch.title + '\n\n' + ch.content;
        setStatus('Chuong ' + ch.number + ': ' + ch.title);
      } else {
        setStatus('Chua doc duoc noi dung!');
      }
    } catch (e) { setStatus('Loi: ' + e.message); }
  };

  window.cex_copy = function () {
    try {
      var ta = document.getElementById('cex_ta');
      if (!ta || !ta.value) { setStatus('Khong co gi de copy!'); return; }
      ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch (ex) {}
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () {});
      setStatus('Da copy!');
    } catch (e) {}
  };

  // ── 13. BUILD UI ──────────────────────────────────────────────────
  function buildUI() {
    var old = document.getElementById('cex_wrap');
    if (old) old.remove();

    var curNum = getNum();

    var W = document.createElement('div');
    W.id = 'cex_wrap';
    W.style.cssText = 'position:fixed;left:12px;top:60px;width:480px;z-index:2147483647;background:#fff;border:2px solid #333;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);font-family:Arial,sans-serif;font-size:13px;max-height:92vh;overflow-y:auto;';

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;';
    var htitle = document.createElement('b');
    htitle.innerText = 'Trich xuat truyen — ' + (siteCfg ? siteCfg.label : 'Chua ho tro');
    hdr.appendChild(htitle);
    var btnX = document.createElement('button');
    btnX.innerHTML = '&#x2715;';
    btnX.style.cssText = 'background:none;border:0;color:#fff;font-size:20px;cursor:pointer;';
    btnX.onclick = function () { W.remove(); };
    hdr.appendChild(btnX);
    W.appendChild(hdr);

    // Banner 15 trang — dang luoi cuon
    var ban = document.createElement('div');
    ban.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 10px;background:#f8f9fa;border-bottom:1px solid #eee;max-height:72px;overflow-y:auto;';
    SUPPORTED.forEach(function (s) {
      var on = (hostname === s.host);
      var c  = document.createElement('span');
      c.style.cssText = [
        'display:inline-block', 'padding:2px 8px', 'border-radius:10px',
        'font-size:11px', 'font-weight:bold', 'line-height:1.6',
        'border:1px solid ' + (on ? '#27ae60' : '#bbb'),
        'background:'       + (on ? '#27ae60' : '#f0f0f0'),
        'color:'            + (on ? '#fff'    : '#666'),
        'white-space:nowrap', 'cursor:pointer'
      ].join(';');
      c.innerText    = (on ? '\u2713 ' : '') + s.label;
      c.title        = 'Mo ' + s.label + ' — ' + s.host;
      c.onclick      = function () { window.open('https://' + s.host, '_blank'); };
      c.onmouseenter = function () { this.style.opacity = '0.75'; };
      c.onmouseleave = function () { this.style.opacity = '1'; };
      ban.appendChild(c);
    });
    W.appendChild(ban);

    // Body
    var body = document.createElement('div');
    body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:8px;';

    // Canh bao neu trang chua ho tro
    if (!siteCfg) {
      var warn = document.createElement('div');
      warn.style.cssText = 'background:#f8d7da;border:1px solid #f5c6cb;border-radius:4px;padding:8px;font-size:12px;color:#721c24;';
      warn.innerText = 'Trang nay chua duoc ho tro! Click vao nhan ben tren de chuyen trang.';
      body.appendChild(warn);
    }

    // Input row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    function mkLabel(t) { var el = document.createElement('b'); el.innerText = t; return el; }
    function mkInput(id, val) {
      var el = document.createElement('input');
      el.type = 'number'; el.id = id; el.value = val;
      el.style.cssText = 'width:72px;padding:4px 6px;border:1px solid #aaa;border-radius:4px;font-size:13px;color:#000;background:#fff;';
      return el;
    }
    function mkBtn(id, html, bg, fn) {
      var el = document.createElement('button');
      el.id = id || ''; el.innerHTML = html;
      el.style.cssText = 'padding:5px 12px;background:' + bg + ';color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;';
      el.onclick = fn;
      return el;
    }

    row.appendChild(mkLabel('Tu:'));
    row.appendChild(mkInput('cex_inp_start', curNum || 1));
    row.appendChild(mkLabel('Den:'));
    row.appendChild(mkInput('cex_inp_end', (curNum || 1) + 49));

    var btnStart = mkBtn('cex_btn_start', 'Bat dau', '#27ae60', window.cex_start);
    row.appendChild(btnStart);
    var btnStop = mkBtn('cex_btn_stop', 'Dung & Luu', '#c0392b', window.cex_stop);
    btnStop.style.display = 'none';
    row.appendChild(btnStop);
    body.appendChild(row);

    // Progress
    var prog = document.createElement('div');
    prog.id = 'cex_progress';
    prog.style.cssText = 'color:#2980b9;font-size:12px;min-height:14px;';
    body.appendChild(prog);

    // Status
    var stat = document.createElement('div');
    stat.id = 'cex_status';
    stat.style.cssText = 'color:#555;font-size:12px;min-height:14px;';
    stat.innerText = siteCfg ? 'Nhap so chuong roi nhan Bat dau.' : 'Trang chua duoc ho tro.';
    body.appendChild(stat);

    var hr = document.createElement('hr');
    hr.style.cssText = 'border:0;border-top:1px solid #eee;margin:2px 0;';
    body.appendChild(hr);

    // Manual row
    var mrow = document.createElement('div');
    mrow.style.cssText = 'display:flex;gap:8px;align-items:center;';
    mrow.appendChild(mkLabel('Thu cong:'));
    mrow.appendChild(mkBtn('', 'Lay chuong hien tai', '#2980b9', window.cex_getCurrent));
    mrow.appendChild(mkBtn('', 'Copy', '#7f8c8d', window.cex_copy));
    body.appendChild(mrow);

    // Textarea
    var ta = document.createElement('textarea');
    ta.id = 'cex_ta';
    ta.style.cssText = 'width:100%;height:200px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;';
    body.appendChild(ta);

    W.appendChild(body);
    document.body.appendChild(W);
  }

  // ── 14. INIT ──────────────────────────────────────────────────────
  function init() {
    buildUI();

    // Thu resume neu dang giua qua trinh auto
    if (!isSPA) {
      var state = loadState();
      if (state && state.start && state.end) {
        doResume(state);
        return;
      }
    }

    // Load chuong hien tai vao textarea
    setTimeout(function () {
      try {
        var ch = getCurrentChapter();
        var ta = document.getElementById('cex_ta');
        if (ch && ch.content && ch.content.length > 50 && ta) {
          ta.value = ch.title + '\n\n' + ch.content;
          setStatus('Chuong ' + ch.number + ' san sang.');
        } else if (isSPA) {
          setStatus('Cho SPA load... Thu chuyen chuong roi nhan Lay chuong hien tai.');
        } else {
          setStatus('Chua doc duoc noi dung. Thu nhan Lay chuong hien tai.');
        }
      } catch (e) {}
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
