/**
 * 世界资产纪律测试（node:test）—— 阶段 2 完成态：
 * - 全部世界渲染组件为客户端组件（SSR 安全）；
 * - 场景源码禁 troika <Text>（离线构建红线）、禁外链字体 / 纹理；
 * - world DOM 层无裸 <img>（对齐 routes.test.mjs 全站契约，§11.1）；
 * - 纹理引用只允许 public/world 与 public/images（数据层登记 + useTexture 口径）；
 * - lib/world 保持纯 TS（无 three 依赖，node --test 可直接导入）；
 * - prepare-world-assets.mjs 存在且含来源注释；§11.2 七项产物
 *   statSync 体积上限逐项断言；三屿屏幕贴图按需挂载契约（§11.2）。
 * 运行方式：npm test
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/** 递归收集目录下指定后缀文件（相对路径，正斜杠） */
function collectFiles(dir, suffixes, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, suffixes, acc);
    else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      acc.push(path.relative(projectRoot, full).replaceAll("\\", "/"));
    }
  }
  return acc;
}

const WORLD_TSX = collectFiles(path.join(projectRoot, "components", "world"), [".tsx"]);
const WORLD_ALL = collectFiles(path.join(projectRoot, "components", "world"), [".ts", ".tsx"]);

test("世界组件全部就位且均为客户端组件（SSR 安全）", () => {
  assert.ok(WORLD_TSX.length >= 10, `世界组件应已就位（实际 ${WORLD_TSX.length} 个 .tsx）`);
  for (const file of WORLD_TSX) {
    const src = readProjectFile(file);
    assert.match(
      src,
      /^"use client";/,
      `${file} 应以 "use client" 开头（3D 渲染组件 SSR 安全）`,
    );
  }
});

test("场景源码禁 troika <Text> 与外链字体（离线构建红线，蓝图 §11.1）", () => {
  for (const file of WORLD_ALL) {
    const src = readProjectFile(file);
    // drei 导入白名单：Html / useProgress 等工具，禁 <Text>（默认拉 CDN Roboto）
    const dreiImports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["@']@react-three\/drei["']/g)];
    for (const match of dreiImports) {
      const names = match[1].split(",").map((name) => name.trim().split(" as ")[0]);
      for (const name of names) {
        assert.notEqual(
          name,
          "Text",
          `${file} 不得从 drei 导入 Text（troika 拉取 CDN 字体）`,
        );
      }
    }
    assert.doesNotMatch(src, /fonts\.googleapis|fonts\.gstatic|@fontsource/, `${file} 不得引用外链字体`);
  }
});

test("世界源码与数据层零外部 URL（外链纹理 / CDN 一律禁止）", () => {
  const offenders = [];
  for (const file of [
    ...WORLD_ALL,
    ...collectFiles(path.join(projectRoot, "lib", "world"), [".ts"]),
  ]) {
    if (/https?:\/\//.test(readProjectFile(file))) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `以下世界文件包含外部 URL：${offenders.join(", ")}`);
});

test("world DOM 层无裸 <img>（图片一律 next/image，对齐全站契约）", () => {
  for (const file of WORLD_TSX) {
    const src = readProjectFile(file);
    assert.ok(!/<img[\s>]/.test(src), `${file} 不应出现裸 <img>`);
    if (/<Image[\s>]/.test(src)) {
      assert.ok(src.includes('from "next/image"'), `${file} 应从 next/image 引入 Image`);
    }
  }
});

test("纹理引用只允许 public/world 与 public/images 前缀（阶段 2 起的贴图纪律）", () => {
  for (const file of WORLD_ALL) {
    const src = readProjectFile(file);
    const textureRefs = [...src.matchAll(/(?:useTexture\(\s*|src=["'])([^"')]+)/g)]
      .map((match) => match[1])
      .filter((ref) => ref.startsWith("/") || ref.startsWith("http"));
    for (const ref of textureRefs) {
      assert.ok(
        ref.startsWith("/world/") || ref.startsWith("/images/"),
        `${file} 的纹理/图片引用 ${ref} 应指向 public/world 或 public/images`,
      );
    }
  }
});

test("lib/world 为纯 TS 数据层（无 three 依赖），public/world 产物按 §11.2 登记落位", () => {
  for (const file of collectFiles(path.join(projectRoot, "lib", "world"), [".ts"])) {
    const src = readProjectFile(file);
    assert.ok(!src.includes('from "three"'), `${file} 不应依赖 three`);
    assert.ok(statSync(path.join(projectRoot, file)).size > 0, `${file} 不应为空`);
  }
  // §11.2 产物目录结构：screens / gallery 子目录 + 蝶精灵（其余一律禁止）
  const worldAssetsDir = path.join(projectRoot, "public", "world");
  for (const entry of readdirSync(worldAssetsDir)) {
    assert.match(
      entry,
      /^(screens|gallery|butterfly-sprite-512\.png)$/,
      `public/world 下出现未登记产物 ${entry}`,
    );
  }
});

/* --------------------- §11.2 资产预处理脚本与产物体积（阶段 2） --------------------- */

/** prepare-world-assets.mjs 的产物契约：目标路径 → 体积上限（字节） */
const WORLD_ASSET_PRODUCTS = [
  { target: "public/world/butterfly-sprite-512.png", budget: 60 * 1024 },
  { target: "public/world/gallery/hero-clean-1024.webp", budget: 250 * 1024 },
  { target: "public/world/gallery/hero-full-1024.webp", budget: 250 * 1024 },
];

test("prepare-world-assets.mjs 就位：内置 sharp、幂等重跑、含来源清单注释", () => {
  const script = readProjectFile("scripts/prepare-world-assets.mjs");
  assert.match(script, /from "sharp"/, "脚本应使用内置 sharp（不新增 dependency）");
  assert.match(script, /来源清单/, "脚本头部应维护来源清单注释（素材出处可查）");
  assert.match(script, /toBuffer/, "超限时应逐级降质重试（体积上限自守）");
  // package.json 不因资产脚本新增依赖（sharp 随 Next 16 内置，蓝图 §11.1）
  const pkg = JSON.parse(readProjectFile("package.json"));
  for (const depField of ["dependencies", "devDependencies"]) {
    assert.ok(
      !(pkg[depField] && pkg[depField].sharp),
      `sharp 不应出现在 package.json ${depField}（用 Next 内置）`,
    );
  }
});

test("§11.2 产物存在且体积不超限（statSync 数据级断言，防资产膨胀回归）", () => {
  for (const product of WORLD_ASSET_PRODUCTS) {
    const filePath = path.join(projectRoot, ...product.target.split("/"));
    assert.ok(existsSync(filePath), `缺少产物 ${product.target}`);
    const size = statSync(filePath).size;
    assert.ok(size > 0, `产物 ${product.target} 不应为空文件`);
    assert.ok(
      size <= product.budget,
      `产物 ${product.target} 体积 ${(size / 1024).toFixed(1)}KB 超上限 ${(product.budget / 1024).toFixed(0)}KB（重跑 scripts/prepare-world-assets.mjs 并核查）`,
    );
  }
});

test("三屿屏幕贴图按需挂载：ProjectIsle 只在近距/高档渲染 useTexture 贴图", () => {
  const isle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(isle, /useNearPlayer/, "屏幕贴图应按玩家邻近挂载（§11.2 按需加载）");
  assert.match(isle, /screenTextures/, "应接收性能档开关（低档不加载贴图）");
  assert.match(isle, /Suspense/, "贴图加载应包 Suspense（不阻塞世界首帧）");
  // 贴图路径只允许来自数据层登记（ISLE_SCREENS / findIsleScreen）
  assert.match(isle, /findIsleScreen/, "贴图路径应来自 lib/world 登记表");
  const textureRefs = [...isle.matchAll(/useTexture\(\s*([A-Za-z_$][\w$]*)\s*\)/g)];
  assert.ok(
    textureRefs.length > 0 && textureRefs.every((m) => m[1] === "path"),
    "useTexture 只能消费数据层传入的 path 变量（禁内联路径字面量）",
  );
});

/* --------------------- 阶段 3：品牌三件套 / 材质分层 / 画廊 --------------------- */

test("butterflyShape 转换工具就位：ButterLogo 翼 path 硬编码、零 SVG 运行时依赖", () => {
  const tool = readProjectFile("components/world/objects/butterflyShape.ts");
  assert.match(tool, /ButterflyLogo\.tsx/, "应注明翼形来源（components/layout/ButterflyLogo.tsx）");
  assert.match(tool, /export function createButterflyWingShapes/, "应导出四翼 Shape 构造");
  assert.match(tool, /export function createWingPairGeometry/, "应导出翼对几何工厂");
  assert.doesNotMatch(tool, /createElementNS|<svg|DOMParser/, "运行时不得依赖 SVG 解析（零 SVG 依赖红线）");
  // 三色水晶渐变走 WORLD_COLORS.crystal（icon.svg 同源，§5.1）
  assert.match(tool, /WORLD_COLORS\.crystal/, "顶点色渐变应取 WORLD_COLORS.crystal 三色");
});

test("蝶三件套组件就位：蝶枢 / 引导蝶 / 星尘蝶群 + 动画节奏统一表", () => {
  for (const file of [
    "components/world/objects/ButterflyCore.tsx",
    "components/world/objects/GuideButterfly.tsx",
    "components/world/objects/ButterflyFlock.tsx",
  ]) {
    assert.ok(existsSync(path.join(projectRoot, file)), `缺少 ${file}`);
  }
  const core = readProjectFile("components/world/objects/ButterflyCore.tsx");
  assert.match(core, /MOTION\.coreOpenPeriod/, "蝶枢开合周期应取 MOTION 统一表（24s）");
  const guide = readProjectFile("components/world/objects/GuideButterfly.tsx");
  assert.match(guide, /GUIDE_BUTTERFLY/, "引导蝶参数应取数据层 GUIDE_BUTTERFLY（§5.2）");
  assert.match(guide, /idleReturnSeconds/, "引导蝶应实现静止示意（idle > 8s）");
  const isle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(isle, /MOTION\.pulsePeriod/, "交互高亮脉冲应取 MOTION.pulsePeriod（1.6s 统一节奏）");
  // 动画节奏统一表存在且与 DOM 层同拍（breathe 4.5 / pulse 1.6）
  const motion = readProjectFile("components/world/systems/worldMotion.ts");
  assert.match(motion, /breathePeriod:\s*4\.5/, "呼吸应与 globals.css world-breathe 4.5s 同拍");
  assert.match(motion, /pulsePeriod:\s*1\.6/, "交互脉冲应为 1.6s");
  assert.match(motion, /flockGatherIdleSeconds:\s*20/, "蝶群彩蛋应静止 20s 触发（§9.2）");
});

test("transmission 名额管控（§3.2 ≤3 mesh）：仅蝶枢与 Moss 穹舱，且必须档位门控", () => {
  const offenders = [];
  for (const file of WORLD_ALL) {
    const src = readProjectFile(file);
    if (/transmission\s*[=:]/.test(src)) offenders.push(file);
  }
  const allowed = new Set([
    "components/world/objects/ButterflyCore.tsx",
    "components/world/objects/ProjectIsle.tsx",
  ]);
  for (const file of offenders) {
    assert.ok(
      allowed.has(file),
      `${file} 不得使用 transmission（名额仅蝶枢翼组 ×2 + Moss 穹舱 ×1）`,
    );
  }
  // 两处都必须有降级开关（glass prop / transmissionBudget 门控）
  const core = readProjectFile("components/world/objects/ButterflyCore.tsx");
  assert.match(core, /glass/, "蝶枢 transmission 应由 glass 档位开关门控");
  const isle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(isle, /glass \?/, "Moss 穹舱 transmission 应有 opacity 降级分支");
});

test("星尘蝶群精灵：路径取 WORLD_ASSET_PATHS 数据登记，禁内联路径字面量", () => {
  const flock = readProjectFile("components/world/objects/ButterflyFlock.tsx");
  assert.match(flock, /WORLD_ASSET_PATHS/, "精灵路径应取数据层登记（constants.WORLD_ASSET_PATHS）");
  assert.match(
    flock,
    /useTexture\(\s*WORLD_ASSET_PATHS\.butterflySprite\s*\)/,
    "useTexture 只能消费登记路径（禁内联路径字面量）",
  );
});

test("蝶精灵产物为真实 512px（阶段 3 修复回归守护：栅格化不得静默缩水）", async () => {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(
    path.join(projectRoot, "public", "world", "butterfly-sprite-512.png"),
  ).metadata();
  assert.ok(
    meta.width >= 512 && meta.height >= 512,
    `蝶精灵应 ≥512×512（实际 ${meta.width}×${meta.height}）`,
  );
});

test("茧居所画廊贴图纪律：登记单源 + 按需挂载 + Suspense（§9.1 / §11.2）", () => {
  const nook = readProjectFile("components/world/objects/GalleryNook.tsx");
  assert.match(nook, /GALLERY_ARTWORKS/, "展品应来自 GALLERY_ARTWORKS 数据登记");
  assert.match(nook, /useNearPlayer/, "画廊纹理应按玩家邻近挂载");
  assert.match(nook, /Suspense/, "纹理加载应包 Suspense");
  const textureRefs = [...nook.matchAll(/useTexture\(\s*([A-Za-z_$][\w$]*)\s*\)/g)];
  assert.ok(
    textureRefs.length > 0 && textureRefs.every((m) => m[1] === "path"),
    "useTexture 只能消费登记传入的 path 变量（禁内联路径字面量）",
  );
});

test("材质体系分层落地：materials.tsx 预设就位且被地形/项目屿消费（§3.2）", () => {
  const materials = readProjectFile("components/world/terrain/materials.tsx");
  for (const preset of [
    "FrostRockMaterial",
    "SnowFieldMaterial",
    "DeepMetalMaterial",
    "GlassPaneMaterial",
    "CrystalGlowMaterial",
  ]) {
    assert.match(materials, new RegExp(`export function ${preset}`), `材质预设 ${preset} 应就位`);
  }
  // 分层消费：主岛 / 远景岛 / 三屿 / 石碑至少各消费磨砂 + 冰雪或金属
  const mainIsland = readProjectFile("components/world/terrain/MainIsland.tsx");
  assert.match(mainIsland, /FrostRockMaterial/, "主岛岩体应走磨砂预设");
  assert.match(mainIsland, /SnowFieldMaterial/, "主岛盘面应走冰雪预设");
  const isles = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(isles, /DeepMetalMaterial/, "三屿构架应走深蓝金属预设");
  assert.match(isles, /GlassPaneMaterial/, "三屿玻璃构件应走半透明预设");
  const distant = readProjectFile("components/world/terrain/DistantIsles.tsx");
  assert.match(distant, /FrostRockMaterial/, "远景岛应与主岛共享磨砂语言");
});

test("场景环境反射零外部资源：SceneEnvironment 为 canvas → PMREM 程序化管线", () => {
  const env = readProjectFile("components/world/terrain/SceneEnvironment.tsx");
  assert.match(env, /PMREMGenerator/, "应使用 PMREM 预滤波");
  assert.match(env, /createCanvas|createElement\("canvas"\)/, "环境贴图应 canvas 本地生成");
  assert.match(env, /dispose/, "卸载时应释放渲染目标 / 纹理 / 生成器");
});

test("CS 行情柱数据色直出：toneMapped=false 防 ACES 洗白暖橙记忆点（阶段 3 实测修复）", () => {
  const isle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  // 浏览器实测：Standard+白 emissive 会把 #FFB36B 洗成微暖白（色相扫描 0 命中），
  // 柱阵必须走 toneMapped=false 的数据色直出（与主屏贴图同语言）
  const bars = isle.match(/<instancedMesh ref=\{barsRef\}[\s\S]*?<\/instancedMesh>/);
  assert.ok(bars, "应存在行情柱 instancedMesh");
  assert.match(bars[0], /toneMapped=\{false\}/, "行情柱材质应 toneMapped={false}");
  assert.doesNotMatch(bars[0], /emissive/, "行情柱不得用白 emissive（会洗掉 instanceColor）");
  assert.match(isle, /colorRising[\s\S]*?FFB36B/, "正增长段应保持 #FFB36B 暖橙（§4.2 记忆点）");
});
