/**
 * 3D 世界资产预处理脚本（蓝图 §11.2）：
 * 用 Next 16 内置的 sharp（node_modules/sharp，不新增 dependency）把既有
 * 真实素材重采样为场景内贴图，产物提交入库 public/world/。
 *
 * ── 来源清单（全部为仓库内既有素材，无外部下载）──────────────────────
 *  public/world/butterfly-sprite-512.png   ← app/icon.svg（站点图标栅格化，透明底保留）
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

/** 产物清单：目标 → 源 + 处理参数 + 体积上限（字节） */
const PRODUCTS = [
  {
    target: "public/world/butterfly-sprite-512.png",
    source: "app/icon.svg",
    width: 512,
    format: "png",
    budget: 60 * 1024,
    // SVG 矢量栅格化需允许放大（48 箱体 → 512px；密度 768DPI 实得 512，
    // 阶段 3 修复：此前 density 300 + withoutEnlargement 只得 200px）
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
  const sourceBuffer = readFileSync(path.join(projectRoot, product.source));
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
    `${ok ? "OK " : "OVER"} ${product.target}  ${sizeKb} KB / 上限 ${budgetKb} KB  ← ${product.source}`,
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
