// Fixed scenes for screenshots, driven by a ?shot= query:
//   ?shot=editor&photo=<sample>&caption=<text> — the editor with a photo loaded
//   ?shot=cover&photo=<sample>&caption=<text>&size=<square|portrait|wide>&layout=<...>&grade=<...>
//       — the exported cover alone, drawn by the app itself at export size
//   ?shot=export — runs an export and records it in window.__lastExport
// `photo` picks a sample (samples/<photo>.jpg); `photo2` fills the other panels.
// window.__shotReady is set once the scene has painted.
import { SIZES, defaultPanels } from './cover.js';

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

export async function runShot(shot, query, api) {
  const { state, loadImage, addPhoto, redraw, exportCover, setState } = api;
  const photoName = query.get('photo') ?? 'pier';
  const photo2Name = query.get('photo2') ?? 'boulevard';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const title = query.get('title') ?? 'NEON COAST';
  const subtitle = query.get('subtitle') ?? 'a Vice City story';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? 'square';

  // Wait for the display fonts so the shot shows the real lettering.
  if (document.fonts?.ready) {
    await Promise.all([
      document.fonts.load('900 100px "Neon Coast Black"'),
      document.fonts.load('800 100px "Neon Coast Display"'),
      document.fonts.load('italic 800 40px "Neon Coast Serif"'),
    ]).catch(() => {});
  }

  const first = await loadImage(`samples/${photoName}.jpg`);
  addPhoto(first, `samples/${photoName}.jpg`);
  if (query.get('photo2') !== 'none') {
    const second = await loadImage(`samples/${photo2Name}.jpg`);
    addPhoto(second, `samples/${photo2Name}.jpg`);
  }
  setState({ layout, grade, size, title, subtitle, caption });
  // Rebuild the panels for the chosen layout, spreading the two sample
  // photos across them, so the cover reads as a multi-photo collage.
  const fresh = defaultPanels(layout);
  fresh.forEach((p, i) => { p.photo = i % 2; });
  state.panels = fresh;
  // Sync the choice buttons with the scene's layout, grade and size.
  for (const [id, key, value] of [['layouts', 'layout', layout], ['grades', 'grade', grade], ['sizes', 'size', size]]) {
    document.getElementById(id).querySelectorAll('.choice').forEach((c) => {
      c.classList.toggle('active', c.dataset[key] === value);
    });
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('title').value = title;
    document.getElementById('subtitle').value = subtitle;
    document.getElementById('caption').value = caption;
    const canvas = document.getElementById('stage');
    canvas.width = SIZES[size].w;
    canvas.height = SIZES[size].h;
  } else if (shot === 'editor') {
    document.body.classList.add('shot-editor');
    document.getElementById('title').value = title;
    document.getElementById('subtitle').value = subtitle;
    document.getElementById('caption').value = caption;
  }
  redraw();
  if (shot === 'export') {
    await exportCover();
  }
  markReady();
}
