/**
 * 3D 世界资产预处理脚本（蓝图 §11.2）：
 * 用 Next 16 内置的 sharp（node_modules/sharp，不新增 dependency）把既有
 * 真实素材重采样为场景内贴图，产物提交入库 public/world/。
 *
 * ── 来源清单（全部为仓库内既有素材，无外部下载）──────────────────────
 *  public/world/butterfly-sprite-512.png   ← 内联蝶形 SVG（app/icon.svg 四翼 path 同源，
 *                                            去掉 App 方形底板，仅保留透明底蝶形）
 *  public/world/screens/agehaos-1600.jpg   ← public/images/agehaos-desktop.jpg（AgehaOS 真实桌面截图）
 *  public/world/screens/cs-portfolio-1280.webp ← public/images/cs-market-portfolio.png（CS 模拟器线上真实界面）
 *  public/world/screens/moss-terrarium-1280.webp ← public/images/moss-world-terrarium.png（Moss World 本地运行画面）
 *  public/world/gallery/hero-clean-1024.webp  ← public/images/hero-clean.png
 *  public/world/gallery/hero-full-1024.webp   ← public/images/hero-full.png
 *  public/world/gallery/concept-art-1024.webp ← 仓库根目录 Ageha.tech未来数字世界作品集.png（概念原图，原图不动）
 * ─────────────────────────────────────────────────────────────────────
 *
 * 幂等可重跑：每次全量重生成；质量参数自动下调直至满足体积上限
 * （上限由 tests/world-assets.test.mjs statSync 数据级断言守护）。
 *
 * 运行：node scripts/prepare-world-assets.mjs
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * 蝶群精灵源：只取 app/icon.svg 的四翼 / 身体 / 触角造型，不画方形 App 底板。
 * 远景蝶群是场景氛围元素，不是应用图标；透明底才能读成「蝴蝶」而不是蓝色方块。
 */
const BUTTERFLY_SPRITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <defs>
    <linearGradient id="upper" x1="10" y1="6" x2="38" y2="42" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8FE8FF"/><stop offset="0.5" stop-color="#269DFF"/><stop offset="1" stop-color="#9C83FF"/>
    </linearGradient>
    <linearGradient id="lower" x1="12" y1="38" x2="36" y2="16" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9C83FF"/><stop offset="0.55" stop-color="#3B8BF5"/><stop offset="1" stop-color="#54E3FF"/>
    </linearGradient>
    <radialGradient id="aura" cx="0.5" cy="0.5" r="0.5">
      <stop stop-color="#8FE8FF" stop-opacity="0.22"/><stop offset="0.65" stop-color="#54E3FF" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#54E3FF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="24" cy="23" rx="20" ry="16" fill="url(#aura)"/>
  <path d="M22.6 19.6C19.4 12.6 12.6 7.2 8.2 8.4C4.6 9.4 4.4 14.4 7.6 18.4C10.6 22.2 17.4 24.2 22.6 23.2Z" fill="url(#upper)" stroke="#EAF6FF" stroke-opacity="0.45" stroke-width="0.5"/>
  <path d="M25.4 19.6C28.6 12.6 35.4 7.2 39.8 8.4C43.4 9.4 43.6 14.4 40.4 18.4C37.4 22.2 30.6 24.2 25.4 23.2Z" fill="url(#upper)" stroke="#EAF6FF" stroke-opacity="0.45" stroke-width="0.5"/>
  <path d="M22.8 25.4C18.6 25.8 13.6 27.8 12 31.2C10.6 34.4 13 37.6 16.4 36.8C19.8 36 22.4 32.2 23.4 28.2Z" fill="url(#lower)" fill-opacity="0.94"/>
  <path d="M25.2 25.4C29.4 25.8 34.4 27.8 36 31.2C37.4 34.4 35 37.6 31.6 36.8C28.2 36 25.6 32.2 24.6 28.2Z" fill="url(#lower)" fill-opacity="0.94"/>
  <path d="M22.4 19.8L11 12L13.2 19.8Z" fill="#FFFFFF" fill-opacity="0.16"/>
  <path d="M25.6 19.8L37 12L34.8 19.8Z" fill="#FFFFFF" fill-opacity="0.16"/>
  <g stroke="#EAF6FF" stroke-opacity="0.6" stroke-width="0.65" stroke-linecap="round">
    <path d="M21.8 20L9.8 12.2"/><path d="M21.4 21.6L10.4 18.6"/>
    <path d="M26.2 20L38.2 12.2"/><path d="M26.6 21.6L37.6 18.6"/>
    <path d="M22.6 26.6L14.2 31.4" stroke-opacity="0.42"/><path d="M25.4 26.6L33.8 31.4" stroke-opacity="0.42"/>
  </g>
  <circle cx="24" cy="14.6" r="2" fill="#0E2A52"/>
  <rect x="22.9" y="15.5" width="2.2" height="14" rx="1.1" fill="#0E2A52"/>
  <g stroke="#0E2A52" stroke-width="1.1" stroke-linecap="round">
    <path d="M23.2 13C21.6 10.4 19.4 8.6 16.8 8"/><path d="M24.8 13C26.4 10.4 28.6 8.6 31.2 8"/>
  </g>
  <circle cx="16.5" cy="7.8" r="1" fill="#0E2A52"/><circle cx="31.5" cy="7.8" r="1" fill="#0E2A52"/>
</svg>`;

/** 产物清单：目标 → 源 + 处理参数 + 体积上限（字节） */
const PRODUCTS = [
  {
    target: "public/world/butterfly-sprite-512.png",
    svg: BUTTERFLY_SPRITE_SVG,
    width: 512,
    format: "png",
    budget: 60 * 1024,
    // SVG 矢量栅格化需允许放大（48 箱体 → 512px；密度 768DPI 实得 512）
    density: 768,
    allowEnlargement: true,
  },
  {
    target: "public/world/screens/agehaos-1600.jpg",
    source: "public/images/agehaos-desktop.jpg",
    width: 1600,
    format: "jpg",
    quality: 78,
    budget: 350 * 1024,
  },
  {
    target: "public/world/screens/cs-portfolio-1280.webp",
    source: "public/images/cs-market-portfolio.png",
    width: 1280,
    format: "webp",
    quality: 82,
    budget: 300 * 1024,
  },
  {
    target: "public/world/screens/moss-terrarium-1280.webp",
    source: "public/images/moss-world-terrarium.png",
    width: 1280,
    format: "webp",
    quality: 82,
    budget: 300 * 1024,
  },
  {
    target: "public/world/gallery/hero-clean-1024.webp",
    source: "public/images/hero-clean.png",
    width: 1024,
    format: "webp",
    quality: 82,
    budget: 250 * 1024,
  },
  {
    target: "public/world/gallery/hero-full-1024.webp",
    source: "public/images/hero-full.png",
    width: 1024,
    format: "webp",
    quality: 82,
    budget: 250 * 1024,
  },
  {
    target: "public/world/gallery/concept-art-1024.webp",
    source: "Ageha.tech未来数字世界作品集.png",
    width: 1024,
    format: "webp",
    quality: 82,
    budget: 250 * 1024,
  },
];

/** 生成一个产物；有损格式在超限时逐级降质（下限 55）重试 */
async function buildProduct(product) {
  const sourceBuffer = product.svg
    ? Buffer.from(product.svg)
    : readFileSync(path.join(projectRoot, product.source));
  const targetPath = path.join(projectRoot, product.target);
  mkdirSync(path.dirname(targetPath), { recursive: true });

  let pipeline = sharp(sourceBuffer, { density: product.density ?? 300 }).resize({
    width: product.width,
    withoutEnlargement: !product.allowEnlargement,
  });
  if (product.format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true });
    const output = await pipeline.toBuffer();
    writeFileSync(targetPath, output);
    return output.length;
  }

  let quality = product.quality;
  let output = await pipeline.clone()[product.format === "jpg" ? "jpeg" : "webp"]({
    quality,
  }).toBuffer();
  while (output.length > product.budget && quality > 55) {
    quality -= 6;
    output = await pipeline.clone()[product.format === "jpg" ? "jpeg" : "webp"]({
      quality,
    }).toBuffer();
  }
  writeFileSync(targetPath, output);
  return output.length;
}

let failed = false;
for (const product of PRODUCTS) {
  const size = await buildProduct(product);
  const budgetKb = Math.round(product.budget / 102.4) / 10;
  const sizeKb = Math.round(size / 102.4) / 10;
  const ok = size <= product.budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? "OK " : "OVER"} ${product.target}  ${sizeKb} KB / 上限 ${budgetKb} KB  ← ${product.svg ? "内联蝶形 SVG（icon.svg 翼形同源）" : product.source}`,
  );
}

if (failed) {
  console.error("存在超限产物（体积上限见蓝图 §11.2 / tests/world-assets.test.mjs）");
  process.exitCode = 1;
} else {
  console.log(`全部 ${PRODUCTS.length} 项产物就绪（public/world/）`);
}

// 自检：产物必须真实存在且非空（防御写盘失败）
for (const product of PRODUCTS) {
  const targetPath = path.join(projectRoot, product.target);
  const size = statSync(targetPath).size;
  if (size === 0) {
    console.error(`产物为空：${product.target}`);
    process.exitCode = 1;
  }
}
