// Injected in <head> before app scripts.
(function(){
  var L = window.__log = {errors:[], toasts:[], results:[]};
  window.addEventListener("error", function(e){ L.errors.push("error: "+e.message); });
  window.addEventListener("unhandledrejection", function(e){ L.errors.push("rejection: "+(e.reason&&e.reason.message||e.reason)); });
  var ce = console.error; console.error = function(){ L.errors.push("console.error: "+Array.prototype.join.call(arguments," ")); ce.apply(console, arguments); };
  var tools = window.__tools = [];
  document.modelContext = { registerTool: function(d){ tools.push(d); return Promise.resolve(); } };
  // Faithful-enough YT stub
  var PS = {UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5};
  function Player(id, opts){
    var self=this, el=document.getElementById(id);
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
    getVideoData:function(){ return {video_id:this._vid}; }
  };
  window.YT={Player:Player, PlayerState:PS};
})();
