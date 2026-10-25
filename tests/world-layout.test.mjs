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
  NOOK_CORRIDOR,
  NOOK_CORRIDOR_SAMPLES,
  DISTANT_ISLES,
  TELEPORT_SPOTS,
  ISLE_SCREENS,
  GUIDE_BUTTERFLY,
  GALLERY_ARTWORKS,
  SIGN_POST,
  TRAIL_BEACONS,
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

test("茧居所（彩蛋）登记在主岛下方北侧，阶段 2 起经旋径可达", () => {
  assert.deepEqual(
    { x: CHRYSALIS_NOOK.center.x, y: CHRYSALIS_NOOK.center.y, z: CHRYSALIS_NOOK.center.z },
    { x: 0, y: -18, z: -22 },
  );
  assert.equal(CHRYSALIS_NOOK.reachable, true, "阶段 2 旋径建成，茧居所应可达");
  // 交互体登记：egg 类型（发现后导航面板点亮传送项）
  assert.ok(
    INTERACTABLES.some((item) => item.type === "egg" && item.id === CHRYSALIS_NOOK.id),
    "应登记茧居所（egg）交互体",
  );
});

test("茧居所旋径：主岛西北缘 → 盘旋下沉 → 平台，全程可行走且高度单调下降", () => {
  assert.ok(NOOK_CORRIDOR_SAMPLES.length >= 40, "旋径采样点应足够密");
  // 起点：主岛面内（可行走），且在岛缘附近（隐藏入口位置语义）
  const start = NOOK_CORRIDOR_SAMPLES[0];
  const ex = start.x / MAIN_ISLAND.semiAxisX;
  const ez = start.z / MAIN_ISLAND.semiAxisZ;
  assert.ok(ex * ex + ez * ez <= 1, "旋径起点应在主岛椭圆面内");
  // 终点：茧居所平台内，高度到达 -18
  const end = NOOK_CORRIDOR_SAMPLES[NOOK_CORRIDOR_SAMPLES.length - 1];
  assert.equal(
    getGroundHeight(end.x, end.z, end.y),
    -18,
    "旋径终点（平台中心）地面高度应为 -18",
  );
  // 逐段可行走 + 高度总体下降（每 1/4 段都比上一段低或持平）
  const step = Math.floor(NOOK_CORRIDOR_SAMPLES.length / 4);
  for (let i = 0; i < 4; i += 1) {
    const probe = NOOK_CORRIDOR_SAMPLES[i * step];
    assert.ok(
      getGroundHeight(probe.x, probe.z, probe.y) !== null,
      `旋径 ${i}/4 段应可行走`,
    );
    const next = NOOK_CORRIDOR_SAMPLES[(i + 1) * step];
    assert.ok(
      next.y <= probe.y + 0.5,
      `旋径应总体下行（段 ${i}: ${probe.y} → ${next.y}）`,
    );
  }
  // 平台矩形可行走（四角内缩采样；refY = -18 多层口径——蝶径 A 在其正上方）。
  // 西北角旋径汇入平台处地面为 -17（径末缓降），故断言「茧居所层」高度带。
  for (const [dx, dz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) {
    const x = CHRYSALIS_NOOK.center.x + dx;
    const z = CHRYSALIS_NOOK.center.z + dz;
    const g = getGroundHeight(x, z, -18);
    assert.ok(
      g !== null && g >= -18 && g <= -16,
      `平台点 (${dx},${dz}) 应可行走且在茧居所层（实际 ${g}）`,
    );
  }
  // 多层地形：茧居所层不被头顶蝶径 A 吸走，蝶径层也不被茧居所接住
  const trailAOverlap = { x: 2.4, z: -20 }; // 蝶径 A 在此上方 ~0.5 高度经过
  assert.equal(
    getGroundHeight(trailAOverlap.x, trailAOverlap.z, -18),
    -18,
    "茧居所层查询应返回平台高度（头顶蝶径不参与）",
  );
  assert.ok(
    getGroundHeight(trailAOverlap.x, trailAOverlap.z, 0.4) !== null,
    "蝶径层查询应保持可行走",
  );
  assert.notEqual(
    getGroundHeight(trailAOverlap.x, trailAOverlap.z, 0.4),
    -18,
    "蝶径层不应被吸到茧居所层",
  );
  // 区域名：平台报「茧居所」，下行段报「旋径」，主岛面仍报主岛
  assert.equal(
    getZoneName(CHRYSALIS_NOOK.center.x, CHRYSALIS_NOOK.center.z, -18),
    "茧居所",
  );
  const mid = NOOK_CORRIDOR_SAMPLES[Math.floor(NOOK_CORRIDOR_SAMPLES.length / 2)];
  assert.equal(
    getZoneName(mid.x, mid.z, mid.y),
    NOOK_CORRIDOR.zoneName,
    "旋径中段应报旋径区域名",
  );
  assert.equal(getZoneName(0, 0), MAIN_ISLAND.name, "主岛中心仍应报主岛");
});

/* ------------------------------ 传送目标（阶段 2 快速导航） ------------------------------ */

test("传送目标表：出生点 + 三屿 + 茧居所，落点全部可行走且在结构碰撞体外", () => {
  const ids = TELEPORT_SPOTS.map((spot) => spot.id);
  assert.deepEqual(
    [...ids].sort(),
    ["chrysalis-nook", "isle-agehaos", "isle-cs", "isle-moss", "spawn"],
    "传送目标应覆盖出生点 / 三屿 / 茧居所",
  );

  for (const spot of TELEPORT_SPOTS) {
    // 落点可行走（带落点高度参考的多层口径）——永不传送到空域或错误层
    const ground = getGroundHeight(spot.x, spot.z, spot.y);
    assert.ok(
      ground !== null,
      `${spot.id} 落点 (${spot.x},${spot.z}) 应在可行走面上（多层口径）`,
    );
    // 落点在结构碰撞体外（不被推出）
    const pushed = resolveCylinderPush(spot.x, spot.z, PLAYER_PHYSICS.bodyRadius);
    assert.equal(
      pushed,
      null,
      `${spot.id} 落点应在结构碰撞体外（实际被 ${pushed?.colliderId ?? ""} 推出）`,
    );
    // 相机构图角有效
    assert.ok(
      Number.isFinite(spot.cameraYaw) && Number.isFinite(spot.heading),
      `${spot.id} 应带相机 yaw 与朝向`,
    );
  }

  // 三屿落点面朝岛心（传送后即对准项目设施构图）；Moss 穹舱有偏移，
  // 落点距离按各屿碰撞体中心（offsetX/offsetZ）度量
  for (const isle of PROJECT_ISLES) {
    const spot = TELEPORT_SPOTS.find((item) => item.id === isle.id);
    const colliderX = isle.center.x + isle.collider.offsetX;
    const colliderZ = isle.center.z + isle.collider.offsetZ;
    const d = Math.hypot(spot.x - colliderX, spot.z - colliderZ);
    assert.ok(
      d >= isle.collider.radius + PLAYER_PHYSICS.bodyRadius + 0.3,
      `${isle.id} 落点应距碰撞体中心 ≥ 碰撞半径 + 体半径（实际 ${d.toFixed(2)}）`,
    );
    assert.ok(
      Math.hypot(spot.x - isle.center.x, spot.z - isle.center.z) <= isle.radius,
      `${isle.id} 落点应在盘面内`,
    );
  }
});

/* ------------------------------ 三屿屏幕贴图登记（§4 共同规范） ------------------------------ */

test("三屿屏幕贴图登记齐全：三 slug 全覆盖，路径指向 §11.2 产物目录", () => {
  assert.equal(ISLE_SCREENS.length, 3, "应恰好登记三块屏幕贴图");
  assert.deepEqual(
    [...ISLE_SCREENS.map((screen) => screen.slug)].sort(),
    ["agehaos", "cs-skin-invest", "moss-world"],
    "屏幕贴图登记应覆盖三项目 slug",
  );
  for (const screen of ISLE_SCREENS) {
    assert.ok(
      screen.path.startsWith("/world/screens/"),
      `${screen.slug} 贴图应指向 public/world/screens/（实际 ${screen.path}）`,
    );
    assert.ok(screen.aspect > 0.5 && screen.aspect < 2.5, `${screen.slug} 宽高比应合理`);
    assert.ok(
      screen.mountDistance >= 40,
      `${screen.slug} 按需挂载距离应 ≥40（§11.2）`,
    );
  }
});

test("三屿结构碰撞体逐屿登记：Moss 穹舱按偏移落位（蝶径到达区不穿模）", () => {
  for (const isle of PROJECT_ISLES) {
    const collider = STATIC_COLLIDERS.find((c) => c.id === `collider-${isle.id}-structure`);
    assert.ok(collider, `应登记 ${isle.id} 结构碰撞体`);
    assert.equal(
      collider.centerX,
      isle.center.x + isle.collider.offsetX,
      `${isle.id} 碰撞体中心应按屿数据偏移`,
    );
    assert.equal(collider.radius, isle.collider.radius);
    // 蝶径终点不被本屿碰撞体吞没（阶段 2 修正：CS 终点外移的回归守护）
    const trail = TRAILS.find((t) => t.targetIsleId === isle.id);
    const end = trail.controlPoints[trail.controlPoints.length - 1];
    const endDistance = Math.hypot(collider.centerX - end.x, collider.centerZ - end.z);
    assert.ok(
      endDistance >= collider.radius + PLAYER_PHYSICS.bodyRadius,
      `${isle.id} 蝶径终点应在碰撞体外（终点距碰撞心 ${endDistance.toFixed(2)} < ${collider.radius + PLAYER_PHYSICS.bodyRadius}）`,
    );
  }
  // Moss 交互锚点在穹舱碰撞体外（玩家能站到监测屏前触发提示）
  const moss = PROJECT_ISLES.find((isle) => isle.slug === "moss-world");
  const mossCollider = STATIC_COLLIDERS.find((c) => c.id === "collider-isle-moss-structure");
  const anchor = INTERACTABLES.find((item) => item.slug === "moss-world");
  const anchorDistance = Math.hypot(
    mossCollider.centerX - anchor.x,
    mossCollider.centerZ - anchor.z,
  );
  assert.ok(
    anchorDistance >= mossCollider.radius + PLAYER_PHYSICS.bodyRadius,
    `Moss 监测屏锚点应在穹舱碰撞体外（实际 ${anchorDistance.toFixed(2)}）`,
  );
  assert.equal(anchor.x, moss.center.x + moss.anchor.offsetX, "锚点应按屿数据偏移登记");
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

/* --------------------- 阶段 3：品牌三件套 / 画廊 / 石碑与导向标 --------------------- */

test("引导蝶 Ageha 参数与蓝图 §5.2 一致：翼展 2.2、巡飞 4/s、静止 8s 示意、8Hz ±40°", () => {
  assert.equal(GUIDE_BUTTERFLY.wingspan, 2.2, "翼展应为 2.2（§5.2）");
  assert.equal(GUIDE_BUTTERFLY.speed, 4, "巡飞速度应为 4 unit/s");
  assert.equal(GUIDE_BUTTERFLY.idleReturnSeconds, 8, "静止 8s 飞回示意方向");
  assert.equal(GUIDE_BUTTERFLY.wingFrequency, 8, "扇翼频率 8Hz");
  assert.equal(GUIDE_BUTTERFLY.wingAmplitudeDeg, 40, "扇翼幅度 ±40°");
  assert.ok(GUIDE_BUTTERFLY.flyHeight >= 1, "巡飞高度应在蝶径表面之上 ≥1 unit");
});

test("蝶枢 transmission 名额管控：高档预算 = 3（蝶枢翼组 ×2 + Moss 穹舱 ×1），中低档为 0", () => {
  assert.equal(TIER_PARAMS.high.transmissionBudget, 3, "高档 transmission 预算应为 3（§3.2 全场上限）");
  assert.equal(TIER_PARAMS.medium.transmissionBudget, 0, "中档应降级为 opacity（无 transmission）");
  assert.equal(TIER_PARAMS.low.transmissionBudget, 0, "低档应无 transmission");
});

test("茧居所画廊展品登记：三幅原稿（hero ×2 + 概念图），路径指向 §11.2 产物，按需挂载 ≥30", () => {
  assert.equal(GALLERY_ARTWORKS.length, 3, "画廊应恰好登记三幅展品");
  for (const art of GALLERY_ARTWORKS) {
    assert.ok(
      art.path.startsWith("/world/gallery/"),
      `${art.id} 展品应指向 public/world/gallery/（实际 ${art.path}）`,
    );
    assert.ok(art.aspect > 0.5 && art.aspect < 2.5, `${art.id} 宽高比应合理（实际 ${art.aspect.toFixed(2)}）`);
    assert.ok(art.mountDistance >= 30, `${art.id} 按需挂载距离应 ≥30（§11.2）`);
    assert.ok(art.caption.length > 0, `${art.id} 应有说明牌文案`);
  }
  assert.equal(new Set(GALLERY_ARTWORKS.map((a) => a.id)).size, 3, "展品 id 不得重复");
});

test("主岛石碑落位：在主岛椭圆面内、距出生点 ≥3（不挡初始构图与回航落点）", () => {
  const ex = SIGN_POST.x / MAIN_ISLAND.semiAxisX;
  const ez = SIGN_POST.z / MAIN_ISLAND.semiAxisZ;
  assert.ok(ex * ex + ez * ez <= 1, "石碑应在主岛椭圆面内");
  const d = dist2D(SIGN_POST.x, SIGN_POST.z, SPAWN_POINT.x, SPAWN_POINT.z);
  assert.ok(d >= 3, `石碑应距出生点 ≥3（实际 ${d.toFixed(2)}）`);
  // 碰撞体登记（resolveCylinderPush 无 Y 过滤，需保证不吞传送落点）
  const collider = STATIC_COLLIDERS.find((c) => c.id === `collider-${SIGN_POST.id}`);
  assert.ok(collider, "石碑应登记静态碰撞体");
  assert.equal(resolveCylinderPush(SPAWN_POINT.x, SPAWN_POINT.z, PLAYER_PHYSICS.bodyRadius), null, "出生点不得被石碑推出");
});

test("三径导向标：每径一座、在主岛内、距径中线 ≥1.9（不占可行走带）", () => {
  assert.equal(TRAIL_BEACONS.length, 3, "应有三座导向标（每径一座）");
  const trailIds = new Set(TRAILS.map((t) => t.id));
  for (const beacon of TRAIL_BEACONS) {
    assert.ok(trailIds.has(beacon.trailId), `${beacon.id} 应指向存在的蝶径`);
    // 在主岛椭圆面内（径头均在岛缘附近）
    const ex = beacon.x / MAIN_ISLAND.semiAxisX;
    const ez = beacon.z / MAIN_ISLAND.semiAxisZ;
    assert.ok(
      ex * ex + ez * ez <= 1 + 1e-6,
      `${beacon.id} 应在主岛面内（椭圆值 ${(ex * ex + ez * ez).toFixed(3)}）`,
    );
    // 距所属蝶径中线的最近距离 ≥1.9（径半宽 1.6 + 玩家可站缘位余量）
    const trail = TRAILS.find((t) => t.id === beacon.trailId);
    let best = Infinity;
    for (let i = 1; i < trail.samples.length; i += 1) {
      const a = trail.samples[i - 1];
      const b = trail.samples[i];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz || 1;
      let t = ((beacon.x - a.x) * abx + (beacon.z - a.z) * abz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(beacon.x - (a.x + abx * t), beacon.z - (a.z + abz * t)));
    }
    assert.ok(
      best >= 1.9,
      `${beacon.id} 距径中线 ${best.toFixed(2)} 应 ≥1.9（不占可行走带）`,
    );
    // 碰撞体登记
    assert.ok(
      STATIC_COLLIDERS.some((c) => c.id === `collider-${beacon.id}`),
      `${beacon.id} 应登记静态碰撞体`,
    );
  }
  // 导向标主题色关联三 slug（与目标屿一一对应）
  assert.deepEqual(
    [...TRAIL_BEACONS.map((b) => b.accentSlug)].sort(),
    ["agehaos", "cs-skin-invest", "moss-world"],
  );
});
