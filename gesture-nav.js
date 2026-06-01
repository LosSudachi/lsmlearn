(() => {
  'use strict';

  const PAGES = ['index.html', 'diccionario.html', 'progreso.html'];
  const PAGE_LABELS = { 'index.html':'Práctica', 'diccionario.html':'Biblioteca', 'progreso.html':'Progreso' };
  const PAGE_ICONS  = { 'index.html':'🤟', 'diccionario.html':'📖', 'progreso.html':'📈' };

  const CFG = {
    // Deslizamiento (mano abierta)
    smoothing: 0.55, windowMs: 380, minTravel: 0.16, minVelocity: 0.0006,
    verticalDominance: 1.25, cooldownMs: 1000,
    // Salto por dedos (1–3 dedos sostenidos)
    fingerDwellMs: 650,          // tiempo que hay que sostener los dedos
    stillSpeed: 0.0010,          // velocidad máx. para considerar la mano "quieta"
    // MediaPipe
    minDetectionConfidence: 0.75, minTrackingConfidence: 0.75, modelComplexity: 1,
  };

  const LS_TUTORIAL = 'lsm:gesture-tutorial-seen';
  const LS_ENABLED  = 'lsm:gesture-enabled';
  const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const safeSet = (k,v) => { try { localStorage.setItem(k,v); } catch {} };

  const getCurrentPage = () => {
    const p = window.location.pathname.split(/[\\/]/).pop();
    return (p || 'index.html').toLowerCase();
  };
  const currentIndex = () => Math.max(0, PAGES.indexOf(getCurrentPage()));
  const navTo = (page, delay = 240) => {
    if (page === getCurrentPage()) return;
    window.setTimeout(() => { window.location.href = page; }, delay);
  };
  const cycle = (dir) => {
    const off = dir === 'up' ? 1 : -1;
    return PAGES[(currentIndex() + off + PAGES.length) % PAGES.length];
  };

  /* ----------------------------------------------------------------------- */
  const injectStyles = () => {
    if (document.getElementById('lsm-gesture-styles')) return;
    const s = document.createElement('style');
    s.id = 'lsm-gesture-styles';
    s.textContent = `
      :root{--lsm-primary:#0058be;--lsm-primary-2:#2170e4;--lsm-secondary:#006c49;
        --lsm-secondary-c:#6cf8bb;--lsm-amber:#825100;--lsm-ink:#131b2e;}
      .lsm-font{font-family:'Inter',system-ui,sans-serif;}
      .lsm-head{font-family:'Lexend','Inter',sans-serif;}
      .lsm-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;
        padding:0 7px;border-radius:7px;background:#eef0ff;border:1px solid #c2c6d6;border-bottom-width:2px;
        color:var(--lsm-ink);font:700 12px/1 'Inter',sans-serif;}

      /* Botón flotante */
      .lsm-fab{position:fixed;left:280px;bottom:16px;z-index:10000;display:flex;align-items:center;gap:10px;
        padding:10px 14px 10px 12px;border:none;border-radius:9999px;background:#fff;color:var(--lsm-ink);
        box-shadow:0 10px 30px rgba(15,23,42,.18);font:600 13px/1 'Inter',sans-serif;
        transition:transform .15s ease,box-shadow .15s ease;}
      .lsm-fab:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(15,23,42,.22);}
      .lsm-fab .dot{width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;
        font-size:16px;background:#eef0ff;color:var(--lsm-primary);border:none;cursor:pointer;
        transition:background .2s ease,color .2s ease;}
      .lsm-fab.is-on .dot{background:var(--lsm-secondary-c);color:var(--lsm-secondary);}
      .lsm-fab.is-loading .dot{background:#dae2fd;}
      .lsm-fab .label{display:flex;flex-direction:column;gap:2px;text-align:left;border:none;background:none;cursor:pointer;padding:0;}
      .lsm-fab .label small{font-weight:500;opacity:.6;font-size:11px;}
      .lsm-fab .help{margin-left:2px;width:24px;height:24px;border-radius:9999px;border:1px solid #c2c6d6;
        background:transparent;color:#727785;font:700 13px/1 'Inter',sans-serif;cursor:pointer;}
      .lsm-fab .help:hover{color:var(--lsm-primary);border-color:var(--lsm-primary);}

      /* Insignia con anillo */
      .lsm-badge{position:fixed;top:16px;right:16px;z-index:10000;min-width:230px;max-width:300px;padding:12px 14px;
        border-radius:18px;background:rgba(10,18,35,.86);color:#fff;backdrop-filter:blur(10px);
        box-shadow:0 12px 32px rgba(15,23,42,.25);display:flex;align-items:center;gap:12px;
        font:13px/1.35 'Inter',sans-serif;transform:translateY(-8px);opacity:0;
        transition:opacity .16s ease,transform .16s ease,background .2s ease;pointer-events:none;}
      .lsm-badge .ring{position:relative;width:40px;height:40px;flex:0 0 auto;}
      .lsm-badge .ring svg{transform:rotate(-90deg);}
      .lsm-badge .ring .track{stroke:rgba(255,255,255,.16);}
      .lsm-badge .ring .bar{stroke:var(--lsm-secondary-c);transition:stroke-dashoffset .08s linear;}
      .lsm-badge .ring .ico{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:17px;}
      .lsm-badge .txt b{display:block;font-weight:700;margin-bottom:2px;}
      .lsm-badge .txt span{opacity:.78;}

      /* Leyenda flotante (opciones de mano) */
      .lsm-guide{position:fixed;right:16px;top:50%;transform:translateY(-50%);z-index:9998;width:150px;
        padding:14px 14px 12px;border-radius:18px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);
        box-shadow:0 8px 26px rgba(15,23,42,.12);font:600 11px/1.3 'Inter',sans-serif;color:var(--lsm-ink);
        opacity:0;transition:opacity .2s ease;pointer-events:none;}
      .lsm-guide.show{opacity:1;}
      .lsm-guide h4{margin:0 0 10px;font:700 11px/1 'Lexend',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#727785;}
      .lsm-guide .row{display:flex;gap:9px;align-items:flex-start;margin-bottom:10px;}
      .lsm-guide .row:last-child{margin-bottom:0;}
      .lsm-guide .gi{font-size:18px;flex:0 0 auto;line-height:1.2;}
      .lsm-guide .gt b{display:block;font-weight:700;}
      .lsm-guide .gt span{font-weight:500;opacity:.62;}
      .lsm-guide .dots{display:flex;gap:5px;margin-top:9px;padding-top:10px;border-top:1px solid #e2e7ff;}
      .lsm-guide .pdot{flex:1;height:5px;border-radius:9999px;background:#c2c6d6;}
      .lsm-guide .pdot.active{background:var(--lsm-primary);}

      /* Modal (tutorial + ayuda) */
      .lsm-modal-backdrop{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;
        padding:24px;background:rgba(10,18,35,.55);backdrop-filter:blur(6px);opacity:0;transition:opacity .2s ease;overflow:auto;}
      .lsm-modal-backdrop.show{opacity:1;}
      .lsm-modal{width:100%;max-width:460px;background:#fff;border-radius:28px;overflow:hidden;
        box-shadow:0 30px 80px rgba(15,23,42,.35);transform:translateY(12px) scale(.98);
        transition:transform .25s cubic-bezier(.2,.8,.2,1);}
      .lsm-modal-backdrop.show .lsm-modal{transform:translateY(0) scale(1);}
      .lsm-modal .hero{background:linear-gradient(135deg,var(--lsm-primary),var(--lsm-primary-2));color:#fff;padding:26px 28px 20px;position:relative;}
      .lsm-modal .hero h2{font:700 22px/1.2 'Lexend',sans-serif;margin:0 0 6px;}
      .lsm-modal .hero p{margin:0;font:400 14px/1.5 'Inter',sans-serif;opacity:.92;}
      .lsm-modal .hero .wave{font-size:32px;display:block;margin-bottom:8px;}
      .lsm-modal .hero .x{position:absolute;top:18px;right:18px;width:30px;height:30px;border-radius:9999px;border:none;
        background:rgba(255,255,255,.18);color:#fff;cursor:pointer;font-size:16px;}
      .lsm-modal .hero .x:hover{background:rgba(255,255,255,.3);}
      .lsm-methods{padding:20px 24px 6px;display:grid;gap:12px;}
      .lsm-m{display:flex;gap:14px;align-items:flex-start;padding:13px 14px;border:1px solid #e2e7ff;border-radius:16px;background:#faf8ff;}
      .lsm-m .mi{flex:0 0 auto;width:42px;height:42px;border-radius:12px;background:#fff;border:1px solid #e2e7ff;
        display:flex;align-items:center;justify-content:center;font-size:22px;}
      .lsm-m .mc b{display:block;font:600 14px/1.3 'Inter',sans-serif;color:var(--lsm-ink);margin-bottom:3px;}
      .lsm-m .mc span{font:400 13px/1.45 'Inter',sans-serif;color:#424754;}
      .lsm-m.is-cam{border-color:#bfe3d3;background:#f0fbf6;}
      .lsm-foot{padding:10px 24px 26px;display:flex;flex-direction:column;gap:10px;}
      .lsm-note{display:flex;gap:8px;align-items:center;font:400 12px/1.4 'Inter',sans-serif;color:#727785;
        background:#f2f3ff;border-radius:12px;padding:10px 12px;margin:0;}
      .lsm-btn-primary{width:100%;border:none;border-radius:14px;padding:14px;background:var(--lsm-primary);color:#fff;
        cursor:pointer;font:600 15px/1 'Lexend',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;
        transition:opacity .15s ease;}
      .lsm-btn-primary:hover{opacity:.92;}
      .lsm-btn-ghost{width:100%;border:none;background:transparent;color:#727785;cursor:pointer;padding:6px;font:500 13px/1 'Inter',sans-serif;}
      .lsm-btn-ghost:hover{color:var(--lsm-ink);}
      @media (max-width:640px){.lsm-guide{display:none;}.lsm-fab .label{display:none;}.lsm-fab{left:96px;}}
      @media (prefers-reduced-motion: reduce){.lsm-modal,.lsm-modal-backdrop,.lsm-badge,.lsm-guide,.lsm-fab{transition:none;}}
    `;
    document.head.appendChild(s);
  };

  /* ----------------------------------------------------------------------- */
  const ui = {};

  const buildFab = () => {
    const fab = document.createElement('div');
    fab.className = 'lsm-fab lsm-font';
    fab.innerHTML = `
      <button class="dot" type="button" data-toggle aria-label="Activar o pausar la cámara">✋</button>
      <button type="button" data-toggle class="label">
        <strong>Navegar con gestos</strong><small data-state>Toca para activar</small>
      </button>
      <button class="help" type="button" data-help aria-label="¿Cómo navegar?">?</button>`;
    document.body.appendChild(fab);
    ui.fab = fab; ui.fabState = fab.querySelector('[data-state]');
    fab.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', toggleGestures));
    fab.querySelector('[data-help]').addEventListener('click', () => openModal('help'));
  };

  const buildBadge = () => {
    const b = document.createElement('div');
    b.className = 'lsm-badge';
    b.setAttribute('aria-live', 'polite');
    b.innerHTML = `
      <div class="ring"><svg width="40" height="40" viewBox="0 0 40 40">
        <circle class="track" cx="20" cy="20" r="16" fill="none" stroke-width="4"></circle>
        <circle class="bar" cx="20" cy="20" r="16" fill="none" stroke-width="4" stroke-linecap="round"
          stroke-dasharray="100.5" stroke-dashoffset="100.5"></circle></svg>
        <div class="ico">✋</div></div>
      <div class="txt"><b data-title>Listo</b><span data-sub>Mano abierta o muestra dedos</span></div>`;
    document.body.appendChild(b);
    ui.badge = b; ui.badgeBar = b.querySelector('.bar'); ui.badgeIco = b.querySelector('.ico');
    ui.badgeTitle = b.querySelector('[data-title]'); ui.badgeSub = b.querySelector('[data-sub]');
  };

  const buildGuide = () => {
    const g = document.createElement('div');
    g.className = 'lsm-guide lsm-font';
    const dots = PAGES.map((p,i) => `<div class="pdot ${i===currentIndex()?'active':''}" title="${PAGE_LABELS[p]}"></div>`).join('');
    g.innerHTML = `
      <h4>Gestos de mano</h4>
      <div class="row"><span class="gi">✋↕</span><div class="gt"><b>Mano abierta</b><span>Desliza ↑ siguiente · ↓ anterior</span></div></div>
      <div class="row"><span class="gi">☝</span><div class="gt"><b>1·2·3 dedos</b><span>Vas directo a esa sección</span></div></div>
      <div class="dots">${dots}</div>`;
    document.body.appendChild(g);
    ui.guide = g;
  };

  const RING_LEN = 2 * Math.PI * 16;
  let hideTimer = null;
  const setProgress = (p) => { ui.badgeBar.style.strokeDashoffset = (RING_LEN * (1 - Math.max(0,Math.min(1,p)))).toFixed(2); };
  const showBadge = ({ title, sub, icon, bg, progress }) => {
    if (title) ui.badgeTitle.textContent = title;
    if (sub) ui.badgeSub.textContent = sub;
    if (icon) ui.badgeIco.textContent = icon;
    if (typeof progress === 'number') setProgress(progress);
    ui.badge.style.background = bg || 'rgba(10,18,35,.86)';
    ui.badge.style.opacity = '1'; ui.badge.style.transform = 'translateY(0)';
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => { ui.badge.style.opacity = '0'; ui.badge.style.transform = 'translateY(-8px)'; }, 1100);
  };

  /* ---- Detección de mano ------------------------------------------------- */
  const PALM_POINTS = [0, 5, 9, 13, 17];
  const palmCenter = (lm) => {
    let x=0,y=0; for (const i of PALM_POINTS){ x+=lm[i].x; y+=lm[i].y; } return { x:x/5, y:y/5 };
  };
  // Cuenta dedos extendidos. Para índice..meñique: punta por encima de su nudillo.
  const countFingers = (lm) => {
    const dist = (a,b) => Math.hypot(lm[a].x-lm[b].x, lm[a].y-lm[b].y);
    let n = 0;
    if (dist(4,5) > dist(3,5) * 1.15) n++;               // pulgar separado
    const f = [[8,6],[12,10],[16,14],[20,18]];
    for (const [tip,pip] of f) if (lm[tip].y < lm[pip].y - 0.03) n++;
    return n;
  };

  let smooth = null, buffer = [], lastTriggerAt = 0;
  let fingerCount = 0, fingerSince = 0, lastPos = null, lastT = 0;
  const resetEngine = () => { smooth = null; buffer = []; fingerCount = 0; fingerSince = 0; lastPos = null; };

  const processLandmarks = (lm) => {
    const now = performance.now();
    const raw = palmCenter(lm);
    if (!smooth) smooth = { ...raw };
    else { smooth.x = CFG.smoothing*smooth.x + (1-CFG.smoothing)*raw.x; smooth.y = CFG.smoothing*smooth.y + (1-CFG.smoothing)*raw.y; }

    // velocidad instantánea (para distinguir "quieto" de "deslizando")
    let speed = 0;
    if (lastPos) speed = Math.hypot(smooth.x-lastPos.x, smooth.y-lastPos.y) / Math.max(1, now-lastT);
    lastPos = { x:smooth.x, y:smooth.y }; lastT = now;

    const fingers = countFingers(lm);
    const inCooldown = now - lastTriggerAt < CFG.cooldownMs;

    /* --- MODO DEDOS: 1–3 dedos sostenidos y mano quieta → salto directo --- */
    if (fingers >= 1 && fingers <= 3 && speed < CFG.stillSpeed) {
      buffer = []; // no interfiere con el deslizamiento
      if (fingers !== fingerCount) { fingerCount = fingers; fingerSince = now; }
      const dwell = now - fingerSince;
      const target = PAGES[fingers - 1];
      const isCurrent = (fingers - 1) === currentIndex();
      const progress = Math.min(dwell / CFG.fingerDwellMs, 1);

      if (isCurrent) {
        showBadge({ title:`Ya estás en ${PAGE_LABELS[target]}`, sub:`${fingers} dedo(s)`, icon:'✓', bg:'rgba(10,18,35,.8)', progress:0 });
        return;
      }
      if (inCooldown) { showBadge({ title:'Un momento…', sub:'Evitando dobles cambios', icon:'⏱', bg:'rgba(10,18,35,.8)', progress:0 }); return; }
      if (progress >= 1) {
        lastTriggerAt = now; resetEngine();
        showBadge({ title:`Abriendo ${PAGE_LABELS[target]}`, sub:`Mostraste ${fingers} dedo(s)`, icon:PAGE_ICONS[target], bg:'rgba(0,90,190,.92)', progress:1 });
        navTo(target); return;
      }
      showBadge({ title:`Yendo a ${PAGE_LABELS[target]}`, sub:`Mantén ${fingers} dedo(s)…`, icon:'☝', bg:'rgba(0,108,73,.86)', progress });
      return;
    }
    fingerCount = 0; fingerSince = 0;

    /* --- MODO DESLIZAR: mano abierta (4–5 dedos) con movimiento vertical --- */
    if (fingers >= 4) {
      buffer.push({ x:smooth.x, y:smooth.y, t:now });
      while (buffer.length && now - buffer[0].t > CFG.windowMs) buffer.shift();
      if (buffer.length < 3) { showBadge({ title:'Mano abierta', sub:'Desliza ↑ o ↓', icon:'✋', bg:'rgba(0,108,73,.86)', progress:0 }); return; }

      const a = buffer[0], z = buffer[buffer.length-1];
      const dy = z.y-a.y, dx = z.x-a.x, dt = (z.t-a.t)||1, vy = Math.abs(dy)/dt;
      const progress = Math.min(Math.abs(dy)/CFG.minTravel, vy/CFG.minVelocity, 1);

      if (inCooldown) { showBadge({ title:'Un momento…', sub:'Evitando dobles cambios', icon:'⏱', bg:'rgba(10,18,35,.8)', progress:0 }); return; }
      const verticalDominant = Math.abs(dy) >= Math.abs(dx)*CFG.verticalDominance;
      if (!verticalDominant && Math.abs(dx) > CFG.minTravel) { showBadge({ title:'Muy horizontal', sub:'Hazlo vertical', icon:'↕', bg:'rgba(130,81,0,.85)', progress }); return; }
      if (!(Math.abs(dy) >= CFG.minTravel && vy >= CFG.minVelocity)) { showBadge({ title:'Sigue deslizando', sub:'Un poco más, con decisión', icon:'↕', bg:'rgba(0,108,73,.8)', progress }); return; }

      lastTriggerAt = now; resetEngine();
      const dir = dy < 0 ? 'up' : 'down';
      const target = cycle(dir);
      showBadge({ title:`Abriendo ${PAGE_LABELS[target]}`, sub:dir==='up'?'Deslizaste arriba':'Deslizaste abajo', icon:PAGE_ICONS[target], bg:'rgba(0,90,190,.92)', progress:1 });
      navTo(target); return;
    }

    // Mano cerrada / en transición
    buffer = [];
    showBadge({ title:'Mano detectada', sub:'Abre la mano o muestra dedos', icon:'✊', bg:'rgba(10,18,35,.78)', progress:0 });
  };

  /* ---- MediaPipe lifecycle ----------------------------------------------- */
  let hands=null, camera=null, video=null, running=false, booting=false;
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const sc = document.createElement('script'); sc.src = src; sc.async = true;
    sc.onload = res; sc.onerror = () => rej(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(sc);
  });

  const startGestures = async () => {
    if (running || booting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showBadge({ title:'Cámara no disponible', sub:'Usa el teclado (1·2·3) o el menú', icon:'⚠', bg:'rgba(186,26,26,.9)' }); return;
    }
    booting = true; setFabState('loading');
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      if (typeof Hands === 'undefined' || typeof Camera === 'undefined') throw new Error('MediaPipe no se cargó');
      if (!video) {
        video = document.createElement('video');
        Object.assign(video, { autoplay:true, muted:true, playsInline:true });
        video.setAttribute('aria-hidden','true');
        video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(video);
      }
      hands = new Hands({ locateFile:(f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands:1, selfieMode:true, modelComplexity:CFG.modelComplexity,
        minDetectionConfidence:CFG.minDetectionConfidence, minTrackingConfidence:CFG.minTrackingConfidence });
      hands.onResults((r) => {
        if (!running) return;
        const lm = r.multiHandLandmarks && r.multiHandLandmarks[0];
        if (!lm || !lm.length) { resetEngine(); showBadge({ title:'Sin mano', sub:'Colócala frente a la cámara', icon:'◌', bg:'rgba(10,18,35,.72)', progress:0 }); return; }
        processLandmarks(lm);
      });
      camera = new Camera(video, { onFrame: async () => { if (running) await hands.send({ image: video }); }, width:640, height:480, facingMode:'user' });
      await camera.start();
      running = true; booting = false; safeSet(LS_ENABLED,'1'); setFabState('on');
      ui.guide.classList.add('show');
      showBadge({ title:'Gestos activos', sub:'Mano abierta o muestra dedos', icon:'✋', bg:'rgba(0,108,73,.88)', progress:0 });
    } catch (err) {
      booting = false; running = false; console.warn('gesture-nav:', err); setFabState('off');
      const denied = /permission|denied|NotAllowed/i.test(String(err && err.name) + String(err && err.message));
      showBadge({ title: denied?'Permiso denegado':'No se pudo iniciar', sub: denied?'Puedes usar 1·2·3 o el menú':'Revisa tu conexión', icon:'⚠', bg:'rgba(186,26,26,.9)' });
    }
  };

  const stopGestures = () => {
    running = false;
    try { camera && camera.stop(); } catch {}
    if (video && video.srcObject) { video.srcObject.getTracks().forEach((t)=>t.stop()); video.srcObject = null; }
    resetEngine(); safeSet(LS_ENABLED,'0'); setFabState('off');
    ui.guide.classList.remove('show');
    showBadge({ title:'Gestos en pausa', sub:'Teclado 1·2·3 sigue disponible', icon:'⏸', bg:'rgba(10,18,35,.82)', progress:0 });
  };

  function toggleGestures() {
    if (running) stopGestures();
    else if (!safeGet(LS_TUTORIAL)) openModal('intro');
    else startGestures();
  }

  const setFabState = (state) => {
    ui.fab.classList.remove('is-on','is-loading');
    const dot = ui.fab.querySelector('.dot');
    if (state==='on') { ui.fab.classList.add('is-on'); dot.textContent='👁'; ui.fabState.textContent='Activo · toca para pausar'; }
    else if (state==='loading') { ui.fab.classList.add('is-loading'); dot.textContent='…'; ui.fabState.textContent='Encendiendo cámara…'; }
    else { dot.textContent='✋'; ui.fabState.textContent='Toca para activar'; }
  };

  /* ---- Modal: tutorial / ayuda (mismo contenido, distinto pie) ----------- */
  const openModal = (mode) => {
    if (document.querySelector('.lsm-modal-backdrop')) return;
    const back = document.createElement('div');
    back.className = 'lsm-modal-backdrop lsm-font';
    const foot = mode === 'help'
      ? `<button class="lsm-btn-primary" data-go>${running ? '✓ Entendido' : '✋ Activar cámara para gestos'}</button>
         <button class="lsm-btn-ghost" data-skip>Cerrar</button>`
      : `<p class="lsm-note">🔒 La cámara solo se usa en tu dispositivo para leer el gesto. No se graba ni se envía nada.</p>
         <button class="lsm-btn-primary" data-go>✋ Activar cámara y empezar</button>
         <button class="lsm-btn-ghost" data-skip>Ahora no (puedo usar teclado o menú)</button>`;
    back.innerHTML = `
      <div class="lsm-modal" role="dialog" aria-modal="true" aria-label="Formas de navegar">
        <div class="hero">
          <button class="x" data-skip aria-label="Cerrar">✕</button>
          <span class="wave">🧭</span>
          <h2 class="lsm-head">Cómo moverte por LSM Learn</h2>
          <p>Tienes cuatro formas de cambiar de sección. Usa la que más te acomode.</p>
        </div>
        <div class="lsm-methods">
          <div class="lsm-m"><div class="mi">👆</div><div class="mc"><b>Toca el menú lateral</b><span>El método de siempre, a la izquierda. Siempre disponible.</span></div></div>
          <div class="lsm-m"><div class="mi">⌨️</div><div class="mc"><b>Teclado</b><span>Presiona <span class="lsm-kbd">1</span> <span class="lsm-kbd">2</span> <span class="lsm-kbd">3</span> para ir directo a Práctica, Biblioteca o Progreso.</span></div></div>
          <div class="lsm-m is-cam"><div class="mi">✋</div><div class="mc"><b>Mano abierta (gesto)</b><span>Deslízala hacia <strong>arriba</strong> para la siguiente sección o hacia <strong>abajo</strong> para la anterior.</span></div></div>
          <div class="lsm-m is-cam"><div class="mi">☝️</div><div class="mc"><b>Muestra dedos (gesto)</b><span>Levanta <strong>1, 2 o 3</strong> dedos y mantén un instante: vas directo a esa sección.</span></div></div>
        </div>
        <div class="lsm-foot">${foot}</div>
      </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));
    const close = (go) => {
      safeSet(LS_TUTORIAL,'1');
      back.classList.remove('show'); window.setTimeout(() => back.remove(), 220);
      if (go && !running) startGestures();
    };
    back.querySelectorAll('[data-skip]').forEach((el) => el.addEventListener('click', () => close(false)));
    back.querySelector('[data-go]').addEventListener('click', () => close(true));
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    document.addEventListener('keydown', function esc(e){ if (e.key==='Escape'){ close(false); document.removeEventListener('keydown', esc); } });
  };

  /* ---- Navegación por teclado (siempre activa, sin cámara) --------------- */
  const setupKeyboard = () => {
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = Number(e.key) - 1;
        if (idx !== currentIndex()) { e.preventDefault(); showBadge({ title:`Abriendo ${PAGE_LABELS[PAGES[idx]]}`, sub:`Tecla ${e.key}`, icon:PAGE_ICONS[PAGES[idx]], bg:'rgba(0,90,190,.92)', progress:1 }); navTo(PAGES[idx], 120); }
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault(); openModal('help');
      }
    });
  };

  /* ---- Arranque ---------------------------------------------------------- */
  const boot = () => {
    injectStyles(); buildBadge(); buildGuide(); buildFab(); setFabState('off'); setupKeyboard();
    if (!safeGet(LS_TUTORIAL)) window.setTimeout(() => openModal('intro'), 700);
    else if (safeGet(LS_ENABLED) === '1') startGestures();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
