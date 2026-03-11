# Particle Carousel

A clean, dependency-free demo of a **particle-based logo carousel** using canvas particle morphing transitions. Designed to be deployed instantly on **Cloudflare Pages** (or any static host).

## Features

- **Fake captcha intro** — upon completion the particle cloud explodes and reforms into the first logo.
- **Particle physics** — particles float in space with realistic spring-damper physics between each morph.
- **Logo carousel** — Spotify → Apple Music → TikTok → YouTube → Gallery, each with branded particle colours.
- **Swipe / drag / arrow-key** navigation between carousel items.
- **Drag-and-drop** any PNG, JPEG, GIF, or SVG onto the canvas to sample it into particles instantly.
- **No dependencies** — pure vanilla JavaScript + Canvas 2D API.
- **Responsive** — adapts to any screen size or DPI.

## Files

| File | Purpose |
|---|---|
| `index.html` | Main page: canvas, fake captcha overlay, carousel UI |
| `style.css` | Modern dark space-like styles |
| `particlecarousel.js` | Core particle engine — sampling, physics, morphing |
| `assets/` | Placeholder — drop your own PNG/GIF/SVG logos here |

## Quick Start

```bash
# Clone and open locally
git clone https://github.com/indrolend/particlecarousel
cd particlecarousel
open index.html   # or: python -m http.server 8080
```

No build step required.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/) → **Create a project**.
3. Connect your GitHub repo.
4. Leave **Build command** empty and set **Output directory** to `/` (root).
5. Click **Save and Deploy**.

That's it — your particle carousel is live at `https://<project>.pages.dev`.

## Customising Platforms

Edit the `PLATFORMS` array at the top of `particlecarousel.js`:

```js
const PLATFORMS = [
  {
    key: 'spotify',
    label: 'SPOTIFY',
    colors: ['#1DB954', '#1ed760', '#158a3e', '#fff'],
    url: 'https://open.spotify.com/',
    icon: 'spotify',
  },
  // add more entries…
];
```

## Using Your Own Images

Drag and drop any image file onto the canvas while the carousel is running. The engine samples the image pixels into a particle cloud and morphs the current cloud into the new shape.

## JavaScript API

```js
// Navigate programmatically
ParticleCarousel.next();
ParticleCarousel.prev();
ParticleCarousel.goTo(2);   // zero-based index

// Load an HTMLImageElement as a particle cloud
const img = new Image();
img.src = 'mylogo.png';
img.onload = () => ParticleCarousel.loadImage(img);
```

## License

MIT
