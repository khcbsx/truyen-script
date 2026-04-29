(function () {

  /* ================================================================
     truyen.js  — v6
     Hỗ trợ: truyenfree.org | truyenfull.vision | tvtruyen.co.uk
              xtruyen.vn    | metruyenchu.com.vn
  ================================================================ */

  var LS_STATE_KEY = 'truyen_cex_state_v6';

  // ── 1. SITE DETECTION & CONFIG ──────────────────────────────────
  var SITE_CONFIGS = {
    'truyenfree.org': {
      type: 'spa',
      label: 'TruyenFree',
      contentSelectors: [],
      titleSelectors: [],
      nextSelectors: [],
      nextText: ['Chương sau', 'Chuong sau']
    },
    'truyenfull.vision': {
      type: 'html',
      label: 'TruyenFull',
      contentSelectors: ['#chapter-c', '.chapter-c'],
      titleSelectors: ['.chapter-title', 'h2', 'h1'],
      nextSelectors: ['#next_chap'],
      nextText: ['Chương tiếp', 'Tiếp theo', 'Chương sau']
    },
    'tvtruyen.co.uk': {
      type: 'html',
      label: 'TvTruyen',
      contentSelectors: ['#chapter-content', '.chapter-content'],
      titleSelectors: ['.chapter-title', 'h2', 'h1'],
      nextSelectors: ['a.btn-chapter-nav'],
      nextText: ['Chương tiếp', 'Tiếp theo', 'Chương sau']
    },
    'xtruyen.vn': {
      type: 'html',
      label: 'XTruyen',
      contentSelectors: ['.reading-content .text-left', '.reading-content', '.entry-content'],
      titleSelectors: ['h2', '.chapter-name', '.chapter-title', 'h1'],
      nextSelectors: ['a.btn.next_page', 'a.next_page'],
      nextText: ['Chương tiếp', 'Tiếp theo', 'Chương sau']
    },
    'metruyenchu.com.vn': {
      type: 'html',
      label: 'MeTruyenChu',
      contentSelectors: ['.chapter-content', '#chapter-content', '.content-chapter', '.box-chapter-content'],
      titleSelectors: ['.chapter-title', 'h2', 'h1'],
      nextSelectors: ['a#next_chap', 'a.next-chap', 'a[id*="next"]', 'a.btn-chapter-nav'],
      nextText: ['Chương tiếp', 'Tiếp theo', 'Chương sau']
    }
  };

  var SUPPORTED = [
    { label: 'TruyenFree',  host: 'truyenfree.org'      },
    { label: 'TruyenFull',  host: 'truyenfull.vision'    },
    { label: 'TvTruyen',    host: 'tvtruyen.co.uk'       },
    { label: 'XTruyen',     host: 'xtruyen.vn'           },
    { label: 'MeTruyenChu', host: 'metruyenchu.com.vn'   }
  ];

  var hostname = location.hostname.replace(/^www\./, '');
  var siteCfg  = SITE_CONFIGS[hostname] || null;
  var siteKey  = hostname;
  var isSPA    = siteCfg && siteCfg.type === 'spa';

  // ── 2. SPA INTERCEPTOR (truyenfree.org only) ─────────────────────
  if (isSPA) {
    if (!window._truyen_origLog) {
      window._truyen_origLog = console.log;
    }
    console.log = function () {
      var args = Array.prototype.slice.call(arguments);
      var obj  = args[0];
      if (
        obj && typeof obj === 'object' &&
        typeof obj.number === 'number' &&
        typeof obj.name   === 'string' &&
        typeof obj.content === 'string' &&
        obj.content.length > 50
      ) {
        window._latestChapter = obj;
      }
      return window._truyen_origLog.apply(console, args);
    };
  }

  // ── 3. HELPERS ────────────────────────────────────────────────────
  function getNum() {
    var m = location.pathname.match(/chuong[-_](\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function cleanText(s) {
    return (s || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g,   '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  function qText(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var t = (el.innerText || el.textContent || '').trim();
          if (t.length > 10) return t;
        }
      } catch (e) {}
    }
    return '';
  }

  function getChapterContent() {
    if (!siteCfg) return '';
    return cleanText(qText(siteCfg.contentSelectors));
  }

  function getChapterTitle() {
    if (!siteCfg) return document.title;
    var t = qText(siteCfg.titleSelectors);
    return t || document.title;
  }

  function getCurrentChapter() {
    // SPA: use intercepted console.log data
    if (isSPA) {
      var lc = window._latestChapter;
      if (lc && lc.content && lc.content.length > 50) {
        return {
          number:  lc.number,
          title:   lc.name || ('Chương ' + lc.number),
          content: cleanText(lc.content)
        };
      }
      return { number: getNum(), title: document.title, content: '' };
    }
    // HTML sites
    var num     = getNum();
    var title   = getChapterTitle();
    var content = getChapterContent();
    if (!num) {
      var m = (title.match(/\d+/) || [])[0];
      num = m ? parseInt(m, 10) : 0;
    }
    return { number: num, title: title, content: content };
  }

  function getNextUrl() {
    if (!siteCfg) return null;
    var cfg = siteCfg;
    // Try configured selectors first
    for (var i = 0; i < cfg.nextSelectors.length; i++) {
      try {
        var els = document.querySelectorAll(cfg.nextSelectors[i]);
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          if (!el || !el.href) continue;
          var txt = (el.innerText || el.title || '').toLowerCase();
          if (/(tr.?c|prev|truoc)/i.test(txt)) continue;
          if (el.href.match(/chuong[-_]?\d+/i)) return el.href;
        }
      } catch (e) {}
    }
    // Try by link text
    var allLinks = [];
    try { allLinks = [].slice.call(document.querySelectorAll('a[href*="chuong"]')); } catch (e) {}
    for (var a = 0; a < allLinks.length; a++) {
      var linkTxt = (allLinks[a].innerText || '').trim();
      if (/(tr.?c|prev|truoc)/i.test(linkTxt)) continue;
      for (var k = 0; k < cfg.nextText.length; k++) {
        if (linkTxt === cfg.nextText[k] || linkTxt.indexOf(cfg.nextText[k]) === 0) {
          if (allLinks[a].href && allLinks[a].href.match(/chuong[-_]?\d+/i)) {
            return allLinks[a].href;
          }
        }
      }
    }
    // Fallback: URL with curNum+1
    var curN = getNum();
    if (curN > 0) {
      for (var b = 0; b < allLinks.length; b++) {
        var mm = (allLinks[b].href || '').match(/chuong[-_]?(\d+)/i);
        if (mm && parseInt(mm[1], 10) === curN + 1) return allLinks[b].href;
      }
    }
    return null;
  }

  // ── 4. STATE (localStorage) ──────────────────────────────────────
  function saveState(collected, start, end) {
    if (isSPA) return;
    try {
      localStorage.setItem(LS_STATE_KEY, JSON.stringify({
        collected: collected,
        start:     start,
        end:       end,
        site:      siteKey,
        ts:        Date.now()
      }));
    } catch (e) {}
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(LS_STATE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.site) return null;
      if (s.site !== siteKey) return null;
      if (Date.now() - s.ts > 3 * 3600 * 1000) {
        localStorage.removeItem(LS_STATE_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function clearState() {
    try { localStorage.removeItem(LS_STATE_KEY); } catch (e) {}
  }

  // ── 5. GLOBAL STATE VARIABLES ────────────────────────────────────
  window._autoStop_cex    = false;
  window._collected_cex   = [];
  window._targetStart_cex = 0;
  window._targetEnd_cex   = 0;

  // ── 6. UI HELPERS ─────────────────────────────────────────────────
  function setStatus(msg) {
    try {
      var el = document.getElementById('cex_status');
      if (el) el.innerText = msg;
    } catch (e) {}
  }

  function setProgress(msg) {
    try {
      var el = document.getElementById('cex_progress');
      if (el) el.innerText = msg;
    } catch (e) {}
  }

  // ── 7. DOWNLOAD ───────────────────────────────────────────────────
  function downloadTxt() {
    var collected = window._collected_cex;
    if (!collected || !collected.length) {
      setStatus('⚠️ Chưa có chương nào!');
      return;
    }
    var parts = [];
    collected.forEach(function (ch) {
      parts.push(ch.title + '\n\n' + ch.content);
    });
    var fullText = parts.join('\n\n────────────────────\n\n');
    var slug = (location.pathname.split('/')[1] || 'truyen').replace(/[^a-z0-9\-]/gi, '-');
    var fname = slug + '_ch' + window._targetStart_cex + '-' + window._targetEnd_cex + '.txt';
    try {
      var blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      setStatus('✅ Đã tải: ' + fname + ' (' + collected.length + ' chương)');
      setProgress('');
    } catch (e) {
      setStatus('❌ Lỗi tạo file: ' + e.message);
    }
  }

  // ── 8. AUTO-COLLECT LOOP ──────────────────────────────────────────
  function finishAuto() {
    window._autoStop_cex = false;
    clearState();
    try {
      var b1 = document.getElementById('cex_btn_start');
      var b2 = document.getElementById('cex_btn_stop');
      if (b1) b1.disabled = false;
      if (b2) b2.style.display = 'none';
    } catch (e) {}
    downloadTxt();
  }

  // Wait for new chapter to load (HTML sites after location.href change)
  function waitForChapterLoad(expectedNum, callback) {
    var waited  = 0;
    var maxWait = 12000;
    function check() {
      try {
        var curNum = getNum();
        var lc     = window._latestChapter;
        var spaN   = lc ? lc.number : 0;
        var actual = isSPA ? spaN : curNum;
        if (actual && actual !== expectedNum) {
          setTimeout(callback, 300);
          return;
        }
      } catch (e) {}
      waited += 400;
      if (waited >= maxWait) {
        setStatus('⚠️ Hết thời gian chờ chương mới!');
        finishAuto();
        return;
      }
      setTimeout(check, 400);
    }
    check();
  }

  function autoCollect(lastNum) {
    if (window._autoStop_cex) { finishAuto(); return; }

    var curNum = 0;
    var ch     = null;
    try {
      var urlNum = getNum();
      ch     = getCurrentChapter();
      curNum = ch.number || urlNum;
    } catch (e) {
      setTimeout(function () { autoCollect(lastNum); }, 1000);
      return;
    }

    // Still on same chapter — wait
    if (!curNum || curNum === lastNum) {
      setTimeout(function () { autoCollect(lastNum); }, 1000);
      return;
    }

    // Collect chapter if in range
    if (curNum >= window._targetStart_cex && curNum <= window._targetEnd_cex) {
      var dup = false;
      for (var i = 0; i < window._collected_cex.length; i++) {
        if (window._collected_cex[i].number === curNum) { dup = true; break; }
      }
      if (!dup && ch && ch.content && ch.content.length > 50) {
        window._collected_cex.push({ number: curNum, title: ch.title, content: ch.content });
        window._collected_cex.sort(function (a, b) { return a.number - b.number; });
        saveState(window._collected_cex, window._targetStart_cex, window._targetEnd_cex);
        var total = window._targetEnd_cex - window._targetStart_cex + 1;
        setProgress('📦 ' + window._collected_cex.length + '/' + total + ' | Chương ' + curNum);
      }
    }

    // Done?
    if (curNum >= window._targetEnd_cex) { finishAuto(); return; }

    // Navigate to next chapter
    if (isSPA) {
      // SPA: use click on next button
      var nextBtn = null;
      try {
        var links = [].slice.call(document.querySelectorAll('a[href*="chuong"]'));
        for (var j = 0; j < links.length; j++) {
          var t = (links[j].innerText || '').trim();
          if (t === 'Chương sau' || t === 'Chuong sau') { nextBtn = links[j]; break; }
        }
      } catch (e) {}
      if (!nextBtn) {
        setStatus('⚠️ Không tìm thấy nút "Chương sau"!');
        finishAuto();
        return;
      }
      setStatus('⏳ Đang tải chương ' + (curNum + 1) + '...');
      window._latestChapter = null;
      try { nextBtn.click(); } catch (e) {}
      waitForChapterLoad(curNum, function () { autoCollect(curNum); });
    } else {
      // HTML: navigate by URL
      var nextUrl = null;
      try { nextUrl = getNextUrl(); } catch (e) {}
      if (!nextUrl) {
        setStatus('⚠️ Không tìm thấy link chương tiếp theo!');
        finishAuto();
        return;
      }
      setStatus('⏳ Đang chuyển sang chương ' + (curNum + 1) + '...');
      saveState(window._collected_cex, window._targetStart_cex, window._targetEnd_cex);
      setTimeout(function () { location.href = nextUrl; }, 400);
    }
  }

  // ── 9. RESUME after page reload (HTML sites) ─────────────────────
  function doResume(state) {
    window._targetStart_cex = state.start;
    window._targetEnd_cex   = state.end;
    window._collected_cex   = state.collected || [];
    window._autoStop_cex    = false;

    var collected = window._collected_cex;
    var total     = state.end - state.start + 1;
    setProgress('📦 ' + collected.length + '/' + total + ' | Đang tiếp tục...');
    setStatus('🔄 Tự động tiếp tục...');

    try {
      var b1 = document.getElementById('cex_btn_start');
      var b2 = document.getElementById('cex_btn_stop');
      if (b1) b1.disabled = true;
      if (b2) b2.style.display = 'inline-block';
    } catch (e) {}

    setTimeout(function () { autoCollect(getNum() - 1); }, 800);
  }

  // ── 10. GLOBAL HANDLERS ───────────────────────────────────────────
  window.startAuto_cex = function () {
    try {
      var s = parseInt(document.getElementById('cex_inp_start').value, 10);
      var e = parseInt(document.getElementById('cex_inp_end').value,   10);
      if (!s || !e || isNaN(s) || isNaN(e) || s > e) {
        setStatus('⚠️ Số chương không hợp lệ!'); return;
      }
      if (e - s > 500) { setStatus('⚠️ Tối đa 500 chương/lần!'); return; }
      window._targetStart_cex = s;
      window._targetEnd_cex   = e;
      window._collected_cex   = [];
      window._autoStop_cex    = false;
      clearState();
      var b1 = document.getElementById('cex_btn_start');
      var b2 = document.getElementById('cex_btn_stop');
      if (b1) b1.disabled = true;
      if (b2) b2.style.display = 'inline-block';
      setProgress('');
      setStatus('🚀 Bắt đầu từ chương ' + s + ' → ' + e);
      var urlNum = getNum();
      autoCollect(urlNum > 0 ? urlNum - 1 : 0);
    } catch (e) { setStatus('❌ Lỗi: ' + e.message); }
  };

  window.getCurrent_cex = function () {
    try {
      var ch = getCurrentChapter();
      var ta = document.getElementById('cex_ta');
      if (ch && ch.content && ta) {
        ta.value = ch.title + '\n\n' + ch.content;
        setStatus('✅ Chương ' + ch.number + ': ' + ch.title);
      } else {
        setStatus('⚠️ Chưa bắt được chương!');
      }
    } catch (e) { setStatus('❌ Lỗi: ' + e.message); }
  };

  window.copyCurrent_cex = function () {
    try {
      var ta = document.getElementById('cex_ta');
      if (!ta || !ta.value) { setStatus('⚠️ Không có gì để copy!'); return; }
      ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch (ex) {}
      if (navigator.clipboard) {
        navigator.clipboard.writeText(ta.value).catch(function () {});
      }
      setStatus('✅ Đã copy!');
    } catch (e) {}
  };

  window.stopAuto_cex = function () {
    window._autoStop_cex = true;
    setStatus('⏹ Đang dừng...');
  };

  // ── 11. BUILD UI ──────────────────────────────────────────────────
  function buildUI() {
    var old = document.getElementById('chapter_export_wrap');
    if (old) old.remove();

    var curNum = getNum();

    // Wrapper
    var W = document.createElement('div');
    W.id = 'chapter_export_wrap';
    W.style.cssText = [
      'position:fixed', 'left:12px', 'top:60px', 'width:520px', 'z-index:2147483647',
      'background:#fff', 'border:2px solid #333', 'border-radius:8px',
      'box-shadow:0 4px 24px rgba(0,0,0,.5)', 'font-family:Arial,sans-serif',
      'font-size:13px', 'max-height:90vh', 'overflow-y:auto'
    ].join(';');

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;';
    var hdrTitle = document.createElement('b');
    hdrTitle.innerText = '📚 Trích xuất truyện tự động';
    hdr.appendChild(hdrTitle);
    var btnX = document.createElement('button');
    btnX.innerHTML = '&#x2715;';
    btnX.style.cssText = 'background:none;border:0;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:0;';
    btnX.onclick = function () { W.remove(); };
    hdr.appendChild(btnX);
    W.appendChild(hdr);

    // Site banner
    var ban = document.createElement('div');
    ban.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;background:#f8f9fa;border-bottom:1px solid #eee;';
    SUPPORTED.forEach(function (s) {
      var on = (hostname === s.host);
      var c  = document.createElement('span');
      c.style.cssText = [
        'display:inline-block', 'padding:2px 9px', 'border-radius:12px',
        'font-size:11px', 'font-weight:bold',
        'border:1px solid ' + (on ? '#27ae60' : '#bbb'),
        'background:'       + (on ? '#27ae60' : '#f0f0f0'),
        'color:'            + (on ? '#fff'    : '#666'),
        'white-space:nowrap', 'cursor:pointer'
      ].join(';');
      c.innerText   = (on ? '✓ ' : '') + s.label;
      c.title       = 'Mở ' + s.label + ' – ' + s.host;
      c.onclick     = function () { window.open('https://' + s.host, '_blank'); };
      c.onmouseenter = function () { this.style.opacity = '0.75'; };
      c.onmouseleave = function () { this.style.opacity = '1'; };
      ban.appendChild(c);
    });
    W.appendChild(ban);

    // Body
    var body = document.createElement('div');
    body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:8px;';

    // Warning
    if (!siteCfg) {
      var warn = document.createElement('div');
      warn.style.cssText = 'background:#f8d7da;border:1px solid #f5c6cb;border-radius:4px;padding:8px;font-size:12px;color:#721c24;';
      warn.innerText = '⚠️ Trang này chưa được hỗ trợ! Click vào nhãn bên trên để chuyển sang trang được hỗ trợ.';
      body.appendChild(warn);
    }

    // Input row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    function mkLabel(t) {
      var el = document.createElement('b'); el.innerText = t; return el;
    }
    function mkInput(id, val) {
      var el = document.createElement('input');
      el.type  = 'number'; el.id = id; el.value = val;
      el.style.cssText = 'width:72px;padding:4px 6px;border:1px solid #aaa;border-radius:4px;font-size:13px;color:#000;background:#fff;';
      return el;
    }
    function mkBtn(id, html, bg, handler) {
      var el = document.createElement('button');
      el.innerHTML = html; el.id = id || '';
      el.style.cssText = 'padding:5px 12px;background:' + bg + ';color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;';
      el.onclick = handler;
      return el;
    }

    row.appendChild(mkLabel('Từ:'));
    row.appendChild(mkInput('cex_inp_start', curNum || 1));
    row.appendChild(mkLabel('Đến:'));
    row.appendChild(mkInput('cex_inp_end', (curNum || 1) + 49));

    var btnStart = mkBtn('cex_btn_start', '🚀 Bắt đầu', '#27ae60', window.startAuto_cex);
    row.appendChild(btnStart);

    var btnStop = mkBtn('cex_btn_stop', '⏹ Dừng & Lưu', '#c0392b', window.stopAuto_cex);
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
    stat.innerText = siteCfg
      ? 'Nhập số chương rồi nhấn Bắt đầu.'
      : 'Trang chưa được hỗ trợ.';
    body.appendChild(stat);

    // Divider
    var hr = document.createElement('hr');
    hr.style.cssText = 'border:0;border-top:1px solid #eee;margin:2px 0;';
    body.appendChild(hr);

    // Manual row
    var mrow = document.createElement('div');
    mrow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    mrow.appendChild(mkLabel('Thủ công:'));
    mrow.appendChild(mkBtn('', 'Lấy chương hiện tại', '#2980b9', window.getCurrent_cex));
    mrow.appendChild(mkBtn('', '📋 Copy', '#7f8c8d', window.copyCurrent_cex));
    body.appendChild(mrow);

    // Textarea
    var ta = document.createElement('textarea');
    ta.id = 'cex_ta';
    ta.style.cssText = 'width:100%;height:220px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;';
    body.appendChild(ta);

    W.appendChild(body);
    document.body.appendChild(W);
  }

  // ── 12. INIT ──────────────────────────────────────────────────────
  function init() {
    buildUI();

    // Check for resume state
    if (!isSPA) {
      var state = loadState();
      if (state) {
        doResume(state);
        return;
      }
    }

    // Load current chapter into textarea
    try {
      var ch = getCurrentChapter();
      var ta = document.getElementById('cex_ta');
      if (ch && ch.content && ch.content.length > 50 && ta) {
        ta.value = ch.title + '\n\n' + ch.content;
        setStatus('✅ Chương ' + ch.number + ' đã tải. Sẵn sàng.');
      } else {
        if (isSPA) {
          setStatus('⏳ Chờ dữ liệu SPA... Thử chuyển chương rồi nhấn "Lấy chương hiện tại".');
        } else {
          setStatus('⚠️ Chưa đọc được nội dung. Thử nhấn "Lấy chương hiện tại".');
        }
      }
    } catch (e) {
      setStatus('⚠️ Lỗi khởi tạo: ' + e.message);
    }
  }

  // Wait for DOM if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
