/**
 * R11.6 分段踏板测试（node:test）：
 * C 径（trail-c）视觉从「连续半透明丝带」改为「分段石板踏步」后，
 * 钉死以下契约——
 * 1. C 径起点/终点落位正确（起于主岛西缘、终于 CS 屿盘面且在碰撞体外）；
 * 2. 连接路径连续可达（采样 + 中点均有可行走面，横向带宽内同样可达）；
 * 3. 踏板位姿贴合路径、无异常包围盒（间距受控、不越控制点包络、
 *    不插进目标屿岩裙、远离蝶枢）；
 * 4. 不再出现跨海连续宽带（单元素长度 ≤3m + 板间留空 + 板顶贴可行走面）；
 * 5. 碰撞/导航解析面不受视觉重构影响（径面高度与采样一致、区域名可读）；
 * 6. 其他蝶径（A/M）完全不受影响（控制点冻结对照 + 不在踏板名单内）。
 * 运行方式：npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUTTERFLY_CORE,
  MAIN_ISLAND,
  PROJECT_ISLES,
  TRAILS,
  getGroundHeight,
  getZoneName,
} from "../lib/world/layout.ts";
import {
  DECK_BURY_LIMIT,
  DECK_CURB_PAD,
  DECK_ISLE_MARGIN,
  DECK_SLAB,
  DECK_STRIDE,
  DECK_TOP_LIFT,
  TRAIL_DECK_IDS,
  buildTrailDeck,
} from "../lib/world/trailDeck.ts";

const trailC = TRAILS.find((t) => t.id === "trail-c");
assert.ok(trailC, "TRAILS 应包含 trail-c");
const isleCS = PROJECT_ISLES.find((isle) => isle.id === "isle-calendar");
assert.ok(isleCS, "PROJECT_ISLES 应包含 isle-calendar");

const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** 折线最近点（2D 距离 + 插值 y），用于踏板贴合度校验 */
function nearestOnPolyline(x, z, samples) {
  let best = null;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lenSq = abx * abx + abz * abz;
    if (lenSq === 0) continue;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const d = Math.hypot(x - px, z - pz);
    if (best === null || d < best.distance) {
      best = { distance: d, y: a.y + (b.y - a.y) * t };
    }
  }
  return best;
}

test("R11.6 C 径起终点落位：起于主岛西缘、终于 CS 屿盘面且避开结构碰撞体", () => {
  const first = trailC.samples[0];
  const last = trailC.samples[trailC.samples.length - 1];
  // 端点契约：首末采样 = 首末控制点（无闭合曲线 / 端点漂移）
  assert.deepEqual(
    [first.x, first.y, first.z],
    [trailC.controlPoints[0].x, trailC.controlPoints[0].y, trailC.controlPoints[0].z],
    "C 径首采样应等于第一个控制点",
  );
  const lastControl = trailC.controlPoints[trailC.controlPoints.length - 1];
  assert.deepEqual(
    [last.x, last.y, last.z],
    [lastControl.x, lastControl.y, lastControl.z],
    "C 径末采样应等于最后一个控制点",
  );
  // 起点：主岛椭圆内（岛缘登陆）
  const rStart = Math.hypot(
    first.x / MAIN_ISLAND.semiAxisX,
    first.z / MAIN_ISLAND.semiAxisZ,
  );
  assert.ok(rStart <= 1, `C 径起点应在主岛椭圆内（r=${rStart.toFixed(3)}）`);
  // 终点：CS 屿盘面内、结构碰撞体外、到达高度 = 屿面高
  const dEnd = dist2D(last.x, last.z, isleCS.center.x, isleCS.center.z);
  assert.ok(dEnd <= isleCS.radius, `C 径终点应落在 CS 屿盘面内（d=${dEnd.toFixed(2)} > ${isleCS.radius}）`);
  const colliderDist =
    dist2D(
      last.x,
      last.z,
      isleCS.center.x + isleCS.collider.offsetX,
      isleCS.center.z + isleCS.collider.offsetZ,
    ) - isleCS.collider.radius;
  assert.ok(colliderDist >= 1, `C 径终点距 CS 屿结构碰撞体应 ≥1m（余量 ${colliderDist.toFixed(2)}）`);
  assert.equal(last.y, isleCS.center.y, "C 径终点高度应与 CS 屿面一致（+8）");
});

test("R11.6 连接连续可达：C 径采样与中点全部有可行走面，横向带宽内可达", () => {
  const samples = trailC.samples;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const g = getGroundHeight(s.x, s.z, s.y + 5);
    assert.ok(g !== null, `C 径采样 #${i} (${s.x.toFixed(1)},${s.z.toFixed(1)}) 应有可行走面`);
    // 采样中点同样可达（径带无断口）
    if (i < samples.length - 1) {
      const n = samples[i + 1];
      const mx = (s.x + n.x) / 2;
      const mz = (s.z + n.z) / 2;
      const my = (s.y + n.y) / 2;
      const gm = getGroundHeight(mx, mz, my + 5);
      assert.ok(gm !== null, `C 径采样 #${i}/#${i + 1} 中点应有可行走面`);
    }
  }
  // 横向：径带内偏移 ±1.2（半宽 1.6 − 0.4 余量）仍可达
  for (let i = 4; i < samples.length - 4; i += 8) {
    const s = samples[i];
    const prev = samples[i - 1];
    const next = samples[i + 1];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = tz / len;
    const nz = -tx / len;
    for (const side of [-1, 1]) {
      const x = s.x + nx * 1.2 * side;
      const z = s.z + nz * 1.2 * side;
      const g = getGroundHeight(x, z, s.y + 5);
      assert.ok(g !== null, `C 径采样 #${i} 横向 ${side > 0 ? "右" : "左"} 1.2m 应有可行走面`);
    }
  }
});

test("R11.6 踏板位姿：贴合路径、间距受控、不越包络、不插岩裙、远离蝶枢", () => {
  const deck = buildTrailDeck(trailC.samples);
  // 数量：弧长 50.8 / 步距 2.3 → 20±4；跳过的是接屿段
  assert.ok(deck.steps.length >= 12 && deck.steps.length <= 28,
    `踏板数 ${deck.steps.length} 应在 12~28`);
  assert.ok(deck.skipped >= 0 && deck.skipped <= 6, `跳过步数 ${deck.skipped} 应 ≤6`);

  const xs = trailC.controlPoints.map((p) => p.x);
  const zs = trailC.controlPoints.map((p) => p.z);
  const box = {
    minX: Math.min(...xs) - 2, maxX: Math.max(...xs) + 2,
    minZ: Math.min(...zs) - 2, maxZ: Math.max(...zs) + 2,
  };

  deck.steps.forEach((step, i) => {
    // 贴合：每块板中心贴近折线（≤ 半步距 + 0.4），y 与折线插值一致（±0.05）
    const near = nearestOnPolyline(step.x, step.z, trailC.samples);
    assert.ok(near && near.distance <= DECK_STRIDE / 2 + 0.4,
      `踏板 #${i} 距径折线 ${near?.distance.toFixed(2)}m 应 ≤ ${(DECK_STRIDE / 2 + 0.4).toFixed(2)}`);
    assert.ok(Math.abs(step.y - near.y) <= 0.05,
      `踏板 #${i} y=${step.y.toFixed(3)} 与折线插值 y=${near.y.toFixed(3)} 偏差应 ≤0.05`);
    // 朝向有限且为 atan2 口径（|angle| ≤ π）
    assert.ok(Number.isFinite(step.angle) && Math.abs(step.angle) <= Math.PI + 1e-9,
      `踏板 #${i} 朝向 ${step.angle} 应为有限角`);
    // 包络：不越控制点包络 +2m（无失控几何）
    assert.ok(
      step.x >= box.minX && step.x <= box.maxX && step.z >= box.minZ && step.z <= box.maxZ,
      `踏板 #${i} (${step.x.toFixed(1)},${step.z.toFixed(1)}) 越出控制点包络+2m`,
    );
    // 岩裙让位：屿面高于板顶时，板必须在 walkable 半径 + 让位之外
    for (const isle of PROJECT_ISLES) {
      if (isle.center.y > step.y + 0.5) {
        const d = dist2D(step.x, step.z, isle.center.x, isle.center.z);
        assert.ok(
          d >= isle.radius + DECK_ISLE_MARGIN - 0.01,
          `踏板 #${i} (d=${d.toFixed(2)}) 落入 ${isle.id} 岩裙让位圈 (${isle.radius + DECK_ISLE_MARGIN})`,
        );
      }
    }
    // 远离蝶枢（不穿越主建筑上空）
    const dCore = dist2D(step.x, step.z, BUTTERFLY_CORE.center.x, BUTTERFLY_CORE.center.z);
    assert.ok(dCore >= 14, `踏板 #${i} 距蝶枢 ${dCore.toFixed(1)}m 应 ≥14m`);
  });

  // 间距：相邻保留板弧长间隙 ≤ 3×步距（岩裙让位最多造成一小段收尾间隙）
  for (let i = 1; i < deck.steps.length; i += 1) {
    const a = deck.steps[i - 1];
    const b = deck.steps[i];
    const gap = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    assert.ok(gap <= DECK_STRIDE * 3 + 0.3,
      `踏板 #${i - 1}→#${i} 间隙 ${gap.toFixed(2)}m 应 ≤ ${(DECK_STRIDE * 3 + 0.3).toFixed(2)}`);
  }
});

test("R11.6 无跨海连续宽带：单元素 ≤3m、板间留空、板顶贴可行走面", () => {
  assert.ok(TRAIL_DECK_IDS.includes("trail-c"), "trail-c 应在分段踏板名单中");
  // 单个视觉元素沿路径方向的长度上限（数据级「无巨带」表达）
  assert.ok(DECK_SLAB.length <= 3, `石板长 ${DECK_SLAB.length} 应 ≤3m`);
  assert.ok(DECK_CURB_PAD.length <= 3, `基石长 ${DECK_CURB_PAD.length} 应 ≤3m`);
  // 板与板之间必须留空（节奏感 = 远景不连成一面）
  assert.ok(
    DECK_STRIDE - DECK_CURB_PAD.length >= 0.1,
    `步距 ${DECK_STRIDE} 与基石长 ${DECK_CURB_PAD.length} 之间应留 ≥0.1m 空隙`,
  );
  // 板顶必须贴着可行走面（既不悬空也不沉入）
  const deck = buildTrailDeck(trailC.samples);
  deck.steps.forEach((step, i) => {
    const ground = getGroundHeight(step.x, step.z);
    assert.ok(ground !== null, `踏板 #${i} 处应有可行走面`);
    const top = step.y + DECK_TOP_LIFT;
    assert.ok(
      ground - top <= DECK_BURY_LIMIT + 1e-9,
      `踏板 #${i} 板顶低于当地地面 ${(ground - top).toFixed(3)}m，应 ≤${DECK_BURY_LIMIT}`,
    );
    assert.ok(
      top - ground <= 0.1,
      `踏板 #${i} 板顶高于当地地面 ${(top - ground).toFixed(3)}m，应 ≤0.1（不悬空）`,
    );
  });
});

test("R11.6 碰撞/导航不受影响：径面高度与采样一致，区域名沿径可读", () => {
  const samples = trailC.samples;
  for (let i = 0; i < samples.length; i += 4) {
    const s = samples[i];
    const g = getGroundHeight(s.x, s.z, s.y + 5);
    assert.ok(g !== null, `C 径采样 #${i} 应有可行走面`);
    // 径面高度不被视觉重构改变：地面 ≥ 采样 y − 0.05（不塌陷），
    // 且 ≤ 采样 y + 2.5（近屿段允许被屿面接管抬高）
    assert.ok(g >= s.y - 0.05 && g <= s.y + 2.5,
      `C 径采样 #${i} 地面 ${g?.toFixed(2)} 偏离径面 ${s.y.toFixed(2)} 过大`);
  }
  // 区域名：海上段报蝶径，近屿段报目标屿
  const mid = samples[Math.floor(samples.length / 2)];
  assert.equal(getZoneName(mid.x, mid.z, mid.y + 1), "蝶径 · 西南径");
  const endZone = getZoneName(
    samples[samples.length - 1].x,
    samples[samples.length - 1].z,
    samples[samples.length - 1].y + 1,
  );
  assert.equal(endZone, isleCS.name);
});

test("R11.6 其他蝶径不受影响：A/M 控制点冻结、不在踏板名单", () => {
  assert.deepEqual(
    TRAIL_DECK_IDS,
    ["trail-c"],
    "踏板名单应只包含 trail-c",
  );
  const trailA = TRAILS.find((t) => t.id === "trail-a");
  const trailM = TRAILS.find((t) => t.id === "trail-m");
  assert.ok(trailA && trailM, "TRAILS 应包含 trail-a 与 trail-m");
  // R11.4 定稿控制点冻结对照（防本轮或后续误改）
  assert.deepEqual(
    trailA.controlPoints.map((p) => [p.x, p.y, p.z]),
    [[-6, 0, -12], [-10.6, 1.2, -27], [-15, 2.6, -42], [-20, 4, -52]],
    "trail-a 控制点应保持 R11.4 定稿",
  );
  assert.deepEqual(
    trailM.controlPoints.map((p) => [p.x, p.y, p.z]),
    [[14, 0, 7], [26, -1, 4], [37, -2, 15], [46, -3, 28]],
    "trail-m 控制点应保持定稿",
  );
  // 宽度契约不变
  for (const trail of TRAILS) {
    assert.equal(trail.width, 3.2, `${trail.id} 可行走宽度应保持 3.2`);
  }
});
