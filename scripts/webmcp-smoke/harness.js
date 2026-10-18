// Injected in <head> before app scripts.
(function(){
  var L = window.__log = {errors:[], toasts:[], results:[]};
  window.addEventListener("error", function(e){ L.errors.push("error: "+e.message); });
  window.addEventListener("unhandledrejection", function(e){ L.errors.push("rejection: "+(e.reason&&e.reason.message||e.reason)); });
  var ce = console.error; console.error = function(){ L.errors.push("console.error: "+Array.prototype.join.call(arguments," ")); ce.apply(console, arguments); };
  // Battery Status API mock. ?battery=none removes it, =throw throws, =reject rejects.
  var bmode=(location.search.match(/battery=(\w+)/)||[])[1]||"mock";
  L.batteryMode=bmode;
  if (bmode==="none") { delete Navigator.prototype.getBattery; try{ delete navigator.getBattery; }catch(e){} }
  else {
    var bat=new EventTarget(); bat.level=0.55; bat.charging=false; bat.chargingTime=Infinity; bat.dischargingTime=7200;
    window.__battery=function(level,charging){
      if(typeof level==="number"&&level!==bat.level){ bat.level=level; bat.dispatchEvent(new Event("levelchange")); }
      if(typeof charging==="boolean"&&charging!==bat.charging){ bat.charging=charging; bat.dispatchEvent(new Event("chargingchange")); }
    };
    Object.defineProperty(Navigator.prototype,"getBattery",{configurable:true,writable:true,value:function(){
      if(bmode==="throw") throw new Error("battery blocked");
      if(bmode==="reject") return Promise.reject(new DOMException("blocked","NotAllowedError"));
      return Promise.resolve(bat);
    }});
  }
  var tools = window.__tools = [];
  document.modelContext = { registerTool: function(d){ tools.push(d); return Promise.resolve(); } };
  // Faithful-enough YT stub
  var PS = {UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5};
  function Player(id, opts){
    var self=this, el=document.getElementById(id); window.__ytOpts=opts;
    var f=document.createElement("iframe"); f.id=id; f.className=el.className; el.replaceWith(f);
    this._o=opts; this._t=(opts.playerVars&&opts.playerVars.start)||0; this._s=-1; this._vid=opts.videoId; this._dur=600;
    setTimeout(function(){ opts.events.onReady({target:self}); }, 50);
  }
  Player.prototype={
    _set:function(s){ this._s=s; var o=this._o; setTimeout(function(){ o.events.onStateChange({data:s}); },0); },
    playVideo:function(){ this._set(1); }, pauseVideo:function(){ this._set(2); },
    seekTo:function(t){ this._t=t; }, getCurrentTime:function(){ return this._t; },
    getDuration:function(){ return this._dur; }, getPlayerState:function(){ return this._s; },
    loadVideoById:function(a){ this._vid=typeof a==="string"?a:a.videoId; this._t=(a&&a.startSeconds)||0; this._set(1); },
    getVideoData:function(){ return {video_id:this._vid}; },
    // Captions module stub: records calls, tracks the active track.
    loadModule:function(m){ (window.__ccLog=window.__ccLog||[]).push({op:"load",m:m,vid:this._vid}); if(m==="captions") this._ccMod=true; },
    unloadModule:function(m){ (window.__ccLog=window.__ccLog||[]).push({op:"unload",m:m,vid:this._vid}); if(m==="captions"){ this._ccMod=false; this._ccTrack={}; } },
    setOption:function(m,k,v){ (window.__ccLog=window.__ccLog||[]).push({op:"set",m:m,k:k,v:v,vid:this._vid}); if(m==="captions"&&k==="track") this._ccTrack=v||{}; },
    getOption:function(m,k){ if(m!=="captions") return undefined; if(k==="tracklist") return [{languageCode:"fr",kind:""},{languageCode:"en",kind:"asr"},{languageCode:"en-US",kind:""}]; if(k==="track") return this._ccTrack||{}; }
  };
  window.YT={Player:Player, PlayerState:PS};
})();
