/**
 * 场景交互共享态（仅客户端运行时，非持久数据）。
 *
 * 与 inputState 同理：指针事件（悬停 / 点击）是低频但直接驱动帧内视觉的量，
 * 走模块级可变对象避免 React 重渲。DOM 侧（面板关闭守卫）也读同一份。
 */
export const interactionState = {
  /** 当前悬停的交互体 id（场景 mesh pointer 事件写入；null = 无悬停） */
  hoverId: null as string | null,
  /**
   * 场景点击守卫：3D 交互体点击时置位，同一事件冒泡到 document 的
   * 「点击场景空白关闭面板」监听消费后复位——防止点击交互体换开面板
   * 又立刻被空白关闭逻辑关掉的竞态（canvas 先于 document 收到事件）。
   */
  suppressSceneClose: false,
};
