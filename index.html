<!DOCTYPE html>
<!--
  Particle Carousel — demo page.
  ─────────────────────────────────────────────────────────────────
  Four-phase animation per transition:
    1. IDLE      — gifler renders the animated GIF into a canvas
                   displayed on screen.  The particle canvas
                   runs beneath it (invisible, but ready).
    2. TRIGGER   — User navigates: gifler stops (freezing the current
                   frame), the live frame is sampled as a particle cloud,
                   and those particles are placed at the exact pixel
                   positions.  The GIF canvas is instantly hidden,
                   revealing the particle layer.
    3. EXPLOSION — Each particle is given a random outward velocity and
                   flies freely for EXPLODE_DURATION ms, fading slightly,
                   giving a "burst apart" visual.
    4. REASSEMBLE — Particles spring-morph from their scattered positions
                   toward the next slide's cloud.  Once settled, gifler
                   loads and plays the next GIF ("solidifying").

  Requires: gifler (vendored in assets/gifler.min.js from gifler@0.1.0,
            Apache-2.0; CDN alternative: jsdelivr.net/npm/gifler@0.1.0).
  Deploy as-is to Cloudflare Pages (or any static host).

  ── Extending ──────────────────────────────────────────────
  • Add slides: drop a GIF/PNG/SVG into assets/ and add an entry to
    DEFAULT_LOGOS in particlecarousel.demo.js.
  • Tune physics: edit SPRING, DAMPING, DAMPING_OVERSHOOT, DRIFT at the
    top of particlecarousel.engine.js.
  • Tune explosion: edit EXPLODE_DURATION, EXPLODE_SPEED_MIN/MAX etc.
  • Full JS API: ParticleCarousel.next() / .prev() / .goTo(n) / .loadImage(img)
-->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Particle Carousel</title>
  <style>
    /* ── Reset & base ─────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%; overflow: hidden;
      background: #0a0d14; color: #fff;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    /* ── Full-screen canvas ───────────────────────────────────────────────── */
    #canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; cursor: grab; }
    #canvas:active { cursor: grabbing; }

    /* ── Controls bar (top-centre) ────────────────────────────────────────── */
    #controls {
      position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      z-index: 10; background: rgba(16, 20, 34, 0.92);
      padding: 8px 18px; border-radius: 40px;
      display: flex; align-items: center; gap: 10px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 28px rgba(0, 0, 0, 0.55);
    }
    .ctrl-btn {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #fff; border-radius: 50%;
      width: 34px; height: 34px; font-size: 1rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, transform 0.1s; user-select: none;
    }
    .ctrl-btn:hover  { background: rgba(255, 255, 255, 0.16); }
    .ctrl-btn:active { transform: scale(0.92); }
    #file-label {
      cursor: pointer; font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.45); letter-spacing: 0.04em; white-space: nowrap;
    }
    #file-input { display: none; }
    #img-count {
      font-size: 0.78rem; color: rgba(255, 255, 255, 0.35);
      min-width: 38px; text-align: center;
    }

    /* ── Current logo name ────────────────────────────────────────────────── */
    #label {
      position: fixed; top: 76px; left: 50%; transform: translateX(-50%);
      font-size: clamp(1.1rem, 4vw, 2rem); font-weight: 800;
      letter-spacing: 0.22em; text-transform: uppercase;
      text-shadow: 0 2px 18px rgba(0, 0, 0, 0.75);
      pointer-events: none; z-index: 5;
    }

    /* ── Navigation dots ──────────────────────────────────────────────────── */
    #dots {
      position: fixed; bottom: 58px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; z-index: 5; pointer-events: none;
    }
    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      transition: background 0.3s, transform 0.2s;
    }
    .dot.active { background: #fff; transform: scale(1.5); }

    /* ── Bottom hint ──────────────────────────────────────────────────────── */
    #hint {
      position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
      font-size: 0.68rem; color: rgba(255, 255, 255, 0.2);
      letter-spacing: 0.07em; pointer-events: none; z-index: 5; white-space: nowrap;
    }

    /* ── Drag-over overlay ────────────────────────────────────────────────── */
    #drop-overlay {
      position: fixed; inset: 0; background: rgba(10, 13, 20, 0.78);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; color: rgba(255, 255, 255, 0.6);
      pointer-events: none; opacity: 0; transition: opacity 0.2s;
      z-index: 20; letter-spacing: 0.1em;
    }
    body.dragging #drop-overlay { opacity: 1; }

    /* ── Animated GIF canvas (idle state) ───────────────────────────────── */
    /* gifler renders the GIF into this canvas; it is shown over the particle */
    /* canvas during idle and instantly hidden when a transition fires.        */
    #gif-canvas {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      /* CSS scales the canvas element proportionally for display.             */
      /* gifler sets the intrinsic width/height to the GIF's native dimensions.*/
      max-width:  min(70vw, 420px);
      max-height: min(calc(var(--vh, 1vh) * 65), 420px);
      width: auto;
      height: auto;
      pointer-events: none;
      z-index: 2;           /* above particle canvas, below controls/label */
      display: none;
    }
    #gif-canvas.visible { display: block; }
  </style>
</head>
<body>

  <!-- Full-screen canvas — particles are drawn here -->
  <canvas id="canvas"></canvas>

  <!-- GIF canvas — gifler renders the animated GIF into this; shown in idle, hidden during transitions -->
  <canvas id="gif-canvas" aria-hidden="true"></canvas>

  <!-- Controls: file picker + prev / next buttons -->
  <div id="controls">
    <label id="file-label" for="file-input">📁 Load images</label>
    <input type="file" id="file-input" multiple accept="image/*" />
    <button class="ctrl-btn" id="prev" aria-label="Previous">&#8592;</button>
    <span id="img-count"></span>
    <button class="ctrl-btn" id="next" aria-label="Next">&#8594;</button>
  </div>

  <!-- Current slide name -->
  <div id="label"></div>

  <!-- Navigation dots (built by JS) -->
  <div id="dots"></div>

  <!-- Hint text -->
  <div id="hint">Click · Swipe · Arrow keys to navigate &nbsp;|&nbsp; Drop or load your own images</div>

  <!-- Drop overlay -->
  <div id="drop-overlay">Drop image to particulate it</div>

  <!-- gifler: decodes animated GIFs frame-by-frame into a <canvas>.
       CDN: https://cdn.jsdelivr.net/npm/gifler@0.1.0/gifler.min.js -->
  <script src="assets/gifler.min.js"></script>
  <!-- Particle Carousel engine (class-based, SPA-friendly) -->
  <script src="particlecarousel.engine.js"></script>
  <!-- Demo harness: default logos, UI wiring, file/drag-and-drop -->
  <script src="particlecarousel.demo.js"></script>
</body>
</html>