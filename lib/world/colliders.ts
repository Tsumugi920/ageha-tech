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
import { BUTTERFLY_CORE, PROJECT_ISLES } from "./layout.ts";

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
 * 静态碰撞体清单（阶段 1：蝶枢禁入圆柱 + 三屿中央结构占位圆柱；
 * 阶段 2 随正式造型扩充栏杆 / 基座 / 穹舱壁等）。
 */
export const STATIC_COLLIDERS: readonly Collider[] = [
  {
    kind: "cylinder",
    id: "collider-butterfly-core",
    centerX: BUTTERFLY_CORE.center.x,
    centerZ: BUTTERFLY_CORE.center.z,
    radius: 3.4,
    yMin: 0,
    yMax: 9.5,
  },
  ...PROJECT_ISLES.map(
    (isle): CylinderCollider => ({
      kind: "cylinder",
      id: `collider-${isle.id}-structure`,
      centerX: isle.center.x,
      centerZ: isle.center.z,
      radius: 3,
      yMin: isle.center.y,
      yMax: isle.center.y + 12,
    }),
  ),
] as const;

/**
 * 相机遮挡体（AABB）：相机↔角色连线 raycast 命中则前移（§7）。
 * 阶段 1 覆盖蝶枢与三屿结构体量；阶段 2 随造型精修同步更新。
 */
export const CAMERA_OCCLUDERS: readonly BoxCollider[] = [
  {
    kind: "box",
    id: "occluder-butterfly-core",
    minX: -3.6, maxX: 3.6,
    minY: 0, maxY: 9.5,
    minZ: -3.6, maxZ: 3.6,
  },
  ...PROJECT_ISLES.map(
    (isle): BoxCollider => ({
      kind: "box",
      id: `occluder-${isle.id}-structure`,
      minX: isle.center.x - 3.2, maxX: isle.center.x + 3.2,
      minY: isle.center.y, maxY: isle.center.y + 12,
      minZ: isle.center.z - 3.2, maxZ: isle.center.z + 3.2,
    }),
  ),
] as const;

/* ------------------------------ 交互体 ------------------------------ */

export type Interactable = {
  readonly id: string;
  readonly type: "project" | "core" | "egg";
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
 * 交互体登记：三项目屿 + 蝶枢 + 茧居所彩蛋（彩蛋阶段 2 开放交互）。
 * world-layout.test.mjs 校验 slug 覆盖三项目。
 */
export const INTERACTABLES: readonly Interactable[] = [
  ...PROJECT_ISLES.map((isle) => ({
    id: isle.id,
    type: "project" as const,
    slug: isle.slug,
    x: isle.center.x,
    y: isle.center.y,
    z: isle.center.z,
    radius: 6,
    label: isle.name,
  })),
  {
    id: BUTTERFLY_CORE.id,
    type: "core",
    x: BUTTERFLY_CORE.center.x,
    y: BUTTERFLY_CORE.center.y,
    z: BUTTERFLY_CORE.center.z,
    radius: 6,
    label: "蝶枢 · 世界核心",
  },
] as const;

/**
 * 圆柱碰撞体位置推出：若 (x,z) 进入圆柱（含玩家体半径），返回推出后的
 * 坐标；否则返回 null。控制器逐帧调用（阶段 1 全部为圆柱碰撞体）。
 */
export function resolveCylinderPush(
  x: number,
  z: number,
  bodyRadius: number,
): { x: number; z: number; colliderId: string } | null {
  for (const collider of STATIC_COLLIDERS) {
    if (collider.kind !== "cylinder") continue;
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
