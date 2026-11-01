/**
 * P4 探索目标与进度（纯 TS，node --test 可直接导入）。
 *
 * 目标只复用已经存在的世界事件：北径信标（P2）、三个项目区体验（P3）、
 * 茧居所发现（画廊彩蛋）。不新增区域、不锁任何项目正文或路由。
 * 进度只记录目标 id 的完成状态，不保存身份、位置或访问轨迹。
 */

export const EXPLORE_GOALS = [
  {
    id: "north-relay",
    title: "点亮北径信标",
    hint: "在主岛北径口按下 E 或点击信标",
  },
  {
    id: "agehaos-experience",
    title: "终端体验",
    hint: "在 AgehaOS 切换任一演示界面",
  },
  {
    id: "cs-experience",
    title: "观测体验",
    hint: "在 CS 观测屏切换任一视图",
  },
  {
    id: "moss-experience",
    title: "穹舱光照",
    hint: "为 Moss 穹舱选择任一光照",
  },
  {
    id: "nook-discovery",
    title: "发现茧居所",
    hint: "沿主岛西北旋径找到隐藏画廊",
  },
] as const;

export type ExploreGoal = (typeof EXPLORE_GOALS)[number];
export type ExploreGoalId = ExploreGoal["id"];
export type ExploreProgress = Readonly<Record<ExploreGoalId, boolean>>;

export const EXPLORE_TOTAL = EXPLORE_GOALS.length;

const GOAL_IDS = new Set<string>(EXPLORE_GOALS.map((goal) => goal.id));

export function isExploreGoalId(value: unknown): value is ExploreGoalId {
  return typeof value === "string" && GOAL_IDS.has(value);
}

export function getExploreGoal(id: ExploreGoalId): ExploreGoal {
  const goal = EXPLORE_GOALS.find((item) => item.id === id);
  if (!goal) throw new Error(`未知探索目标：${id}`);
  return goal;
}

/** 项目体验 slug → 对应探索目标（只映射三个真实项目区） */
const EXPERIENCE_GOAL: Readonly<Record<string, ExploreGoalId>> = {
  agehaos: "agehaos-experience",
  "cs-skin-invest": "cs-experience",
  "moss-world": "moss-experience",
};

export function goalIdForExperience(slug: string): ExploreGoalId | null {
  return EXPERIENCE_GOAL[slug] ?? null;
}

export function createEmptyExploreProgress(): ExploreProgress {
  return EXPLORE_GOALS.reduce(
    (progress, goal) => {
      progress[goal.id] = false;
      return progress;
    },
    {} as Record<ExploreGoalId, boolean>,
  );
}

/** 完成一个目标；未知 id 或已完成时原样返回（引用不变，便于跳过更新） */
export function completeExploreGoal(
  progress: ExploreProgress,
  id: ExploreGoalId,
): ExploreProgress {
  if (!isExploreGoalId(id) || progress[id]) return progress;
  return { ...progress, [id]: true };
}

export function countCompletedGoals(progress: ExploreProgress): number {
  return EXPLORE_GOALS.reduce(
    (count, goal) => count + (progress[goal.id] ? 1 : 0),
    0,
  );
}

export function isExploreComplete(progress: ExploreProgress): boolean {
  return countCompletedGoals(progress) === EXPLORE_TOTAL;
}

/** 已完成 id，按目标登记顺序（存档序列化与界面展示共用同一顺序） */
export function listCompletedGoals(progress: ExploreProgress): ExploreGoalId[] {
  return EXPLORE_GOALS.filter((goal) => progress[goal.id]).map((goal) => goal.id);
}
