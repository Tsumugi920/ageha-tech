export type ClassValue = string | number | false | null | undefined;

/**
 * 合并 className 的小工具：过滤掉假值后用空格拼接。
 * （刻意不引入 tailwind-merge / clsx，保持依赖克制；
 *   同类冲突类由调用方自行避免。）
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter((value): value is string => Boolean(value)).join(" ");
}
