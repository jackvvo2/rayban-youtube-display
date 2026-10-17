// Injected at end of body; runs scenario after load.
window.addEventListener("load", function(){ setTimeout(async function(){
  var L=__log, T=__tools, f=n=>T.find(t=>t.name===n);
  var tObs=document.getElementById("toast");
  new MutationObserver(function(){ if(tObs.textContent) L.toasts.push(tObs.textContent); }).observe(tObs,{childList:true,characterData:true,subtree:true});
  function scr(){ var a=document.querySelector(".screen.active"); return a&&a.id; }
  async function call(name,input,label){
    var ac=new AbortController(), r;
    try { r = await f(name).execute(input||{}, {signal:ac.signal}); } catch(e){ r={THREW:String(e&&e.message||e)}; }
    L.results.push({step:label||name, input:input, screen:scr(), focus:document.activeElement&&(document.activeElement.dataset.action||document.activeElement.id||document.activeElement.tagName), badge:(document.getElementById("webmcp-status")||{}).textContent, r:r});
    return r;
  }
  L.meta={count:T.length, names:T.map(t=>t.name), badge:document.getElementById("webmcp-status").textContent};
  // before player ready / home screen
  await call("player_status",{},"status@home");
  await call("seek_to",{seconds:10},"seek@noplayer");
  for (const a of ["skip30","restart","next_chapter","previous_chapter","last_chapter"]) await call("playback_control",{action:a},"pc_"+a+"@noplayer");
  await call("player_close",{},"close@home");
  await call("play_video",{number:0},"play n=0");
  await call("play_video",{number:99},"play n=99");
  await call("play_video",{number:"abc"},"play n=abc");
  await call("play_video",{query:""},"play q=''");
  await call("play_video",{query:"zzzqqq"},"play q=nomatch");
  await call("play_video",{},"play empty");
  await call("playlist_list",{},"list");
  await call("play_video",{number:"2"},"play n='2'");
  await call("player_open",{},"open@player");
  await call("player_status",{},"status@player");
  await call("playback_control",{action:"toggle"},"pc toggle1");
  await call("playback_control",{action:"toggle"},"pc toggle2");
  await call("playback_control",{action:"skip30"},"pc skip30");
  await call("playback_control",{action:"restart"},"pc restart");
  await call("playback_control",{action:"next_chapter"},"pc next_chapter");
  await call("playback_control",{action:"previous_chapter"},"pc previous_chapter");
  await call("playback_control",{action:"last_chapter"},"pc last_chapter");
  await call("playback_control",{action:"next"},"pc next");
  await call("playback_control",{action:"previous"},"pc previous");
  await call("playback_control",{action:"bogus"},"pc bogus");
  await call("playback_control",{},"pc missing");
  await call("seek_to",{seconds:-5},"seek -5");
  await call("seek_to",{seconds:99999},"seek 99999");
  await call("seek_to",{seconds:"120"},"seek '120'");
  await call("play_video",{query:"necromancer"},"play q=necromancer");
  // rapid repeated
  var rs = await Promise.all([1,2,3].map(()=>f("playback_control").execute({action:"next"},{signal:new AbortController().signal})));
  L.results.push({step:"rapid next x3", screen:scr(), r:rs.map(x=>x.now&&x.now.position)});
  // aborted signal
  var ac=new AbortController(); ac.abort();
  try { var ra = await f("playlist_refresh").execute({}, {signal:ac.signal}); L.results.push({step:"refresh aborted", r:ra}); } catch(e){ L.results.push({step:"refresh aborted", r:{THREW:String(e&&e.name||e)}}); }
  var ac2=new AbortController(); setTimeout(()=>ac2.abort(),100);
  try { var rb = await f("playlist_refresh").execute({}, {signal:ac2.signal}); L.results.push({step:"refresh mid-abort", r:rb}); } catch(e){ L.results.push({step:"refresh mid-abort", r:{THREW:String(e&&e.name||e)}}); }
  await call("player_close",{},"close@player");
  await call("player_close",{},"close again");
  await call("player_open",{},"open@home");
  await call("playlist_refresh",{},"refresh");
  // execute with no 2nd arg
  try { var r1 = await f("player_status").execute({}); L.results.push({step:"status no-opts", r:!!r1}); } catch(e){ L.results.push({step:"status no-opts", r:{THREW:String(e)}}); }
  document.body.setAttribute("data-log", JSON.stringify(L));
}, 2000); });
