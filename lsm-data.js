(() => {
  'use strict';
  const KEY = 'lsm:v1';
  const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
  const today = () => new Date().toISOString().slice(0, 10);

  const blank = () => ({ letters: {}, days: {}, totalSec: 0 });
  const load = () => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY))); } catch { return blank(); } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

  const api = {
    ALPHABET,

    // ----- Progreso por letra (0–100) -----
    progress(letter) { return load().letters[letter] || 0; },
    status(letter) { const v = this.progress(letter); return v >= 100 ? 'done' : v > 0 ? 'progress' : 'todo'; },
    setProgress(letter, pct) { const s = load(); s.letters[letter] = Math.max(0, Math.min(100, Math.round(pct))); save(s); },
    markDone(letter) { this.setProgress(letter, 100); },

    // ----- Estadísticas agregadas (reales) -----
    stats() {
      const s = load(); let done = 0, prog = 0;
      ALPHABET.forEach((l) => { const v = s.letters[l] || 0; if (v >= 100) done++; else if (v > 0) prog++; });
      const total = ALPHABET.length;
      return { done, prog, todo: total - done - prog, total, pct: Math.round((done / total) * 100) };
    },
    nextPending() { return ALPHABET.find((l) => (load().letters[l] || 0) < 100) || ALPHABET[0]; },

    // ----- Tiempo de práctica (segundos) -----
    addPracticeTime(sec) {
      if (!sec || sec < 0) return;
      const s = load(); const d = today();
      s.days[d] = (s.days[d] || 0) + sec; s.totalSec += sec; save(s);
    },
    totalSeconds() { return load().totalSec; },

    // Minutos de los últimos 7 días (lunes→domingo de la semana actual)
    weekMinutes() {
      const s = load(); const out = [];
      const now = new Date(); const dow = (now.getDay() + 6) % 7; // 0 = lunes
      const monday = new Date(now); monday.setDate(now.getDate() - dow);
      const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      for (let i = 0; i < 7; i++) {
        const dd = new Date(monday); dd.setDate(monday.getDate() + i);
        const key = dd.toISOString().slice(0, 10);
        out.push({ d: labels[i], min: Math.round((s.days[key] || 0) / 60) });
      }
      return out;
    },

    // Racha de días consecutivos con práctica (termina hoy o ayer)
    streak() {
      const s = load(); let n = 0; const day = new Date();
      // si hoy no hay práctica pero ayer sí, la racha aún cuenta desde ayer
      if (!s.days[today()]) day.setDate(day.getDate() - 1);
      for (;;) {
        const key = day.toISOString().slice(0, 10);
        if (s.days[key] > 0) { n++; day.setDate(day.getDate() - 1); } else break;
      }
      return n;
    },

    reset() { save(blank()); },
  };

  window.LSMData = api;
})();
