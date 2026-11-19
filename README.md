# Neon Coast Cover Maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/meviusorg5799/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/meviusorg5799/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns your photo and a caption into GTA 6-style cover
art — the multi-panel poster look with bold lettering and a Vice City sunset /
neon colour grade — and exports it as a PNG to share.

Built for the make.fun bounty **[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01)**.

## How it works

1. **Add a photo** — picked from your machine with a file picker. Photos are
   read locally and never uploaded anywhere.
2. **Pick a layout** — Hero + 3, Grid 2 × 2, Strip × 3, or Full bleed. Several
   panels can hold one photo or several.
3. **Frame each panel** — click a panel to select it, drag to move its photo,
   scroll (or use the slider) to zoom, reset any time.
4. **Write the words** — editable title, subtitle and caption, in bold
   condensed lettering drawn on the cover.
5. **Choose a grade and a size** — Sunset, Neon Night or Vice Coast;
   1080 × 1080, 1080 × 1350 or 1920 × 1080.
6. **Export PNG** — one click downloads the cover at full size.

Everything is drawn on a canvas from scratch: gradient sunset skies, a
glowing sun, palm silhouettes, neon panel frames, grain and vignette. No
Rockstar Games logo, artwork or font is used anywhere — the lettering is
Noto Sans (SIL Open Font License 1.1, vendored under `app/fonts/`).

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `app/` is plain static files.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-app.ts` library.

## License

MIT — see [LICENSE](./LICENSE). Fonts under `app/fonts/` are Noto Sans /
Noto Serif under the SIL Open Font License 1.1 (see `app/fonts/OFL.txt`).
