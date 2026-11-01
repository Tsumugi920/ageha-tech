/**
 * R11.1 主岛地貌结构精修守护（node:test）：
 * - 数据层：顶部地形的「去圆盘化」指标（同一归一化半径上的角向
 *   高度差必须可读）与东南浅凹谷的存在；
 * - 源码层：钉定檐口-地表连续混合、逐层轮廓相位、层错上限加档、
 *   丝带自发光底面——防止后续轮次回退成均匀环带 / 黑底悬空丝带。
 * 运行方式：npm test（node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MAIN_ISLAND, mainIslandSurfaceY } from "../lib/world/layout.ts";

test("R11.1 顶部去圆盘化：同一归一化半径上角向高度差可读（方向性地貌）", () => {
  for (const rr of [0.62, 0.75]) {
    const heights = [];
    for (let i = 0; i < 24; i += 1) {
      const theta = (i / 24) * Math.PI * 2;
      const x = Math.cos(theta) * MAIN_ISLAND.semiAxisX * rr;
      const z = Math.sin(theta) * MAIN_ISLAND.semiAxisZ * rr;
      heights.push(mainIslandSurfaceY(x, z));
    }
    const spread = Math.max(...heights) - Math.min(...heights);
    assert.ok(
      spread >= 1.2,
      `r=${rr} 角向高度差 ${spread.toFixed(2)} 应 ≥1.2（不同方向地貌特征不同）`,
    );
  }
});

test("R11.1 东南浅凹谷：凹谷点明显低于同象限非凹谷点（低伏走向）", () => {
  const trough = mainIslandSurfaceY(9.5, 9);
  const flat = mainIslandSurfaceY(9.5, 3);
  assert.ok(
    trough + 0.15 <= flat,
    `凹谷点 ${trough.toFixed(3)} 应比北侧 ${flat.toFixed(3)} 低 ≥0.15`,
  );
});

test("R11.1 源码守护：檐口混合 / 逐层相位 / 层错加档 / 丝带自发光", () => {
  const geo = readFileSync("components/world/terrain/islandGeometry.ts", "utf8");
  // 檐口与地表连续混合（k=0 取地表行，k=1 收成檐口；檐径跟随 rim 轮廓）
  assert.match(geo, /surfaceRadius = t \* rim/, "檐径应从地表轮廓出发");
  assert.match(geo, /lipRadius \* rim - surfaceRadius/, "檐口终点应跟随 rim 轮廓并保持旧几何");
  assert.match(geo, /surfaceY \+ \(lipY - surfaceY\) \* k/, "檐高应与地表高度连续混合");
  // 逐层轮廓相位（消除各层相同岩石轮廓的重复感）
  assert.match(geo, /ringIndex \* 0\.37/, "轮廓波应带逐层相位");
  assert.match(geo, /Math\.sin\(theta \* 2\.05 \+ seed \* 1\.4 \+ ringIndex \* 0\.23\)/, "层理倾斜波应带逐层相位");
  // 层错上限加档（0.22 → 0.34 邻层间距）
  assert.match(geo, /Math\.min\(gapAbove, gapBelow\) \* 0\.34/, "层错上限应为邻层间距的 0.34");

  const trails = readFileSync("components/world/terrain/Trails.tsx", "utf8");
  // 蝶径丝带自发光 + 半透明（蓝图 §2.3「半透明鳞粉光带」；
  // R11.3 实证 b0 机位距 C 径 7.55m，不透明丝带仰视读作实体墙）
  assert.match(trails, /emissive="#7FB0D8"/, "路缘应带浅蓝自发光");
  assert.match(trails, /emissive="#D2E4F2"/, "铺面应带冰白自发光");
  assert.match(trails, /emissiveIntensity=\{0\.62\}/, "路缘自发光强度 0.62");
  assert.match(trails, /transparent\s*\n\s*opacity=\{0\.8\}/, "路缘应为半透明（0.8）");
  assert.match(trails, /transparent\s*\n\s*opacity=\{0\.72\}/, "铺面应为半透明（0.72）");

  const layout = readFileSync("lib/world/layout.ts", "utf8");
  // 顶部去圆盘化：雪台三频角向调制 / 雪脊对比拉开 / rimTaper 收窄
  // （R11.2：雪台振幅 0.4、下限 0.12；雪脊 0.32）
  assert.match(layout, /Math\.max\(\s*0\.12,\s*0\.62 \+ 0\.38 \* Math\.sin\(theta \* 2\.1 - 0\.8\)/, "环岛雪台应改为三频角向调制（下限 0.12）");
  assert.match(layout, /0\.32 \*\s*\n\s*\(0\.5 \+ 0\.5 \* Math\.sin\(theta \* 3\.1 \+ 0\.7 \+ 0\.9 \* Math\.sin\(theta \* 1\.3\)\)\)/, "大尺度雪脊应带双频角向对比（0.32）");
  assert.match(layout, /smoothstep01\(0\.93, 0\.997, r\)/, "岛缘平台应收窄到 0.93-0.997");
  assert.match(layout, /smoothstep01\(2\.0, 4\.0, trailDistance\)/, "径带外缘应为 4.0");

  const geo2 = readFileSync("components/world/terrain/islandGeometry.ts", "utf8");
  // R11.2：色带立体化（角向×高度 warp）与逐层半径节奏
  assert.match(geo2, /0\.085 \* Math\.sin\(theta \* 2\.7 \+ 0\.9\)/, "岩色 warp 应升级为角向×高度场");
  assert.match(geo2, /0\.05 \* Math\.sin\(theta \* 1\.8 \+ y \* 0\.22\)/, "warp 应含高度耦合项");
  assert.match(geo2, /0\.035 \* Math\.sin\(ringIndex \* 2\.7 \+ seed \* 1\.3\)/, "逐层半径节奏应存在");
  assert.match(geo2, /Math\.sin\(theta \* 3 \+ seed\) \* 0\.028/, "平面轮廓噪声应增强到 0.028");
});
