// Neon Coast cover engine: draws a multi-panel GTA-style poster cover onto any
// 2D canvas. Everything is drawn from scratch — gradient skies, a sun, palm
// silhouettes, panel frames and bold condensed lettering — no borrowed artwork.
//
// A cover state looks like:
//   { layout, grade, size, title, subtitle, caption,
//     photos: [HTMLImageElement | null, ...],
//     panels: [{ photo, zoom, ox, oy }, ...] }   // ox/oy: pan fractions, -0.5..0.5
// Panels are filled from photos; a panel with no photo shows the sunset sky.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

export const GRADES = {
  sunset: {
    name: 'Sunset',
    sky: ['#2b0f4d', '#7b1e6e', '#e0397a', '#ff7a18', '#ffc46b'],
    sun: ['#fff3c4', '#ffb347', '#ff5e62'],
    wash: 'rgba(255, 94, 98, 0.20)',
    tint: 'rgba(255, 122, 24, 0.16)',
    accent: '#ff2e88',
    accent2: '#ffb347',
    title: ['#ffffff', '#ffd9ec', '#ff9ecf'],
    band: '#160a26',
  },
  neon: {
    name: 'Neon Night',
    sky: ['#0b0630', '#2b0f5e', '#a4138e', '#ff2e88', '#22e6ff'],
    sun: ['#e8fbff', '#22e6ff', '#ff2e88'],
    wash: 'rgba(34, 230, 255, 0.18)',
    tint: 'rgba(255, 46, 136, 0.20)',
    accent: '#22e6ff',
    accent2: '#ff2e88',
    title: ['#ffffff', '#c9f6ff', '#7ee9ff'],
    band: '#0a0618',
  },
  coast: {
    name: 'Vice Coast',
    sky: ['#0a2a4d', '#14607a', '#1f9e8e', '#ffb347', '#ffe9a8'],
    sun: ['#fffbe8', '#ffe9a8', '#ff9a3d'],
    wash: 'rgba(31, 158, 142, 0.18)',
    tint: 'rgba(255, 179, 71, 0.18)',
    accent: '#ffb347',
    accent2: '#1f9e8e',
    title: ['#ffffff', '#fff3c4', '#ffd27a'],
    band: '#081826',
  },
};

export const LAYOUTS = {
  hero: { name: 'Hero + 3', panels: 4 },
  grid: { name: 'Grid 2 × 2', panels: 4 },
  strip: { name: 'Strip × 3', panels: 3 },
  solo: { name: 'Full bleed', panels: 1 },
};

/** Deterministic pseudo-random generator, so grain and palms render identically. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles for a layout inside the cover's panel area. */
export function layoutPanels(layout, area) {
  const { x, y, w, h } = area;
  const g = Math.max(6, w * 0.008); // gutter between panels
  if (layout === 'hero') {
    const heroW = w * 0.62;
    const sideW = w - heroW - g;
    const sideH = (h - 2 * g) / 3;
    return [
      { x, y, w: heroW, h },
      { x: x + heroW + g, y, w: sideW, h: sideH },
      { x: x + heroW + g, y: y + sideH + g, w: sideW, h: sideH },
      { x: x + heroW + g, y: y + 2 * (sideH + g), w: sideW, h: sideH },
    ];
  }
  if (layout === 'grid') {
    const cw = (w - g) / 2;
    const ch = (h - g) / 2;
    return [
      { x, y, w: cw, h: ch },
      { x: x + cw + g, y, w: cw, h: ch },
      { x, y: y + ch + g, w: cw, h: ch },
      { x: x + cw + g, y: y + ch + g, w: cw, h: ch },
    ];
  }
  if (layout === 'strip') {
    const cw = (w - 2 * g) / 3;
    return [0, 1, 2].map((i) => ({ x: x + i * (cw + g), y, w: cw, h }));
  }
  return [{ x, y, w, h }]; // solo
}

/** Which panel (index) contains point (px, py), or -1. */
export function panelAt(px, py, panels) {
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const r = panels[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

/** Draws one photo cover-filling a rect, with zoom and pan. */
export function drawPhotoInto(ctx, img, rect, panel) {
  const zoom = panel?.zoom ?? 1;
  const ox = panel?.ox ?? 0;
  const oy = panel?.oy ?? 0;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = rect.x + rect.w / 2 + ox * rect.w;
  const cy = rect.y + rect.h / 2 + oy * rect.h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

/** A palm silhouette: curved trunk and drooping fronds, drawn with strokes. */
export function drawPalm(ctx, x, y, s, color, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, s * 0.036);
  // Trunk, leaning slightly, from the base (x, y) up to the crown.
  const lean = s * (0.10 + rnd() * 0.08) * (rnd() > 0.5 ? 1 : -1);
  const topX = x + lean;
  const topY = y - s * 0.92;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.3, y - s * 0.5, topX, topY);
  ctx.stroke();
  // Fronds: arcs over the crown that droop at the tips.
  ctx.lineWidth = Math.max(0.8, s * 0.016);
  const fronds = 7;
  for (let i = 0; i < fronds; i += 1) {
    const t = (i / (fronds - 1)) * Math.PI; // 0 = left, PI/2 = up, PI = right
    const dirX = Math.cos(Math.PI + t); // sweep left -> up -> right
    const dirY = Math.sin(Math.PI + t);
    const len = s * (0.48 + rnd() * 0.16);
    const ex = topX + dirX * len;
    const ey = topY + dirY * len * 0.55 + len * 0.34; // droop
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + dirX * len * 0.55, topY - len * 0.22, ex, ey);
    ctx.stroke();
  }
  // Coconuts under the crown.
  ctx.beginPath();
  ctx.arc(topX - s * 0.02, topY + s * 0.03, s * 0.028, 0, Math.PI * 2);
  ctx.arc(topX + s * 0.04, topY + s * 0.04, s * 0.024, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Sunset sky with a glowing sun disc, used behind panels and in empty panels. */
export function drawSky(ctx, rect, grade, seed, withPalms = true) {
  const { x, y, w, h } = rect;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  grade.sky.forEach((stop, i) => sky.addColorStop(i / (grade.sky.length - 1), stop));
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // Sun: a soft glowing disc low in the sky.
  const sunR = Math.min(w, h) * 0.16;
  const sunX = x + w * 0.72;
  const sunY = y + h * 0.62;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR * 2.2);
  glow.addColorStop(0, grade.sun[1] + 'cc');
  glow.addColorStop(1, grade.sun[1] + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  const disc = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  disc.addColorStop(0, grade.sun[0]);
  disc.addColorStop(0.6, grade.sun[1]);
  disc.addColorStop(1, grade.sun[2]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Horizon shimmer.
  const shim = ctx.createLinearGradient(0, y + h * 0.78, 0, y + h);
  shim.addColorStop(0, 'rgba(255,255,255,0)');
  shim.addColorStop(1, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = shim;
  ctx.fillRect(x, y, w, h);
  // Palm silhouettes along the bottom edge of the sky, kept small so their
  // crowns never poke into the title band or a neighbouring panel.
  if (withPalms) {
    const rnd = mulberry32(seed);
    const sil = 'rgba(20, 6, 38, 0.85)';
    for (let i = 0; i < 3; i += 1) {
      const px = x + w * (0.08 + rnd() * 0.84);
      drawPalm(ctx, px, y + h * 0.98, h * (0.24 + rnd() * 0.12), sil, seed + i * 7);
    }
  }
}

/** Fits a font size so `text` fits `maxWidth` on this context. */
export function fitFont(ctx, text, weight, family, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

const DISPLAY = '"Neon Coast Black", "Arial Narrow", "Impact", sans-serif';
const CONDENSED = '"Neon Coast Display", "Arial Narrow", sans-serif';
const SERIF_IT = '"Neon Coast Serif", Georgia, serif';

/** Draws the whole cover onto `canvas` (its own pixel size) from a state. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const u = Math.min(W, H) / 1080; // unit scale, so a 1080-wide cover is 1:1
  const titleH = H * 0.155;
  const captionH = H * 0.105;
  const pad = W * 0.022;
  const area = { x: pad, y: titleH + pad * 0.6, w: W - pad * 2, h: H - titleH - captionH - pad * 1.6 };
  const panels = layoutPanels(state.layout, area);

  // Backdrop: the grade's sky fills everything; panels sit on top of it.
  // No palms here — the title band gets its own small ones below.
  drawSky(ctx, { x: 0, y: 0, w: W, h: H }, grade, 1234, false);

  // Sun and palms in the title band, flanking the title.
  const sunR = titleH * 0.38;
  const sunX = W * 0.905;
  const sunY = titleH * 0.52;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, grade.sun[1] + '99');
  glow.addColorStop(1, grade.sun[1] + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(W * 0.7, 0, W * 0.3, titleH);
  const disc = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  disc.addColorStop(0, grade.sun[0]);
  disc.addColorStop(0.6, grade.sun[1]);
  disc.addColorStop(1, grade.sun[2]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  const sil = 'rgba(20, 6, 38, 0.9)';
  drawPalm(ctx, W * 0.035, titleH * 1.0, titleH * 1.05, sil, 41);

  // Panels.
  const photos = state.photos ?? [];
  const panelStates = state.panels ?? [];
  panels.forEach((rect, i) => {
    const ps = panelStates[i] ?? { photo: null, zoom: 1, ox: 0, oy: 0 };
    const img = ps.photo != null ? photos[ps.photo] : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      drawPhotoInto(ctx, img, rect, ps);
      // Grade wash + tint over the photo.
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = grade.tint;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = grade.wash;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // A warm light rising from the bottom of each photo.
      const lift = ctx.createLinearGradient(0, rect.y + rect.h * 0.55, 0, rect.y + rect.h);
      lift.addColorStop(0, 'rgba(255,122,24,0)');
      lift.addColorStop(1, 'rgba(255,46,136,0.28)');
      ctx.fillStyle = lift;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      drawSky(ctx, rect, grade, 900 + i * 31);
    }
    // Frame: white edge, then a neon hairline.
    ctx.lineWidth = Math.max(2, 4 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeRect(rect.x + 2 * u, rect.y + 2 * u, rect.w - 4 * u, rect.h - 4 * u);
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.strokeStyle = grade.accent;
    ctx.strokeRect(rect.x + 6 * u, rect.y + 6 * u, rect.w - 12 * u, rect.h - 12 * u);
    ctx.restore();
  });

  // Title block over the sky at the top.
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim();
  if (title) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const size = fitFont(ctx, title, 900, DISPLAY, H * 0.105, W * 0.94);
    const titleGrad = ctx.createLinearGradient(0, pad * 0.4, 0, titleH);
    grade.title.forEach((stop, i) => titleGrad.addColorStop(i / (grade.title.length - 1), stop));
    ctx.translate(W / 2, titleH * 0.72);
    ctx.transform(1, 0, -0.045, 1, 0, 0); // slight forward lean
    ctx.font = `900 ${size}px ${DISPLAY}`;
    ctx.lineWidth = Math.max(3, size * 0.07);
    ctx.strokeStyle = 'rgba(20, 6, 38, 0.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(title, 0, 0);
    ctx.fillStyle = titleGrad;
    ctx.fillText(title, 0, 0);
    // Neon underline under the title.
    ctx.restore();
    ctx.save();
    ctx.fillStyle = grade.accent;
    const ruleW = Math.min(W * 0.5, ctx.measureText(title).width * 0.55);
    ctx.fillRect(W / 2 - ruleW / 2, titleH * 0.86, ruleW, Math.max(2, 3 * u));
    ctx.fillStyle = grade.accent2;
    ctx.fillRect(W / 2 - ruleW / 2, titleH * 0.86 + Math.max(2, 3 * u) + 2 * u, ruleW * 0.6, Math.max(1.5, 2 * u));
    ctx.restore();
  }
  if (subtitle) {
    ctx.save();
    ctx.textAlign = 'center';
    const size = fitFont(ctx, subtitle, 'italic 800', SERIF_IT, H * 0.032, W * 0.8);
    ctx.font = `italic 800 ${size}px ${SERIF_IT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = 12 * u;
    ctx.fillText(subtitle, W / 2, titleH * 0.985);
    ctx.restore();
  }

  // Caption band along the foot.
  const bandY = H - captionH;
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandY, W, captionH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandY, W, Math.max(2, 3 * u));
  const caption = (state.caption ?? '').trim().toUpperCase();
  if (caption) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = fitFont(ctx, caption, 800, CONDENSED, captionH * 0.52, W * 0.9);
    ctx.font = `800 ${size}px ${CONDENSED}`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = 10 * u;
    ctx.fillText(caption, W / 2, bandY + captionH * 0.56);
    ctx.restore();
  }

  // Grain + vignette for a printed-poster feel (seeded, so renders repeat).
  const rnd = mulberry32(20261119);
  ctx.save();
  ctx.globalAlpha = 0.05;
  const dots = Math.floor((W * H) / 2600);
  for (let i = 0; i < dots; i += 1) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1.4 * u, 1.4 * u);
  }
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,4,24,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  return panels;
}

/** Renders a cover at full export size and returns the canvas. */
export function renderCover(state, sizeKey) {
  const size = SIZES[sizeKey] ?? SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}

/** A fresh default state for a layout. */
export function defaultPanels(layout) {
  const count = LAYOUTS[layout]?.panels ?? 4;
  return Array.from({ length: count }, () => ({ photo: null, zoom: 1, ox: 0, oy: 0 }));
}
