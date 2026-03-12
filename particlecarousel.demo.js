// particlecarousel.demo.js
// Demo harness — wires the DOM controls to ParticleCarouselEngine.
//
// Depends on: particlecarousel.engine.js (loaded first).
// No ES modules / imports — works from file:// directly.

(function () {
  'use strict';

  // ── Default slides ─────────────────────────────────────────────────────────
  // Drop new GIF/PNG/SVG files into assets/ and add a matching entry here.
  // Each entry: { label: string, src: 'assets/<filename>' }
  var DEFAULT_LOGOS = [
    { label: 'Spotify',     src: 'assets/Spotifylogospin.gif'    },
    { label: 'Apple Music', src: 'assets/Applemusiclogospin.gif' },
    { label: 'TikTok',      src: 'assets/Tiktoklogospin.gif'     },
    { label: 'YouTube',     src: 'assets/Youtubelogospin.gif'    },
    { label: 'Instagram',   src: 'assets/Instagramlogospin.gif'  },
    { label: 'Bandcamp',    src: 'assets/Bandcamplogospin.gif'   },
  ];

  // ── Utility: load an image by src path ─────────────────────────────────────
  function imgFromSrc(src) {
    return new Promise(function (resolve) {
      var img      = new Image();
      img.onload  = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src      = src;
    });
  }

  // ── Utility: convert an inline SVG string → HTMLImageElement ───────────────
  function svgToImage(svgStr) {
    return new Promise(function (resolve, reject) {
      var blob = new Blob([svgStr], { type: 'image/svg+xml' });
      var url  = URL.createObjectURL(blob);
      var img  = new Image();
      img.onload  = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function (e) { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  // ── Handle file uploads (picker or drag-and-drop) ──────────────────────────
  function handleFiles(files, engine) {
    var arr = Array.from(files).filter(function (f) { return f.type.startsWith('image/'); });
    if (!arr.length) return;
    var slides  = new Array(arr.length);
    var loaded  = 0;
    arr.forEach(function (f, i) {
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = img.onerror = function () {
        if (img.complete && img.naturalWidth) {
          slides[i] = {
            label:  f.name.replace(/\.[^.]+$/, ''),
            img:    img,
            gifSrc: url,   // keep blob URL alive for gifler; engine revokes when replaced
          };
        } else {
          slides[i] = null;
          URL.revokeObjectURL(url);
        }
        if (++loaded === arr.length) {
          engine.setSlides(slides.filter(Boolean));
        }
      };
      img.src = url;
    });
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  (async function () {
    var canvas    = document.getElementById('canvas');
    var gifCanvas = document.getElementById('gif-canvas');
    var labelEl   = document.getElementById('label');
    var dotsEl    = document.getElementById('dots');
    var countEl   = document.getElementById('img-count');

    // Instantiate the engine, passing the required DOM elements.
    var engine = new ParticleCarouselEngine({
      particleCanvas: canvas,
      gifCanvas:      gifCanvas,
      labelEl:        labelEl,
      dotsEl:         dotsEl,
      countEl:        countEl,
    });

    // Expose engine on window for debugging.
    window.__particleCarouselEngine = engine;

    // Backward-compatible public API (mirrors old window.ParticleCarousel).
    window.ParticleCarousel = {
      next:      function ()             { engine.next(); },
      prev:      function ()             { engine.prev(); },
      goTo:      function (i)            { engine.goTo(i); },
      /** Load an HTMLImageElement directly as an additional slide.
       *  @param {HTMLImageElement} img
       *  @param {string}          [label]
       *  @param {string}          [gifSrc]  URL/path for gifler idle playback */
      loadImage: function (img, label, gifSrc) { engine.addImage(img, label, gifSrc); },
    };

    // ── Wire up controls ────────────────────────────────────────────────────
    document.getElementById('prev').addEventListener('click', function () { engine.prev(); });
    document.getElementById('next').addEventListener('click', function () { engine.next(); });

    document.getElementById('file-input').addEventListener('change', function (e) {
      handleFiles(e.target.files, engine);
    });

    // Keyboard arrow navigation
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') engine.next();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   engine.prev();
    });

    // Click canvas to advance (suppress if the pointer moved > 6 px — it was a drag)
    var pointerDownX = 0, pointerMoved = false; // tracks canvas click vs drag gestures
    canvas.addEventListener('pointerdown', function (e) {
      pointerDownX = e.clientX; pointerMoved = false;
    });
    canvas.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - pointerDownX) > 6) pointerMoved = true;
    });
    canvas.addEventListener('click', function () { if (!pointerMoved) engine.next(); });

    // Touch swipe
    var touchStartX = 0;
    canvas.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
      var d = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(d) > 50) { if (d < 0) { engine.next(); } else { engine.prev(); } }
    }, { passive: true });

    // Drag-and-drop
    document.addEventListener('dragenter', function () { document.body.classList.add('dragging'); });
    document.addEventListener('dragleave', function (e) {
      if (!e.relatedTarget) document.body.classList.remove('dragging');
    });
    document.addEventListener('dragover',  function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      document.body.classList.remove('dragging');
      handleFiles(e.dataTransfer.files, engine);
    });

    // ── Load default logos from assets/ ─────────────────────────────────────
    var imgs   = [];
    var labels = [];
    var srcs   = [];
    for (var li = 0; li < DEFAULT_LOGOS.length; li++) {
      var logo = DEFAULT_LOGOS[li];
      try {
        var img = logo.src
          ? await imgFromSrc(logo.src)
          : await svgToImage(logo.svg);
        if (img) {
          imgs.push(img);
          labels.push(logo.label);
          srcs.push(logo.src || null);
        } else {
          console.warn('Particle Carousel: failed to load "' + logo.label + '"');
        }
      } catch (e) {
        console.warn('Particle Carousel: failed to load "' + logo.label + '"', e);
      }
    }

    if (imgs.length === 0) {
      labelEl.textContent = 'Drop an image to start';
      return;
    }

    // Build slide descriptors and pass them to the engine.
    var slideData = imgs.map(function (img, i) {
      return { label: labels[i], img: img, gifSrc: srcs[i] };
    });
    engine.setSlides(slideData);
  })();

}());
