/**
 * 三项目区的场景内短体验（纯 TS 数据）：
 *
 * 每个项目只提供 3 个演示选项 + 一次复位；全部是场景示意，
 * 不伪装实时连接或项目真实画面。真实项目信息仍由详情面板
 * 从 lib/projects.ts 渲染，体验层不得出现项目外链。
 * 注意：本改编中三屿不再挂载旧项目的真实截图或演示屏，
 * 体验选项仅用于探索目标完成与场景示意，具体演示画面待后续补齐。
 */
export type ExperienceProjectSlug = "cs-major-archive" | "calendar" | "blog-cms";

export type ExperienceOption = {
  readonly id: string;
  readonly label: string;
};

export const EXPERIENCE_OPTIONS: Record<
  ExperienceProjectSlug,
  readonly ExperienceOption[]
> = {
  "cs-major-archive": [
    { id: "champions", label: "冠军堂" },
    { id: "chronicle", label: "编年史" },
    { id: "hall-of-fame", label: "名人堂" },
  ],
  calendar: [
    { id: "month", label: "月视图" },
    { id: "search", label: "搜索" },
    { id: "reminders", label: "提醒" },
  ],
  "blog-cms": [
    { id: "articles", label: "文章" },
    { id: "comments", label: "评论" },
    { id: "categories", label: "分类" },
  ],
} as const;

/** 场景体验标题：三区操作对象不同，不共用“打开详情”语言。 */
export const EXPERIENCE_TITLES: Record<ExperienceProjectSlug, string> = {
  "cs-major-archive": "档案体验",
  calendar: "日程体验",
  "blog-cms": "博客体验",
};

/** 诚实边界：体验属于作品集演示，不宣称实时画面或真实数据。 */
export const EXPERIENCE_NOTES: Record<ExperienceProjectSlug, string> = {
  "cs-major-archive": "作品集演示 · 场景内示意，非项目实时画面",
  calendar: "作品集演示 · 场景内示意，非项目实时画面",
  "blog-cms": "作品集演示 · 场景内示意，非项目实时画面",
};

export const EXPERIENCE_RESET_LABELS: Record<ExperienceProjectSlug, string> = {
  "cs-major-archive": "默认",
  calendar: "默认",
  "blog-cms": "默认",
};

export function isExperienceProjectSlug(
  slug: string,
): slug is ExperienceProjectSlug {
  return slug === "cs-major-archive" || slug === "calendar" || slug === "blog-cms";
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
