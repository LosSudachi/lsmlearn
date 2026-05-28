(() => {
  const pages = ['index.html', 'diccionario.html', 'progreso.html'];
  const cooldownMs = 500;
  const navigationFlashMs = 220;
  const pageLabels = {
    'index.html': 'Práctica',
    'diccionario.html': 'Diccionario',
    'progreso.html': 'Progreso',
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });

  const getCurrentPage = () => {
    const currentPath = window.location.pathname.split(/[\\/]/).pop();
    return (currentPath || 'index.html').toLowerCase();
  };

  const getNextPage = (direction) => {
    const currentIndex = Math.max(0, pages.indexOf(getCurrentPage()));
    const offset = direction === 'up' ? 1 : -1;
    return pages[(currentIndex + offset + pages.length) % pages.length];
  };

  const createHiddenVideo = () => {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);
    return video;
  };

  const createStatusBadge = () => {
    const badge = document.createElement('div');
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('aria-atomic', 'true');
    badge.style.cssText = [
      'position:fixed',
      'top:16px',
      'right:16px',
      'z-index:9999',
      'min-width:220px',
      'max-width:280px',
      'padding:12px 14px',
      'border-radius:16px',
      'background:rgba(10,18,35,0.82)',
      'color:#fff',
      'backdrop-filter:blur(10px)',
      'box-shadow:0 12px 32px rgba(15,23,42,0.2)',
      'font-family:Inter, sans-serif',
      'font-size:13px',
      'line-height:1.3',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'transform:translateY(-8px)',
      'opacity:0',
      'transition:opacity 160ms ease, transform 160ms ease, background 160ms ease',
      'pointer-events:none',
    ].join(';');

    badge.innerHTML = `
      <div style="width:36px;height:36px;border-radius:9999px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">
        <span data-gesture-icon style="font-size:18px;line-height:1;">✋</span>
      </div>
      <div style="min-width:0;">
        <div data-gesture-title style="font-weight:700;margin-bottom:2px;">Esperando mano</div>
        <div data-gesture-subtitle style="opacity:0.78;">Mueve la mano verticalmente</div>
      </div>
    `;

    document.body.appendChild(badge);
    return badge;
  };

  const showBadge = (badge, state) => {
    const title = badge.querySelector('[data-gesture-title]');
    const subtitle = badge.querySelector('[data-gesture-subtitle]');
    const icon = badge.querySelector('[data-gesture-icon]');

    if (title) {
      title.textContent = state.title;
    }

    if (subtitle) {
      subtitle.textContent = state.subtitle;
    }

    if (icon) {
      icon.textContent = state.icon;
    }

    badge.style.background = state.background || 'rgba(10,18,35,0.82)';
    badge.style.opacity = '1';
    badge.style.transform = 'translateY(0)';
  };

  const hideBadge = (badge) => {
    badge.style.opacity = '0';
    badge.style.transform = 'translateY(-8px)';
  };

  const boot = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }

    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
      return;
    }

    const video = createHiddenVideo();
    const badge = createStatusBadge();
    let lastTriggerAt = 0;
    let gestureStart = null;
    let hideBadgeTimer = null;

    const scheduleBadgeHide = () => {
      window.clearTimeout(hideBadgeTimer);
      hideBadgeTimer = window.setTimeout(() => hideBadge(badge), 900);
    };

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results) => {
      const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];
      if (!landmarks || !landmarks.length) {
        gestureStart = null;
        showBadge(badge, {
          title: 'Sin mano detectada',
          subtitle: 'Coloca la mano frente a la cámara',
          icon: '◌',
          background: 'rgba(10,18,35,0.7)',
        });
        scheduleBadgeHide();
        return;
      }

      const wrist = landmarks[0];
      const now = performance.now();

      if (!gestureStart) {
        gestureStart = { x: wrist.x, y: wrist.y, time: now };
        showBadge(badge, {
          title: 'Mano detectada',
          subtitle: 'Mantén un desplazamiento vertical',
          icon: '✋',
          background: 'rgba(0,108,73,0.86)',
        });
        scheduleBadgeHide();
        return;
      }

      const deltaY = wrist.y - gestureStart.y;
      const deltaX = wrist.x - gestureStart.x;
      const elapsed = now - gestureStart.time;

      if (elapsed < 120) {
        return;
      }

      if (Math.abs(deltaY) < 0.18) {
        showBadge(badge, {
          title: 'Movimiento corto',
          subtitle: 'Haz un gesto más vertical',
          icon: '↕',
          background: 'rgba(130,81,0,0.84)',
        });
        scheduleBadgeHide();
        return;
      }

      if (Math.abs(deltaY) < Math.abs(deltaX) * 1.15) {
        showBadge(badge, {
          title: 'Demasiado horizontal',
          subtitle: 'Prueba subir o bajar la mano',
          icon: '↕',
          background: 'rgba(130,81,0,0.84)',
        });
        scheduleBadgeHide();
        return;
      }

      if (now - lastTriggerAt < cooldownMs) {
        showBadge(badge, {
          title: 'Espera un momento',
          subtitle: 'Evitando falsos positivos',
          icon: '⏱',
          background: 'rgba(10,18,35,0.78)',
        });
        scheduleBadgeHide();
        return;
      }

      lastTriggerAt = now;
      gestureStart = null;
      const direction = deltaY < 0 ? 'up' : 'down';
      const targetPage = getNextPage(direction);

      showBadge(badge, {
        title: `Cambiando a ${pageLabels[targetPage]}`,
        subtitle: direction === 'up' ? 'Desplazamiento hacia arriba' : 'Desplazamiento hacia abajo',
        icon: direction === 'up' ? '↑' : '↓',
        background: 'rgba(0,90,190,0.9)',
      });

      window.setTimeout(() => {
        window.location.href = targetPage;
      }, navigationFlashMs);
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    camera.start();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch((error) => console.warn('gesture-nav: no se pudo iniciar MediaPipe', error));
    });
  } else {
    boot().catch((error) => console.warn('gesture-nav: no se pudo iniciar MediaPipe', error));
  }
})();