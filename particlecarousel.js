/**
 * particlecarousel.js
 * Image/logo carousel using canvas particle morphing transitions.
 * No external dependencies.
 */

(function () {
  'use strict';

  // ─── Physics / sampling constants ─────────────────────────────────────────
  // Spring force pulling each particle toward its target position.
  const SPRING_FORCE = 0.08;
  // Velocity damping factor when approaching target (< 1 = friction).
  const DAMPING_FACTOR = 0.82;
  // Extra friction applied when a particle overshoots its target (velocity and
  // displacement in opposite directions).  Kills the recoil bounce.
  const DAMPING_OVERSHOOT = 0.65;
  // Initial random velocity burst given to particles when they receive new targets.
  const BURST_VELOCITY = 4;
  // Fraction of particles that must be settled before the morph is considered done.
  // 0.92 leaves a small margin for stragglers that never reach sub-pixel precision.
  const SETTLE_THRESHOLD = 0.92;
  // Minimum alpha channel value (0–255) for a pixel to be sampled as a particle.
  const ALPHA_THRESHOLD = 60;
  // Maximum stride when sub-sampling image pixels to avoid O(n²) work on large images.
  const MAX_SAMPLE_STEP = 8;

  // ─── Platform definitions ──────────────────────────────────────────────────
  const PLATFORMS = [
    {
      key: 'spotify',
      label: 'SPOTIFY',
      colors: ['#1DB954', '#1ed760', '#158a3e', '#fff'],
      url: 'https://open.spotify.com/',
      icon: 'spotify',
    },
    {
      key: 'applemusic',
      label: 'APPLE MUSIC',
      colors: ['#FA243C', '#ff6b81', '#c0392b', '#fff'],
      url: 'https://music.apple.com/',
      icon: 'applemusic',
    },
    {
      key: 'tiktok',
      label: 'TIKTOK',
      colors: ['#00F2EA', '#FF0050', '#010101', '#fff'],
      url: 'https://www.tiktok.com/',
      icon: 'tiktok',
    },
    {
      key: 'youtube',
      label: 'YOUTUBE',
      colors: ['#FF0000', '#FF4444', '#282828', '#fff'],
      url: 'https://www.youtube.com/',
      icon: 'youtube',
    },
    {
      key: 'gallery',
      label: 'GALLERY',
      colors: ['#FF7F00', '#FFD700', '#9400D3', '#4B0082', '#fff'],
      url: '#gallery',
      icon: 'gallery',
    },
  ];

  // ─── State ─────────────────────────────────────────────────────────────────
  let canvas, ctx;
  let W, H;
  let particles = [];
  let animFrameId = null;
  let appState = 'captcha'; // 'captcha' | 'carousel'
  let currentIndex = 0;
  let morphing = false;
  let floating = false;

  // ─── Particle constructor ──────────────────────────────────────────────────
  function makeParticle(x, y, color, tx, ty, tcolor, size) {
    return {
      x,
      y,
      color,
      tx: tx !== undefined ? tx : x,
      ty: ty !== undefined ? ty : y,
      tcolor: tcolor !== undefined ? tcolor : color,
      size: size || 4,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      alpha: 1,
    };
  }

  // ─── Colour utilities ──────────────────────────────────────────────────────
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function parseColor(c) {
    if (c && c[0] === '#') return hexToRgb(c);
    if (c && c.startsWith('rgb')) {
      return c.match(/\d+/g).map(Number);
    }
    return [200, 200, 200];
  }

  function blendColor(a, b, t) {
    const [ra, ga, ba] = parseColor(a);
    const [rb, gb, bb] = parseColor(b);
    return (
      'rgb(' +
      Math.round(ra * (1 - t) + rb * t) +
      ',' +
      Math.round(ga * (1 - t) + gb * t) +
      ',' +
      Math.round(ba * (1 - t) + bb * t) +
      ')'
    );
  }

  // ─── Icon drawing helpers ─────────────────────────────────────────────────
  // Each returns {offCanvas, offCtx} with icon drawn in white on transparent.
  function drawSpotifyIcon(size) {
    const oc = document.createElement('canvas');
    oc.width = size;
    oc.height = size;
    const oc2 = oc.getContext('2d');
    const cx = size / 2,
      cy = size / 2,
      r = size * 0.42;
    oc2.strokeStyle = '#fff';
    oc2.lineWidth = size * 0.07;
    oc2.lineCap = 'round';
    // Three arcs
    [0.28, 0.48, 0.68].forEach(function (ratio) {
      const ar = r * ratio;
      oc2.beginPath();
      oc2.arc(cx, cy, ar, (Math.PI * 5) / 6, (Math.PI * 11) / 6);
      oc2.stroke();
    });
    // Center dot
    oc2.fillStyle = '#fff';
    oc2.beginPath();
    oc2.arc(cx, cy, size * 0.05, 0, Math.PI * 2);
    oc2.fill();
    return oc;
  }

  function drawAppleMusicIcon(size) {
    const oc = document.createElement('canvas');
    oc.width = size;
    oc.height = size;
    const oc2 = oc.getContext('2d');
    const cx = size / 2,
      cy = size / 2;
    // Musical note shape
    oc2.fillStyle = '#fff';
    // Stem
    oc2.fillRect(cx + size * 0.1, cy - size * 0.3, size * 0.07, size * 0.42);
    // Note head
    oc2.beginPath();
    oc2.ellipse(cx, cy + size * 0.1, size * 0.13, size * 0.1, -0.3, 0, Math.PI * 2);
    oc2.fill();
    // Beam
    oc2.fillRect(cx + size * 0.1, cy - size * 0.3, size * 0.28, size * 0.07);
    // Second head
    oc2.beginPath();
    oc2.ellipse(cx + size * 0.28, cy - size * 0.05, size * 0.13, size * 0.1, -0.3, 0, Math.PI * 2);
    oc2.fill();
    return oc;
  }

  function drawTiktokIcon(size) {
    const oc = document.createElement('canvas');
    oc.width = size;
    oc.height = size;
    const oc2 = oc.getContext('2d');
    const cx = size / 2,
      cy = size / 2;
    // TikTok "d" shape
    oc2.fillStyle = '#fff';
    // Body of the note
    oc2.fillRect(cx - size * 0.08, cy - size * 0.3, size * 0.16, size * 0.5);
    // Curved top
    oc2.beginPath();
    oc2.arc(cx + size * 0.12, cy - size * 0.14, size * 0.2, -Math.PI / 2, Math.PI / 2);
    oc2.stroke();
    oc2.strokeStyle = '#fff';
    oc2.lineWidth = size * 0.07;
    oc2.beginPath();
    oc2.arc(cx + size * 0.12, cy - size * 0.14, size * 0.2, -Math.PI / 2, Math.PI / 2);
    oc2.stroke();
    // Bottom circle
    oc2.beginPath();
    oc2.arc(cx - size * 0.04, cy + size * 0.2, size * 0.12, 0, Math.PI * 2);
    oc2.fill();
    return oc;
  }

  function drawYoutubeIcon(size) {
    const oc = document.createElement('canvas');
    oc.width = size;
    oc.height = size;
    const oc2 = oc.getContext('2d');
    const cx = size / 2,
      cy = size / 2;
    // Play button triangle
    oc2.fillStyle = '#fff';
    oc2.beginPath();
    oc2.moveTo(cx - size * 0.18, cy - size * 0.22);
    oc2.lineTo(cx + size * 0.28, cy);
    oc2.lineTo(cx - size * 0.18, cy + size * 0.22);
    oc2.closePath();
    oc2.fill();
    return oc;
  }

  function drawGalleryIcon(size) {
    const oc = document.createElement('canvas');
    oc.width = size;
    oc.height = size;
    const oc2 = oc.getContext('2d');
    const cx = size / 2,
      cy = size / 2;
    // Photo grid
    oc2.fillStyle = '#fff';
    const gap = size * 0.06,
      sz = size * 0.38;
    [
      [cx - sz / 2 - gap / 2 - sz / 2, cy - sz / 2 - gap / 2 - sz / 2],
      [cx + gap / 2, cy - sz / 2 - gap / 2 - sz / 2],
      [cx - sz / 2 - gap / 2 - sz / 2, cy + gap / 2],
      [cx + gap / 2, cy + gap / 2],
    ].forEach(function (pos) {
      oc2.beginPath();
      oc2.roundRect(pos[0], pos[1], sz, sz, size * 0.04);
      oc2.fill();
    });
    return oc;
  }

  function getIconCanvas(key, size) {
    switch (key) {
      case 'spotify':
        return drawSpotifyIcon(size);
      case 'applemusic':
        return drawAppleMusicIcon(size);
      case 'tiktok':
        return drawTiktokIcon(size);
      case 'youtube':
        return drawYoutubeIcon(size);
      case 'gallery':
        return drawGalleryIcon(size);
      default:
        return drawGalleryIcon(size);
    }
  }

  // ─── Particle cloud generators ────────────────────────────────────────────

  // Sample pixels from an offscreen canvas into a particle array.
  function sampleCanvasToParticles(srcCanvas, cx, cy, colors, targetCount) {
    const sc = srcCanvas.getContext('2d');
    const sw = srcCanvas.width,
      sh = srcCanvas.height;
    const imageData = sc.getImageData(0, 0, sw, sh);
    const data = imageData.data;

    // Collect lit pixels
    const lit = [];
    const step = Math.min(MAX_SAMPLE_STEP, Math.max(1, Math.floor(Math.sqrt((sw * sh) / (targetCount * 2)))));
    for (let py = 0; py < sh; py += step) {
      for (let px = 0; px < sw; px += step) {
        const i = (py * sw + px) * 4;
        if (data[i + 3] > ALPHA_THRESHOLD) {
          // alpha threshold
          lit.push([px, py, data[i], data[i + 1], data[i + 2]]);
        }
      }
    }

    if (lit.length === 0) return [];

    // Sub-sample to targetCount
    const result = [];
    const stride = Math.max(1, Math.floor(lit.length / targetCount));
    for (let k = 0; k < lit.length; k += stride) {
      const [px, py, r, g, b] = lit[k];
      // Map to world space centred at cx, cy
      const wx = cx - sw / 2 + px;
      const wy = cy - sh / 2 + py;
      // Pick platform colour or pixel colour
      const col = colors
        ? colors[Math.floor(Math.random() * colors.length)]
        : 'rgb(' + r + ',' + g + ',' + b + ')';
      result.push({ wx, wy, col });
    }
    return result;
  }

  // Generate captcha particle cloud
  function generateCaptchaCloud() {
    const cw = Math.min(340, W * 0.88),
      ch = 110;
    const cx = W / 2,
      cy = H * 0.38;
    const colors = ['#ffdc80', '#6dd9e8', '#fff', '#3bb8cc', '#f06292'];
    const pts = [];
    const d = 13;
    for (let py = -ch / 2; py <= ch / 2; py += d) {
      for (let px = -cw / 2; px <= cw / 2; px += d) {
        // Rounded rect mask
        const rx = Math.abs(px) - (cw / 2 - 18),
          ry = Math.abs(py) - (ch / 2 - 18);
        const dist = Math.sqrt(Math.max(0, rx) ** 2 + Math.max(0, ry) ** 2);
        if (dist <= 18) {
          const col = colors[Math.floor((Math.abs(px / d) + Math.abs(py / d)) % colors.length)];
          pts.push({ wx: cx + px, wy: cy + py, col });
        }
      }
    }
    return pts;
  }

  // Generate platform logo cloud using the icon canvas
  function generatePlatformCloud(platform) {
    const iconSize = Math.min(220, W * 0.45, H * 0.45);
    const iconCanvas = getIconCanvas(platform.icon, iconSize);
    const cx = W / 2,
      cy = H / 2;
    const targetCount = 500;
    const pts = sampleCanvasToParticles(iconCanvas, cx, cy, platform.colors, targetCount);
    if (pts.length === 0) {
      // Fallback: filled circle
      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        for (let r = 10; r < iconSize * 0.4; r += 14) {
          pts.push({
            wx: cx + Math.cos(a) * r,
            wy: cy + Math.sin(a) * r,
            col: platform.colors[Math.floor(Math.random() * platform.colors.length)],
          });
        }
      }
    }
    return pts;
  }

  // Generate cloud from a user-supplied Image (drag-and-drop)
  function generateImageCloud(img) {
    const maxDim = Math.min(W * 0.8, H * 0.7, 420);
    const ratio = Math.min(maxDim / img.width, maxDim / img.height);
    const dw = Math.round(img.width * ratio),
      dh = Math.round(img.height * ratio);
    const offC = document.createElement('canvas');
    offC.width = dw;
    offC.height = dh;
    const offCtx = offC.getContext('2d');
    offCtx.drawImage(img, 0, 0, dw, dh);
    const cx = W / 2,
      cy = H / 2;
    return sampleCanvasToParticles(offC, cx, cy, null, 800);
  }

  // ─── Morphing ─────────────────────────────────────────────────────────────

  // Remap current particles → new cloud points (grow/shrink as needed)
  function remapToCloud(cloudPts) {
    if (cloudPts.length === 0) return;
    const newCount = cloudPts.length;
    const oldCount = particles.length;

    // Expand or shrink particles array
    if (newCount > oldCount) {
      // Clone existing particles to fill gap
      for (let i = oldCount; i < newCount; i++) {
        const src = particles[i % oldCount];
        particles.push(
          makeParticle(src.x, src.y, src.color, src.tx, src.ty, src.tcolor, src.size)
        );
      }
    } else if (newCount < oldCount) {
      particles.length = newCount;
    }

    // Assign new targets
    for (let i = 0; i < particles.length; i++) {
      const pt = cloudPts[i];
      particles[i].tx = pt.wx;
      particles[i].ty = pt.wy;
      particles[i].tcolor = pt.col;
      // Give a small burst
      particles[i].vx = (Math.random() - 0.5) * BURST_VELOCITY;
      particles[i].vy = (Math.random() - 0.5) * BURST_VELOCITY;
    }
  }

  // Initialise particle array from a cloud definition
  function initParticles(cloudPts) {
    particles = cloudPts.map(function (pt) {
      return makeParticle(
        pt.wx + (Math.random() - 0.5) * W * 0.6,
        pt.wy + (Math.random() - 0.5) * H * 0.6,
        pt.col,
        pt.wx,
        pt.wy,
        pt.col,
        4
      );
    });
  }

  // ─── Animation loop ───────────────────────────────────────────────────────

  function stopAnim() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function startAnim() {
    stopAnim();
    function frame() {
      ctx.clearRect(0, 0, W, H);
      let settled = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Pull toward target
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        p.vx += dx * SPRING_FORCE;
        p.vy += dy * SPRING_FORCE;

        // Asymmetric damping — brake hard when overshooting to kill recoil bounce
        p.vx *= (dx * p.vx < 0) ? DAMPING_OVERSHOOT : DAMPING_FACTOR;
        p.vy *= (dy * p.vy < 0) ? DAMPING_OVERSHOOT : DAMPING_FACTOR;

        // Add subtle drift when settled (floating-in-space feel)
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          p.vx += (Math.random() - 0.5) * 0.4;
          p.vy += (Math.random() - 0.5) * 0.4;
          settled++;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Blend colour toward target
        p.color = blendColor(p.color, p.tcolor, 0.08);

        // Draw
        ctx.globalAlpha = Math.max(0.15, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (settled >= particles.length * SETTLE_THRESHOLD) {
        morphing = false;
        floating = true;
      }

      animFrameId = requestAnimationFrame(frame);
    }
    frame();
  }

  // ─── Swipe / drag navigation ──────────────────────────────────────────────

  function navigateTo(index) {
    if (morphing) return;
    morphing = true;
    floating = false;
    currentIndex = ((index % PLATFORMS.length) + PLATFORMS.length) % PLATFORMS.length;
    const cloud = generatePlatformCloud(PLATFORMS[currentIndex]);
    remapToCloud(cloud);
    updateUI();
  }

  function setupSwipe(el) {
    let startX = 0,
      startY = 0,
      active = false;

    function onStart(x, y) {
      startX = x;
      startY = y;
      active = true;
    }
    function onEnd(x) {
      if (!active) return;
      active = false;
      const diff = x - startX;
      if (Math.abs(diff) > 50) {
        if (diff < 0) {
          navigateTo(currentIndex + 1);
        } else {
          navigateTo(currentIndex - 1);
        }
      }
    }

    el.addEventListener('mousedown', function (e) {
      onStart(e.clientX, e.clientY);
    });
    el.addEventListener('mouseup', function (e) {
      onEnd(e.clientX);
    });
    el.addEventListener('mouseleave', function () {
      active = false;
    });
    el.addEventListener('touchstart', function (e) {
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    });
    el.addEventListener('touchend', function (e) {
      onEnd(e.changedTouches[0].clientX);
    });
  }

  // ─── Drag-and-drop image ──────────────────────────────────────────────────

  function setupDragDrop(el) {
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        morphing = true;
        floating = false;
        const cloud = generateImageCloud(img);
        remapToCloud(cloud);
        URL.revokeObjectURL(url);
        // Hide platform label for custom image
        const lbl = document.getElementById('pc-platform-label');
        if (lbl) lbl.textContent = 'CUSTOM IMAGE';
        const link = document.getElementById('pc-link');
        if (link) link.style.display = 'none';
      };
      img.src = url;
    });
  }

  // ─── UI updates ───────────────────────────────────────────────────────────

  function updateUI() {
    const plat = PLATFORMS[currentIndex];
    const lbl = document.getElementById('pc-platform-label');
    const link = document.getElementById('pc-link');
    const dots = document.querySelectorAll('.pc-dot');
    if (lbl) lbl.textContent = plat.label;
    if (link) {
      link.textContent = 'Visit ' + plat.label;
      link.href = plat.url;
      link.style.display = '';
    }
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === currentIndex);
    });
  }

  // ─── Captcha completion ───────────────────────────────────────────────────

  function onCaptchaComplete() {
    appState = 'carousel';
    const captchaEl = document.getElementById('pc-captcha');
    if (captchaEl) captchaEl.style.display = 'none';

    const ui = document.getElementById('pc-ui');
    if (ui) ui.style.display = '';

    morphing = true;
    floating = false;
    const cloud = generatePlatformCloud(PLATFORMS[currentIndex]);
    remapToCloud(cloud);
    updateUI();
    startAnim();
  }

  // ─── Resize handler ───────────────────────────────────────────────────────

  function onResize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    // Recentre targets without resetting motion
    if (appState === 'carousel') {
      const cloud = generatePlatformCloud(PLATFORMS[currentIndex]);
      for (let i = 0; i < Math.min(particles.length, cloud.length); i++) {
        particles[i].tx = cloud[i].wx;
        particles[i].ty = cloud[i].wy;
      }
    }
  }

  // ─── Keyboard navigation ─────────────────────────────────────────────────

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (appState !== 'carousel') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigateTo(currentIndex + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigateTo(currentIndex - 1);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    canvas = document.getElementById('pc-canvas');
    if (!canvas) {
      console.error('particlecarousel: no #pc-canvas element found');
      return;
    }
    ctx = canvas.getContext('2d');
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;

    // Initial captcha cloud
    const captchaCloud = generateCaptchaCloud();
    initParticles(captchaCloud);
    startAnim();

    setupSwipe(canvas);
    setupDragDrop(canvas);
    setupKeyboard();
    window.addEventListener('resize', onResize);

    // Wire up captcha button
    const btn = document.getElementById('pc-captcha-btn');
    if (btn) btn.addEventListener('click', onCaptchaComplete);

    // Wire up carousel nav arrows
    const prev = document.getElementById('pc-prev');
    const next = document.getElementById('pc-next');
    if (prev) prev.addEventListener('click', function () { navigateTo(currentIndex - 1); });
    if (next) next.addEventListener('click', function () { navigateTo(currentIndex + 1); });
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.ParticleCarousel = {
    next: function () { navigateTo(currentIndex + 1); },
    prev: function () { navigateTo(currentIndex - 1); },
    goTo: function (i) { navigateTo(i); },
    loadImage: function (img) {
      morphing = true;
      floating = false;
      remapToCloud(generateImageCloud(img));
    },
  };
})();
