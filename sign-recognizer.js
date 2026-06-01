(() => {
  'use strict';

  const N = 63, TAU = 1.4; // TAU controla qué tan estricto es el match
  const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  const SKEY = 'lsm:samples';

  function extractFeatures(lm){
    const w=lm[0], scale=Math.hypot(lm[9].x-w.x, lm[9].y-w.y)||1e-3;
    const v=new Float32Array(N);
    for(let i=0;i<21;i++){ v[i*3]=(lm[i].x-w.x)/scale; v[i*3+1]=(lm[i].y-w.y)/scale; v[i*3+2]=((lm[i].z||0)-(w.z||0))/scale; }
    return v;
  }

  const api = {
    FEATURES:N, CONN, extractFeatures, SKEY,
    _s:{}, // {L:[Float32Array,...]}

    _loadRaw(){ try{ return JSON.parse(localStorage.getItem(SKEY)||'{}'); }catch{ return {}; } },
    _index(raw){ this._s={}; for(const L in raw){ if(raw[L]&&raw[L].length) this._s[L]=raw[L].map(a=>Float32Array.from(a)); } },

    async loadModel(){
      let raw=this._loadRaw();
      if(!Object.keys(raw).length){
        try{ const r=await fetch('models/samples.json'); if(r.ok){ raw=await r.json(); localStorage.setItem(SKEY, JSON.stringify(raw)); } }catch{}
      }
      this._index(raw);
      return this.registeredLetters().length>0;
    },
    refresh(){ this._index(this._loadRaw()); },

    registeredLetters(){ return Object.keys(this._s).filter(L=>this._s[L]&&this._s[L].length); },
    labels(){ return this.registeredLetters(); },
    hasModel(){ return this.registeredLetters().length>0; },
    countFor(letter){ return (this._s[letter]||[]).length; },

    // Registrar (incremental, por letra)
    addSamples(letter, vecs){
      const raw=this._loadRaw();
      raw[letter]=(raw[letter]||[]).concat(vecs.map(v=>Array.from(v)));
      try{ localStorage.setItem(SKEY, JSON.stringify(raw)); }catch(e){ return false; }
      this._s[letter]=raw[letter].map(a=>Float32Array.from(a));
      return true;
    },
    clearLetter(letter){ const raw=this._loadRaw(); delete raw[letter]; localStorage.setItem(SKEY, JSON.stringify(raw)); delete this._s[letter]; },
    clearAll(){ localStorage.setItem(SKEY, '{}'); this._s={}; },

    _dmin(L, vec){ // distancia cuadrada al vecino más cercano de la letra L
      const arr=this._s[L]; let best=Infinity;
      for(let k=0;k<arr.length;k++){ const s=arr[k]; let d=0; for(let i=0;i<N;i++){ const e=s[i]-vec[i]; d+=e*e; } if(d<best) best=d; }
      return best;
    },

    confidence(letter, vec){
      if(!this._s[letter]||!this._s[letter].length) return 0;
      const dt=this._dmin(letter, vec);
      let bestD=dt; for(const L of this.registeredLetters()){ if(L===letter) continue; const d=this._dmin(L,vec); if(d<bestD) bestD=d; }
      const sim=Math.exp(-0.5*Math.pow(Math.sqrt(dt)/TAU,2));   // cercanía absoluta a la letra
      const ratio=dt>0?Math.min(1,bestD/dt):1;                  // que sea además la MÁS cercana
      return Math.max(0,Math.min(1, sim*ratio));
    },
    predict(vec){
      const Ls=this.registeredLetters(); if(!Ls.length) return null;
      let bL=null,bD=Infinity; for(const L of Ls){ const d=this._dmin(L,vec); if(d<bD){bD=d;bL=L;} }
      return { label:bL, prob:Math.exp(-0.5*Math.pow(Math.sqrt(bD)/TAU,2)), labels:Ls };
    },
    probFor(letter, vec){ return this.confidence(letter, vec); },

    // Cámara: procesa el <video>, dibuja puntos y entrega features por cuadro
    async start(video, canvas, onFrame){
      this.stop();
      const load=(src)=>new Promise((res,rej)=>{ if(document.querySelector(`script[src="${src}"]`)) return res();
        const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(0); document.head.appendChild(s); });
      try{ await load('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.min.js'); }catch{ onFrame&&onFrame(null,'noload'); return; }
      if(typeof Hands==='undefined'){ onFrame&&onFrame(null,'noload'); return; }
      const hands=new Hands({ locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands:1, selfieMode:true, modelComplexity:1, minDetectionConfidence:0.7, minTrackingConfidence:0.6 });
      const ctx=canvas.getContext('2d');
      hands.onResults((r)=>{
        const w=canvas.width=video.clientWidth||640, h=canvas.height=video.clientHeight||400;
        ctx.clearRect(0,0,w,h);
        const lm=r.multiHandLandmarks&&r.multiHandLandmarks[0];
        if(!lm){ onFrame&&onFrame(null); return; }
        ctx.strokeStyle='rgba(111,255,196,.85)'; ctx.lineWidth=2;
        CONN.forEach(([a,b])=>{ ctx.beginPath(); ctx.moveTo(lm[a].x*w,lm[a].y*h); ctx.lineTo(lm[b].x*w,lm[b].y*h); ctx.stroke(); });
        ctx.fillStyle='#fff'; lm.forEach((p)=>{ ctx.beginPath(); ctx.arc(p.x*w,p.y*h,3.2,0,7); ctx.fill(); });
        onFrame&&onFrame({ vec:extractFeatures(lm) });
      });
      this._hands=hands; this._video=video; this._canvas=canvas; this._run=true;
      const loop=async()=>{ if(!this._run) return; if(video.readyState>=2){ try{ await hands.send({image:video}); }catch{} } this._raf=requestAnimationFrame(loop); };
      loop();
    },
    stop(){ this._run=false; if(this._raf) cancelAnimationFrame(this._raf);
      if(this._canvas){ const c=this._canvas.getContext('2d'); c&&c.clearRect(0,0,this._canvas.width,this._canvas.height); } this._hands=null; },
  };

  window.SignRecognizer=api;
})();
