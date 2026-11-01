/**
 * 生成 R7 主岛地形前后对比图（同视口 / 同机位优先，裁剪区域已标注）。
 * 用法：node scripts/make-r7-compare.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const outDir = "screenshots/r7/compare";
await mkdir(outDir, { recursive: true });

async function compare(a, b, out, { width = 720, left = 0, top = 0, cropW, cropH, labelA, labelB, note } = {}) {
  const read = async (file) => {
    let image = sharp(file);
    if (cropW && cropH) {
      image = image.extract({ left, top, width: cropW, height: cropH });
    }
    const meta = await image.metadata();
    const height = Math.round((width * meta.height) / meta.width);
    return image.resize(width, height, { fit: "fill" }).png().toBuffer();
  };
  const imageA = await read(a);
  const imageB = await read(b);
  const metaA = await sharp(imageA).metadata();
  const height = metaA.height;
  const gap = 14;
  const labelH = note ? 68 : 42;
  const totalW = width * 2 + gap;
  const totalH = height + labelH;
  const labels = `<svg width="${totalW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${totalW}" height="${labelH}" fill="#F2F8FF"/>
    <text x="16" y="27" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#10294B">${labelA}</text>
    <text x="${width + gap + 16}" y="27" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#10294B">${labelB}</text>
    ${note ? `<text x="16" y="52" font-family="Arial, sans-serif" font-size="12" fill="#4B668A">${note}</text>` : ""}
  </svg>`;
  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: "#F2F8FF" } })
    .composite([
      { input: Buffer.from(labels), left: 0, top: 0 },
      { input: imageA, left: 0, top: labelH },
      { input: imageB, left: width + gap, top: labelH },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await compare(
  "screenshots/r51-final/after/01-entry.png",
  "screenshots/r7/final/01-entry.png",
  `${outDir}/01-entry.png`,
  {
    width: 720,
    labelA: "BEFORE · 生产构建 · R6 + R5.1 基线",
    labelB: "AFTER · 生产构建 · R7",
    note: "1440×900 · 出生点初始机位完全一致（player 6.5 / 7，yaw 0.55，pitch 0.24，距离档 2）。",
  },
);

await compare(
  "screenshots/r7/before/02-rim-low.png",
  "screenshots/r7/final/02-rim-low.png",
  `${outDir}/02-rim-low.png`,
  {
    width: 720,
    left: 120,
    top: 0,
    cropW: 1320,
    cropH: 900,
    labelA: "BEFORE · 南缘低机位（裁剪）",
    labelB: "AFTER · 南缘低机位（裁剪）",
    note: "同机位：yaw 0.382，pitch 0.14，距离档 2。观察雪檐与侧壁连接；已裁掉 BEFORE 左下角开发角标。",
  },
);

await compare(
  "screenshots/r7/before/03-plaza-top.png",
  "screenshots/r7/final/03-plaza-top.png",
  `${outDir}/03-plaza-top.png`,
  {
    width: 680,
    left: 120,
    top: 60,
    cropW: 1320,
    cropH: 780,
    labelA: "BEFORE · 广场 / 道路（裁剪）",
    labelB: "AFTER · 广场 / 道路（裁剪）",
    note: "同一输入序列与机位档位；BEFORE 为开发态截图，已裁掉左下角 Next 开发角标。",
  },
);

await compare(
  "screenshots/r7/before/05-side.png",
  "screenshots/r7/final/05-side.png",
  `${outDir}/04-side.png`,
  {
    width: 700,
    left: 300,
    top: 100,
    cropW: 850,
    cropH: 530,
    labelA: "BEFORE · CS 屿回望主岛",
    labelB: "AFTER · CS 屿回望主岛",
    note: "回望机位 yaw −0.90 → −1.05（本轮脚本将主岛重新居中），其余档位一致；裁剪同一区域。",
  },
);
