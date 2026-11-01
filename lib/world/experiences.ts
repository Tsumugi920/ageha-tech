/**
 * 三项目区的场景内短体验（P3，纯 TS 数据）：
 *
 * 每个项目只提供 3 个演示选项 + 一次复位；全部是场景视觉状态，
 * 不伪装实时连接、实时行情或生态模拟。真实项目信息仍由详情面板
 * 从 lib/projects.ts 渲染，体验层不得出现项目外链。
 */
export type ExperienceProjectSlug = "agehaos" | "cs-skin-invest" | "moss-world";

export type ExperienceOption = {
  readonly id: string;
  readonly label: string;
};

export const EXPERIENCE_OPTIONS: Record<
  ExperienceProjectSlug,
  readonly ExperienceOption[]
> = {
  agehaos: [
    { id: "windows", label: "窗口" },
    { id: "files", label: "文件" },
    { id: "settings", label: "设置" },
  ],
  "cs-skin-invest": [
    { id: "portfolio", label: "资产" },
    { id: "holdings", label: "持仓" },
    { id: "trades", label: "成交" },
  ],
  "moss-world": [
    { id: "morning", label: "晨雾" },
    { id: "noon", label: "正午" },
    { id: "dusk", label: "暮光" },
  ],
} as const;

/** 场景体验标题：三区操作对象/结果不同，不共用“打开详情”语言。 */
export const EXPERIENCE_TITLES: Record<ExperienceProjectSlug, string> = {
  agehaos: "终端体验",
  "cs-skin-invest": "观测体验",
  "moss-world": "穹舱光照",
};

/** 诚实边界：体验属于作品集演示，不宣称实时连接/行情/生态模拟。 */
export const EXPERIENCE_NOTES: Record<ExperienceProjectSlug, string> = {
  agehaos: "界面演示 · 非实时连接",
  "cs-skin-invest": "演示数据 · 非实时行情",
  "moss-world": "灯光演示 · 非生态模拟",
};

export const EXPERIENCE_RESET_LABELS: Record<ExperienceProjectSlug, string> = {
  agehaos: "实拍",
  "cs-skin-invest": "实拍",
  "moss-world": "默认",
};

export function isExperienceProjectSlug(
  slug: string,
): slug is ExperienceProjectSlug {
  return slug === "agehaos" || slug === "cs-skin-invest" || slug === "moss-world";
}

export function getExperienceOptions(
  slug: string,
): readonly ExperienceOption[] | null {
  return isExperienceProjectSlug(slug) ? EXPERIENCE_OPTIONS[slug] : null;
}

export function isValidExperienceOption(
  slug: string,
  optionId: string | null,
): boolean {
  if (optionId === null) return true;
  const options = getExperienceOptions(slug);
  return Boolean(options?.some((option) => option.id === optionId));
}
