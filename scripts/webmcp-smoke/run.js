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
  L.checks=[];
  function check(name, pass, detail){ L.checks.push({name:name, pass:!!pass, detail:detail}); }
  var wait=ms=>new Promise(r=>setTimeout(r,ms));
  var bats=()=>Array.prototype.slice.call(document.querySelectorAll("[data-battery]"));
  if (L.batteryMode!=="mock") {
    // Unavailable / throwing / rejecting API: indicator hidden, status null.
    await wait(300);
    check("["+L.batteryMode+"] battery indicators hidden", bats().length===2 && bats().every(e=>e.hidden && !e.textContent && e.getClientRects().length===0), bats().map(e=>e.hidden+":"+e.textContent));
    var st=await f("player_status").execute({}, {signal:new AbortController().signal});
    check("["+L.batteryMode+"] player_status battery null", st.battery_level===null && st.charging===null, st);
    var tl=document.getElementById("toast").textContent;
    check("["+L.batteryMode+"] no battery toast", !/battery/i.test(tl), tl);
    document.body.setAttribute("data-log", JSON.stringify(L));
    return;
  }
  // Battery mock: 55%, not charging.
  await wait(100);
  check("battery shows 55%", bats().length===2 && bats().every(e=>!e.hidden && e.textContent==="55%"), bats().map(e=>e.textContent));
  check("battery 55% neutral color", bats().every(e=>!e.classList.contains("battery-low")&&!e.classList.contains("battery-critical")), null);
  check("home battery visible", bats()[0].getClientRects().length>0, null);
  var bst=await f("player_status").execute({}, {signal:new AbortController().signal});
  check("player_status battery 55 / not charging", bst.battery_level===55 && bst.charging===false, {battery_level:bst.battery_level, charging:bst.charging});
  __battery(undefined,true);
  check("charging bolt shown", bats().every(e=>e.textContent.indexOf("\u26A1")===0 && e.classList.contains("battery-charging")), bats()[0].textContent);
  __battery(0.20);
  check("<=20% amber", bats().every(e=>e.classList.contains("battery-low")&&!e.classList.contains("battery-critical")), bats()[0].className);
  check("amber color", getComputedStyle(bats()[0]).color==="rgb(255, 176, 32)", getComputedStyle(bats()[0]).color);
  __battery(0.10);
  check("<=10% red", bats().every(e=>e.classList.contains("battery-critical")&&!e.classList.contains("battery-low")), bats()[0].className);
  check("red color", getComputedStyle(bats()[0]).color==="rgb(255, 59, 48)", getComputedStyle(bats()[0]).color);
  check("no low toast while charging", !/battery low/i.test(document.getElementById("toast").textContent), document.getElementById("toast").textContent);
  bst=await f("player_status").execute({}, {signal:new AbortController().signal});
  check("player_status battery 10 / charging", bst.battery_level===10 && bst.charging===true, {battery_level:bst.battery_level, charging:bst.charging});
  __battery(0.55,false);
  check("battery back to 55% no bolt", bats().every(e=>e.textContent==="55%"), bats()[0].textContent);
  // before player ready / home screen
  await call("player_status",{},"status@home");
  // ---- captions before any player: saved, honest note ---------------------
  var cc;
  cc=await call("captions",{enabled:true},"captions on@noplayer");
  check("captions on with no player saves pref + note", cc.captions==="on" && cc.applied===false && /saved/i.test(cc.note||"") && localStorage.getItem("rayban-youtube-display:captions:v1")==="on", cc);
  cc=await call("captions",{enabled:"maybe"},"captions bad");
  check("captions bad input errors", cc.error==="bad_enabled" && cc.captions==="on", cc);
  cc=await call("captions",{},"captions missing");
  check("captions missing errors", cc.error==="bad_enabled", cc);
  var acc=new AbortController(); acc.abort();
  try { await f("captions").execute({enabled:false},{signal:acc.signal}); check("captions honors abort", false, "resolved"); }
  catch(e){ check("captions honors abort", e.name==="AbortError" && localStorage.getItem("rayban-youtube-display:captions:v1")==="on", e.name); }
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
  // ---- captions with a player --------------------------------------------
  var ccl=()=>window.__ccLog||[];
  check("new player gets cc_load_policy=1 + cc_lang_pref from saved pref", window.__ytOpts && window.__ytOpts.playerVars.cc_load_policy===1 && /^[a-z]+$/.test(window.__ytOpts.playerVars.cc_lang_pref), window.__ytOpts&&window.__ytOpts.playerVars);
  await new Promise(r=>setTimeout(r,800));
  check("saved 'on' applied to playing video", ccl().some(x=>x.op==="load"&&x.m==="captions") && ccl().some(x=>x.op==="set"&&x.k==="track"&&x.v&&x.v.languageCode), ccl().slice(-3));
  cc=await call("captions",{enabled:false},"captions off@player");
  check("captions off applied", cc.captions==="off" && cc.applied!==false && !cc.note && ccl().some(x=>x.op==="unload"&&x.m==="captions") && localStorage.getItem("rayban-youtube-display:captions:v1")==="off", cc);
  var cs=await call("player_status",{},"status captions off");
  check("player_status captions off / no track", cs.captions==="off" && cs.captions_track===null, {captions:cs.captions, track:cs.captions_track});
  var mark=ccl().length;
  await call("playback_control",{action:"next"},"pc next (captions off carries)");
  await new Promise(r=>setTimeout(r,800));
  var after=ccl().slice(mark), nv=document.querySelector(".video-card.primary");
  check("off re-applied to next video", after.some(x=>x.op==="unload") && after.some(x=>x.op==="set"&&x.k==="track"&&x.v&&!x.v.languageCode) && !after.some(x=>x.op==="load"), after);
  cc=await call("captions",{enabled:"on"},"captions 'on'@player");
  check("captions on applied (prefers manual track)", cc.captions==="on" && ccl().slice(-1)[0].op==="set" && ccl().slice(-1)[0].v.languageCode, ccl().slice(-1)[0]);
  cs=await call("player_status",{},"status captions on");
  check("player_status captions on + track", cs.captions==="on" && typeof cs.captions_track==="string", {captions:cs.captions, track:cs.captions_track});
  await call("playback_control",{action:"previous"},"pc previous");
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
  // ---- video_size + video blackout --------------------------------------
  var body=document.body, pt=()=>document.getElementById("player-target");
  // Headless --dump-dom renders no frames, so CSS transitions never tick;
  // finish them to read each element's settled (end-of-fade) value.
  function settled(e){ if(e&&e.getAnimations){ e.getAnimations().forEach(function(x){ try{ x.finish(); }catch(_){} }); } return e; }
  var op=sel=>{ var e=settled(document.querySelector(sel)); return e?getComputedStyle(e).opacity:"missing"; };
  var bg=sel=>getComputedStyle(settled(document.querySelector(sel))).backgroundColor;
  var vs;
  vs=await call("video_size",{percent:70},"size 70");
  check("video_size 70 applied", vs.size_percent===70 && localStorage.getItem("rayban-youtube-display:video-size:v1")==="70", vs);
  check("video_size 70 iframe width", Math.abs(pt().getBoundingClientRect().width-584*0.7)<1.5, pt().getBoundingClientRect().width);
  check("video_size 70 centered", (function(){ var a=pt().getBoundingClientRect(), b=document.querySelector(".player-shell").getBoundingClientRect(); return Math.abs((a.left+a.right)/2-(b.left+b.right)/2)<1.5 && Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)<1.5; })(), null);
  check("shell black when scaled", bg(".player-shell")==="rgb(0, 0, 0)", bg(".player-shell"));
  vs=await call("video_size",{percent:10},"size 10"); check("video_size 10 clamps to 20", vs.size_percent===20 && vs.clamped, vs);
  vs=await call("video_size",{percent:150},"size 150"); check("video_size 150 clamps to 100", vs.size_percent===100 && vs.clamped, vs);
  vs=await call("video_size",{percent:"50%"},"size '50%'"); check("video_size '50%' parses", vs.size_percent===50, vs);
  vs=await call("video_size",{percent:"abc"},"size abc"); check("video_size abc errors", vs.error==="bad_percent" && vs.size_percent===50, vs);
  vs=await call("video_size",{},"size missing"); check("video_size missing errors", vs.error==="bad_percent", vs);
  var acv=new AbortController(); acv.abort();
  try { await f("video_size").execute({percent:30},{signal:acv.signal}); check("video_size honors abort", false, "resolved"); }
  catch(e){ check("video_size honors abort", e.name==="AbortError" && window.VideoFocus.getSize()===50, String(e.name)); }
  vs=await call("video_size",{percent:100},"size 100"); check("video_size 100 restores full", Math.abs(pt().getBoundingClientRect().width-584)<1.5 && !document.documentElement.classList.contains("video-scaled"), pt().getBoundingClientRect().width);

  // playing (stub state 1) + 3s idle -> blackout
  if (window.VideoFocus.isBlackout()) { document.dispatchEvent(new KeyboardEvent("keydown",{key:"Shift",bubbles:true})); }
  check("ui visible right after input", !body.classList.contains("video-blackout"), null);
  await wait(3600); await wait(800);
  check("blackout after 3s idle while playing", body.classList.contains("video-blackout"), body.className);
  check("cinema-bar faded to 0", op(".cinema-bar")==="0", op(".cinema-bar"));
  check("status faded to 0", op(".player-status")==="0", op(".player-status"));
  check("badge faded to 0", op("#webmcp-status")==="0", op("#webmcp-status"));
  check("video still drawn", op("#player-target")==="1", op("#player-target"));
  check("player shell black in blackout", bg(".player-shell")==="rgb(0, 0, 0)" && bg(".app-root")==="rgb(0, 0, 0)" && bg("body")==="rgb(0, 0, 0)", bg(".player-shell"));
  check("fade duration ~0.6s", getComputedStyle(document.querySelector(".cinema-bar")).transitionDuration==="0.6s", getComputedStyle(document.querySelector(".cinema-bar")).transitionDuration);
  // Low-battery toast shows during blackout, once per threshold crossing.
  var lowToasts=()=>L.toasts.filter(t=>/battery low/i.test(t)).length;
  check("battery indicator faded in blackout", (function(){ var e=document.querySelector(".battery-corner"); return e && getComputedStyle(settled(e.closest(".cinema-bar"))).opacity==="0"; })(), null);
  __battery(0.15,false);
  await wait(50);
  check("low-battery toast at 15% during blackout", lowToasts()===1 && body.classList.contains("video-blackout") && op(".toast")==="1" && /15%/.test(document.getElementById("toast").textContent), {n:lowToasts(), op:op(".toast"), t:document.getElementById("toast").textContent});
  __battery(0.14); await wait(50);
  __battery(0.13); await wait(50);
  check("low-battery toast only once per crossing", lowToasts()===1, lowToasts());
  await wait(5000);
  check("low-battery toast hides", op(".toast")==="0" && !document.getElementById("toast").classList.contains("toast-urgent"), op(".toast"));
  __battery(undefined,true); await wait(50);
  __battery(undefined,false); await wait(50);
  check("re-armed after charging: toast again", lowToasts()===2, lowToasts());
  __battery(0.5); await wait(50);
  __battery(0.12); await wait(50);
  check("re-armed after >15%: toast again", lowToasts()===3, lowToasts());
  __battery(0.55); await wait(5000);
  check("still blacked out after battery toasts", body.classList.contains("video-blackout"), body.className);
  // WebMCP flash may show during blackout
  vs=await call("video_size",{percent:80},"size 80 during blackout");
  check("badge flash visible during blackout", op("#webmcp-status")==="1" && body.classList.contains("video-blackout"), op("#webmcp-status"));
  await call("video_size",{percent:100},"size 100");
  // first key wakes only (swallowed); focus stays valid & visible
  var before=document.activeElement;
  (document.activeElement||document).dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}));
  await wait(50);
  var a=document.activeElement;
  check("key wakes UI", !body.classList.contains("video-blackout"), body.className);
  check("wake key swallowed (focus unchanged)", a===before, a&&(a.dataset.action||a.id));
  check("focus valid after wake", a && a.classList.contains("focusable") && a.closest("#player-screen") && a.getClientRects().length>0, a&&(a.dataset.action||a.id));
  await wait(700);
  check("cinema-bar restored to 1", op(".cinema-bar")==="1", op(".cinema-bar"));
  // next key navigates normally
  a.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}));
  await wait(50);
  check("second key moves focus", document.activeElement!==a && document.activeElement.classList.contains("focusable"), document.activeElement&&(document.activeElement.dataset.action||document.activeElement.id));
  await wait(2000);
  check("still visible before 3s idle", !body.classList.contains("video-blackout"), null);
  await wait(1500);
  check("blackout again after 3s idle", body.classList.contains("video-blackout"), null);
  // pause restores
  await call("playback_control",{action:"toggle"},"pc toggle pause (blackout)");
  await wait(400);
  check("pause restores UI", !body.classList.contains("video-blackout") && op(".cinema-bar")==="1" && op("#webmcp-status")==="1", body.className+" "+op(".cinema-bar"));
  check("focus valid after pause restore", document.activeElement && document.activeElement.classList.contains("focusable") && document.activeElement.getClientRects().length>0, document.activeElement&&(document.activeElement.dataset.action||document.activeElement.id));
  await wait(3600);
  check("no blackout while paused", !body.classList.contains("video-blackout"), null);
  await call("playback_control",{action:"toggle"},"pc toggle play");
  await wait(3600);
  check("blackout resumes when playing", body.classList.contains("video-blackout"), null);
  await call("player_close",{},"close@player");
  check("close restores UI", !body.classList.contains("video-blackout"), body.className);
  await wait(3600);
  check("no blackout on home screen", !body.classList.contains("video-blackout"), null);
  await call("player_close",{},"close again");
  await call("player_open",{},"open@home");
  await call("playlist_refresh",{},"refresh");
  // execute with no 2nd arg
  try { var r1 = await f("player_status").execute({}); L.results.push({step:"status no-opts", r:!!r1}); } catch(e){ L.results.push({step:"status no-opts", r:{THREW:String(e)}}); }
  document.body.setAttribute("data-log", JSON.stringify(L));
}, 2000); });
