// particlecarousel.engine.js
// Particle Carousel — canonical engine (class-based, SPA-friendly).
//
// Requires: gifler loaded before this file.
// No ES modules / imports — works from file:// directly.
//
// Usage:
//   const engine = new ParticleCarouselEngine({ particleCanvas, gifCanvas,
//     labelEl, dotsEl, countEl, onSlideChange });
//   engine.setSlides([{ label, img, gifSrc }]);

(function (global) {
  'use strict';

  // ── Physics constants ──────────────────────────────────────────────────────
  // Tweak these to change the feel of the transitions.
  const SPRING               = 0.11;   // Spring coefficient: pulls particles toward target
  const DAMPING              = 0.82;   // Velocity multiplier per frame when approaching target
  const DAMPING_OVERSHOOT    = 0.50;   // Extra friction when velocity overshoots target (kills bounce)
  const DRIFT                = 0.30;   // Subtle random drift when floating in place
  const SETTLE_PCT           = 0.90;   // Fraction of particles settled → morph complete
  const ALPHA_MIN            = 55;     // Min pixel alpha (0–255) to become a particle
  const MAX_STEP             = 6;      // Max pixel stride for sampling (controls density)
  const BURST_V              = 4;      // Initial burst velocity on morph transition
  const PART_SIZE            = 3.2;    // Particle radius in CSS pixels
  // Random lateral nudge applied per frame while particles are gathering.
  // Breaks up visible straight lines that form when many particles share
  // the same row/column in a rectangular source image.
  const GATHER_JITTER        = 0.8;    // max random acceleration (px/frame²) during morph
  // Target number of particles to aim for when computing the adaptive sampling stride.
  // Higher = denser cloud (more CPU); lower = sparser cloud.
  const TARGET_PARTICLE_DENSITY = 700;

  // ── GIF transition timing ──────────────────────────────────────────────────
  const SETTLE_POLL_MS    = 80;    // ms — how often to poll for morph completion
  const SETTLE_TIMEOUT_MS = 5000;  // ms — safety limit: show GIF even if morph stalls
  // ms to wait after gifler's animateInCanvas() before revealing the canvas.
  // gifler schedules its first draw via requestAnimationFrame; this delay
  // ensures at least one frame has been painted before the canvas is shown.
  const GIF_FIRST_FRAME_MS  = 60;
  // ms before giving up waiting for a GIF to load over the network.
  const GIF_LOAD_TIMEOUT_MS = 10000;

  // ── Explosion transition ───────────────────────────────────────────────────
  const EXPLODE_DURATION  = 320;   // ms — how long particles fly outward
  const EXPLODE_SPEED_MIN = 1.5;   // px/frame — minimum outward speed per particle
  const EXPLODE_SPEED_MAX = 4;     // px/frame — maximum outward speed per particle
  const EXPLODE_DAMPING   = 0.88;  // friction per frame — higher value = particles travel farther
  const EXPLODE_ALPHA     = 0.55;  // alpha target to fade toward during explosion

  // ── Colour helpers ─────────────────────────────────────────────────────────
  function parseRgb(s) {
    if (s[0] === '#') {
      const n = parseInt(s.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = s.match(/\d+/g);
    return m ? m.map(Number) : [200, 200, 200];
  }

  function blendColor(a, b, t) {
    const ca = parseRgb(a), cb = parseRgb(b);
    return (
      'rgb(' +
      Math.round(ca[0] * (1 - t) + cb[0] * t) + ',' +
      Math.round(ca[1] * (1 - t) + cb[1] * t) + ',' +
      Math.round(ca[2] * (1 - t) + cb[2] * t) + ')'
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  ParticleCarouselEngine
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Constructor options (all DOM elements required unless marked optional):
  //   particleCanvas  — <canvas> used for particle rendering
  //   gifCanvas       — <canvas> used by gifler for animated GIF playback
  //   labelEl         — element to receive the current slide label text (optional)
  //   dotsEl          — container element for navigation dot indicators (optional)
  //   countEl         — element to show "N / total" counter text (optional)
  //   onSlideChange   — callback({ currentIdx, total, label }) on slide change (optional)

  var ParticleCarouselEngine = (function () {

    function ParticleCarouselEngine(opts) {
      opts = opts || {};
      this._canvas        = opts.particleCanvas;
      this._ctx           = opts.particleCanvas.getContext('2d');
      this._gifCanvas     = opts.gifCanvas;
      this._labelEl       = opts.labelEl    || null;
      this._dotsEl        = opts.dotsEl     || null;
      this._countEl       = opts.countEl    || null;
      this._onSlideChange = opts.onSlideChange || null;

      this._W           = 0;
      this._H           = 0;
      this._slides      = [];    // [{ label, img, cloud, gifSrc }]
      this._particles   = [];    // active particle array
      this._currentIdx  = 0;
      this._morphing    = false; // true while particles are springing to targets
      this._exploding   = false; // true during the outward explosion phase
      this._transitioning = false; // true from goTo start until next GIF appears
      this._gifPlayer   = null;  // current gifler Animator instance
      this._rafId       = null;

      this._resizeBound = this._resize.bind(this);
      window.addEventListener('resize', this._resizeBound);
      this._resize();
    }

    // ── Viewport / resize ───────────────────────────────────────────────────
    // On iOS Safari, CSS `100vh` resolves to the *large* viewport height while
    // JS `window.innerHeight` and `position:fixed top:50%` both use the *visual*
    // viewport.  Using innerWidth/innerHeight for both canvas bitmap and CSS size
    // ensures no bitmap scaling and correct particle/GIF alignment on all platforms.
    ParticleCarouselEngine.prototype._resize = function () {
      this._W = this._canvas.width  = window.innerWidth;
      this._H = this._canvas.height = window.innerHeight;
      // Override the CSS 100vw/100vh rules so the canvas element is displayed at
      // exactly W×H CSS pixels — no implicit scaling on any platform.
      this._canvas.style.width  = this._W + 'px';
      this._canvas.style.height = this._H + 'px';
      // Expose visual-viewport height as a CSS variable so #gif-canvas can use
      // max-height: calc(var(--vh) * 65) instead of 65vh, keeping both layers
      // sized from the same reference.
      document.documentElement.style.setProperty('--vh', (this._H * 0.01) + 'px');
      // Regenerate clouds for new centre position
      var self = this;
      if (self._slides.length > 0) {
        self._slides.forEach(function (s) {
          if (s.img) s.cloud = self._sampleImage(s.img);
        });
        if (!self._transitioning) {
          if (self._gifCanvas.classList.contains('visible')) {
            // GIF is showing — silently snap particles to new positions so
            // they are correct when the next transition fires.
            self._snapToCloud(self._slides[self._currentIdx].cloud);
          } else {
            self._morphToCloud(self._slides[self._currentIdx].cloud);
          }
        }
      }
    };

    // ── Image → particle cloud ──────────────────────────────────────────────
    // Renders `img` to an offscreen canvas, walks every `step`-th pixel,
    // and returns an array of { wx, wy, col } in world space.
    // Images smaller than maxDim are NOT upscaled (ratio capped at 1) so
    // the particle cloud exactly matches the element's CSS display size and
    // the GIF canvas fully covers it during idle.
    ParticleCarouselEngine.prototype._sampleImage = function (img) {
      var W = this._W, H = this._H;
      if (!img.width || !img.height) return [];
      var maxDim = Math.min(W * 0.70, H * 0.65, 420);
      var ratio  = Math.min(maxDim / img.width, maxDim / img.height, 1);
      var dw     = Math.max(1, Math.round(img.width  * ratio));
      var dh     = Math.max(1, Math.round(img.height * ratio));

      var off    = document.createElement('canvas');
      off.width  = dw;
      off.height = dh;
      off.getContext('2d').drawImage(img, 0, 0, dw, dh);

      var data = off.getContext('2d').getImageData(0, 0, dw, dh).data;
      // Adaptive stride so dense images don't create too many particles
      var step = Math.min(MAX_STEP, Math.max(1, Math.floor(Math.sqrt((dw * dh) / TARGET_PARTICLE_DENSITY))));

      var cx = W / 2, cy = H / 2;
      var pts = [];
      for (var py = 0; py < dh; py += step) {
        for (var px = 0; px < dw; px += step) {
          var idx = (py * dw + px) * 4;
          if (data[idx + 3] > ALPHA_MIN) {
            pts.push({
              wx:  cx - dw / 2 + px,
              wy:  cy - dh / 2 + py,
              col: 'rgb(' + data[idx] + ',' + data[idx + 1] + ',' + data[idx + 2] + ')',
            });
          }
        }
      }
      return pts;
    };

    // ── gifler helpers ──────────────────────────────────────────────────────

    // Stop the current gifler player and capture the live frame as a cloud.
    // Returns the cloud array, or null if the canvas is empty / no player.
    ParticleCarouselEngine.prototype._stopAndSampleGif = function () {
      if (!this._gifPlayer) return null;
      this._gifPlayer.stop();
      this._gifPlayer = null;
      var gc = this._gifCanvas;
      if (!gc.width || !gc.height) return null;
      var cloud = this._sampleImage(gc);
      return cloud.length > 0 ? cloud : null;
    };

    // Load `url` with gifler, animate into gifCanvas, then call `onReady`.
    // A safety timer ensures `onReady` is always called even if loading fails.
    ParticleCarouselEngine.prototype._loadAndPlayGIF = function (url, onReady) {
      var self = this;
      if (self._gifPlayer) { self._gifPlayer.stop(); self._gifPlayer = null; }
      if (!url) {
        self._gifCanvas.classList.remove('visible');
        if (onReady) onReady();
        return;
      }

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        if (onReady) onReady();
      }
      // Safety: if gifler never calls back (network error etc.), release the lock.
      var safetyTimer = setTimeout(finish, GIF_LOAD_TIMEOUT_MS);

      gifler(url).get(function (anim) {
        clearTimeout(safetyTimer);
        self._gifPlayer = anim;
        anim.animateInCanvas(self._gifCanvas);
        // Brief delay so the first frame has been rendered before we show it.
        setTimeout(function () {
          self._gifCanvas.style.display = '';  // clear display:none set in _goTo() during transition
          self._gifCanvas.classList.add('visible');
          self._canvas.style.visibility = 'hidden'; // hide particles while GIF is playing
          finish();
        }, GIF_FIRST_FRAME_MS);
      });
    };

    // Call `cb` once morphing is complete (or after SETTLE_TIMEOUT_MS safety timeout).
    ParticleCarouselEngine.prototype._waitForSettle = function (cb) {
      var self = this;
      var waited = 0;
      (function poll() {
        waited += SETTLE_POLL_MS;
        if (!self._morphing || waited > SETTLE_TIMEOUT_MS) { cb(); return; }
        setTimeout(poll, SETTLE_POLL_MS);
      })();
    };

    // ── Particle helpers ────────────────────────────────────────────────────

    ParticleCarouselEngine.prototype._makeParticle = function (x, y, color, tx, ty, tcol) {
      return {
        x: x, y: y, color: color,
        tx: (tx !== undefined ? tx : x),
        ty: (ty !== undefined ? ty : y),
        tcolor: (tcol !== undefined ? tcol : color),
        size: PART_SIZE,
        vx: (Math.random() - 0.5) * BURST_V,
        vy: (Math.random() - 0.5) * BURST_V,
        alpha: 1,
      };
    };

    // Silently move particles to `cloud` positions without burst or morph flag.
    // Used during window resize when the GIF canvas is visible.
    ParticleCarouselEngine.prototype._snapToCloud = function (cloud) {
      if (!cloud || cloud.length === 0) return;
      var particles = this._particles;
      var oldLen = particles.length;
      var newLen = cloud.length;
      for (var i = oldLen; i < newLen; i++) {
        particles.push(this._makeParticle(
          cloud[i].wx, cloud[i].wy, cloud[i].col,
          cloud[i].wx, cloud[i].wy, cloud[i].col
        ));
        particles[particles.length - 1].vx = 0;
        particles[particles.length - 1].vy = 0;
      }
      particles.length = newLen;
      for (var j = 0; j < newLen; j++) {
        particles[j].x      = cloud[j].wx;
        particles[j].y      = cloud[j].wy;
        particles[j].tx     = cloud[j].wx;
        particles[j].ty     = cloud[j].wy;
        particles[j].color  = cloud[j].col;
        particles[j].tcolor = cloud[j].col;
        particles[j].vx     = 0;
        particles[j].vy     = 0;
      }
    };

    // Place particles exactly at `cloud` positions and at rest, matching the
    // live GIF frame so the canvas looks identical when gifCanvas is hidden.
    ParticleCarouselEngine.prototype.setParticlesAtCloud = function (cloud) {
      if (!cloud || cloud.length === 0) return;
      this._particles = cloud.map(function (pt) {
        return {
          x: pt.wx, y: pt.wy, color: pt.col,
          tx: pt.wx, ty: pt.wy, tcolor: pt.col,
          size: PART_SIZE, vx: 0, vy: 0, alpha: 1,
        };
      });
    };

    // Clones or trims the particle array to match the new cloud size, then
    // assigns new target positions + colours and gives every particle a burst.
    ParticleCarouselEngine.prototype._morphToCloud = function (cloud) {
      if (!cloud || cloud.length === 0) return;
      var particles = this._particles;
      var W = this._W, H = this._H;
      var oldLen = particles.length;
      var newLen = cloud.length;
      var i;

      // Grow: clone existing particles to fill the gap.
      // If particles is empty, spawn new particles at the canvas centre.
      for (i = oldLen; i < newLen; i++) {
        if (oldLen === 0) {
          particles.push(this._makeParticle(W / 2, H / 2, '#fff', W / 2, H / 2, '#fff'));
        } else {
          var src = particles[i % oldLen];
          particles.push(this._makeParticle(src.x, src.y, src.color, src.tx, src.ty, src.tcolor));
        }
      }
      // Shrink
      particles.length = newLen;

      // Assign new targets + burst velocity
      for (i = 0; i < particles.length; i++) {
        var pt = cloud[i];
        particles[i].tx     = pt.wx;
        particles[i].ty     = pt.wy;
        particles[i].tcolor = pt.col;
        particles[i].vx     = (Math.random() - 0.5) * BURST_V;
        particles[i].vy     = (Math.random() - 0.5) * BURST_V;
      }
      this._morphing = true;
    };

    // Seed the particle array from scratch (used for the first slide).
    ParticleCarouselEngine.prototype._initFromCloud = function (cloud) {
      var W = this._W, H = this._H;
      var self = this;
      this._particles = cloud.map(function (pt) {
        return self._makeParticle(
          pt.wx + (Math.random() - 0.5) * W * 0.5,
          pt.wy + (Math.random() - 0.5) * H * 0.5,
          pt.col, pt.wx, pt.wy, pt.col
        );
      });
    };

    // Kicks every particle in a random direction at a random speed, lets them
    // fly freely for `duration` ms, then calls `onComplete` so the caller can
    // assign new targets and start the spring-morph toward the next slide.
    ParticleCarouselEngine.prototype._explodeParticles = function (duration, onComplete) {
      var particles = this._particles;
      for (var i = 0; i < particles.length; i++) {
        var p     = particles[i];
        var angle = Math.random() * Math.PI * 2;
        var speed = EXPLODE_SPEED_MIN + Math.random() * (EXPLODE_SPEED_MAX - EXPLODE_SPEED_MIN);
        p.vx    = Math.cos(angle) * speed;
        p.vy    = Math.sin(angle) * speed;
        p.alpha = 1;
      }
      this._exploding = true;
      this._morphing  = false;

      var self = this;
      setTimeout(function () {
        self._exploding = false;
        // Restore full opacity so the reassembly morph starts at full brightness.
        for (var j = 0; j < particles.length; j++) {
          particles[j].alpha = 1;
        }
        onComplete();
      }, duration);
    };

    // ── Animation loop ──────────────────────────────────────────────────────
    // Two physics modes, selected by state flags:
    //   exploding — particles fly freely with very light friction (no spring pull).
    //   default   — spring-physics pulls each particle toward its target;
    //               settled particles get subtle random drift.
    ParticleCarouselEngine.prototype._startAnim = function () {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      var self = this;
      var ctx  = this._ctx;

      function frame() {
        ctx.clearRect(0, 0, self._W, self._H);
        var particles = self._particles;
        var settled   = 0;

        if (self._exploding) {
          // ── Explosion phase: free-fly with very light friction ──────────────
          for (var i = 0; i < particles.length; i++) {
            var p = particles[i];

            p.vx *= EXPLODE_DAMPING;
            p.vy *= EXPLODE_DAMPING;
            p.x  += p.vx;
            p.y  += p.vy;

            // Gently fade toward EXPLODE_ALPHA for a subtle dissolving effect.
            p.alpha += (EXPLODE_ALPHA - p.alpha) * 0.06;

            ctx.globalAlpha = Math.max(0.1, p.alpha);
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // ── Spring-physics morph / idle drift ─────────────────────────────
          for (var j = 0; j < particles.length; j++) {
            var q = particles[j];

            // Spring force toward target
            var dx = q.tx - q.x;
            var dy = q.ty - q.y;
            q.vx += dx * SPRING;
            q.vy += dy * SPRING;

            // During gathering: add a small distance-scaled random nudge to break
            // up the visible straight lines that appear when many particles share
            // the same row or column in a rectangular source image.
            if (self._morphing && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
              // Scale jitter with distance: full strength at ≥20 px away, zero at target.
              var dist = Math.sqrt(dx * dx + dy * dy);
              var jit  = Math.min(dist / 20, 1) * GATHER_JITTER;
              q.vx += (Math.random() - 0.5) * jit;
              q.vy += (Math.random() - 0.5) * jit;
            }

            // Damping — asymmetric: apply extra friction when the particle is
            // overshooting (velocity and displacement point in opposite directions)
            // so it brakes hard instead of bouncing back.
            q.vx *= (dx * q.vx < 0) ? DAMPING_OVERSHOOT : DAMPING;
            q.vy *= (dy * q.vy < 0) ? DAMPING_OVERSHOOT : DAMPING;

            // Subtle drift once the particle is nearly at rest
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
              q.vx += (Math.random() - 0.5) * DRIFT;
              q.vy += (Math.random() - 0.5) * DRIFT;
              settled++;
            }

            q.x += q.vx;
            q.y += q.vy;

            // Blend colour toward target
            q.color = blendColor(q.color, q.tcolor, 0.08);

            ctx.globalAlpha = Math.max(0.15, q.alpha);
            ctx.fillStyle   = q.color;
            ctx.beginPath();
            ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
            ctx.fill();
          }

          if (self._morphing && settled >= particles.length * SETTLE_PCT) self._morphing = false;
        }

        ctx.globalAlpha = 1;
        self._rafId = requestAnimationFrame(frame);
      }
      frame();
    };

    // ── Navigation dots (optional) ──────────────────────────────────────────
    ParticleCarouselEngine.prototype._buildDots = function () {
      if (!this._dotsEl) return;
      var dotsEl     = this._dotsEl;
      var slides     = this._slides;
      var currentIdx = this._currentIdx;
      dotsEl.innerHTML = '';
      slides.forEach(function (_, i) {
        var d = document.createElement('div');
        d.className = 'dot' + (i === currentIdx ? ' active' : '');
        dotsEl.appendChild(d);
      });
    };

    ParticleCarouselEngine.prototype._updateDots = function (idx) {
      if (!this._dotsEl) return;
      this._dotsEl.querySelectorAll('.dot').forEach(function (d, i) {
        d.classList.toggle('active', i === idx);
      });
    };

    // ── Navigation ──────────────────────────────────────────────────────────
    ParticleCarouselEngine.prototype._goTo = function (idx) {
      var self = this;
      if (self._transitioning || self._slides.length === 0) return;
      var targetIdx = ((idx % self._slides.length) + self._slides.length) % self._slides.length;

      self._transitioning = true;

      // Reveal the particle canvas for the transition (it is hidden while the GIF plays).
      self._canvas.style.visibility = '';

      // Phase 1 — Stop gifler and sample the live animated frame.
      // If gifler is running the current frame's pixels match what is
      // displayed; sampling them makes the particle layer look identical.
      var liveCloud = self._stopAndSampleGif();
      if (liveCloud) {
        self.setParticlesAtCloud(liveCloud);
      }

      // Instantly hide the GIF canvas — the particle canvas beneath it is
      // now showing particles at the exact same pixel positions, so the
      // switch is seamless.
      self._gifCanvas.classList.remove('visible');
      self._gifCanvas.style.display = 'none';

      // Phase 2 — Explosion: particles burst outward before reassembling.
      self._explodeParticles(EXPLODE_DURATION, function () {

        // Phase 3 — Update slide state and spring-morph toward the new cloud.
        self._currentIdx = targetIdx;
        if (self._labelEl) self._labelEl.textContent = self._slides[targetIdx].label;
        if (self._countEl) self._countEl.textContent = (targetIdx + 1) + ' / ' + self._slides.length;
        self._updateDots(targetIdx);
        if (self._onSlideChange) {
          self._onSlideChange({
            currentIdx: targetIdx,
            total:      self._slides.length,
            label:      self._slides[targetIdx].label,
          });
        }
        self._morphToCloud(self._slides[targetIdx].cloud);

        // Phase 4 — When particles settle, load and play the next GIF.
        self._waitForSettle(function () {
          self._loadAndPlayGIF(self._slides[targetIdx].gifSrc, function () {
            self._transitioning = false;
          });
        });
      });
    };

    // ── Public navigation methods ───────────────────────────────────────────
    ParticleCarouselEngine.prototype.next = function () { this._goTo(this._currentIdx + 1); };
    ParticleCarouselEngine.prototype.prev = function () { this._goTo(this._currentIdx - 1); };
    ParticleCarouselEngine.prototype.goTo = function (index) { this._goTo(index); };

    // ── setSlides ───────────────────────────────────────────────────────────
    // Replace the current slide set and restart the carousel.
    // slides = [{ label: string, img: HTMLImageElement, gifSrc: string|null }]
    ParticleCarouselEngine.prototype.setSlides = function (slides) {
      var self  = this;
      var valid = [];
      slides.forEach(function (s) {
        if (!s.img) return;
        var cloud = self._sampleImage(s.img);
        if (cloud.length > 0) valid.push({
          label:  s.label  || 'Image',
          img:    s.img,
          cloud:  cloud,
          gifSrc: s.gifSrc || null,
        });
      });
      if (valid.length === 0) return;

      // Tear down any previous player
      if (self._gifPlayer) { self._gifPlayer.stop(); self._gifPlayer = null; }
      self._gifCanvas.classList.remove('visible');
      self._canvas.style.visibility = ''; // ensure particle canvas is visible for the initial morph

      // Revoke blob URLs from the previous set of slides to avoid memory leaks.
      self._slides.forEach(function (s) {
        if (s.gifSrc && s.gifSrc.startsWith('blob:')) URL.revokeObjectURL(s.gifSrc);
      });

      self._slides        = valid;
      self._currentIdx    = 0;
      self._transitioning = false;
      self._buildDots();
      self._initFromCloud(valid[0].cloud);
      self._morphing = true;   // particles start scattered; frame loop clears this when settled
      if (self._labelEl) self._labelEl.textContent = valid[0].label;
      if (self._countEl) self._countEl.textContent = '1 / ' + valid.length;
      if (self._onSlideChange) {
        self._onSlideChange({ currentIdx: 0, total: valid.length, label: valid[0].label });
      }
      self._startAnim();       // always (re)start the animation loop

      // Once the initial cloud settles, start playing the first GIF.
      self._waitForSettle(function () {
        self._loadAndPlayGIF(valid[0].gifSrc);
      });
    };

    // ── addImage ────────────────────────────────────────────────────────────
    // Append a single image as a new slide without resetting the carousel.
    // @param {HTMLImageElement} img
    // @param {string}          [label]
    // @param {string}          [gifSrc]  URL/path for gifler idle playback
    ParticleCarouselEngine.prototype.addImage = function (img, label, gifSrc) {
      if (!img) return;
      var cloud = this._sampleImage(img);
      if (!cloud.length) return;
      this._slides.push({ label: label || 'Custom', img: img, cloud: cloud, gifSrc: gifSrc || null });
      this._buildDots();
      if (this._countEl) this._countEl.textContent = (this._currentIdx + 1) + ' / ' + this._slides.length;
    };

    // ── destroy ─────────────────────────────────────────────────────────────
    // Stop RAF, stop gifler, remove resize listener.  Call when unmounting in an SPA.
    ParticleCarouselEngine.prototype.destroy = function () {
      if (this._rafId)    { cancelAnimationFrame(this._rafId); this._rafId = null; }
      if (this._gifPlayer) { this._gifPlayer.stop(); this._gifPlayer = null; }
      window.removeEventListener('resize', this._resizeBound);
    };

    return ParticleCarouselEngine;
  }());

  global.ParticleCarouselEngine = ParticleCarouselEngine;

}(window));
