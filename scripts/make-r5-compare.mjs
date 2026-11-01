/**
 * 生成 R4 → R5 同状态前后对比图（side-by-side + 标签）。
 * 用法：node scripts/make-r5-compare.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const outDir = "screenshots/r5-final/compare";
await mkdir(outDir, { recursive: true });

async function compare(a, b, out, targetW, labelA = "R4 · BEFORE", labelB = "R5 · AFTER") {
  const metaA = await sharp(a).metadata();
  const height = Math.round((targetW * metaA.height) / metaA.width);
  const imageA = await sharp(a).resize(targetW, height, { fit: "fill" }).png().toBuffer();
  const imageB = await sharp(b).resize(targetW, height, { fit: "fill" }).png().toBuffer();
  const gap = 14;
  const labelH = 42;
  const totalW = targetW * 2 + gap;
  const totalH = height + labelH;
  const labels = `<svg width="${totalW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${totalW}" height="${labelH}" fill="#F2F8FF"/>
    <text x="16" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10294B">${labelA}</text>
    <text x="${targetW + gap + 16}" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10294B">${labelB}</text>
  </svg>`;
  await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: "#F2F8FF" },
  })
    .composite([
      { input: Buffer.from(labels), left: 0, top: 0 },
      { input: imageA, left: 0, top: labelH },
      { input: imageB, left: targetW + gap, top: labelH },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await compare(
  "screenshots/r4-final/01-desktop-1440-entry.png",
  "screenshots/r5-final/01-entry-1440.png",
  `${outDir}/01-entry-1440.png`,
  720,
);
await compare(
  "screenshots/r4-final/04-agehaos.png",
  "screenshots/r5-final/02-agehaos-1440.png",
  `${outDir}/02-agehaos-1440.png`,
  720,
);

/** 局部裁切对比：用于看清同一构图里的蝶群图标 / 环境细节 */
async function compareRegion(a, b, out, region, scale = 1) {
  const width = Math.round(region.width * scale);
  const height = Math.round(region.height * scale);
  const imageA = await sharp(a).extract(region).resize(width, height, { fit: "fill" }).png().toBuffer();
  const imageB = await sharp(b).extract(region).resize(width, height, { fit: "fill" }).png().toBuffer();
  const gap = 14;
  const labelH = 42;
  const totalW = width * 2 + gap;
  const totalH = height + labelH;
  const labels = `<svg width="${totalW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${totalW}" height="${labelH}" fill="#F2F8FF"/>
    <text x="16" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10294B">R4 · BEFORE · 蝶群图标</text>
    <text x="${width + gap + 16}" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10294B">R5 · AFTER · 蝶群图标</text>
  </svg>`;
  await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: "#F2F8FF" },
  })
    .composite([
      { input: Buffer.from(labels), left: 0, top: 0 },
      { input: imageA, left: 0, top: labelH },
      { input: imageB, left: width + gap, top: labelH },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await compareRegion(
  "screenshots/r4-final/01-desktop-1440-entry.png",
  "screenshots/r5-final/01-entry-1440.png",
  `${outDir}/03-flock-icons-crop.png`,
  { left: 220, top: 270, width: 760, height: 280 },
  1,
);
