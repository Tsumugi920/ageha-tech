/**
 * 生成 R3 → R4 同状态前后对比图（side-by-side + 标签）。
 * 依赖工作区内的 sharp（Next 可选依赖）；截图路径来自 screenshots/。
 * 用法：node scripts/make-r4-compare.mjs
 */
import sharp from "sharp";
import { copyFile, mkdir } from "node:fs/promises";

const outDir = "screenshots/r4-final/compare";
await mkdir(outDir, { recursive: true });

async function compare(a, b, out, targetW) {
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
    <text x="16" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10294B">R3 · BEFORE</text>
    <text x="${targetW + gap + 16}" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10294B">R4 · AFTER</text>
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
  "screenshots/r3-final/desktop/desktop-01-entry.png",
  "screenshots/r4-final/desktop-1440/desktop-1440-01-entry-intro.png",
  `${outDir}/01-entry-1440-intro.png`,
  720,
);
await compare(
  "screenshots/r3-final/prod-2560/02-entry-scene.png",
  "screenshots/r4-final/desktop-2560/desktop-2560-02-entry-scene.png",
  `${outDir}/02-entry-2560.png`,
  1280,
);
await compare(
  "screenshots/r3-final/desktop/desktop-04-agehaos.png",
  "screenshots/r4-final/desktop-1440/landmark-agehaos.png",
  `${outDir}/03-agehaos-1440.png`,
  720,
);
await compare(
  "screenshots/r3-final/prod-1440/05-moss.png",
  "screenshots/r4-final/desktop-1440/landmark-moss.png",
  `${outDir}/04-moss-1440.png`,
  720,
);
await compare(
  "screenshots/r3-final/prod-mobile/02-entry-scene.png",
  "screenshots/r4-final/mobile-390/mobile-390-02-entry-scene.png",
  `${outDir}/05-mobile-entry.png`,
  390,
);
await compare(
  "screenshots/r3-final/prod-mobile/01-entry-intro.png",
  "screenshots/r4-final/mobile-390/mobile-390-01-entry-intro.png",
  `${outDir}/06-mobile-intro.png`,
  390,
);
await compare(
  "screenshots/r3-final/prod-mobile/03-project-detail.png",
  "screenshots/r4-final/mobile-390/mobile-390-04-detail.png",
  `${outDir}/07-mobile-detail.png`,
  390,
);

const copies = [
  ["screenshots/r4-final/desktop-1440/desktop-1440-02-entry-scene.png", "screenshots/r4-final/01-desktop-1440-entry.png"],
  ["screenshots/r4-final/desktop-2560/desktop-2560-02-entry-scene.png", "screenshots/r4-final/02-desktop-2560-entry.png"],
  ["screenshots/r4-final/desktop-1440/butterfly-close.png", "screenshots/r4-final/03-butterfly-close.png"],
  ["screenshots/r4-final/desktop-1440/landmark-agehaos.png", "screenshots/r4-final/04-agehaos.png"],
  ["screenshots/r4-final/desktop-1440/landmark-moss.png", "screenshots/r4-final/05-moss.png"],
  ["screenshots/r4-final/desktop-1440/landmark-cs.png", "screenshots/r4-final/06-cs.png"],
  ["screenshots/r4-final/mobile-390/mobile-390-02-entry-scene.png", "screenshots/r4-final/07-mobile-entry.png"],
  ["screenshots/r4-final/mobile-390/mobile-390-01-entry-intro.png", "screenshots/r4-final/08-mobile-intro.png"],
  ["screenshots/r4-final/mobile-390/mobile-390-04-detail.png", "screenshots/r4-final/09-mobile-detail.png"],
  ["screenshots/r4-final/mobile-390x667/resize-667-panel.png", "screenshots/r4-final/10-mobile-390x667-panel.png"],
];
for (const [from, to] of copies) {
  await copyFile(from, to);
}
console.log("copied key images");