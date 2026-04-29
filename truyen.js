(function(){
  // 1. INTERCEPTOR
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

  // 2. HELPERS
  function getNumFromUrl(){
    var m = location.pathname.match(/chuong-(\d+)/i);
    return m ? parseInt(m[1],10) : 0;
  }

  function cleanContent(s){
    return (s||'')
      .replace(/\\n/g,'\n')
      .replace(/\\"/g,'"')
      .replace(/\\\\/g,'\\')
      .replace(/\\u003c/gi,'<')
      .replace(/\\u003e/gi,'>')
      .replace(/\\u0026/gi,'&')
      .replace(/\\u([\dA-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));})
      .replace(/\n{3,}/g,'\n\n')
      .replace(/[ \t]+\n/g,'\n')
      .trim();
  }

  function extractFallback(){
    var bad = /\b(book|slugId|slug|description|publisher|categories|author|cover|shortDescription|createdAt|updatedAt|approved|status|TRANSLATOR|images|public|review|rating|tags)\b/i;
    var scripts = [].slice.call(document.scripts)
      .map(function(s){return s.textContent||'';})
      .filter(function(t){return t.indexOf('self.__next_f.push')>-1;});
    var candidates = [];
    scripts.forEach(function(src){
      var re = /"((?:[^"\\]|\\.)*)"/g, m2;
      while((m2=re.exec(src))!==null){
        var s = m2[1]
          .replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\')
          .replace(/\\u([\dA-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));});
        var score=0;
        if(s.length>300) score+=2;
        if((s.match(/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g)||[]).length>100) score+=2;
        if((s.match(/\s/g)||[]).length>20) score+=1;
        if((s.match(/\n/g)||[]).length>3) score+=3;
        if(/[\u201C\u201D\u2018\u2019"']/.test(s)) score+=3;
        if(/[.?!\u2026]/.test(s)) score+=2;
        if(bad.test(s)) score-=8;
        if(/^https?:\/\//i.test(s)) score-=5;
        if(s.indexOf('{')>-1&&s.indexOf('}')>-1) score-=4;
        if((s.indexOf('":"[')>-1||s.indexOf('","')>-1)&&s.indexOf('slug')>-1) score-=6;
        if(score>=5) candidates.push({s:s,score:score});
      }
    });
    candidates.sort(function(a,b){return b.score-a.score||b.s.length-a.s.length;});
    return (candidates[0]&&candidates[0].s) ? candidates[0].s.replace(/\n{3,}/g,'\n\n').trim() : '';
  }

  function getCurrentChapter(){
    var lc = window._latestChapter;
    if(lc && lc.content && lc.content.length>50){
      return {
        number: lc.number,
        title: lc.name||('Chuong '+lc.number),
        content: cleanContent(lc.content)
      };
    }
    var content = extractFallback();
    var titleEl = [].slice.call(document.querySelectorAll('h1,h2,h3'))
      .map(function(el){return (el.innerText||'').trim();})
      .filter(function(t){return /^Ch[\u01B0\u01B0\u01B0ong]+\s*\d+/i.test(t)||/^Chuong\s*\d+/i.test(t);})
      .sort(function(a,b){return b.length-a.length;})[0] || document.title;
    var num = getNumFromUrl() || parseInt(((titleEl.match(/\d+/)||[])[0]||'0'),10);
    return {number:num, title:titleEl, content:content};
  }

  function clickNext(){
    var links = [].slice.call(document.querySelectorAll('a[href*="chuong"]'));
    for(var i=0;i<links.length;i++){
      if(links[i].innerText.trim()==='Chương sau'){links[i].click();return true;}
    }
    return false;
  }

  // 3. STATE
  window._autoStop_cex  = false;
  window._collected_cex = [];
  window._targetStart_cex = 0;
  window._targetEnd_cex   = 0;

  // 4. UI HELPERS
  function setStatus(msg){var el=document.getElementById('cex_status');if(el)el.innerText=msg;}
  function setProgress(msg){var el=document.getElementById('cex_progress');if(el)el.innerText=msg;}

  // 5. DOWNLOAD
  function downloadTxt(){
    if(!window._collected_cex.length){setStatus('Chua co chuong nao!');return;}
    var parts=[];
    window._collected_cex.forEach(function(ch){
      parts.push(ch.title+'\n\n'+ch.content);
    });
    var fullText = parts.join('\n\n');
    var slug = (location.pathname.split('/')[2]||'truyen').replace(/[^a-z0-9\-]/gi,'-');
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
  }

  // 6. AUTO-COLLECT
  function finishAuto(){
    window._autoStop_cex=false;
    var b1=document.getElementById('cex_btn_start');
    var b2=document.getElementById('cex_btn_stop');
    if(b1)b1.disabled=false;
    if(b2)b2.style.display='none';
    downloadTxt();
  }

  function waitAndCollect(prevNum){
    var waited=0;
    function check(){
      var urlN = getNumFromUrl();
      var lcN  = window._latestChapter ? window._latestChapter.number : 0;
      var cur  = lcN || urlN;
      if(cur && cur!==prevNum){
        setTimeout(function(){autoCollect(prevNum);},300);
      } else if(waited>=10000){
        setStatus('Het thoi gian cho chuong moi!');
        finishAuto();
      } else {
        waited+=400;
        setTimeout(check,400);
      }
    }
    check();
  }

  function autoCollect(lastNum){
    if(window._autoStop_cex){finishAuto();return;}
    var urlNum = getNumFromUrl();
    var ch     = getCurrentChapter();
    var curNum = ch.number || urlNum;

    if(!curNum||curNum===lastNum){
      setTimeout(function(){autoCollect(lastNum);},1200);
      return;
    }

    if(curNum>=window._targetStart_cex && curNum<=window._targetEnd_cex){
      var dup=false;
      for(var i=0;i<window._collected_cex.length;i++){
        if(window._collected_cex[i].number===curNum){dup=true;break;}
      }
      if(!dup && ch.content && ch.content.length>50){
        window._collected_cex.push({number:curNum,title:ch.title,content:ch.content});
        window._collected_cex.sort(function(a,b){return a.number-b.number;});
        var total=window._targetEnd_cex-window._targetStart_cex+1;
        setProgress(window._collected_cex.length+'/'+total+' | Chuong '+curNum);
      }
    }

    if(curNum>=window._targetEnd_cex){finishAuto();return;}

    if(!clickNext()){
      setStatus('Khong tim thay nut Chuong sau!');
      finishAuto();
      return;
    }
    setStatus('Dang tai chuong '+(curNum+1)+'...');
    waitAndCollect(curNum);
  }

  // 7. GLOBAL HANDLERS
  window.startAuto_cex = function(){
    var s=parseInt(document.getElementById('cex_inp_start').value,10);
    var e=parseInt(document.getElementById('cex_inp_end').value,10);
    if(!s||!e||isNaN(s)||isNaN(e)||s>e){setStatus('So chuong khong hop le!');return;}
    if(e-s>500){setStatus('Toi da 500 chuong moi lan!');return;}
    window._targetStart_cex=s;
    window._targetEnd_cex=e;
    window._collected_cex=[];
    window._autoStop_cex=false;
    var b1=document.getElementById('cex_btn_start');
    var b2=document.getElementById('cex_btn_stop');
    if(b1)b1.disabled=true;
    if(b2)b2.style.display='inline-block';
    setProgress('');
    setStatus('Bat dau tu chuong '+s+' den '+e+'...');
    autoCollect(getNumFromUrl()-1);
  };

  window.getCurrent_cex = function(){
    var ch=getCurrentChapter();
    var ta=document.getElementById('cex_ta');
    if(ch&&ch.content&&ta){
      ta.value=ch.title+'\n\n'+ch.content;
      setStatus('Chuong '+ch.number+': '+ch.title);
    } else {
      setStatus('Chua co noi dung!');
    }
  };

  window.copyCurrent_cex = function(){
    var ta=document.getElementById('cex_ta');
    if(!ta||!ta.value){setStatus('Khong co gi de copy!');return;}
    ta.focus();ta.select();
    try{document.execCommand('copy');}catch(ex){}
    if(navigator.clipboard)navigator.clipboard.writeText(ta.value).catch(function(){});
    setStatus('Da copy!');
  };

  // 8. BUILD UI
  var old=document.getElementById('chapter_export_wrap');
  if(old)old.remove();

  var curNum=getNumFromUrl();
  var W=document.createElement('div');
  W.id='chapter_export_wrap';
  W.style.cssText='position:fixed;left:12px;top:60px;width:500px;z-index:2147483647;background:#fff;border:2px solid #333;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);font-family:Arial,sans-serif;font-size:13px;';

  // Header
  var hdr=document.createElement('div');
  hdr.style.cssText='background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;';
  hdr.innerHTML='<b>Trich xuat truyen tu dong</b>';
  var btnX=document.createElement('button');
  btnX.innerHTML='&#x2715;';
  btnX.style.cssText='background:none;border:0;color:#fff;font-size:20px;cursor:pointer;';
  btnX.onclick=function(){W.remove();};
  hdr.appendChild(btnX);
  W.appendChild(hdr);

  // Body
  var body=document.createElement('div');
  body.style.cssText='padding:12px;display:flex;flex-direction:column;gap:8px;';

  // Warning box
  var warn=document.createElement('div');
  warn.style.cssText='background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:8px;font-size:12px;color:#856404;';
  warn.innerText='Hay vao dung chuong bat dau, nhap so chuong roi nhan Bat dau.';
  body.appendChild(warn);

  // Input row
  var row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

  function mkLabel(t){var el=document.createElement('b');el.innerText=t;return el;}
  function mkInput(id,val){
    var el=document.createElement('input');
    el.type='number'; el.id=id; el.value=val;
    el.style.cssText='width:75px;padding:4px 6px;border:1px solid #aaa;border-radius:4px;font-size:13px;color:#000;background:#fff;';
    return el;
  }
  function mkBtn(txt,bg,handler){
    var el=document.createElement('button');
    el.innerHTML=txt;
    el.style.cssText='padding:5px 12px;background:'+bg+';color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;';
    el.onclick=handler;
    return el;
  }

  row.appendChild(mkLabel('Tu:'));
  row.appendChild(mkInput('cex_inp_start',curNum));
  row.appendChild(mkLabel('Den:'));
  row.appendChild(mkInput('cex_inp_end',curNum+49));

  var btnStart=mkBtn('&#x1F680; Bat dau','#27ae60',window.startAuto_cex);
  btnStart.id='cex_btn_start';
  row.appendChild(btnStart);

  var btnStop=mkBtn('&#x23F9; Dung & Luu','#c0392b',function(){
    window._autoStop_cex=true;
    setStatus('Dang dung...');
  });
  btnStop.id='cex_btn_stop';
  btnStop.style.display='none';
  row.appendChild(btnStop);
  body.appendChild(row);

  // Progress & status
  var prog=document.createElement('div');
  prog.id='cex_progress';
  prog.style.cssText='color:#2980b9;font-size:12px;min-height:14px;';
  body.appendChild(prog);

  var stat=document.createElement('div');
  stat.id='cex_status';
  stat.style.cssText='color:#555;font-size:12px;min-height:14px;';
  stat.innerText='Nhap so chuong roi nhan Bat dau.';
  body.appendChild(stat);

  var hr=document.createElement('hr');
  hr.style.cssText='border:0;border-top:1px solid #eee;margin:4px 0;';
  body.appendChild(hr);

  // Manual row
  var mrow=document.createElement('div');
  mrow.style.cssText='display:flex;gap:8px;align-items:center;';
  mrow.appendChild(mkLabel('Thu cong:'));
  mrow.appendChild(mkBtn('Lay chuong hien tai','#2980b9',window.getCurrent_cex));
  mrow.appendChild(mkBtn('&#x1F4CB; Copy','#7f8c8d',window.copyCurrent_cex));
  body.appendChild(mrow);

  // Textarea
  var ta=document.createElement('textarea');
  ta.id='cex_ta';
  ta.style.cssText='width:100%;height:240px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;';
  body.appendChild(ta);

  W.appendChild(body);
  document.body.appendChild(W);

  // Load current chapter on open
  var initCh=getCurrentChapter();
  if(initCh&&initCh.content){
    ta.value=initCh.title+'\n\n'+initCh.content;
    setStatus('Chuong '+initCh.number+' da tai. Interceptor san sang.');
  } else {
    setStatus('Chua bat duoc chuong. Thu chuyen chuong roi nhan Lay chuong hien tai.');
  }
})();
