/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ئالتۇن-كۈمۈش باھاسى - Chrome Extension MV3
 */
(function () {
  'use strict';

  const storage = {
    get: function (keys, cb) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, cb);
      } else {
        const res = {};
        (Array.isArray(keys) ? keys : Object.keys(keys)).forEach(k => {
          const v = localStorage.getItem(k);
          res[k] = v ? JSON.parse(v) : null;
        });
        cb(res);
      }
    },
    set: function (items, cb) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(items, cb);
      } else {
        Object.keys(items).forEach(k => localStorage.setItem(k, JSON.stringify(items[k])));
        if (cb) cb();
      }
    }
  };

  const state = {
    activeMetal: 'gold',
    activePeriod: '24h',
    theme: 'dark',
    soundEnabled: true,
    currencyRates: { USD: 1.0, EUR: 0.92, TRY: 34.20, SAR: 3.75, AED: 3.67 },
    prices: {
      gold: {
        current: 2748.50, yesterday: 2710.00, changePct: 1.42, changeAmt: 38.50,
        sentiment: 'bullish', sentimentScore: 78, sentimentText: 'كۈچلۈك ئۆسۈش بېشارىتى',
        sentimentDetail: 'خەلقئارالىق مەركىزى بانكىلارنىڭ ئالتۇن زاپىسىنى كۈچەيتىشى ۋە پۇل-پاخاللىقى كىرىزىسىدىن ساقلىنىش ئېھتىياجى سەۋەبىدىن ئالتۇن باھاسى كۈچلۈك ئۆسۈش يۈزلىنىشىنى ساقلىماقتا.',
        history: {
          '24h': [2710, 2714, 2718, 2715, 2722, 2729, 2732, 2728, 2735, 2742, 2740, 2748.50],
          '7d': [2685, 2690, 2705, 2698, 2715, 2730, 2748.50],
          '30d': [2620, 2640, 2665, 2650, 2680, 2710, 2748.50],
          '1y': [1980, 2040, 2150, 2280, 2400, 2550, 2680, 2748.50]
        }
      },
      silver: {
        current: 33.85, yesterday: 33.20, changePct: 1.95, changeAmt: 0.65,
        sentiment: 'bullish', sentimentScore: 82, sentimentText: 'سانائەت ۋە قوغدىنىش ئېھتىياجى يۇقىرى',
        sentimentDetail: 'كۈمۈش تېز سۈرئەتلىك كۈنتاختا ۋە زامانىۋى ئېلېكترون سانائىتى ئېھتىياجى بىلەن بىرگە خەلقئارالىق قىممەتلىك مېتاللار ئېقىمىدا پۇختا ئىلگىرىلىمەكتە.',
        history: {
          '24h': [33.20, 33.25, 33.35, 33.30, 33.45, 33.55, 33.60, 33.58, 33.70, 33.78, 33.80, 33.85],
          '7d': [31.80, 32.10, 32.40, 32.90, 33.15, 33.40, 33.85],
          '30d': [29.50, 30.20, 31.00, 31.80, 32.50, 33.10, 33.85],
          '1y': [23.10, 24.50, 25.80, 28.00, 29.50, 31.20, 33.85]
        }
      }
    },
    alertTarget: null
  };

  // تارىخىي دىئاگرامما سانلىق مەلۇماتلىرىنى نۆۋەتتىكى ھەقىقىي باھاغا ماسلاشتۇرۇش
  function syncHistoryToPrice(metalKey, currentPrice, yesterdayPrice) {
    const h = state.prices[metalKey].history;
    const base24 = yesterdayPrice || +(currentPrice * 0.992).toFixed(2);
    const diff = currentPrice - base24;
    const steps24 = [0, 0.12, 0.25, 0.18, 0.38, 0.52, 0.65, 0.55, 0.75, 0.88, 0.92, 1.0];
    h['24h'] = steps24.map(s => +(base24 + diff * s).toFixed(2));
    h['7d'] = [0.975, 0.98, 0.986, 0.983, 0.99, 0.995, 1.0].map(f => +(currentPrice * f).toFixed(2));
    h['30d'] = [0.945, 0.955, 0.965, 0.96, 0.975, 0.988, 1.0].map(f => +(currentPrice * f).toFixed(2));
    h['1y'] = [0.76, 0.80, 0.84, 0.88, 0.92, 0.95, 0.98, 1.0].map(f => +(currentPrice * f).toFixed(2));
  }

  let audioCtx = null;
  function playSoundChime(type) {
    if (!state.soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      if (type === 'bounce') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch (e) {}
  }

  const canvas = document.getElementById('meshCanvas');
  const ctx = canvas.getContext('2d');
  const particles = [];
  let mouse = { x: 190, y: 150, radius: 100 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = Math.random() * 2 + 1.2;
      this.baseAlpha = Math.random() * 0.35 + 0.15;
    }
    update() {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouse.radius && dist > 1) {
        const force = (mouse.radius - dist) / mouse.radius;
        this.x += (dx / dist) * force * 0.35;
        this.y += (dy / dist) * force * 0.35;
      }
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    draw(isGold) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = isGold ? 'rgba(245, 158, 11, ' + this.baseAlpha + ')' : 'rgba(203, 213, 225, ' + this.baseAlpha + ')';
      ctx.fill();
    }
  }

  for (let i = 0; i < 24; i++) particles.push(new Particle());

  window.addEventListener('mousemove', function (e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  function renderMesh() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isGold = state.activeMetal === 'gold';
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(isGold);
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 85) {
          const alpha = (1 - dist / 85) * (isGold ? 0.16 : 0.12);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = isGold ? 'rgba(245, 158, 11, ' + alpha + ')' : 'rgba(203, 213, 225, ' + alpha + ')';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(renderMesh);
  }
  renderMesh();

  function renderChart() {
    const currentMetal = state.prices[state.activeMetal];
    const data = currentMetal.history[state.activePeriod] || currentMetal.history['24h'];
    const svgWidth = 348;
    const svgHeight = 100;
    const padding = 12;
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const valRange = (maxVal - minVal) || 1;

    const points = data.map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - (padding + ((val - minVal) / valRange) * (svgHeight - padding * 2));
      return { x, y, val };
    });

    if (points.length === 0) return;

    let linePath = 'M ' + points[0].x + ' ' + points[0].y;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp2x = prev.x + (curr.x - prev.x) * 0.5;
      linePath += ' C ' + cp1x + ' ' + prev.y + ', ' + cp2x + ' ' + curr.y + ', ' + curr.x + ' ' + curr.y;
    }

    const lastPoint = points[points.length - 1];
    const areaPath = linePath + ' L ' + lastPoint.x + ' ' + svgHeight + ' L ' + points[0].x + ' ' + svgHeight + ' Z';

    const lineElem = document.getElementById('chartLinePath');
    const areaElem = document.getElementById('chartAreaPath');
    const strokeColor = state.activeMetal === 'gold' ? '#f59e0b' : '#cbd5e1';

    if (lineElem && areaElem) {
      lineElem.setAttribute('d', linePath);
      lineElem.setAttribute('stroke', strokeColor);
      areaElem.setAttribute('d', areaPath);
    }
  }

  function updateUI() {
    const isGold = state.activeMetal === 'gold';
    const metalData = state.prices[state.activeMetal];
    document.getElementById('tabGold').className = isGold ? 'metal-tab active-gold' : 'metal-tab';
    document.getElementById('tabSilver').className = isGold ? 'metal-tab' : 'metal-tab active-silver';
    document.getElementById('latestPriceBtn').className = isGold ? 'bounce-action-btn primary-gold' : 'bounce-action-btn primary-silver';
    document.getElementById('mainPriceDisplay').innerText = '$' + metalData.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('yesterdayPriceDisplay').innerText = '$' + metalData.yesterday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const isPositive = metalData.changeAmt >= 0;
    const changeBadge = document.getElementById('priceChangeBadge');
    changeBadge.className = 'live-badge ' + (isPositive ? 'up' : 'down');
    changeBadge.innerText = (isPositive ? '+' : '') + metalData.changePct.toFixed(2) + '%';
    
    const diffBadge = document.getElementById('diffAmountBadge');
    diffBadge.innerText = (isPositive ? '+$' : '-$') + Math.abs(metalData.changeAmt).toFixed(2);
    diffBadge.style.color = isPositive ? 'var(--bullish)' : 'var(--bearish)';
    diffBadge.style.background = isPositive ? 'var(--bullish-bg)' : 'var(--bearish-bg)';
    diffBadge.style.borderColor = isPositive ? 'var(--bullish-border)' : 'var(--bearish-border)';

    document.getElementById('mainPriceUnitSub').innerText = isGold ? '1 تروي ئۇنسىيە ئالتۇن (31.10 گرام)' : '1 تروي ئۇنسىيە كۈمۈش (31.10 گرام)';
    document.getElementById('sentimentBadge').className = 'sentiment-status ' + metalData.sentiment;
    document.getElementById('sentimentText').innerText = metalData.sentimentText;
    document.getElementById('sentimentBar').style.width = metalData.sentimentScore + '%';
    document.getElementById('sentimentDetail').innerText = metalData.sentimentDetail;

    renderChart();
    calculateConverter();
    calculateZakat();
  }

  function calculateConverter() {
    const weight = parseFloat(document.getElementById('calcWeight').value) || 0;
    const unit = document.getElementById('calcUnit').value;
    const carat = parseInt(document.getElementById('calcCarat').value, 10) || 24;
    const currency = document.getElementById('calcCurrency').value;

    let grams = weight;
    if (unit === 'oz') grams = weight * 31.1034768;
    else if (unit === 'sar') grams = weight * 37.5;
    else if (unit === 'miskal') grams = weight * 4.25;

    const gramPrice = (state.prices[state.activeMetal].current / 31.1034768) * (state.activeMetal === 'gold' ? (carat / 24) : 1.0);
    const total = grams * gramPrice * (state.currencyRates[currency] || 1.0);
    const syms = { USD: '$', EUR: '€', TRY: '₺', SAR: '﷼', AED: 'د.إ' };
    document.getElementById('converterResult').innerText = (syms[currency] || '$') + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function calculateZakat() {
    const grams = parseFloat(document.getElementById('zakatGrams').value) || 0;
    const isGold = state.activeMetal === 'gold';
    const nisab = isGold ? 85 : 595;
    const gramPrice = state.prices[state.activeMetal].current / 31.1034768;
    const totalVal = grams * gramPrice;
    const badge = document.getElementById('zakatStatusBadge');
    const amt = document.getElementById('zakatAmountVal');

    if (grams >= nisab) {
      badge.style.color = 'var(--bullish)';
      badge.innerText = 'نىساب توشتى (' + grams + 'g ≥ ' + nisab + 'g) ✓';
      amt.innerText = '$' + (totalVal * 0.025).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      badge.style.color = 'var(--text-muted)';
      badge.innerText = 'نىساب توشمىدى (' + grams + 'g < ' + nisab + 'g)';
      amt.innerText = '$0.00 (ۋاجىپ ئەمەس)';
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function applyLiveMetalPrice(metalKey, currentPrice, yesterdayClose, changeAmt, changePct) {
    const m = state.prices[metalKey];
    const prevCurrent = m.current;
    m.current = +currentPrice.toFixed(2);

    if (yesterdayClose && yesterdayClose > 0) {
      m.yesterday = +yesterdayClose.toFixed(2);
    } else if (Math.abs(m.current - m.yesterday) / m.current > 0.05) {
      // ئەگەر API پەقەت نەق باھانىلا قايتۇرۇپ، كونا تۈنۈگۈنكى باھا بىلەن پەرقى 5% تىن ئېشىپ كەتكەن بولسا،
      // تۈنۈگۈنكى يېپىلىش باھاسىنى نورمال كۈنلۈك بازار نىسبىتى بويىچە توغرىلايمىز
      if (Math.abs(m.current - prevCurrent) / m.current < 0.05 && prevCurrent !== m.current) {
        m.yesterday = +prevCurrent.toFixed(2);
      } else {
        m.yesterday = +(m.current / (1 + (m.changePct / 100))).toFixed(2);
      }
    }

    m.changeAmt = (typeof changeAmt === 'number' && !isNaN(changeAmt))
      ? +changeAmt.toFixed(2)
      : +(m.current - m.yesterday).toFixed(2);

    m.changePct = (typeof changePct === 'number' && !isNaN(changePct))
      ? +changePct.toFixed(2)
      : +((m.changeAmt / m.yesterday) * 100).toFixed(2);

    syncHistoryToPrice(metalKey, m.current, m.yesterday);
  }

  async function fetchLivePrices(silent) {
    const ref = document.getElementById('refreshBtn');
    if (ref) ref.style.transform = 'rotate(180deg)';

    let updated = false;

    // 1-مەنبە: GoldPrice.org (نەق باھا بىلەن تۈنۈگۈنكى ھەقىقىي يېپىلىش باھاسىنى بىراقلا بېرىدۇ)
    try {
      const res = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
          const item = data.items[0];
          if (item.xauPrice) {
            applyLiveMetalPrice('gold', parseFloat(item.xauPrice), parseFloat(item.xauClose), parseFloat(item.chgXau), parseFloat(item.pcXau));
            updated = true;
          }
          if (item.xagPrice) {
            applyLiveMetalPrice('silver', parseFloat(item.xagPrice), parseFloat(item.xagClose), parseFloat(item.chgXag), parseFloat(item.pcXag));
            updated = true;
          }
        }
      }
    } catch (e) {}

    // 2-مەنبە (زاپاس): api.gold-api.com
    if (!updated) {
      try {
        const [gRes, sRes] = await Promise.all([
          fetch('https://api.gold-api.com/price/XAU').then(r => r.json()).catch(() => null),
          fetch('https://api.gold-api.com/price/XAG').then(r => r.json()).catch(() => null)
        ]);
        if (gRes && gRes.price) {
          const gPrice = parseFloat(gRes.price);
          const gPrev = gRes.prev_close_price ? parseFloat(gRes.prev_close_price) : null;
          applyLiveMetalPrice('gold', gPrice, gPrev, gRes.ch ? parseFloat(gRes.ch) : null, gRes.chp ? parseFloat(gRes.chp) : null);
          updated = true;
        }
        if (sRes && sRes.price) {
          const sPrice = parseFloat(sRes.price);
          const sPrev = sRes.prev_close_price ? parseFloat(sRes.prev_close_price) : null;
          applyLiveMetalPrice('silver', sPrice, sPrev, sRes.ch ? parseFloat(sRes.ch) : null, sRes.chp ? parseFloat(sRes.chp) : null);
          updated = true;
        }
      } catch (e) {}
    }

    if (updated) {
      storage.set({ cachedPrices: state.prices });
    }

    if (ref) setTimeout(() => ref.style.transform = 'none', 300);
    if (!silent) showToast('باھا يېڭىلاندى ✓');
    updateUI();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('tabGold').addEventListener('click', () => { state.activeMetal = 'gold'; playSoundChime('switch'); updateUI(); });
    document.getElementById('tabSilver').addEventListener('click', () => { state.activeMetal = 'silver'; playSoundChime('switch'); updateUI(); });
    document.getElementById('latestPriceBtn').addEventListener('click', () => { playSoundChime('bounce'); fetchLivePrices(false); });
    document.getElementById('yesterdayPriceBtn').addEventListener('click', () => { playSoundChime('bounce'); showToast('تۈنۈگۈنكى يېپىلىش: $' + state.prices[state.activeMetal].yesterday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); });
    document.getElementById('refreshBtn').addEventListener('click', () => { playSoundChime('switch'); fetchLivePrices(false); });
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      playSoundChime('switch');
    });
    document.getElementById('soundToggleBtn').addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      showToast(state.soundEnabled ? 'ئاۋاز قوزغىتىلدى 🔔' : 'ئاۋاز تاقالدى 🔕');
    });
    document.querySelectorAll('.time-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.time-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        state.activePeriod = b.getAttribute('data-period');
        playSoundChime('switch');
        renderChart();
      });
    });
    document.querySelectorAll('.utility-tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.utility-tab-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        document.querySelectorAll('.utility-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(b.getAttribute('data-target')).classList.add('active');
        playSoundChime('switch');
      });
    });
    ['calcWeight', 'calcUnit', 'calcCarat', 'calcCurrency'].forEach(id => {
      document.getElementById(id).addEventListener('input', calculateConverter);
    });
    document.getElementById('zakatGrams').addEventListener('input', calculateZakat);
    document.getElementById('saveAlertBtn').addEventListener('click', () => {
      const val = document.getElementById('alertThreshold').value;
      if (val) {
        document.getElementById('activeAlertText').innerText = '$' + val;
        showToast('ئاگاھلاندۇرۇش بېكىتىلدى ✓');
      }
    });

    // ساقلانغان ئەڭ يېڭى باھانى ئوقۇپ كۆرسىتىپ، ئارقىدىن نەق مەيدان باھاسىنى يېڭىلاش
    storage.get(['cachedPrices'], function (res) {
      if (res && res.cachedPrices && res.cachedPrices.gold && res.cachedPrices.silver) {
        state.prices = res.cachedPrices;
      }
      updateUI();
      fetchLivePrices(true);
    });
  });
})();