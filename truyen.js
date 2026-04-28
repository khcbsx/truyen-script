(function(){
if(window._chapterInterceptInstalled){
  var old=document.getElementById('chapter_export_wrap');
  if(old)old.remove();
} else {
  window._chapterInterceptInstalled=true;
  window._latestChapter=null;
  var _origLog=console.log;
  console.log=function(){
    var args=Array.prototype.slice.call(arguments);
    if(args[0]&&typeof args[0]==='object'&&args[0].content&&args[0].name&&typeof args[0].number==='number'){
      window._latestChapter=args[0];
    }
    return _origLog.apply(this,arguments);
  };
}
function dec(s){
  return(s||'')
    .replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\')
    .replace(/\\u003c/g,'<').replace(/\\u003e/g,'>').replace(/\\u0026/g,'&')
    .replace(/\\u([\dA-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));})
    .trim();
}
function txt(el){return(el&&el.innerText||'').trim();}
function getNumFromUrl(){
  var m=location.pathname.match(/chuong-(\d+)/);
  return m?parseInt(m[1]):0;
}
function getCurrentChapter(){
  if(window._latestChapter&&window._latestChapter.content){
    var content=window._latestChapter.content
      .replace(/\\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').trim();
    return{
      number:window._latestChapter.number,
      title:window._latestChapter.name||document.title,
      content:content
    };
  }
  var bad=/\b(book|slugId|slug|description|publisher|categories|author|cover|shortDescription|createdAt|updatedAt|approved|status|TRANSLATOR|images|public|review|rating|tags)\b/i;
  var scripts=[].slice.call(document.scripts)
    .map(function(s){return s.textContent||''})
    .filter(function(t){return t.indexOf('self.__next_f.push')>-1});
  var candidates=[];
  scripts.forEach(function(src){
    var arr=[...src.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(function(m){return dec(m[1])});
    arr.forEach(function(s){
      var score=0;
      if(s.length>300)score+=2;
      if((s.match(/[A-Za-zÀ-ỹ]/g)||[]).length>100)score+=2;
      if((s.match(/\s/g)||[]).length>20)score+=1;
      if((s.match(/\n/g)||[]).length>3)score+=3;
      if(/[""]/.test(s))score+=3;
      if(/[\.\?!…]/.test(s))score+=2;
      if(bad.test(s))score-=8;
      if(/^https?:\/\//i.test(s))score-=5;
      if(s.indexOf('{')>-1&&s.indexOf('}')>-1)score-=4;
      if((s.indexOf('":[\"')>-1||s.indexOf('","')>-1)&&s.indexOf('slug')>-1)score-=6;
      if(score>=5)candidates.push({s:s,score:score});
    });
  });
  candidates.sort(function(a,b){return b.score-a.score||b.s.length-a.s.length});
  var content=(candidates[0]&&candidates[0].s)||'';
  content=content.replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').trim();
  var title=[].slice.call(document.querySelectorAll('h1,h2,h3,div,span')).map(txt)
    .filter(function(t){return/^Chương\s*\d+/i.test(t)})
    .sort(function(a,b){return b.length-a.length})[0]||document.title;
  var num=getNumFromUrl()||parseInt((title||'').match(/\d+/)||0);
  return{number:num,title:title,content:content};
}
function clickNext(){
  var links=[].slice.call(document.querySelectorAll('a[href*="chuong"]'));
  for(var i=0;i<links.length;i++){
    if(links[i].innerText.trim()==='Chương sau'){links[i].click();return true;}
  }
  return false;
}
function setStatus(m){var el=document.getElementById('cex_status');if(el)el.innerText=m;}
function setProgress(m){var el=document.getElementById('cex_progress');if(el)el.innerText=m;}
function finishAuto(){
  window._autoStop_cex=false;
  var b1=document.getElementById('cex_btn_start');
  var b2=document.getElementById('cex_btn_stop');
  if(b1)b1.disabled=false;
  if(b2)b2.style.display='none';
  if(window._collected_cex.length===0){
    setStatus('⚠️ Không có chương nào được thu thập!');
    return;
  }
  var fullText='';
  window._collected_cex.forEach(function(ch){
    fullText+=ch.title+'\n\n'+ch.content+'\n\n';
  });
  var slug=location.pathname.split('/')[2]||'truyen';
  var fname=slug+'_ch'+window._targetStart_cex+'-'+window._targetEnd_cex+'.txt';
  var blob=new Blob([fullText],{type:'text/plain;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=fname;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus('✅ Đã tải: '+fname+' ('+window._collected_cex.length+' chương)');
  setProgress('');
}
function autoCollect(lastNum){
  if(window._autoStop_cex){finishAuto();return;}
  var urlNum=getNumFromUrl();
  var ch=getCurrentChapter();
  var currentNum=ch.number||urlNum;
  if(currentNum&&currentNum!==lastNum){
    if(currentNum>=window._targetStart_cex&&currentNum<=window._targetEnd_cex){
      var exists=false;
      for(var i=0;i<window._collected_cex.length;i++){
        if(window._collected_cex[i].number===currentNum){exists=true;break;}
      }
      if(!exists&&ch.content){
        window._collected_cex.push(ch);
        window._collected_cex.sort(function(a,b){return a.number-b.number;});
        setProgress('📦 '+window._collected_cex.length+'/'+(window._targetEnd_cex-window._targetStart_cex+1)+' chương | Chương '+currentNum);
      }
    }
    if(currentNum>=window._targetEnd_cex){finishAuto();return;}
    if(!clickNext()){setStatus('⚠️ Không tìm thấy nút Chương sau!');finishAuto();return;}
    setStatus('⏳ Đang tải chương '+(currentNum+1)+'...');
    setTimeout(function(){autoCollect(currentNum);},2500);
  } else {
    setTimeout(function(){autoCollect(lastNum);},1500);
  }
}
window.startAuto_cex=function(){
  var s=parseInt(document.getElementById('cex_inp_start').value)||0;
  var e=parseInt(document.getElementById('cex_inp_end').value)||0;
  if(!s||!e||s>e){setStatus('⚠️ Số chương không hợp lệ!');return;}
  if(e-s>500){setStatus('⚠️ Tối đa 500 chương mỗi lần!');return;}
  window._targetStart_cex=s;
  window._targetEnd_cex=e;
  window._collected_cex=[];
  window._autoStop_cex=false;
  document.getElementById('cex_btn_start').disabled=true;
  document.getElementById('cex_btn_stop').style.display='inline-block';
  setProgress('');
  setStatus('🚀 Bắt đầu từ chương '+s+' đến '+e+'...');
  var urlNum=getNumFromUrl();
  if(urlNum<s){
    setStatus('⚠️ Hãy vào đúng chương '+s+' trước rồi nhấn Bắt đầu!');
    document.getElementById('cex_btn_start').disabled=false;
    document.getElementById('cex_btn_stop').style.display='none';
    return;
  }
  autoCollect(urlNum-1);
};
window.getCurrent_cex=function(){
  var c=getCurrentChapter();
  var ta=document.getElementById('cex_ta');
  if(c&&c.content&&ta){
    ta.value=c.title+'\n\n'+c.content;
    setStatus('✅ Chương '+c.number+': '+c.title);
  } else {
    setStatus('⚠️ Chưa có nội dung!');
  }
};
window.copyCurrent_cex=function(){
  var ta=document.getElementById('cex_ta');
  if(!ta)return;
  ta.focus();ta.select();
  try{document.execCommand('copy');}catch(e){}
  if(navigator.clipboard)navigator.clipboard.writeText(ta.value).catch(function(){});
  setStatus('✅ Đã copy!');
};
var curNum=getNumFromUrl();
var wrap=document.createElement('div');
wrap.id='chapter_export_wrap';
wrap.style.cssText='position:fixed;left:12px;top:60px;width:480px;z-index:2147483647;background:#fff;border:2px solid #333;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);';
wrap.innerHTML=[
  '<div style="background:#333;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">',
  '<b>📚 Trích xuất truyện tự động</b>',
  '<button onclick="document.getElementById(\'chapter_export_wrap\').remove()" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;">✕</button>',
  '</div>',
  '<div style="padding:14px;display:flex;flex-direction:column;gap:10px;font-family:Arial;font-size:13px;">',
  '<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:8px;font-size:12px;color:#856404;">',
  '⚠️ Hãy vào đúng chương bắt đầu trước, sau đó nhập số chương và nhấn Bắt đầu.',
  '</div>',
  '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">',
  '<b>Từ chương:</b>',
  '<input id="cex_inp_start" type="number" value="'+curNum+'" style="width:80px;padding:5px;border:1px solid #999;border-radius:4px;font-size:13px;color:#000;background:#fff;"/>',
  '<b>Đến:</b>',
  '<input id="cex_inp_end" type="number" value="'+(curNum+49)+'" style="width:80px;padding:5px;border:1px solid #999;border-radius:4px;font-size:13px;color:#000;background:#fff;"/>',
  '<button id="cex_btn_start" onclick="startAuto_cex()" style="padding:5px 12px;background:#28a745;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">🚀 Bắt đầu</button>',
  '<button id="cex_btn_stop" onclick="window._autoStop_cex=true;document.getElementById(\'cex_status\').innerText=\'⏹ Đang dừng...\';" style="padding:5px 12px;background:#dc3545;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:13px;display:none;">⏹ Dừng & Lưu</button>',
  '</div>',
  '<div id="cex_progress" style="color:#0066cc;font-size:12px;min-height:16px;"></div>',
  '<div id="cex_status" style="color:#555;font-size:12px;min-height:16px;">Nhập số chương rồi nhấn Bắt đầu.</div>',
  '<hr style="border:0;border-top:1px solid #eee;margin:2px 0;"/>',
  '<div style="display:flex;gap:8px;align-items:center;">',
  '<b>Thủ công:</b>',
  '<button onclick="getCurrent_cex()" style="padding:4px 10px;background:#0066cc;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:12px;">Lấy chương hiện tại</button>',
  '<button onclick="copyCurrent_cex()" style="padding:4px 10px;background:#6c757d;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:12px;">📋 Copy</button>',
  '</div>',
  '<textarea id="cex_ta" style="width:100%;height:260px;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-size:13px;line-height:1.6;color:#222;background:#fff;"></textarea>',
  '</div>'
].join('');
document.body.appendChild(wrap);
var ch=getCurrentChapter();
if(ch&&ch.content){
  var ta=document.getElementById('cex_ta');
  if(ta)ta.value=ch.title+'\n\n'+ch.content;
}
})();
