/**
 * R10 环境材质守护（node:test，源码级 + 数据级）：
 * - 岩层五带明度自上而下严格递减，深部色相向蓝紫漂移（去「单一深蓝环带」）；
 * - 沟槽强度场与岩层顶点色耦合（材质跟着几何走，沟内压暗）；
 * - 地表 / 雪面哑光口径（粗糙度下限），抑制强日光下的过曝高光；
 * - 坡度染色与檐口几何解耦（sculptedLip）：屿顶染色不改变岛缘剪影；
 * - 道路路缘去「深色描边」口径（旧饱和深蓝 curb 色不回流，边线低透明度）；
 * - 后处理红线：世界画布不引入 EffectComposer / bloom（材质优先口径）。
 * 运行方式：npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/** #RRGGBB → { h: 0~360, s: 0~1, l: 0~1 }（HSL，与 three Color.offsetHSL 同口径） */
function hexToHsl(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

const ISLAND_GEOMETRY = "components/world/terrain/islandGeometry.ts";

test("R10 岩层五带：明度自上而下严格递减，深部色相向蓝紫漂移", () => {
  const src = readProjectFile(ISLAND_GEOMETRY);
  const bands = ["ROCK_TOP", "ROCK_UPPER", "ROCK_MID", "ROCK_DEEP", "ROCK_ABYSS"].map(
    (name) => {
      const match = src.match(new RegExp(`const ${name} = new Color\\("(#[0-9A-Fa-f]{6})"\\)`));
      assert.ok(match, `${name} 应以 #RRGGBB 字面量登记`);
      return { name, ...hexToHsl(match[1]) };
    },
  );
  for (let i = 0; i < bands.length - 1; i += 1) {
    assert.ok(
      bands[i].l > bands[i + 1].l,
      `${bands[i].name}(L=${bands[i].l.toFixed(3)}) 应亮于 ${bands[i + 1].name}(L=${bands[i + 1].l.toFixed(3)})`,
    );
  }
  assert.ok(
    bands[4].h > bands[0].h,
    `深部色相(${bands[4].h.toFixed(1)}°) 应比顶部(${bands[0].h.toFixed(1)}°) 更偏蓝紫——层与层靠色相差区分，而不是只有明度差`,
  );
});

test("R10 沟槽强度场与岩层顶点色耦合：材质跟着几何位移场走", () => {
  const src = readProjectFile(ISLAND_GEOMETRY);
  assert.match(src, /const GROOVE_SHADOW = new Color\("#[0-9A-Fa-f]{6}"\)/, "沟槽阴影色应登记为常量");
  assert.match(src, /gully = 0/, "pushFace 应计算沟槽强度");
  assert.match(
    src,
    /Math\.cos\(\s*theta \* buttressCount \+ seed \* 1\.7 \+ depthRatio \* 0\.55/,
    "沟槽着色应与几何位移场同公式（theta*buttressCount + seed*1.7 + depthRatio*0.55）",
  );
  assert.match(src, /rockColor\(avgY, depth, shade, theta, organic, gully\)/, "rockColor 应接收沟槽强度");
});

test("R10 地表 / 雪面哑光口径：主岛顶面、项目屿顶面、雪台帽抑制过曝高光", () => {
  const mainIsland = readProjectFile("components/world/terrain/MainIsland.tsx");
  const topMaterial = mainIsland.match(
    /vertexColors roughness=\{(0\.\d+)\} metalness=\{(0\.\d+)\} flatShading/,
  );
  assert.ok(topMaterial, "主岛雪原顶面应为 vertexColors + flatShading 材质");
  assert.ok(
    Number(topMaterial[1]) >= 0.66,
    `主岛顶面粗糙度应 ≥0.66（实际 ${topMaterial[1]}，防止强日光过曝）`,
  );
  assert.ok(Number(topMaterial[2]) <= 0.03, "主岛顶面 metalness 应 ≤0.03");

  const materials = readProjectFile("components/world/terrain/materials.tsx");
  const snowField = materials.match(
    /meshStandardMaterial color=\{color\} roughness=\{(0\.\d+)\} metalness=\{(0\.\d+)\}/,
  );
  assert.ok(snowField, "SnowFieldMaterial 应保持单行材质声明");
  assert.ok(Number(snowField[1]) >= 0.5, `雪面粗糙度应 ≥0.5（实际 ${snowField[1]}）`);

  const projectIsle = readProjectFile("components/world/objects/ProjectIsle.tsx");
  assert.match(
    projectIsle,
    /vertexColors roughness=\{0\.68\} metalness=\{0\.03\}/,
    "项目屿顶面应与主岛同口径压哑光",
  );
  assert.match(projectIsle, /slopeTint: 0\.4/, "项目屿顶面应启用坡度染色（只着色不改形）");
});

test("R10 坡度染色与檐口几何解耦：屿顶染色不改变岛缘剪影", () => {
  const src = readProjectFile(ISLAND_GEOMETRY);
  assert.match(src, /const sculptedLip = rimScallop > 0 \|\| rimRockBlend > 0;/, "应存在 sculptedLip 形状门");
  assert.match(src, /if \(sculptedLip\) \{/, "檐口几何分支应使用 sculptedLip 而非 organicRim");
  // organicRim 仍负责颜色分层（冰壳斑块 / 坡度染色的入口开关）
  assert.match(src, /const organicRim = rimScallop > 0 \|\| slopeTint > 0 \|\| rimRockBlend > 0;/);
});

test("R10 道路去描边口径：路缘为灰蓝石材（低金属度），旧饱和深蓝不回流", () => {
  const raw = readProjectFile("components/world/terrain/Trails.tsx");
  // 剥离块注释 / 行注释：旧色号允许出现在「R10 改动说明」里，不允许出现在代码中
  const trails = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const legacy of ["#345A7E", "#3E6488"]) {
    assert.ok(!trails.includes(legacy), `旧深蓝路缘色 ${legacy} 不应回流`);
  }
  // R11.1：路缘/铺面允许在 color 与 roughness 之间携带 emissive 属性
  // （悬空段底面自发光），属性解析改为宽松捕获再逐项校验
  const curbs = [...trails.matchAll(/meshStandardMaterial\s+color="(#[0-9A-Fa-f]{6})"([^>]*)side=\{DoubleSide\}/g)].map(
    (match) => {
      const attrs = match[2];
      const roughness = Number(attrs.match(/roughness=\{(0\.\d+)\}/)?.[1] ?? NaN);
      const metalness = Number(attrs.match(/metalness=\{(0\.\d+)\}/)?.[1] ?? NaN);
      return { color: match[1], roughness, metalness };
    },
  );
  const roadCurbs = curbs.filter(
    (material) => material.metalness <= 0.06 && material.roughness >= 0.7,
  );
  assert.ok(
    roadCurbs.length >= 2,
    "蝶径与接近铺装的路缘都应为低金属度石材（metalness ≤0.06、roughness ≥0.7）",
  );
  assert.ok(!trails.includes("opacity={0.34}"), "侧缘白线透明度应收敛（0.34 描边感过强）");
  assert.match(trails, /opacity=\{0\.26\}/, "侧缘白线应使用 0.26 低透明度");
});

test("R10.1 路旁压实雪带：着色与路面几何同源（单源路网折线）", () => {
  const trails = readProjectFile("components/world/terrain/Trails.tsx");
  assert.match(
    trails,
    /export const ISLAND_PATH_POLYLINES/,
    "接近铺装 / 迎宾步道折线应从 Trails.tsx 导出（与路面丝带同一份采样）",
  );
  const mainIsland = readProjectFile("components/world/terrain/MainIsland.tsx");
  assert.match(
    mainIsland,
    /import \{ ISLAND_PATH_POLYLINES \} from "\.\/Trails"/,
    "MainIsland 应消费 Trails 导出的路网折线（不允许复制第二份控制点）",
  );
  assert.match(mainIsland, /zoneAt: buildPackedField\(\)/, "主岛顶面应启用压实度分区着色");
  const island = readProjectFile(ISLAND_GEOMETRY);
  assert.match(island, /const SNOW_PACKED = new Color\("#[0-9A-Fa-f]{6}"\)/, "压实雪色应登记为常量");
  assert.match(island, /zoneAt\?: \(x: number, z: number\) => number/, "顶面几何应暴露 zoneAt 分区入口");
});

test("R10.1 岩檐积雪角向占有率：打破等高亮环的规则节奏", () => {
  const src = readProjectFile(ISLAND_GEOMETRY);
  assert.match(src, /snowPresence/, "岩檐积雪应有角向占有率因子");
  assert.match(
    src,
    /Math\.min\(0\.86, \(normalY - 0\.34\) \/ 0\.55\) \* snowPresence/,
    "朝上岩面的积雪强度应乘以角向占有率",
  );
});

test("R10 后处理红线：材质优先，不引入 EffectComposer / bloom", () => {
  for (const file of ["components/world/WorldCanvas.tsx", "components/world/WorldShell.tsx"]) {
    const src = readProjectFile(file);
    assert.ok(!/EffectComposer|postprocessing|UnrealBloom/i.test(src), `${file} 不应引入后处理栈`);
  }
});
