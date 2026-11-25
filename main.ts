// The World in One Day — Tuesday 24 November 2026.
// A zero-dependency Node program that draws one deterministic 1024x1024 PNG
// summarising the verified world news of 24 November 2026 and writes it to
// $MAKEFUN_OUTPUT_DIR/entry.png (default: ./out/entry.png).
// Every story below was checked against reporting dated 24 November 2026
// (Reuters, AP, BBC, The Guardian, Anadolu, Euronews, Xinhua, Dawn).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- PNG ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb: Buffer, w: number, h: number): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- canvas ----
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [16, 35, 63];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [179, 38, 30];
const TEAL: RGB = [14, 124, 123];
const AMBER: RGB = [199, 125, 10];
const BLUE: RGB = [31, 95, 168];
const GREEN: RGB = [46, 125, 50];
const PURPLE: RGB = [106, 76, 147];
const GREY: RGB = [110, 110, 105];
const LIGHT: RGB = [232, 226, 214];

class Canvas {
  buf: Buffer;
  w: number;
  h: number;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3);
    this.fill(0, 0, w, h, bg);
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fill(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    this.fill(x, y, w, 1, c);
    this.fill(x, y + h - 1, w, 1, c);
    this.fill(x, y, 1, h, c);
    this.fill(x + w - 1, y, 1, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
}

// ------------------------------------------------------- 5x7 bitmap font ----
// Each glyph: 7 rows of 5 pixels. Uppercase + digits + common punctuation.
const FONT: Record<string, string[]> = {
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  ";": [".....", "..#..", ".....", ".....", ".....", "..#..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "..#..", "..#..", ".....", "..#.."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#.#.", "#.#.#"],
  "&": [".###.", "#...#", "#...#", ".#.#.", "#.#..", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  "*": [".....", ".#.#.", ".###.", "#####", ".###.", ".#.#.", "....."],
  $: ["..#..", ".####", "#.#.#", ".###.", "..#.#", "####.", "..#.."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = FONT[up[i]] ?? FONT[" "];
    const ox = x + i * 6 * scale;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "#") cv.fill(ox + col * scale, y + r * scale, scale, scale, c);
  }
}
function wrap(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + (cur ? " " : "") + w).length <= maxChars) cur += (cur ? " " : "") + w;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(cv: Canvas, s: string, x: number, y: number, maxChars: number, scale: number, c: RGB, maxLines: number): number {
  const lines = wrap(s, maxChars).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(cv, ln, x, y + i * 9 * scale, scale, c));
  return lines.length;
}

// ------------------------------------------------------------ the news ----
// Region colours (one dot per region, used in the "also today" strip).
const REGION_COLOR: Record<string, RGB> = {
  "MIDDLE EAST": RED,
  EUROPE: BLUE,
  AFRICA: GREEN,
  ASIA: PURPLE,
  "N. AMERICA": TEAL,
  "LATIN AMERICA": AMBER,
  OCEANIA: [14, 110, 160],
  SPORT: [190, 60, 120],
  SCIENCE: [90, 90, 90],
  MARKETS: [120, 90, 20],
};

type Lead = { tag: string; color: RGB; head: string; sub: string; icon: string };
const LEADS: Lead[] = [
  {
    tag: "MIDDLE EAST",
    color: RED,
    head: "THREE TANKERS ABLAZE AFTER MINE STRIKES",
    sub: "Iran's navy says mines hit three tankers in the Strait of Hormuz; US air cover failed to stop it.",
    icon: "tanker",
  },
  {
    tag: "TECH / USA",
    color: BLUE,
    head: "TRUMP RESTORES JENSEN HUANG AS NVIDIA CHIEF",
    sub: "President called the board on Sunday; shares soared 31% on Monday, then fell 6% on Tuesday.",
    icon: "chip",
  },
  {
    tag: "GAZA",
    color: AMBER,
    head: "ISRAELI STRIKE KILLS HAMAS SECURITY CHIEF",
    sub: "Naeem Abu Nahel killed in Gaza City; three more die at a police post in Khan Younis.",
    icon: "burst",
  },
];

type Grid = { tag: string; color: RGB; head: string; sub: string };
const GRID: Grid[] = [
  { tag: "UKRAINE", color: BLUE, head: "TWO KILLED AS RUSSIAN STRIKE HITS ZAPORIZHZHIA FLATS", sub: "40 wounded, four of them children, as strikes continue." },
  { tag: "COLOMBIA", color: AMBER, head: "CAR BOMB WOUNDS 24 IN CENTRAL COLOMBIA", sub: "Blast at the Meta government HQ in Villavicencio; no deaths reported." },
  { tag: "SENEGAL", color: GREEN, head: "SENEGAL REGAIN AFCON TITLE ON APPEAL", sub: "CAS overturns the ruling that gave the trophy to Morocco." },
  { tag: "FOOTBALL", color: [190, 60, 120], head: "USA TO HOST 2031 WOMEN'S WORLD CUP", sub: "FIFA picks the US, Mexico, Costa Rica and Jamaica; the UK gets 2035." },
  { tag: "FRANCE", color: BLUE, head: "SANOFI IN $41BN TAKEOVER OF INSMED", sub: "French drugmaker buys the US biotech to refill its pipeline." },
  { tag: "USA", color: TEAL, head: "HUAWEI GUILTY OF STEALING TRADE SECRETS", sub: "US jury convicts the tech giant, clears it of racketeering." },
  { tag: "DR CONGO", color: GREEN, head: "CONGO HALTS COBALT EXPORTS AGAIN", sub: "World's biggest producer suspends shipments from 30 November." },
  { tag: "CUBA", color: AMBER, head: "CUBA LIFE EXPECTANCY FALLS FOR FIRST TIME SINCE 1950", sub: "WHO: down from 78.8 years in 2020 to 74.4 in 2025." },
  { tag: "SUDAN", color: GREEN, head: "RSF DRONES HIT KHARTOUM AS GRID NEARS COLLAPSE", sub: "Army says it intercepted drones; airport and a UN building struck." },
  { tag: "SPACE", color: [90, 90, 90], head: "MOST DISTANT QUASAR EVER FOUND", sub: "Astronomers spot a galactic core from 630m years after the Big Bang." },
];

// One-line briefs, three columns of eight. Each line: [region, headline].
const ALSO: [string, string][] = [
  ["EUROPE", "Russia threatens 'open war' with Estonia"],
  ["EUROPE", "Russia, Ukraine clash at UN over Black Sea shipping"],
  ["EUROPE", "Zelenskyy warns of new strikes, pleads for Patriots"],
  ["EUROPE", "UK sanctions five Myanmar generals after ICJ ruling"],
  ["EUROPE", "UK heat deaths hit record 5,258 in summer 2026"],
  ["EUROPE", "Burnham: 'unthinkable' to rejoin EU without a vote"],
  ["N. AMERICA", "Canada: 'we do not report to the US'"],
  ["N. AMERICA", "US envoy doubts Israel aid ends this year"],
  ["MIDDLE EAST", "Iran vows to resist US naval blockade"],
  ["MIDDLE EAST", "Houthis: 41 civilians killed in Saudi strikes"],
  ["MIDDLE EAST", "Saudi strike on Riyadh tower injures 11"],
  ["MIDDLE EAST", "US sanctions two dozen Iranian exchange houses"],
  ["ASIA", "North Korea mulls closing Swiss office in Pyongyang"],
  ["ASIA", "Russian jets near South Korea; shelter warning"],
  ["ASIA", "Taiwan votes Saturday; Beijing denounces candidate"],
  ["ASIA", "Hasina plans return to Bangladesh on 16 December"],
  ["ASIA", "Bangladesh garment workers clash with police"],
  ["ASIA", "China and Singapore expand yuan financing"],
  ["AFRICA", "Kenya and DR Congo restore diplomatic ties"],
  ["AFRICA", "Gavi to buy 1.5m Ebola vaccine doses for Congo"],
  ["AFRICA", "300+ Russians killed backing Mali junta, leak"],
  ["AFRICA", "700,000 Russian dead in Ukraine, leak estimates"],
  ["OCEANIA", "France v Vanuatu over Pacific isles at top court"],
  ["SPORT", "Bellingham stuns PSV as Real Madrid stay perfect"],
];

// -------------------------------------------------------------- icons ----
function drawIcon(cv: Canvas, kind: string, x: number, y: number, w: number, h: number): void {
  if (kind === "tanker") {
    // Sea, hull, containers, flame.
    cv.fill(x, y + h - 22, w, 22, [31, 95, 168]);
    cv.fill(x + 8, y + h - 46, w - 16, 26, [60, 60, 60]);
    cv.fill(x + 8, y + h - 46, w - 16, 5, [179, 38, 30]);
    cv.fill(x + 20, y + h - 66, 34, 20, [199, 125, 10]);
    cv.fill(x + 60, y + h - 66, 34, 20, [14, 124, 123]);
    cv.fill(x + 100, y + h - 66, 34, 20, [106, 76, 147]);
    // Flame above the middle container.
    cv.fill(x + 112, y + 8, 10, 26, [230, 120, 20]);
    cv.fill(x + 116, y + 2, 6, 12, [250, 200, 40]);
    cv.fill(x + 140, y + 20, 8, 18, [230, 120, 20]);
    // Smoke.
    cv.disc(x + 60, y + 14, 9, [120, 120, 120]);
    cv.disc(x + 74, y + 8, 7, [140, 140, 140]);
  } else if (kind === "chip") {
    // A processor: dark square, pins, inner die. Kept small so the
    // headline below it stays clear.
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    cv.fill(cx - 28, cy - 28, 56, 56, [26, 26, 26]);
    for (let i = 0; i < 3; i++) {
      cv.fill(cx - 22 + i * 18, cy - 36, 5, 8, [120, 120, 120]);
      cv.fill(cx - 22 + i * 18, cy + 28, 5, 8, [120, 120, 120]);
      cv.fill(cx - 36, cy - 22 + i * 18, 8, 5, [120, 120, 120]);
      cv.fill(cx + 28, cy - 22 + i * 18, 8, 5, [120, 120, 120]);
    }
    cv.fill(cx - 18, cy - 18, 36, 36, [31, 95, 168]);
    drawText(cv, "AI", cx - 12, cy - 11, 2, WHITE);
    cv.fill(cx - 28, cy - 28, 56, 4, [179, 38, 30]);
  } else {
    // Burst over a skyline: three buildings and a star burst.
    cv.fill(x + 10, y + h - 40, 26, 40, [60, 60, 60]);
    cv.fill(x + 44, y + h - 62, 26, 62, [80, 80, 80]);
    cv.fill(x + 78, y + h - 48, 26, 48, [60, 60, 60]);
    cv.fill(x + 112, y + h - 34, 26, 34, [80, 80, 80]);
    const bx = x + w - 58;
    const by = y + 26;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      const x1 = bx + Math.round(Math.cos(ang) * 10);
      const y1 = by + Math.round(Math.sin(ang) * 10);
      const x2 = bx + Math.round(Math.cos(ang) * 30);
      const y2 = by + Math.round(Math.sin(ang) * 30);
      cv.line(x1, y1, x2, y2, [230, 120, 20]);
    }
    cv.disc(bx, by, 10, [250, 200, 40]);
    cv.disc(bx, by, 5, [179, 38, 30]);
  }
}

// -------------------------------------------------------------- layout ----
function main(): void {
  const cv = new Canvas(W, H, PAPER);
  const M = 16; // margin

  // Header band.
  cv.fill(0, 0, W, 100, NAVY);
  cv.fill(0, 100, W, 4, RED);
  drawText(cv, "THE WORLD IN ONE DAY", M, 14, 4, WHITE);
  drawText(cv, "TUESDAY 24 NOVEMBER 2026", M, 52, 3, [250, 200, 40]);
  const dateW = textWidth("24 NOV 2026", 3);
  cv.rect(W - M - dateW - 28, 18, dateW + 28, 64, [250, 200, 40]);
  drawText(cv, "24 NOV 2026", W - M - dateW - 14, 30, 3, [250, 200, 40]);
  drawText(cv, "THE DAY'S NEWS, IN ONE IMAGE", W - M - textWidth("THE DAY'S NEWS, IN ONE IMAGE", 1), 68, 1, WHITE);

  // Lead stories: three cards.
  const cardW = Math.floor((W - 2 * M - 16) / 3);
  const cardY = 112;
  const cardH = 196;
  LEADS.forEach((lead, i) => {
    const x = M + i * (cardW + 8);
    cv.fill(x, cardY, cardW, cardH, WHITE);
    cv.rect(x, cardY, cardW, cardH, INK);
    cv.fill(x, cardY, cardW, 26, lead.color);
    drawText(cv, lead.tag, x + 10, cardY + 9, 1, WHITE);
    drawIcon(cv, lead.icon, x + 10, cardY + 36, cardW - 20, 78);
    const headY = cardY + 122;
    drawWrapped(cv, lead.head, x + 10, headY, 25, 2, INK, 2);
    drawWrapped(cv, lead.sub, x + 10, cardY + cardH - 30, 50, 1, GREY, 2);
  });

  // Section bar: around the world.
  const secY = 320;
  cv.fill(M, secY, W - 2 * M, 30, INK);
  drawText(cv, "AROUND THE WORLD", M + 10, secY + 11, 2, WHITE);
  drawText(cv, "10 MORE STORIES THAT SHAPED THE DAY", M + 10 + textWidth("AROUND THE WORLD ", 2) + 12, secY + 11, 1, [250, 200, 40]);

  // Grid: 2 columns x 5 rows.
  const gridY = 358;
  const cellW = Math.floor((W - 2 * M - 8) / 2);
  const cellH = 76;
  GRID.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (cellW + 8);
    const y = gridY + row * (cellH + 6);
    cv.fill(x, y, cellW, cellH, WHITE);
    cv.fill(x, y, 6, cellH, g.color);
    drawText(cv, g.tag, x + 14, y + 8, 1, g.color);
    drawWrapped(cv, g.head, x + 14, y + 22, 38, 2, INK, 2);
    drawWrapped(cv, g.sub, x + 14, y + cellH - 14, 74, 1, GREY, 1);
  });

  // "Also today" band: 3 columns x 8 one-liners.
  const alsoY = 762;
  cv.fill(M, alsoY, W - 2 * M, 30, NAVY);
  drawText(cv, "ALSO ON TUESDAY", M + 10, alsoY + 11, 2, WHITE);
  drawText(cv, "24 MORE BRIEFS FROM EVERY REGION", M + 10 + textWidth("ALSO ON TUESDAY ", 2) + 12, alsoY + 11, 1, [250, 200, 40]);
  const colW = Math.floor((W - 2 * M) / 3);
  ALSO.forEach(([region, head], i) => {
    const col = Math.floor(i / 8);
    const row = i % 8;
    const x = M + col * colW + 4;
    const y = 800 + row * 24;
    const c = REGION_COLOR[region] ?? GREY;
    cv.disc(x + 4, y + 4, 4, c);
    drawText(cv, head, x + 14, y - 1, 1, INK);
  });

  // Footer.
  const footY = 996;
  cv.fill(0, footY - 2, W, 2, RED);
  drawText(cv, "SOURCES: REUTERS - AP - BBC - THE GUARDIAN - ANADOLU - EURONEWS - XINHUA - DAWN", M, footY + 8, 1, GREY);
  drawText(cv, "37 STORIES - 9 REGIONS", W - M - textWidth("37 STORIES - 9 REGIONS", 1), footY + 8, 1, GREY);

  const png = encodePNG(cv.buf, W, H);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  // Self-validation: the gate's hard limits, checked before we report.
  const back = fs.readFileSync(outPath);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!back.subarray(0, 8).equals(sig)) throw new Error("validation: bad PNG signature");
  if (back.readUInt32BE(16) !== W || back.readUInt32BE(20) !== H)
    throw new Error("validation: wrong dimensions");
  if (back.length > 1048576) throw new Error(`validation: ${back.length} bytes exceeds 1 MiB`);
  if (!back.subarray(-12).toString("ascii").includes("IEND"))
    throw new Error("validation: missing IEND");
  const sha = crypto.createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${sha})`);
  console.log(`validation: OK (1024x1024, ${png.length} bytes, PNG signature + IEND present)`);
  console.log(`stories: ${LEADS.length + GRID.length + ALSO.length} (lead ${LEADS.length}, grid ${GRID.length}, briefs ${ALSO.length})`);
}

main();
