"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, MathUtils, PerspectiveCamera, Ray, Vector3 } from "three";
import { CAMERA_LIMITS } from "@/lib/world/constants";
import { CAMERA_OCCLUDERS } from "@/lib/world/colliders";
import { PROJECT_ISLES, getGroundHeight } from "@/lib/world/layout";
import { cameraState, inputState } from "./inputState";
import { aimFollowCamera } from "./cameraFraming";
import type { PlayerApi } from "./usePlayerController";

/**
 * 第三人称跟随相机（R3 重构）。
 *
 * 稳定性三项根因修复：
 * 1. 取消「初始特殊机位 → 首次移动跳回跟随」双状态：相机从第一帧起就是
 *    跟随解算结果，Canvas 首帧位置与解算值一致，移动 / 缩放不再跳镜头；
 * 2. 取景目标前探 2.5m 并随视口宽高比自适应距离：竖屏不会把主体挤出画幅；
 * 3. 靠近项目屿时，视点平滑抬向地标上部并适度后退（仅取景辅助，
 *    不锁死玩家操作），高塔 / 观测环 / 穹舱在正常跟随距离下完整入画。
 *
 * 其余行为沿用：拖拽轨道观察（不锁指针）、滚轮 / 双指三档距离、
 * 相机遮挡 raycast 前移、相机不进入地面、帧率无关阻尼跟随。
 */
const LANDMARK_FOCUS: Record<
  string,
  { lift: number; back: number; lookHeight: number }
> = {
  // P1：接近档案塔时收小后退/抬视量——塔身仍完整，信灯不被拉成远处小点
  "cs-major-archive": { lift: 2.2, back: 2.2, lookHeight: 4.4 },
  calendar: { lift: 1.9, back: 2.6, lookHeight: 3.6 },
  "blog-cms": { lift: 0.9, back: 1.8, lookHeight: 1.7 },
};

/** 模块级命令式入口（同 ApplyShadowPipeline 口径：避免组件内改 hook 返回值） */
function applyCameraFov(camera: unknown, fov: number): void {
  if (!(camera instanceof PerspectiveCamera)) return;
  if (camera.fov === fov) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * 验收机位调试（同 ?tier= 的 URL 覆盖约定）：?cam=x,y,z,tx,ty,tz。
 * 提供绝对机位 + 注视点，跳过跟随 / 遮挡 / 地面钳制——供地形与构图
 * 验收截图复现同一机位（Before/After 对比、俯视、岛侧低角度等
 * 正常轨道相机到不了的角度）。参数非法时静默忽略。
 */
function pickPhotoPose(): { pos: Vector3; look: Vector3 } | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("cam");
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 6 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return {
    pos: new Vector3(parts[0], parts[1], parts[2]),
    look: new Vector3(parts[3], parts[4], parts[5]),
  };
}

export function FollowCamera({
  player,
  isMobileLike,
  distanceOffset = 0,
  alignWeight = 0.4,
}: {
  player: PlayerApi;
  isMobileLike: boolean;
  /** 移动端距离补偿（蓝图 §6.3） */
  distanceOffset?: number;
  /** 移动时 yaw 对齐移动方向的权重（桌面 0.4 / 触屏 0.15，§6.3 简化摄影机） */
  alignWeight?: number;
}) {
  const { camera, gl, size } = useThree();

  const lookCurrent = useRef(
    new Vector3(
      CAMERA_LIMITS.initialLookAt.x,
      CAMERA_LIMITS.initialLookAt.y,
      CAMERA_LIMITS.initialLookAt.z,
    ),
  );
  const desiredPos = useRef(new Vector3());
  const desiredLook = useRef(new Vector3());
  const occluders = useMemo<Box3[]>(
    () =>
      CAMERA_OCCLUDERS.map(
        (box) =>
          new Box3(
            new Vector3(box.minX, box.minY, box.minZ),
            new Vector3(box.maxX, box.maxY, box.maxZ),
          ),
      ),
    [],
  );
  const ray = useMemo(() => new Ray(), []);
  const hitPoint = useMemo(() => new Vector3(), []);
  const dirVec = useMemo(() => new Vector3(), []);
  // 验收机位：一次性解析 ?cam=，命中则整帧跳过跟随解算
  const photoPose = useMemo(() => pickPhotoPose(), []);

  // 视口形态变化时同步 FOV（Canvas camera prop 不会随 isMobileLike 更新）
  useEffect(() => {
    applyCameraFov(
      camera,
      isMobileLike ? CAMERA_LIMITS.fovMobile : CAMERA_LIMITS.fovDesktop,
    );
  }, [camera, isMobileLike]);

  // 画布指针拖拽（轨道观察）/ 双指捏合（距离档）/ 滚轮——不锁定指针，
  // 点击留给场景交互。拖拽累计位移：超过阈值判定为「观察拖拽」而非「点击」，
  // 供场景交互体（点击打开详情）与面板（点击空白关闭）对账
  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false;
    let dragDistance = 0;
    const DRAG_THRESHOLD = 6;
    // 触摸 PointerEvent 的 movementX 在 Safari iOS 恒为 0：自算差值
    const pointers = new Map<number, { x: number; y: number }>();
    // 双指捏合：基准距离与累计变化（每 ±80px 一步距离档）
    let pinchBase = 0;
    let pinchAccum = 0;
    const PINCH_STEP = 80;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        dragging = true;
        dragDistance = 0;
        inputState.pointerDragged = false;
      } else {
        // 双指进入捏合：退出单指观察（拖拽视角让位给缩放）
        dragging = false;
        const [a, b] = [...pointers.values()];
        pinchBase = Math.hypot(a.x - b.x, a.y - b.y);
        pinchAccum = 0;
        inputState.pointerDragged = true;
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const prev = pointers.get(event.pointerId);
      if (!prev) return;
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2) {
        // 双指捏合：距离变化 → 距离档步进（拉远 +1 / 拉近 -1，与滚轮同通道）
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        pinchAccum += distance - pinchBase;
        pinchBase = distance;
        while (pinchAccum >= PINCH_STEP) {
          inputState.zoomStep += 1;
          pinchAccum -= PINCH_STEP;
        }
        while (pinchAccum <= -PINCH_STEP) {
          inputState.zoomStep -= 1;
          pinchAccum += PINCH_STEP;
        }
        return;
      }

      if (!dragging) return;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      if (dragDistance > DRAG_THRESHOLD) inputState.pointerDragged = true;
      inputState.lookDelta.x += dx * 0.0042;
      inputState.lookDelta.y += dy * 0.0032;
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      // 捏合后残留的单指不回到拖拽（防视角跳变），抬指重按再观察
      dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      inputState.zoomStep += event.deltaY > 0 ? 1 : -1;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const p = player.pos.current;
    const aspect = size.width / Math.max(1, size.height);

    // ---- 验收机位（?cam=）：固定机位 + 注视点，不做任何跟随解算 ----
    if (photoPose) {
      camera.position.copy(photoPose.pos);
      lookCurrent.current.copy(photoPose.look);
      camera.lookAt(lookCurrent.current);
      return;
    }

    // ---- 输入消费：轨道观察 / 距离档 ----
    if (inputState.lookDelta.x !== 0 || inputState.lookDelta.y !== 0) {
      cameraState.yaw -= inputState.lookDelta.x;
      cameraState.pitch += inputState.lookDelta.y;
      cameraState.yaw = MathUtils.clamp(
        cameraState.yaw,
        -CAMERA_LIMITS.yawRange,
        CAMERA_LIMITS.yawRange,
      );
      cameraState.pitch = MathUtils.clamp(
        cameraState.pitch,
        CAMERA_LIMITS.pitchMin,
        CAMERA_LIMITS.pitchMax,
      );
      inputState.lookDelta.x = 0;
      inputState.lookDelta.y = 0;
    }
    if (inputState.zoomStep !== 0) {
      cameraState.distanceIndex = MathUtils.clamp(
        cameraState.distanceIndex + inputState.zoomStep,
        0,
        CAMERA_LIMITS.distances.length - 1,
      );
      inputState.zoomStep = 0;
    }

    // ---- 移动时 yaw 缓慢对齐移动方向（§7；权重：桌面 0.4 / 触屏 0.15 弱回正） ----
    const v = player.vel.current;
    const sp = Math.hypot(v.x, v.z);
    if (sp > 2) {
      const moveYaw = Math.atan2(-v.x / sp, -v.z / sp);
      let diff = moveYaw - cameraState.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cameraState.yaw += diff * Math.min(1, alignWeight * 2 * delta);
    }

    // ---- 地标取景辅助：靠近项目屿且面向它时，视点抬向地标上部并后退 ----
    const fwdX = -Math.sin(cameraState.yaw);
    const fwdZ = -Math.cos(cameraState.yaw);
    let focusLift = 0;
    let focusBack = 0;
    for (const isle of PROJECT_ISLES) {
      const dx = isle.center.x - p.x;
      const dz = isle.center.z - p.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 34) continue;
      const focus = LANDMARK_FOCUS[isle.slug];
      if (!focus) continue;
      const facing = Math.max(0, (dx / (distance || 1)) * fwdX + (dz / (distance || 1)) * fwdZ);
      const strength =
        (1 - smoothstep(8, 34, distance)) * (0.3 + facing * 0.7);
      // 以地标上部为参考点，平滑抬视点；不改变玩家可控的 yaw/pitch
      const targetLookY = isle.center.y + focus.lookHeight;
      focusLift = Math.max(focusLift, (targetLookY - (p.y + CAMERA_LIMITS.lookHeight)) * strength * 0.8);
      focusBack = Math.max(focusBack, focus.back * strength);
    }

    // ---- 视口自适应：竖屏适度后退，保持主视觉完整 ----
    const portraitBoost = Math.max(0, 1 - aspect) * 4.4;
    const distance =
      CAMERA_LIMITS.distances[cameraState.distanceIndex] +
      distanceOffset +
      portraitBoost +
      focusBack;
    const cosPitch = Math.cos(cameraState.pitch);

    desiredLook.current.set(
      p.x + fwdX * CAMERA_LIMITS.lookAhead,
      p.y + CAMERA_LIMITS.lookHeight + focusLift,
      p.z + fwdZ * CAMERA_LIMITS.lookAhead,
    );

    // 相机 = 视点 + 球坐标偏移
    const offX = Math.sin(cameraState.yaw) * cosPitch;
    const offZ = Math.cos(cameraState.yaw) * cosPitch;
    const offY = Math.sin(cameraState.pitch);
    desiredPos.current.set(
      desiredLook.current.x + offX * distance,
      desiredLook.current.y + offY * distance,
      desiredLook.current.z + offZ * distance,
    );

    // ---- 遮挡：目标点 → 相机连线 raycast，命中则相机前移至命中点前 ----
    const dir = dirVec.copy(desiredPos.current).sub(desiredLook.current);
    const desiredDist = dir.length();
    dir.normalize();
    ray.origin.copy(desiredLook.current);
    ray.direction.copy(dir);
    let nearest = desiredDist;
    for (const box of occluders) {
      // 前探视点贴到地标时会进入遮挡盒；此时相交点是对侧盒壁，
      // 按原逻辑会把相机拉到建筑内部。起点在盒内就不参与遮挡前移。
      if (box.containsPoint(ray.origin)) continue;
      if (ray.intersectBox(box, hitPoint)) {
        const d = hitPoint.distanceTo(ray.origin);
        if (d < nearest) nearest = Math.max(2.2, d - 0.3);
      }
    }
    if (nearest < desiredDist) {
      desiredPos.current
        .copy(desiredLook.current)
        .add(dir.multiplyScalar(nearest));
    }

    // ---- 相机不进入地面 / 不贴到角色脚下 ----
    const camGround = getGroundHeight(
      desiredPos.current.x,
      desiredPos.current.z,
      desiredPos.current.y,
    );
    if (camGround !== null && desiredPos.current.y < camGround + 0.5) {
      desiredPos.current.y = camGround + 0.5;
    }
    desiredPos.current.y = Math.max(desiredPos.current.y, p.y + 0.9);

    // ---- 帧率无关阻尼跟随（λ=4 位置 / λ=6 视点） ----
    const posLambda = 4;
    const lookLambda = 6;
    camera.position.set(
      MathUtils.damp(camera.position.x, desiredPos.current.x, posLambda, delta),
      MathUtils.damp(camera.position.y, desiredPos.current.y, posLambda, delta),
      MathUtils.damp(camera.position.z, desiredPos.current.z, posLambda, delta),
    );
    lookCurrent.current.set(
      MathUtils.damp(lookCurrent.current.x, desiredLook.current.x, lookLambda, delta),
      MathUtils.damp(lookCurrent.current.y, desiredLook.current.y, lookLambda, delta),
      MathUtils.damp(lookCurrent.current.z, desiredLook.current.z, lookLambda, delta),
    );
    aimFollowCamera(camera, lookCurrent.current, p);
  });

  return null;
}
