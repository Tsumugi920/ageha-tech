/**
 * 静态碰撞体与交互体登记（蓝图 §6.4 / §8）。
 *
 * - 碰撞体：AABB / 圆柱清单，控制器逐帧做位置推出（不做刚体）；
 * - 交互体：id / 位置 / 半径 / 类型 / slug，供 InteractionSystem 做距离检测；
 * - 相机遮挡体：Box3 清单，FollowCamera 做 raycast 前移（§7 遮挡处理）。
 *
 * 纯 TS 数据（无 three 依赖），node --test 直接 import 校验
 * （tests/world-layout.test.mjs：碰撞体须含蝶枢与三屿主体、交互登记覆盖三 slug）。
 */
import {
  BUTTERFLY_CORE,
  CHRYSALIS_NOOK,
  NORTH_RELAY,
  PROJECT_ISLES,
  SIGN_POST,
  TRAIL_BEACONS,
} from "./layout.ts";

export type CylinderCollider = {
  readonly kind: "cylinder";
  readonly id: string;
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
  readonly yMin: number;
  readonly yMax: number;
};

export type BoxCollider = {
  readonly kind: "box";
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
};

export type Collider = CylinderCollider | BoxCollider;

/**
 * 静态碰撞体清单：蝶枢悬空装置 + 三屿中央结构圆柱 + 主岛石碑与三径导向标。
 *
 * R3：蝶枢碰撞只覆盖悬空翼组（yMin 5.6），玩家在地面可从核心正下方穿过——
 * 这是「出生点 → 北径」的主动线，不再被中央柱子截断。圆柱推出按
 * 玩家脚部高度过滤，其他地面物件（石碑/导向标/项目结构）仍然实体阻挡。
 */
export const STATIC_COLLIDERS: readonly Collider[] = [
  {
    kind: "cylinder",
    id: "collider-butterfly-core",
    centerX: BUTTERFLY_CORE.center.x,
    centerZ: BUTTERFLY_CORE.center.z,
    radius: 3.05,
    yMin: 5.5,
    yMax: 10.1,
  },
  ...PROJECT_ISLES.map(
    (isle): CylinderCollider => ({
      kind: "cylinder",
      id: `collider-${isle.id}-structure`,
      centerX: isle.center.x + isle.collider.offsetX,
      centerZ: isle.center.z + isle.collider.offsetZ,
      radius: isle.collider.radius,
      yMin: isle.center.y,
      yMax: isle.center.y + 14,
    }),
  ),
  {
    kind: "cylinder",
    id: `collider-${NORTH_RELAY.id}`,
    centerX: NORTH_RELAY.x,
    centerZ: NORTH_RELAY.z,
    radius: NORTH_RELAY.radius,
    yMin: -1,
    yMax: 1.4,
  },
  {
    kind: "cylinder",
    id: `collider-${SIGN_POST.id}`,
    centerX: SIGN_POST.x,
    centerZ: SIGN_POST.z,
    radius: 1.3,
    yMin: -1,
    yMax: 2.8,
  },
  ...TRAIL_BEACONS.map(
    (beacon): CylinderCollider => ({
      kind: "cylinder",
      id: `collider-${beacon.id}`,
      centerX: beacon.x,
      centerZ: beacon.z,
      radius: 0.45,
      yMin: -1,
      yMax: 1.4,
    }),
  ),
] as const;

/**
 * 相机遮挡体（AABB）：相机↔取景目标连线 raycast 命中则前移（§7）。
 * 蝶枢只登记悬空翼组高度（相机在地面穿行时不会被头顶装置推成特写）；
 * 三屿结构体量按各屿 collider 尺寸推导。
 *
 * CS 屿额外登记抬升观测环：环圈 + 四根斜撑横向铺到半径 ~6.8、
 * 顶部到岛面上方 ~7.8，而中央塔芯遮挡盒只有 2.8；从 CS 落点转身
 * 回望主岛时，跟随相机（14m）正好会绕进观测环，被近在 3m 的斜撑
 * 与前置竖屏挡满前景。补一个环体遮挡盒让相机按既有逻辑前移，
 * 不改变玩家移动 / 场景内容。
 */
export const CAMERA_OCCLUDERS: readonly BoxCollider[] = [
  {
    kind: "box",
    id: "occluder-butterfly-core",
    minX: -3.3, maxX: 3.3,
    minY: 5.4, maxY: 10.2,
    minZ: -3.3, maxZ: 3.3,
  },
  ...PROJECT_ISLES.map(
    (isle): BoxCollider => ({
      kind: "box",
      id: `occluder-${isle.id}-structure`,
      minX: isle.center.x + isle.collider.offsetX - isle.collider.radius,
      maxX: isle.center.x + isle.collider.offsetX + isle.collider.radius,
      minY: isle.center.y,
      maxY: isle.center.y + 14,
      minZ: isle.center.z + isle.collider.offsetZ - isle.collider.radius,
      maxZ: isle.center.z + isle.collider.offsetZ + isle.collider.radius,
    }),
  ),
  {
    kind: "box",
    id: "occluder-isle-cs-observatory-ring",
    minX: -70.9, maxX: -57.1,
    minY: 10.0, maxY: 15.8,
    minZ: 27.1, maxZ: 40.9,
  },
] as const;

/* ------------------------------ 交互体 ------------------------------ */

export type Interactable = {
  readonly id: string;
  readonly type: "project" | "core" | "egg" | "relay";
  /** project 类型对应 lib/projects.ts 的 slug（详情面板 / 路由入口的数据键） */
  readonly slug?: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 交互半径（§8：距离 <6 触发提示） */
  readonly radius: number;
  /** 场景内名牌文案（三屿名牌来自 lib/projects.ts 项目名，此处只存位置语义） */
  readonly label: string;
};

/**
 * 交互体登记：三项目屿 + 蝶枢 + 茧居所彩蛋（阶段 2 开放：旋径可达，
 * 进入发现半径后导航面板点亮传送项；画廊展品交互在阶段 3 落地）。
 * world-layout.test.mjs 校验 slug 覆盖三项目 + core / egg 类型。
 */
export const INTERACTABLES: readonly Interactable[] = [
  ...PROJECT_ISLES.map((isle) => ({
    id: isle.id,
    type: "project" as const,
    slug: isle.slug,
    x: isle.center.x + (isle.anchor?.offsetX ?? 0),
    y: isle.center.y,
    z: isle.center.z + (isle.anchor?.offsetZ ?? 0),
    radius: 6,
    label: isle.name,
  })),
  {
    id: NORTH_RELAY.id,
    type: "relay",
    x: NORTH_RELAY.x,
    y: 0,
    z: NORTH_RELAY.z,
    radius: 6,
    label: "北径信标",
  },
  {
    id: BUTTERFLY_CORE.id,
    type: "core",
    x: BUTTERFLY_CORE.center.x,
    y: BUTTERFLY_CORE.center.y,
    z: BUTTERFLY_CORE.center.z,
    radius: 6,
    label: "蝶枢 · 世界核心",
  },
  {
    id: CHRYSALIS_NOOK.id,
    type: "egg",
    x: CHRYSALIS_NOOK.center.x,
    y: CHRYSALIS_NOOK.center.y,
    z: CHRYSALIS_NOOK.center.z,
    radius: 6,
    label: "茧居所 · 设计原稿画廊",
  },
] as const;

/**
 * 圆柱碰撞体位置推出：若 (x,z) 进入圆柱（含玩家体半径），返回推出后的
 * 坐标；否则返回 null。
 *
 * feetY 提供时按玩家身位高度过滤（0.35 悬浮体 + 1.2 身高），使悬空装置
 * （蝶枢）不阻挡地面通行；不提供时按无限高碰撞体处理（数据校验 / 默认）。
 */
export function resolveCylinderPush(
  x: number,
  z: number,
  bodyRadius: number,
  feetY?: number,
): { x: number; z: number; colliderId: string } | null {
  for (const collider of STATIC_COLLIDERS) {
    if (collider.kind !== "cylinder") continue;
    if (
      feetY !== undefined &&
      (feetY + 1.6 <= collider.yMin || feetY >= collider.yMax)
    ) {
      continue;
    }
    const dx = x - collider.centerX;
    const dz = z - collider.centerZ;
    const d = Math.hypot(dx, dz);
    const minDist = collider.radius + bodyRadius;
    if (d < minDist && d > 1e-4) {
      return {
        x: collider.centerX + (dx / d) * minDist,
        z: collider.centerZ + (dz / d) * minDist,
        colliderId: collider.id,
      };
    }
  }
  return null;
}
