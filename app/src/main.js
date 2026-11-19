// Neon Coast Cover Maker — wires the editor: photo uploads, panel picking and
// dragging, layouts, grades, sizes and PNG export. Photos are read with
// FileReader on this machine and never leave it.
import { SIZES, GRADES, LAYOUTS, drawCover, renderCover, defaultPanels, panelAt, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const status = $('status');

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: 'square',
  title: 'NEON COAST',
  subtitle: 'a Vice City story',
  caption: 'Sunset Heist',
  photos: [],
  panels: defaultPanels('hero'),
};
let selectedPanel = 0;
let activePhoto = -1; // index into state.photos, or -1 for none
let panelsNow = [];

function syncCanvasSize() {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
}

function redraw() {
  syncCanvasSize();
  panelsNow = drawCover(canvas, state);
  $('zoom').value = String(state.panels[selectedPanel]?.zoom ?? 1);
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function addPhoto(img, thumbUrl) {
  state.photos.push(img);
  const idx = state.photos.length - 1;
  const thumb = document.createElement('img');
  thumb.src = thumbUrl;
  thumb.alt = `Photo ${idx + 1}`;
  thumb.title = `Use photo ${idx + 1} in the selected panel`;
  thumb.addEventListener('click', () => {
    activePhoto = idx;
    document.querySelectorAll('#thumbs img').forEach((t) => t.classList.remove('selected'));
    thumb.classList.add('selected');
    assignPhotoToSelected(idx);
  });
  $('thumbs').appendChild(thumb);
  // First photo fills the hero panel automatically — one click from photo to cover.
  if (state.photos.length === 1) {
    activePhoto = 0;
    thumb.classList.add('selected');
    state.panels.forEach((p) => { p.photo = 0; });
  }
  redraw();
}

function assignPhotoToSelected(photoIdx) {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.photo = photoIdx;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
}

$('photos').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  for (const file of files) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      addPhoto(await loadImage(dataUrl), dataUrl);
    } catch {
      status.textContent = `Could not read ${file.name}.`;
    }
  }
  if (files.length) status.textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded — drag a panel to frame it, then export.`;
  event.target.value = '';
});

$('fillAll').addEventListener('click', () => {
  if (activePhoto < 0) { status.textContent = 'Add a photo first.'; return; }
  state.panels.forEach((p) => { p.photo = activePhoto; p.zoom = 1; p.ox = 0; p.oy = 0; });
  redraw();
});

function wireChoices(id, key, onPick) {
  $(id).addEventListener('click', (event) => {
    const button = event.target.closest('[data-' + key + ']');
    if (!button) return;
    $(id).querySelectorAll('.choice').forEach((c) => c.classList.remove('active'));
    button.classList.add('active');
    onPick(button.dataset[key]);
  });
}

wireChoices('layouts', 'layout', (layout) => {
  const old = state.panels;
  state.layout = layout;
  state.panels = defaultPanels(layout);
  // Carry the photos over: hero keeps the first photo, others spread in order.
  state.panels.forEach((p, i) => {
    const from = old[Math.min(i, old.length - 1)];
    if (from) { p.photo = from.photo; p.zoom = from.zoom; p.ox = from.ox; p.oy = from.oy; }
  });
  selectedPanel = 0;
  redraw();
});

wireChoices('grades', 'grade', (grade) => { state.grade = grade; redraw(); });
wireChoices('sizes', 'size', (size) => { state.size = size; redraw(); });

$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });

function setZoom(z) {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Math.min(3, Math.max(1, z));
  redraw();
}
$('zoom').addEventListener('input', (e) => setZoom(Number(e.target.value)));
$('zoomIn').addEventListener('click', () => setZoom((state.panels[selectedPanel]?.zoom ?? 1) * 1.2));
$('zoomOut').addEventListener('click', () => setZoom((state.panels[selectedPanel]?.zoom ?? 1) / 1.2));
$('resetPanel').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = 1; panel.ox = 0; panel.oy = 0;
  redraw();
});

// Pointer: click selects a panel, drag pans its photo, wheel zooms it.
let drag = null;
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (event) => {
  const p = canvasPoint(event);
  const idx = panelAt(p.x, p.y, panelsNow);
  if (idx < 0) return;
  selectedPanel = idx;
  canvas.setPointerCapture(event.pointerId);
  drag = { panel: state.panels[idx], start: p, ox: state.panels[idx].ox, oy: state.panels[idx].oy };
  redraw();
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const p = canvasPoint(event);
  const rect = panelsNow[selectedPanel];
  if (!rect) return;
  drag.panel.ox = Math.min(0.5, Math.max(-0.5, drag.ox + (p.x - drag.start.x) / rect.w));
  drag.panel.oy = Math.min(0.5, Math.max(-0.5, drag.oy + (p.y - drag.start.y) / rect.h));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const p = canvasPoint(event);
  const idx = panelAt(p.x, p.y, panelsNow);
  if (idx >= 0) {
    selectedPanel = idx;
    setZoom((state.panels[idx].zoom ?? 1) * Math.exp(-event.deltaY * 0.0012));
  }
}, { passive: false });

/** Exports the cover at full size as a PNG download. */
export function exportCover() {
  return new Promise((resolve) => {
    const size = SIZES[state.size];
    const out = renderCover(state, state.size);
    out.toBlob((blob) => {
      if (!blob) { status.textContent = 'Export failed — try again.'; resolve(null); return; }
      window.__lastExport = { w: size.w, h: size.h, bytes: blob.size, type: blob.type };
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neon-coast-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      status.textContent = `Saved neon-coast-${size.w}x${size.h}.png (${Math.round(blob.size / 1024)} KB).`;
      resolve(window.__lastExport);
    }, 'image/png');
  });
}
$('export').addEventListener('click', exportCover);

// Re-draw once the vendored display fonts arrive, so lettering uses them.
if (document.fonts?.ready) {
  document.fonts.load('900 100px "Neon Coast Black"');
  document.fonts.load('800 100px "Neon Coast Display"');
  document.fonts.load('italic 800 40px "Neon Coast Serif"');
  document.fonts.ready.then(() => redraw());
}

// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone; ?shot=export runs an
// export and records its size in window.__lastExport. window.__shotReady is
// set once the scene has painted.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, { state, loadImage, addPhoto, redraw, exportCover, setState: (patch) => Object.assign(state, patch) });
} else {
  redraw();
}

// Handle for headless checks: the live state and a redraw.
window.__neonCoast = { state, redraw, exportCover, get selectedPanel() { return selectedPanel; } };
