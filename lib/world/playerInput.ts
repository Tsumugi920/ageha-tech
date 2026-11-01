/**
 * 玩家输入状态机（纯 TS，无 React / three 依赖）：
 *
 * 键盘按「物理键」记录按下集合，再合成为逻辑移动轴——W 与 ↑、S 与 ↓、
 * A 与 ←、D 与 → 各为同一动作的同义键，松开其中一个不会清空另一个；
 * 相反方向同时按下互相抵消，松开一侧即恢复另一侧。左右 Shift 同样
 * 分别记录，任一按住即冲刺，全部松开才取消。
 *
 * 控制器只负责事件绑定与把合成结果写入 inputState；失焦 / 页面隐藏时
 * 调 clearMoveInput 清空键盘与摇杆共享态，避免恢复后残留。
 */

type MoveAxes = { x: number; y: number };

export type KeyboardMoveInput = {
  /** 返回该键是否属于移动 / 冲刺键（用于事件路由） */
  setKey(code: string, down: boolean): boolean;
  has(code: string): boolean;
  clear(): void;
  axes(): MoveAxes;
  sprint(): boolean;
};

export function isMovementKey(code: string): boolean {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "ArrowUp" ||
    code === "ArrowDown" ||
    code === "ArrowLeft" ||
    code === "ArrowRight"
  );
}

export function isSprintKey(code: string): boolean {
  return code === "ShiftLeft" || code === "ShiftRight";
}

export function createKeyboardMoveInput(): KeyboardMoveInput {
  const pressed = new Set<string>();

  const axes = (): MoveAxes => {
    let x = 0;
    let y = 0;
    if (pressed.has("KeyA") || pressed.has("ArrowLeft")) x -= 1;
    if (pressed.has("KeyD") || pressed.has("ArrowRight")) x += 1;
    if (pressed.has("KeyW") || pressed.has("ArrowUp")) y += 1;
    if (pressed.has("KeyS") || pressed.has("ArrowDown")) y -= 1;
    return { x, y };
  };

  const sprint = () => pressed.has("ShiftLeft") || pressed.has("ShiftRight");

  return {
    setKey(code, down) {
      if (!isMovementKey(code) && !isSprintKey(code)) return false;
      if (down) pressed.add(code);
      else pressed.delete(code);
      return true;
    },
    has(code) {
      return pressed.has(code);
    },
    clear() {
      pressed.clear();
    },
    axes,
    sprint,
  };
}

/** 控制器与摇杆共享的可变输入态（inputState 的最小子集） */
export type MutableMoveInput = {
  move: MoveAxes;
  joystick: MoveAxes;
  sprint: boolean;
};

export function syncKeyboardInput(
  input: MutableMoveInput,
  keyboard: KeyboardMoveInput,
): void {
  const next = keyboard.axes();
  input.move.x = next.x;
  input.move.y = next.y;
  input.sprint = keyboard.sprint();
}

/** 失焦 / 页面隐藏：键盘、摇杆与冲刺一并归零 */
export function clearMoveInput(input: MutableMoveInput): void {
  input.move.x = 0;
  input.move.y = 0;
  input.joystick.x = 0;
  input.joystick.y = 0;
  input.sprint = false;
}
