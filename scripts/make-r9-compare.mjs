/**
 * R9 修改前后对比图：同视口、同机位脚本。
 * 用法：node scripts/make-r9-compare.mjs
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const pairs = [
  { id: "01-entry", title: "初始进入 · 同机位" },
  { id: "03-plaza-top", title: "中央广场 · 同朝向（行走位置略异）" },
  { id: "05-north-road", title: "北径探索 · 同朝向（行走位置略异）" },
  { id: "06-side", title: "CS 回望主岛 · 同机位" },
  { id: "07-agehaos-arrival", title: "AgehaOS 抵达 · 同机位" },
];

await mkdir("screenshots/r9/compare", { recursive: true });

const label = (text, x, y, size = 28, color = "#10294B", width = 1840) =>
  Buffer.from(
    `<svg width="${width}" height="80" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="600" fill="${color}">${text}</text>
    </svg>`,
  );

for (const pair of pairs) {
  const panelWidth = 900;
  const panelHeight = Math.round((panelWidth * 900) / 1440);
  const before = await sharp(`screenshots/r9/before/${pair.id}.png`)
    .resize(panelWidth, panelHeight)
    .toBuffer();
  const after = await sharp(`screenshots/r9/after-prod/${pair.id}.png`)
    .resize(panelWidth, panelHeight)
    .toBuffer();
  const gap = 24;
  const margin = 20;
  const header = 52;
  const width = panelWidth * 2 + gap + margin * 2;
  const height = panelHeight + header + margin * 2;
  await sharp({
    create: { width, height, channels: 3, background: "#EAF5FD" },
  })
    .composite([
      { input: label(pair.title, margin, 36, 28) },
      { input: label("R8 · 修改前", margin, header + 24, 22, "#4B668A") },
      { input: label("R9 · 修改后", panelWidth + gap + margin, header + 24, 22, "#1A64BE") },
      { input: before, left: margin, top: header + 34 },
      { input: after, left: margin + panelWidth + gap, top: header + 34 },
    ])
    .png()
    .toFile(`screenshots/r9/compare/${pair.id}.png`);
  console.log(`screenshots/r9/compare/${pair.id}.png`);
}

// 移动端：R8 最终移动端入口 vs R9 生产移动端入口
const mobileWidth = 450;
const mobileHeight = Math.round((mobileWidth * 844) / 390);
const beforeMobile = await sharp("screenshots/r8/final-mobile/mobile-01-entry.png")
  .resize(mobileWidth, mobileHeight)
  .toBuffer();
const afterMobile = await sharp("screenshots/r9/mobile-prod/mobile-01-entry.png")
  .resize(mobileWidth, mobileHeight)
  .toBuffer();
const mgap = 24;
const mmargin = 20;
const mheader = 60;
const mwidth = mobileWidth * 2 + mgap + mmargin * 2;
const mheight = mobileHeight + mheader + mmargin * 2;
await sharp({
  create: { width: mwidth, height: mheight, channels: 3, background: "#EAF5FD" },
})
  .composite([
    { input: label("移动端主场景 · 同视口 390×844", mmargin, 38, 26, "#10294B", mwidth) },
    { input: label("R8 · 修改前", mmargin, mheader + 22, 20, "#4B668A", mwidth) },
    { input: label("R9 · 修改后", mobileWidth + mgap + mmargin, mheader + 22, 20, "#1A64BE", mwidth) },
    { input: beforeMobile, left: mmargin, top: mheader + 32 },
    { input: afterMobile, left: mmargin + mobileWidth + mgap, top: mheader + 32 },
  ])
  .png()
  .toFile("screenshots/r9/compare/mobile-01-entry.png");
console.log("screenshots/r9/compare/mobile-01-entry.png");
