/**
 * 世界布局数据测试（node:test）：
 * 对 lib/world 数据层做坐标级校验（蓝图 §2.2 坐标表 / §12.1 档位表）：
 * 三径起终点落位、样条弧长自洽（评审遗留：弧长 ≥ 直线距离）、可行走面
 * 连续性、交互登记覆盖三 slug、碰撞体含蝶枢与三屿主体、性能档位三档齐全。
 * 运行方式：npm test（即 node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAIN_ISLAND,
  SPAWN_POINT,
  BUTTERFLY_CORE,
  TRAILS,
  PROJECT_ISLES,
  CHRYSALIS_NOOK,
  DISTANT_ISLES,
  getGroundHeight,
  getZoneName,
  softBoundaryPush,
} from "../lib/world/layout.ts";
import {
  STATIC_COLLIDERS,
  CAMERA_OCCLUDERS,
  INTERACTABLES,
  resolveCylinderPush,
} from "../lib/world/colliders.ts";
import { TIER_PARAMS, pickInitialTier, MOBILE_MODIFIERS } from "../lib/world/performance.ts";
import { CAMERA_LIMITS, PLAYER_PHYSICS, INTERACTION } from "../lib/world/constants.ts";

const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/* ------------------------------ 主岛与出生点 ------------------------------ */

test("主岛尺度与出生点：椭圆 36×28（半轴 18/13），出生点在岛内南缘、面北", () => {
  assert.equal(MAIN_ISLAND.semiAxisX, 18);
  assert.equal(MAIN_ISLAND.semiAxisZ, 13);
  assert.equal(MAIN_ISLAND.groundY, 0);
  assert.equal(MAIN_ISLAND.coneDepth, 14);
  assert.deepEqual(
    { x: SPAWN_POINT.x, z: SPAWN_POINT.z },
    { x: 0, z: 10 },
    "出生点应在 (0, 0, +10)（主岛南缘）",
  );
  const ex = SPAWN_POINT.x / MAIN_ISLAND.semiAxisX;
  const ez = SPAWN_POINT.z / MAIN_ISLAND.semiAxisZ;
  assert.ok(ex * ex + ez * ez <= 1, "出生点应在主岛椭圆面内");
  assert.ok(getGroundHeight(SPAWN_POINT.x, SPAWN_POINT.z) !== null, "出生点可行走");
});

test("蝶枢（世界核心）位于主岛中心上空 (0,6,0)，环绕观赏不可进入", () => {
  assert.deepEqual(
    { x: BUTTERFLY_CORE.center.x, y: BUTTERFLY_CORE.center.y, z: BUTTERFLY_CORE.center.z },
    { x: 0, y: 6, z: 0 },
  );
  // 碰撞体含蝶枢禁入圆柱（半径 ≥3，玩家不可穿入）
  const coreCollider = STATIC_COLLIDERS.find((c) => c.id === "collider-butterfly-core");
  assert.ok(coreCollider, "静态碰撞体应含蝶枢");
  assert.ok(coreCollider.radius >= 3, "蝶枢禁入半径应 ≥3");
});

/* ------------------------------ 三条蝶径 ------------------------------ */

test("三径起终点落位：起点在主岛边缘内，终点落在对应项目屿盘面内", () => {
  assert.equal(TRAILS.length, 3, "应有三条蝶径");
  for (const trail of TRAILS) {
    const start = trail.controlPoints[0];
    const end = trail.controlPoints[trail.controlPoints.length - 1];

    const ex = start.x / MAIN_ISLAND.semiAxisX;
    const ez = start.z / MAIN_ISLAND.semiAxisZ;
    assert.ok(
      ex * ex + ez * ez <= 1 + 1e-6,
      `${trail.id} 起点应在主岛椭圆面（含边缘）内`,
    );

    const isle = PROJECT_ISLES.find((item) => item.id === trail.targetIsleId);
    assert.ok(isle, `${trail.id} 应指向存在的项目屿`);
    const endDistance = dist2D(end.x, end.z, isle.center.x, isle.center.z);
    assert.ok(
      endDistance <= isle.radius,
      `${trail.id} 终点应落在 ${isle.id} 盘面内（距离 ${endDistance.toFixed(2)} ≤ ${isle.radius}）`,
    );
    assert.equal(trail.width, 3.2, "蝶径宽度应为 3.2");
  }
});

test("蝶径长度自洽：样条弧长 ≥ 起终点直线距离（名义长度为弧长口径）", () => {
  for (const trail of TRAILS) {
    assert.ok(
      trail.arcLength >= trail.straightDistance,
      `${trail.id} 样条弧长 ${trail.arcLength} 应 ≥ 直线距离 ${trail.straightDistance}`,
    );
    // 适度弯曲：弧长不超过直线距离的 1.35 倍（防失控绕路）
    assert.ok(
      trail.arcLength <= trail.straightDistance * 1.35,
      `${trail.id} 弧长/直线比 ${(trail.arcLength / trail.straightDistance).toFixed(3)} 应 ≤ 1.35`,
    );
    // 采样折线可用（可行走面查询的输入）
    assert.ok(trail.samples.length >= 32, `${trail.id} 采样点应足够密`);
    // 径面中段可行走（起点与终点都有效，中点按插值高度有效）
    const mid = trail.samples[Math.floor(trail.samples.length / 2)];
    assert.ok(
      getGroundHeight(mid.x, mid.z) !== null,
      `${trail.id} 中段应在可行走带内`,
    );
  }
});

test("可行走面连续：主岛 → 三径 → 三屿全程有效，空域返回 null", () => {
  // 三屿盘面中心可行走且高度 = 岛面
  for (const isle of PROJECT_ISLES) {
    const ground = getGroundHeight(isle.center.x + 1, isle.center.z + 1);
    assert.ok(ground !== null, `${isle.id} 盘面应可行走`);
    assert.equal(ground, isle.center.y, `${isle.id} 地面高度应为岛面 y=${isle.center.y}`);
  }
  // 远离一切表面的空域不可行走（软边界责任）
  assert.equal(getGroundHeight(200, 200), null);
  assert.equal(getGroundHeight(0, -140), null, "北径之外远空应不可行走");
});

test("区域名牌：三屿与主岛有名可查，空域为 null", () => {
  assert.equal(getZoneName(0, 0), MAIN_ISLAND.name);
  for (const isle of PROJECT_ISLES) {
    assert.equal(getZoneName(isle.center.x, isle.center.z), isle.name);
  }
  assert.equal(getZoneName(200, 200), null);
});

test("软边界推回方向：空域坐标总能得到指向可行走面的单位向量", () => {
  for (const [x, z] of [[30, 30], [-60, -10], [10, -100], [70, 40]]) {
    const push = softBoundaryPush(x, z);
    const len = Math.hypot(push.x, push.z);
    assert.ok(len > 0.99 && len < 1.01, `(${x},${z}) 推回向量应为单位向量`);
    // 沿推回方向前进 2 单位后应更接近可行走面（有地面或距离减小）
    const probeX = x + push.x * 2;
    const probeZ = z + push.z * 2;
    const before = nearestWalkableDistance(x, z);
    const after = nearestWalkableDistance(probeX, probeZ);
    assert.ok(after <= before, `(${x},${z}) 推回方向应靠近可行走面`);
  }
});

function nearestWalkableDistance(x, z) {
  // 简化度量：到主岛椭圆边缘与三屿盘面边缘的最近距离
  const ex = x / MAIN_ISLAND.semiAxisX;
  const ez = z / MAIN_ISLAND.semiAxisZ;
  const r = Math.hypot(ex, ez);
  const toIsland = r <= 1 ? 0 : (r - 1) * Math.min(MAIN_ISLAND.semiAxisX, MAIN_ISLAND.semiAxisZ);
  let best = toIsland;
  for (const isle of PROJECT_ISLES) {
    const d = dist2D(x, z, isle.center.x, isle.center.z) - isle.radius;
    best = Math.min(best, Math.max(0, d));
  }
  return best;
}

/* ------------------------------ 项目屿与交互 ------------------------------ */

test("三屿坐标与去对称布局：三 slug 各异、互相间距 ≥100、高度三档不同", () => {
  assert.equal(PROJECT_ISLES.length, 3);
  const slugs = PROJECT_ISLES.map((isle) => isle.slug);
  assert.deepEqual([...slugs].sort(), ["agehaos", "cs-skin-invest", "moss-world"]);
  assert.equal(new Set(PROJECT_ISLES.map((i) => i.center.y)).size, 3, "三屿高度应三档（−3/+4/+8）");
  for (let i = 0; i < PROJECT_ISLES.length; i += 1) {
    for (let j = i + 1; j < PROJECT_ISLES.length; j += 1) {
      const a = PROJECT_ISLES[i].center;
      const b = PROJECT_ISLES[j].center;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(d >= 100, `${PROJECT_ISLES[i].id} 与 ${PROJECT_ISLES[j].id} 间距应 ≥100（实际 ${d.toFixed(1)}）`);
    }
  }
  // Moss 屿是全场景唯一下沉屿（−3）
  const moss = PROJECT_ISLES.find((isle) => isle.slug === "moss-world");
  assert.equal(moss.center.y, -3);
});

test("交互登记覆盖三项目 slug 与彩蛋类型，交互半径符合蓝图", () => {
  const projectItems = INTERACTABLES.filter((item) => item.type === "project");
  assert.deepEqual(
    [...projectItems.map((item) => item.slug)].sort(),
    ["agehaos", "cs-skin-invest", "moss-world"],
    "交互登记应覆盖三项目",
  );
  for (const item of INTERACTABLES) {
    assert.ok(item.label.length > 0, `${item.id} 应有名牌文案`);
    assert.equal(item.radius, INTERACTION.promptDistance, "交互半径应为 6");
  }
  assert.ok(
    INTERACTABLES.some((item) => item.type === "core"),
    "应登记蝶枢（core）交互体",
  );
});

test("碰撞与遮挡：静态碰撞体含三屿主体，相机遮挡体非空，圆柱推出有效", () => {
  for (const isle of PROJECT_ISLES) {
    assert.ok(
      STATIC_COLLIDERS.some((c) => c.id === `collider-${isle.id}-structure`),
      `碰撞体应含 ${isle.id} 主体结构`,
    );
    assert.ok(
      CAMERA_OCCLUDERS.some((c) => c.id === `occluder-${isle.id}-structure`),
      `遮挡体应含 ${isle.id} 主体结构`,
    );
  }
  // 蝶枢圆柱推出：从中心旁推出到半径 + 体半径
  const pushed = resolveCylinderPush(1, 0, PLAYER_PHYSICS.bodyRadius);
  assert.ok(pushed, "蝶枢旁应触发推出");
  assert.ok(pushed.x > 3, `推出后应在圆柱外（x=${pushed.x.toFixed(2)}）`);
  // 远离碰撞体不推出
  assert.equal(resolveCylinderPush(20, 20, PLAYER_PHYSICS.bodyRadius), null);
});

/* ------------------------------ 远景与茧居所 ------------------------------ */

test("远景浮岛群：环带 r=120~220（世界数据 7 座上限），全部不可达", () => {
  assert.ok(DISTANT_ISLES.length >= 5 && DISTANT_ISLES.length <= 7, "远景岛应 5~7 座");
  for (const isle of DISTANT_ISLES) {
    const d = Math.hypot(isle.x, isle.z);
    assert.ok(d >= 120 && d <= 220, `远景岛应在 120~220 环带（实际 ${d.toFixed(0)}）`);
    assert.equal(
      getGroundHeight(isle.x, isle.z),
      null,
      "远景岛不可达（无地面）",
    );
  }
});

test("茧居所（彩蛋）登记在主岛下方北侧，阶段 1 不可达标记如实", () => {
  assert.deepEqual(
    { x: CHRYSALIS_NOOK.center.x, y: CHRYSALIS_NOOK.center.y, z: CHRYSALIS_NOOK.center.z },
    { x: 0, y: -18, z: -22 },
  );
  assert.equal(CHRYSALIS_NOOK.reachable, false, "阶段 2 前茧居所应标记为不可达");
});

/* ------------------------------ 相机与运动参数 ------------------------------ */

test("初始构图（第一眼世界观）：机位 / 视点 / FOV 与蓝图 §7 一致", () => {
  assert.deepEqual(
    CAMERA_LIMITS.initialPosition,
    { x: 0, y: 4.6, z: 18.5 },
  );
  assert.deepEqual(
    CAMERA_LIMITS.initialLookAt,
    { x: 0, y: 3.2, z: -12 },
  );
  assert.equal(CAMERA_LIMITS.fovDesktop, 55);
  assert.equal(CAMERA_LIMITS.fovMobile, 60);
  assert.equal(CAMERA_LIMITS.far, 500);
  assert.deepEqual([...CAMERA_LIMITS.distances], [6, 9, 13], "滚轮三档距离");
});

test("运动学参数与蓝图 §6.2 一致", () => {
  assert.equal(PLAYER_PHYSICS.acceleration, 22);
  assert.equal(PLAYER_PHYSICS.maxSpeed, 7.5);
  assert.equal(PLAYER_PHYSICS.sprintMultiplier, 1.6);
  assert.equal(PLAYER_PHYSICS.dampingBase, 0.85);
  assert.equal(PLAYER_PHYSICS.verticalLambda, 10);
  assert.ok(PLAYER_PHYSICS.mobileSpeedScale < 1, "移动端速度上限应打折");
});

/* ------------------------------ 性能档位 ------------------------------ */

test("性能档位表三档齐全且参数合理（阶段 4 AdaptiveQuality 的数据基础）", () => {
  assert.deepEqual(
    Object.keys(TIER_PARAMS).sort(),
    ["high", "low", "medium"],
  );
  assert.equal(TIER_PARAMS.high.distantIsles, DISTANT_ISLES.length, "高档远景座数应等于数据登记数");
  assert.ok(TIER_PARAMS.low.distantIsles >= 3, "低档至少 3 座剪影");
  // 初始选档：桌面高 / 移动中
  assert.equal(pickInitialTier(false).tier, "high");
  assert.equal(pickInitialTier(true).tier, MOBILE_MODIFIERS.defaultTier);
});
