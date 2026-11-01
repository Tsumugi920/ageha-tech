/**
 * 生成 R8 修改前后 / 状态对照图（同视口、同机位优先）。
 * 用法：node scripts/make-r8-compare.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const outDir = "screenshots/r8/compare";
await mkdir(outDir, { recursive: true });

async function compare(a, b, out, { width = 720, labelA, labelB, note, crop } = {}) {
  const read = async (file) => {
    let image = sharp(file);
    if (crop) image = image.extract(crop);
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

const R7 = "screenshots/r7/final";
const R8 = "screenshots/r8/final";

await compare(`${R7}/01-entry.png`, `${R8}/01-entry.png`, `${outDir}/01-entry.png`, {
  width: 720,
  labelA: "BEFORE · R7 初始",
  labelB: "AFTER · R8 初始",
  note: "1440×900 · 同一出生点 / 相机档位。R8：植被与岩簇收成西岭 / 东池 / 北径口三组，清理孤立装饰与漂浮碎屑。左下操作提示按设计 8s 后收成 ?，R7/R8 截图等待时长不同导致该 HUD 状态不同。",
});

await compare(`${R7}/03-plaza-top.png`, `${R8}/03-plaza-top.png`, `${outDir}/03-plaza-top.png`, {
  width: 720,
  labelA: "BEFORE · R7 广场 / 道路",
  labelB: "AFTER · R8 广场 / 道路",
  note: "同一输入序列与相机档位。中央广场增强石环 / 基座对比，广场外只保留成组植被。",
});

await compare(`${R7}/04-north-road.png`, `${R8}/04-north-road.png`, `${outDir}/04-north-road.png`, {
  width: 720,
  labelA: "BEFORE · R7 北径",
  labelB: "AFTER · R8 北径",
  note: "同一输入序列与相机档位。北径西侧补一块低伏伴石、东侧保留霜松 / 冰冠乔木，道路引导不变。",
});

await compare(`${R7}/05-side.png`, `${R8}/05-side.png`, `${outDir}/05-side.png`, {
  width: 700,
  labelA: "BEFORE · R7 CS 回望主岛",
  labelB: "AFTER · R8 CS 回望主岛",
  note: "同一输入序列（yaw −1.049 / pitch 0.372 / 档位 1）。R7 相机停在 CS 观测环内，被斜撑 / 竖屏挡满前景；R8 相机被观测环遮挡体前移。",
});

await compare(`${R7}/05-side-crop.png`, `${R8}/05-side-crop.png`, `${outDir}/05-side-crop.png`, {
  width: 620,
  labelA: "BEFORE · R7 遮挡位裁剪",
  labelB: "AFTER · R8 遮挡位裁剪",
  note: "同一裁剪区域（主岛中心）。R8 主岛顶部保留广场焦点，外围树木成组、碎屑减少。",
});

await compare(`${R7}/06-agehaos-arrival.png`, `${R8}/06-agehaos-arrival.png`, `${outDir}/06-agehaos-arrival.png`, {
  width: 720,
  labelA: "BEFORE · R7 AgehaOS 远景",
  labelB: "AFTER · R8 AgehaOS 远景",
  note: "同一输入序列。终端塔与主岛均未重做；确认 R8 遮挡体未改变 AgehaOS 到达构图。",
});

await compare(`${R7}/07-agehaos-near.png`, `${R8}/07-agehaos-near.png`, `${outDir}/07-agehaos-near.png`, {
  width: 720,
  labelA: "BEFORE · R7 AgehaOS 近景",
  labelB: "AFTER · R8 AgehaOS 近景",
  note: "同一输入序列。项目详情入口与交互提示保持原样。",
});

await compare(`${R8}/01-entry.png`, `${R8}/08-return.png`, `${outDir}/08-return.png`, {
  width: 720,
  labelA: "R8 · 01 初始",
  labelB: "R8 · 08 返回起点",
  note: "返回后玩家 (6.5, 0.35, 7)、相机档位 yaw 0.55 / pitch 0.24 / 距离 2 全部复位；相机位置收敛偏差小于 0.03m。",
});
