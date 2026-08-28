// Regenerates the raster logo assets from logo.svg, which is the single source
// of truth for the mark.
//
//   node scripts/generate-seo-images.mjs
//
// Outputs:
//   logo.png                             1024x1024 RGBA, general-purpose raster
//   docs/.vuepress/public/images/og-card.png  1200x630 flattened link-share card
//
// The card is a separate asset rather than logo.png because link-share
// scrapers need an opaque 1.91:1 image: they composite alpha against their own
// background (Discord dark, Slack/Twitter light), and this mark's star field
// and thin orbit ring are near-white, so they disappear on light backdrops.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG = join(ROOT, 'logo.svg');

// Card layout. The logo and text form one visually centred group:
// LOGO_SIZE (trimmed) + GAP + text width, centred in CARD_W.
const CARD_W = 1200;
const CARD_H = 630;
const LOGO_BOX = 480;
const GAP = 66;

// Diagonal brand gradient sampled from the logo's own backdrop, darkened so
// white type clears WCAG AA across the whole field (7.6:1 at the text, 5.5:1
// against the lightest corner).
const BG_DARK = '#2A2E3E';
const BG_LIGHT = '#5D6587';

const TITLE = 'Musebot';
const TAGLINE = 'Generative AI for Discord';

// Font stack rather than a single family: this runs on developer machines, not
// in CI, so it falls back through the common sans-serifs.
const FONTS = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

const svg = readFileSync(SVG);

/** Renders logo.svg at n x n with enough DPI that curves stay clean. */
function renderLogo(n) {
  return sharp(svg, { density: Math.ceil((96 * n) / 1024) * 4 }).resize(n, n);
}

// sharp's trim() is useless here: the faint outer star dots carry low but
// non-zero alpha out to the canvas edge, so it reports no border to remove at
// any threshold. Find the ink box directly from the alpha channel instead,
// ignoring pixels below ALPHA_FLOOR so a stray 1/255 dot cannot defeat it.
const ALPHA_FLOOR = 8;

async function trimToInk(buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + channels - 1] < ALPHA_FLOOR) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) throw new Error('logo.svg rendered fully transparent');

  return sharp(buf)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
}

async function buildLogoPng() {
  const out = join(ROOT, 'logo.png');
  await renderLogo(1024).png({ compressionLevel: 9 }).toFile(out);
  return out;
}

async function buildOgCard() {
  // Trim the transparent margin so the group is centred on actual ink, not on
  // the SVG's square viewBox.
  const logo = await trimToInk(await renderLogo(LOGO_BOX).png().toBuffer());
  const { width: lw, height: lh } = await sharp(logo).metadata();

  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
       <text x="0" y="104" font-family="${FONTS}" font-size="104" font-weight="700" fill="#FAFCFB">${TITLE}</text>
       <text x="4" y="176" font-family="${FONTS}" font-size="40" font-weight="300" fill="#CBD3E8">${TAGLINE}</text>
     </svg>`,
  );
  const text = await trimToInk(await sharp(textSvg).png().toBuffer());
  const { width: tw, height: th } = await sharp(text).metadata();

  const groupW = lw + GAP + tw;
  const x0 = Math.round((CARD_W - groupW) / 2);
  // Centre the group as a whole, then centre each element on that shared
  // midline. Centring the two independently makes the shorter text block drift
  // relative to the logo.
  const midY = Math.round(CARD_H / 2);

  const background = {
    create: {
      width: CARD_W,
      height: CARD_H,
      channels: 4,
      background: BG_DARK,
    },
  };

  // Linear gradient from bottom-left to top-right, matching the logo's own
  // lighting axis. Drawn as an SVG so there is no rotate-and-crop step, which
  // would leave uncovered corners.
  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
       <defs>
         <linearGradient id="g" x1="0" y1="${CARD_H}" x2="${CARD_W}" y2="0" gradientUnits="userSpaceOnUse">
           <stop offset="0" stop-color="${BG_DARK}"/>
           <stop offset="1" stop-color="${BG_LIGHT}"/>
         </linearGradient>
       </defs>
       <rect width="${CARD_W}" height="${CARD_H}" fill="url(#g)"/>
     </svg>`,
  );

  const out = join(ROOT, 'docs', '.vuepress', 'public', 'images', 'og-card.png');
  await sharp(background)
    .composite([
      { input: gradient, top: 0, left: 0 },
      { input: logo, top: midY - Math.round(lh / 2), left: x0 },
      { input: text, top: midY - Math.round(th / 2), left: x0 + lw + GAP },
    ])
    // removeAlpha as well as flatten: scrapers should get a plainly opaque
    // image, with no alpha channel for them to misinterpret.
    .flatten({ background: BG_DARK })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

for (const out of [await buildLogoPng(), await buildOgCard()]) {
  const { width, height, channels } = await sharp(out).metadata();
  console.log(`${out}  ${width}x${height}  ${channels}ch`);
}
