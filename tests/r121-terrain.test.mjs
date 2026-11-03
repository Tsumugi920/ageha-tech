/**
 * R12.1 地形与自然资产精修守护（node:test）：
 * - A 阶段（岩层）：局部岩突 / 断面场的行为契约（顶环 / 底尖保护、
 *   方位聚簇、几何真实生效）、逐层振幅节奏、层理明度台阶；
 * - B/C/D 阶段测试随阶段追加。
 * 运行方式：npm test（node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createLayeredIslandGeometry,
  islandOutcropField,
} from "../components/world/terrain/islandGeometry.ts";
import {
  PINE_FORMS,
  buildPineFoliage,
} from "../components/world/terrain/floraGeometry.ts";
import {
  SPAWN_POINT,
  SIGN_POST,
  TRAILS,
  mainIslandSurfaceY,
} from "../lib/world/layout.ts";

/** 主岛岩体参数（与 MainIsland.tsx rockGeometry 调用一致） */
const MAIN_ROCK = {
  radiusX: 18,
  radiusZ: 13,
  depth: 17.5,
  seed: 2.17,
  jaggedness: 0.09,
  segments: 120,
  profile: "headland",
  strataTilt: 0.085,
  buttressCount: 7,
  buttressDepth: 0.075,
  layerJitter: 0.034,
  breachCount: 3,
  breachDepth: 0.15,
  outcropCount: 4,
  notchCount: 3,
};

test("R12.1-A 岩突场：顶环 / 雪檐接缝与底部尖端完全不受影响", () => {
  for (let i = 0; i < 64; i += 1) {
    const theta = (i / 64) * Math.PI * 2;
    for (const depthRatio of [0, 0.05, 0.1, 0.135, 0.845, 0.9, 0.97, 1]) {
      const field = islandOutcropField(theta, depthRatio, 2.17, 2);
      assert.equal(field.bulge, 0, `depthRatio=${depthRatio} 应无岩突`);
      assert.equal(field.notch, 0, `depthRatio=${depthRatio} 应无断面`);
    }
  }
});

test("R12.1-A 岩突场：4 处岩突在各自深度带内均有可读外凸区，3 处断面同理", () => {
  // 与 islandGeometry.islandOutcropField 相同的确定性布位公式（钉定行为）
  const hash01 = (a, b, c) => {
    const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const scan = (field, bandCenter) => {
    let peak = 0;
    for (let i = 0; i < 720; i += 1) {
      const theta = (i / 720) * Math.PI * 2;
      peak = Math.max(peak, field(theta, bandCenter));
    }
    return peak;
  };
  for (let k = 0; k < 4; k += 1) {
    const bandCenter = 0.24 + 0.36 * hash01(k + 5, 2.17, 6.1);
    const peak = scan(
      (theta, dr) => islandOutcropField(theta, dr, 2.17, 3).bulge,
      bandCenter,
    );
    assert.ok(peak >= 0.5, `岩突 #${k} 在带心 ${bandCenter.toFixed(2)} 峰值 ${peak.toFixed(2)} 应 ≥0.5`);
  }
  for (let k = 0; k < 3; k += 1) {
    const bandCenter = 0.3 + 0.4 * hash01(k + 21, 2.17, 1.3);
    const peak = scan(
      (theta, dr) => islandOutcropField(theta, dr, 2.17, 3).notch,
      bandCenter,
    );
    assert.ok(peak >= 0.5, `断面 #${k} 在带心 ${bandCenter.toFixed(2)} 峰值 ${peak.toFixed(2)} 应 ≥0.5`);
  }
});

test("R12.1-A 岩突几何：中下部半径相对无岩突版本出现 ≥3% 局部偏差", () => {
  const without = createLayeredIslandGeometry({ ...MAIN_ROCK, outcropCount: 0, notchCount: 0 });
  const withOutcrop = createLayeredIslandGeometry(MAIN_ROCK);
  const position = without.getAttribute("position");
  const positionOut = withOutcrop.getAttribute("position");
  assert.equal(position.count, positionOut.count, "顶点数应一致（只位移、不增减）");
  let maxDeviation = 0;
  let deviationRings = new Set();
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const depthRatio = -y / MAIN_ROCK.depth;
    if (depthRatio < 0.16 || depthRatio > 0.82) continue;
    const r0 = Math.hypot(
      position.getX(i) / MAIN_ROCK.radiusX,
      position.getZ(i) / MAIN_ROCK.radiusZ,
    );
    const r1 = Math.hypot(
      positionOut.getX(i) / MAIN_ROCK.radiusX,
      positionOut.getZ(i) / MAIN_ROCK.radiusZ,
    );
    const deviation = Math.abs(r1 - r0);
    if (deviation > maxDeviation) maxDeviation = deviation;
    if (deviation > 0.03) deviationRings.add(Math.round(depthRatio * 20));
  }
  assert.ok(
    maxDeviation >= 0.03,
    `最大相对半径偏差 ${maxDeviation.toFixed(4)} 应 ≥0.03（岩突真实改变几何）`,
  );
  assert.ok(
    deviationRings.size >= 2,
    `偏差应分布在多个深度带（实际 ${deviationRings.size} 带）`,
  );
  without.dispose();
  withOutcrop.dispose();
});

test("R12.1-A 顶环保护：y > −0.4m 的雪檐接缝顶点在开/关岩突间逐位一致", () => {
  const without = createLayeredIslandGeometry({ ...MAIN_ROCK, outcropCount: 0, notchCount: 0 });
  const withOutcrop = createLayeredIslandGeometry(MAIN_ROCK);
  const a = without.getAttribute("position");
  const b = withOutcrop.getAttribute("position");
  let checked = 0;
  const axisGet = { x: (attr, i) => attr.getX(i), y: (attr, i) => attr.getY(i), z: (attr, i) => attr.getZ(i) };
  for (let i = 0; i < a.count; i += 1) {
    if (a.getY(i) < -0.4) continue;
    checked += 1;
    for (const axis of ["x", "y", "z"]) {
      assert.ok(
        Math.abs(axisGet[axis](a, i) - axisGet[axis](b, i)) < 1e-9,
        `顶点 ${i}.${axis} 应完全一致（岩突不影响雪檐接缝）`,
      );
    }
  }
  assert.ok(checked > 1000, `接缝区域顶点数 ${checked} 应 >1000`);
  without.dispose();
  withOutcrop.dispose();
});

test("R12.1-A 层理明度台阶：中深部各深度片的平均明度存在可读跳变", () => {
  const geometry = createLayeredIslandGeometry(MAIN_ROCK);
  const position = geometry.getAttribute("position");
  const color = geometry.getAttribute("color");
  const luminance = (i) =>
    0.2126 * color.getX(i) + 0.7152 * color.getY(i) + 0.0722 * color.getZ(i);
  // 按 0.05·depth 深度片统计中深部（0.3~0.7）平均明度
  const slabs = new Map();
  for (let i = 0; i < position.count; i += 3) {
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    const depthRatio = -y / MAIN_ROCK.depth;
    if (depthRatio < 0.3 || depthRatio > 0.7) continue;
    const slab = Math.floor(depthRatio * 20);
    const lum = (luminance(i) + luminance(i + 1) + luminance(i + 2)) / 3;
    const entry = slabs.get(slab) ?? { sum: 0, count: 0 };
    entry.sum += lum;
    entry.count += 1;
    slabs.set(slab, entry);
  }
  const means = [...slabs.values()]
    .filter((entry) => entry.count > 30)
    .map((entry) => entry.sum / entry.count);
  assert.ok(means.length >= 4, `有效深度片 ${means.length} 应 ≥4`);
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  const variance =
    means.reduce((sum, value) => sum + (value - mean) ** 2, 0) / means.length;
  assert.ok(
    Math.sqrt(variance) >= 0.008,
    `深度片明度标准差 ${Math.sqrt(variance).toFixed(4)} 应 ≥0.008（层间跳变可读）`,
  );
  geometry.dispose();
});

test("R12.1-A 源码守护：主岛岩突 / 断面 / 层错参数钉定", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /outcropCount: 4/, "主岛应开启 4 处局部岩突");
  assert.match(mainIsland, /notchCount: 3/, "主岛应开启 3 处窄幅断面");
  assert.match(mainIsland, /layerJitter: 0\.034/, "层错应加档到 0.034");
});

/* ------------------------------ B 阶段：树木资产 ------------------------------ */

/** 与 r12c 同口径：点到蝶径折线最近距离 */
function distanceToTrail(x, z) {
  let best = Infinity;
  for (const trail of TRAILS) {
    for (let i = 1; i < trail.samples.length; i += 1) {
      const a = trail.samples[i - 1];
      const b = trail.samples[i];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      if (lenSq === 0) continue;
      let t = ((x - a.x) * abx + (z - a.z) * abz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
    }
  }
  return best;
}

test("R12.1-B 四形态轮廓契约：层数 / 高宽比 / 顶高互相有别（不是同一模型缩放）", () => {
  const forms = Object.entries(PINE_FORMS);
  assert.equal(forms.length, 4, "应有四种形态（spire/broad/wind/tuft）");
  const stats = {};
  for (const [name, form] of forms) {
    const tiers = form.tiers;
    const baseRadius = tiers[0].radius;
    const topY = Math.max(...tiers.map((tier) => tier.y + tier.height / 2));
    stats[name] = {
      tiers: tiers.length,
      aspect: topY / baseRadius,
      topY,
      baseRadius,
    };
  }
  // 层数互不相同（轮廓节奏的本质区别）
  const tierCounts = forms.map(([name]) => stats[name].tiers);
  assert.equal(new Set(tierCounts).size, 4, `四形态层数应互不相同：${tierCounts}`);
  // 高耸 spire：细长（高宽比最大），顶高最高
  assert.equal(stats.spire.tiers, 6);
  assert.ok(stats.spire.aspect > 8, `spire 高宽比 ${stats.spire.aspect.toFixed(1)} 应 >8`);
  assert.ok(stats.spire.topY > stats.broad.topY * 1.5, "spire 应显著高于 broad");
  // 宽冠 broad：宽矮（高宽比最小），底冠最宽
  assert.ok(stats.broad.baseRadius > stats.spire.baseRadius * 1.8, "broad 底冠应显著宽于 spire");
  assert.ok(stats.broad.aspect < stats.wind.aspect, "broad 应比 wind 更宽矮");
  // 小型 tuft：整体最矮（顶高 < 1.5 单位），做路缘点缀
  assert.ok(stats.tuft.topY < 1.5, `tuft 顶高 ${stats.tuft.topY.toFixed(2)} 应 <1.5`);
  assert.ok(stats.tuft.topY < stats.broad.topY * 0.6, "tuft 应显著矮于 broad");
});

test("R12.1-B 冠层几何：四形态几何可构建且顶层向雪色混合（积雪层可读）", () => {
  // three r152+ ColorManagement 会把 hex 基色 / 雪色转成 linear-sRGB 再烘
  // 进顶点色——比较前必须做同样的 sRGB→linear 转换
  const toLinear = (channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const toRGB = (hex) => ({
    r: toLinear(parseInt(hex.slice(1, 3), 16) / 255),
    g: toLinear(parseInt(hex.slice(3, 5), 16) / 255),
    b: toLinear(parseInt(hex.slice(5, 7), 16) / 255),
  });
  const snow = toRGB("#EDF8FE");
  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  for (const [name, form] of Object.entries(PINE_FORMS)) {
    const geometry = buildPineFoliage(form);
    const color = geometry.getAttribute("color");
    assert.ok(color && color.count > 0, `${name} 冠层应有顶点色`);
    // 顶层冠色基色 → 雪色 lerp（顶层全强度 0.82）：存在比基色更接近雪色的顶点
    const bases = form.tiers.map((tier) => toRGB(tier.color));
    let blended = false;
    for (let i = 0; i < color.count; i += 1) {
      const v = { r: color.getX(i), g: color.getY(i), b: color.getZ(i) };
      const nearestBase = Math.min(...bases.map((base) => dist(v, base)));
      if (dist(v, snow) < nearestBase) {
        blended = true;
        break;
      }
    }
    assert.ok(blended, `${name} 顶层应有向雪色混合的顶点`);
    geometry.dispose();
  }
});

test("R12.1-B 小型装饰树布点：岛内缓坡、避让径带 / 广场 / 出生点 / 导览碑", () => {
  // 与 MainIsland.tsx PINES 中 form:"tuft" 的六处布点一致（钉定防回退）
  const spots = [
    { name: "西南浅雪盆缘", x: -4.6, z: 8.7 },
    { name: "南麓缓坡", x: 3.4, z: 9.8 },
    { name: "西岭北凹地", x: -9.8, z: -6.6 },
    { name: "北径东侧", x: 6.2, z: -10.2 },
    { name: "东南 M 径外侧", x: 14.8, z: 1.4 },
    { name: "西岭南麓", x: -11.9, z: 4.4 },
  ];
  for (const spot of spots) {
    const ex = spot.x / 18;
    const ez = spot.z / 13;
    const r = Math.hypot(ex, ez);
    assert.ok(r <= 0.88, `${spot.name} 归一化半径 ${r.toFixed(3)} 应 ≤0.88（不进观景台铺装带）`);
    const trailDist = distanceToTrail(spot.x, spot.z);
    assert.ok(
      trailDist >= 2.2,
      `${spot.name} 距最近蝶径 ${trailDist.toFixed(2)}m 应 ≥2.2（可行走半宽 1.6 + 余量）`,
    );
    const spawnDist = Math.hypot(spot.x - SPAWN_POINT.x, spot.z - SPAWN_POINT.z);
    assert.ok(spawnDist >= 3.2, `${spot.name} 距出生点 ${spawnDist.toFixed(2)}m 应 ≥3.2`);
    const signDist = Math.hypot(spot.x - SIGN_POST.x, spot.z - SIGN_POST.z);
    assert.ok(signDist >= 2.4, `${spot.name} 距导览碑 ${signDist.toFixed(2)}m 应 ≥2.4`);
    const plazaDist = Math.hypot(spot.x, spot.z);
    assert.ok(plazaDist >= 8.8, `${spot.name} 距广场中心 ${plazaDist.toFixed(2)}m 应 ≥8.8`);
    const y = mainIslandSurfaceY(spot.x, spot.z);
    assert.ok(
      y >= 0 && y <= 1.6,
      `${spot.name} 地表高度 ${y.toFixed(2)} 应在缓坡范围（0~1.6）`,
    );
  }
});

test("R12.1-B 源码守护：树形模块抽离 + 坡度贴合 + 布点引用", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(
    mainIsland,
    /from "\.\/floraGeometry"/,
    "树形数据应从 floraGeometry 导入（可测单源）",
  );
  assert.match(mainIsland, /form: "tuft"/, "布点应使用小型装饰树形态");
  assert.match(
    mainIsland,
    /slopeTiltX[\s\S]*slopeTiltZ/,
    "针叶树应有地表梯度微倾（坡度贴合）",
  );
  assert.doesNotMatch(
    mainIsland,
    /function buildPineFoliage/,
    "冠层构建应迁出组件文件（避免重复实现）",
  );
});

/* ------------------------------ C 阶段：岩石与地表融合 ------------------------------ */

test("R12.1-C 岩石变体：七种种子几何 + 平板岩 / 直立石极端轮廓", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  // 七种变体种子钉定（5 平板岩 / 6 直立石为 R12.1-C 新增）
  assert.match(mainIsland, /seed: 19\.4, jaggedness: 0\.38/, "平板岩变体应存在");
  assert.match(mainIsland, /seed: 23\.8, jaggedness: 0\.3/, "直立石变体应存在");
  assert.match(mainIsland, /variant: 5/, "布点应使用平板岩变体");
  assert.match(mainIsland, /variant: 6/, "布点应使用直立石变体");
});

test("R12.1-C 岩石落位：新变体岩石在岛内、避让径带 / 广场 / 出生点 / 冰池", () => {
  const spots = [
    { name: "冰池北岸平板岩", x: 10.4, z: 1.6 },
    { name: "冰碛脊平板岩", x: 11.0, z: -8.2 },
    { name: "西南直立石", x: -5.9, z: 10.3 },
    { name: "东北直立石", x: -1.7, z: -8.9 },
  ];
  for (const spot of spots) {
    const r = Math.hypot(spot.x / 18, spot.z / 13);
    assert.ok(r <= 0.9, `${spot.name} 归一化半径 ${r.toFixed(3)} 应 ≤0.9`);
    const trailDist = distanceToTrail(spot.x, spot.z);
    assert.ok(
      trailDist >= 2.0,
      `${spot.name} 距最近蝶径 ${trailDist.toFixed(2)}m 应 ≥2.0`,
    );
    const spawnDist = Math.hypot(spot.x - SPAWN_POINT.x, spot.z - SPAWN_POINT.z);
    assert.ok(spawnDist >= 3.2, `${spot.name} 距出生点 ${spawnDist.toFixed(2)}m 应 ≥3.2`);
    const plazaDist = Math.hypot(spot.x, spot.z);
    assert.ok(plazaDist >= 8.6, `${spot.name} 距广场中心 ${plazaDist.toFixed(2)}m 应 ≥8.6`);
    const basinDist = Math.hypot(spot.x - 8, spot.z + 2);
    assert.ok(basinDist >= 2.8, `${spot.name} 距冰池 ${basinDist.toFixed(2)}m 应 ≥2.8（不压水景）`);
    const y = mainIslandSurfaceY(spot.x, spot.z);
    assert.ok(
      y >= 0 && y <= 2.2,
      `${spot.name} 地表高度 ${y.toFixed(2)} 应有界（0~2.2）`,
    );
  }
});

test("R12.1-C 冰块群：三簇落位贴地貌焦点、避让动线，块数有界", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /const ICE_BLOCKS/, "应有地表冰块群数据");
  assert.match(mainIsland, /function IceBlocks/, "应有冰块群实例化组件");
  // 冰块贴地（supportAt）且沉埋——源码钉定贴地逻辑
  assert.match(
    mainIsland,
    /supportAt\(block\.x, block\.z, block\.scale\)/,
    "冰块应按足迹贴地",
  );
  const spots = [
    { name: "冰碛脊北缘", x: 8.9, z: -8.8 },
    { name: "东北凹地", x: -3.1, z: -8.2 },
    { name: "南麓盆缘", x: -0.9, z: 10.3 },
  ];
  for (const spot of spots) {
    const trailDist = distanceToTrail(spot.x, spot.z);
    assert.ok(
      trailDist >= 2.0,
      `${spot.name} 冰块距最近蝶径 ${trailDist.toFixed(2)}m 应 ≥2.0`,
    );
    const spawnDist = Math.hypot(spot.x - SPAWN_POINT.x, spot.z - SPAWN_POINT.z);
    assert.ok(spawnDist >= 3.0, `${spot.name} 冰块距出生点 ${spawnDist.toFixed(2)}m 应 ≥3.0`);
    const y = mainIslandSurfaceY(spot.x, spot.z);
    assert.ok(y >= 0 && y <= 2.0, `${spot.name} 冰块地表高度 ${y.toFixed(2)} 应有界`);
  }
});

test("R12.1-C 源码守护：岩石坡度贴合 + 大石深埋 + 针叶树共享坡度逻辑", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(
    mainIsland,
    /const sink = spot\.scale >= 0\.6 \? 0\.1 : 0\.04/,
    "大石应深埋半档（贴地融合）",
  );
  // BoulderField 内应有梯度贴合（与针叶树同手法）
  assert.match(
    mainIsland,
    /slopeTiltX = Math\.max\(-0\.12, Math\.min\(0\.12, gradZ \* 0\.5\)\)/,
    "岩石应按地表梯度微倾（≤0.12rad）",
  );
});

/* ------------------------------ D 阶段：地表层次 ------------------------------ */

test("R12.1-D 视觉微起伏：幅值有界（≤0.17m）、负值钳制（物件不悬空）", async () => {
  const { mainIslandMicroRelief } = await import(
    "../components/world/terrain/islandGeometry.ts"
  );
  let max = -Infinity;
  let min = Infinity;
  for (let x = -18; x <= 18; x += 0.5) {
    for (let z = -13; z <= 13; z += 0.5) {
      const h = mainIslandMicroRelief(x, z);
      max = Math.max(max, h);
      min = Math.min(min, h);
    }
  }
  assert.ok(max <= 0.17, `最大雪垄 ${max.toFixed(3)}m 应 ≤0.17（纯视觉量级）`);
  assert.ok(min >= -0.035, `最小凹坑 ${min.toFixed(3)}m 应 ≥−0.035（物件以解析面落位不悬空）`);
  assert.ok(max > 0.1, `雪垄应有可读起伏（实际峰值 ${max.toFixed(3)}）`);
});

test("R12.1-D 碰撞零影响：雪垄不进 mainIslandSurfaceY（解析场逐位不变）", async () => {
  const { mainIslandMicroRelief } = await import(
    "../components/world/terrain/islandGeometry.ts"
  );
  // 视觉顶面 = mainIslandSurfaceY + mask·microRelief；碰撞只读 mainIslandSurfaceY。
  // 守护：microRelief 必须是独立函数（不被 layout.ts 引用）
  const layout = readFileSync("lib/world/layout.ts", "utf8");
  assert.doesNotMatch(
    layout,
    /mainIslandMicroRelief/,
    "碰撞高度场不得引用视觉微起伏（walkable 面不变）",
  );
  // 掩码钉定：广场 / 出生 / 冰池 / 径带 / 岛缘全归零
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(
    mainIsland,
    /smooth01\(6\.4, 8\.4, Math\.hypot\(x, z\)\)/,
    "广场压平半径内微起伏应归零",
  );
  assert.match(
    mainIsland,
    /\(1 - PACKED_FIELD\(x, z\)\)/,
    "径带压实区内微起伏应归零",
  );
  const { mainIslandSurfaceY: analytic } = await import("../lib/world/layout.ts");
  // 抽样解析场与视觉场差值不超过微起伏幅值（碰撞场本身未被改动）
  let within = true;
  for (const [x, z] of [[12, 10], [-12, -8], [3, 11], [-14, 3], [10, -6]]) {
    const base = analytic(x, z);
    const visual = base + mainIslandMicroRelief(x, z);
    if (Math.abs(visual - base) > 0.17) within = false;
  }
  assert.ok(within, "视觉顶面与解析碰撞场的差值应在微起伏幅值内");
});

test("R12.1-D 地表三区染色：陡坡露岩 + 洼地结冰选项钉定（只改色不改高）", () => {
  const geometrySource = readFileSync("components/world/terrain/islandGeometry.ts", "utf8");
  assert.match(geometrySource, /rockSlopeTint/, "顶面几何应支持陡坡露岩染色");
  assert.match(geometrySource, /hollowIceTint/, "顶面几何应支持洼地结冰染色");
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /rockSlopeTint: 0\.4/, "主岛应开启露岩染色");
  assert.match(mainIsland, /hollowIceTint: 0\.34/, "主岛应开启洼地结冰染色");
  assert.match(
    mainIsland,
    /mainIslandMicroRelief/,
    "顶面高度应叠加视觉微起伏",
  );
  // 染色只出现在 color 分支（不进入 y 计算）——位置行不引用两选项
  assert.doesNotMatch(
    geometrySource,
    /y = [^\n]*rockSlopeTint/,
    "露岩染色不得影响高度",
  );
  assert.doesNotMatch(
    geometrySource,
    /y = [^\n]*hollowIceTint/,
    "结冰染色不得影响高度",
  );
});

test("R12.1-D 南麓雪埂：新增四处落位避让广场 / 出生 / 径带", () => {
  const spots = [
    { name: "广场东南雪埂", x: 2.8, z: 7.8 },
    { name: "东南雪埂", x: 5.8, z: 10.8 },
    { name: "西南雪埂", x: -8.4, z: 7.8 },
    { name: "东侧雪埂", x: 15.2, z: 3.4 },
  ];
  for (const spot of spots) {
    const plazaDist = Math.hypot(spot.x, spot.z);
    assert.ok(plazaDist >= 7.5, `${spot.name} 距广场 ${plazaDist.toFixed(2)}m 应 ≥7.5`);
    const spawnDist = Math.hypot(spot.x - SPAWN_POINT.x, spot.z - SPAWN_POINT.z);
    assert.ok(spawnDist >= 2.8, `${spot.name} 距出生点 ${spawnDist.toFixed(2)}m 应 ≥2.8`);
    const trailDist = distanceToTrail(spot.x, spot.z);
    assert.ok(
      trailDist >= 2.0,
      `${spot.name} 距最近蝶径 ${trailDist.toFixed(2)}m 应 ≥2.0（不横穿路面）`,
    );
    const r = Math.hypot(spot.x / 18, spot.z / 13);
    assert.ok(r <= 0.9, `${spot.name} 归一化半径 ${r.toFixed(3)} 应 ≤0.9`);
  }
});
