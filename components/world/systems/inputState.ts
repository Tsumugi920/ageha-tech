/**
 * 世界输入共享态（仅客户端运行时使用，非持久数据）。
 *
 * 高频输入（键鼠 / 摇杆 / 视角增量 / 滚轮）全部走这份模块级可变对象，
 * 由事件监听写入、帧循环（useFrame）读取消费——杜绝逐帧 React setState
 * 重渲整棵树（蓝图 §10 性能原则）。低频 UI 开关走 WorldUIContext。
 *
 * WorldCanvas 卸载时调用 resetInputState() 复位，防止跨会话残留。
 */
import { CAMERA_LIMITS } from "@/lib/world/constants";

export const inputState = {
  /** 键盘移动向量（x 右 / y 前，各 -1..1，控制器聚合 WASD·方向键） */
  move: { x: 0, y: 0 },
  /** 移动端虚拟摇杆向量（右 / 前，-1..1） */
  joystick: { x: 0, y: 0 },
  /** 冲刺（Shift 按住） */
  sprint: false,
  /** 待消费的观察增量（弧度；pointer 拖拽写入，FollowCamera 消费后清零） */
  lookDelta: { x: 0, y: 0 },
  /** 待消费的滚轮步进（+1 拉远 / -1 拉近） */
  zoomStep: 0,
  /** HUD「返回起点」请求（控制器消费后复位） */
  wantRespawn: false,
  /** 交互触发计数（E 键 / 提示条点击递增，InteractionSystem 对账消费） */
  interactToken: 0,
  /**
   * 指针拖拽守卫（阶段 2 交互）：pointerdown 复位，FollowCamera 拖拽累计
   * 位移超过阈值后置 true——区分「点击交互体」与「拖拽观察」，
   * 拖拽结束时的 pointerup 不触发场景交互 / 面板关闭。
   */
  pointerDragged: false,
  /**
   * 传送请求（DOM 层写入目标 id，TeleportSystem 帧内消费后清空）
   */
  teleportTarget: null as string | null,
  /**
   * 相机构图保持解除请求（TeleportSystem 起飞时置位，FollowCamera 帧内
   * 消费——传送作为首次输入也要立即接管相机，不能停在初始机位看戏）
   */
  wantCameraRelease: false,
  /**
   * 传送飞行中（TeleportSystem 置位）：控制器让位——跳过移动 / 贴地，
   * 位置完全由传送运镜接管，结束后复位。
   */
  teleportActive: false,
};

/** 相机轨道状态（yaw/pitch/距离档）：pointer 拖拽与跟随对齐共同驱动 */
export const cameraState: {
  yaw: number;
  pitch: number;
  distanceIndex: number;
} = {
  yaw: CAMERA_LIMITS.initialYaw,
  pitch: CAMERA_LIMITS.initialPitch,
  distanceIndex: CAMERA_LIMITS.initialDistanceIndex,
};

export function resetInputState() {
  inputState.move.x = 0;
  inputState.move.y = 0;
  inputState.joystick.x = 0;
  inputState.joystick.y = 0;
  inputState.sprint = false;
  inputState.lookDelta.x = 0;
  inputState.lookDelta.y = 0;
  inputState.zoomStep = 0;
  inputState.wantRespawn = false;
  inputState.interactToken = 0;
  inputState.pointerDragged = false;
  inputState.teleportTarget = null;
  inputState.teleportActive = false;
  inputState.wantCameraRelease = false;
  cameraState.yaw = CAMERA_LIMITS.initialYaw;
  cameraState.pitch = CAMERA_LIMITS.initialPitch;
  cameraState.distanceIndex = CAMERA_LIMITS.initialDistanceIndex;
}
