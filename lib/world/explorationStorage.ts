/**
 * 探索进度的本地持久化适配（注入式 Storage，node --test 可测）。
 *
 * 只保存完成目标 id 的数组，payload 带版本号；不保存任何个人信息。
 * 读取、写入、清除都不抛异常——失败时返回可判定的结果，由 UI 退化为
 * 会话内状态并如实提示。浏览器入口会先做一次写入探测，隐私模式 /
 * 配额受限在首屏即可识别。
 */
import {
  createEmptyExploreProgress,
  isExploreGoalId,
  listCompletedGoals,
  type ExploreGoalId,
  type ExploreProgress,
} from "./exploration.ts";

export const EXPLORE_STORAGE_KEY = "ageha.world.exploration";
export const EXPLORE_STORAGE_VERSION = 1;

export type ProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type LoadExploreProgressResult = {
  progress: ExploreProgress;
  /** false = Storage 不可读（隐私模式 / 安全限制），进度只在本次会话有效 */
  persisted: boolean;
};

type StoredPayload = {
  version: typeof EXPLORE_STORAGE_VERSION;
  completed: ExploreGoalId[];
};

export function serializeExploreProgress(progress: ExploreProgress): string {
  const payload: StoredPayload = {
    version: EXPLORE_STORAGE_VERSION,
    completed: listCompletedGoals(progress),
  };
  return JSON.stringify(payload);
}

/**
 * 解析本地记录：缺省 / 损坏 / 版本不符 → null；同版本内未知 id 被忽略。
 * 只按登记顺序读取已知目标，不接受任意键写入进度对象。
 */
export function parseExploreProgress(raw: string | null): ExploreProgress | null {
  if (raw === null || raw.trim() === "") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const payload = data as { version?: unknown; completed?: unknown };
  if (payload.version !== EXPLORE_STORAGE_VERSION) return null;
  if (!Array.isArray(payload.completed)) return null;

  const progress = { ...createEmptyExploreProgress() };
  for (const id of payload.completed) {
    if (isExploreGoalId(id)) progress[id] = true;
  }
  return progress;
}

export function loadExploreProgress(
  storage: ProgressStorage | null,
): LoadExploreProgressResult {
  if (!storage) {
    return { progress: createEmptyExploreProgress(), persisted: false };
  }
  try {
    const raw = storage.getItem(EXPLORE_STORAGE_KEY);
    if (raw === null) {
      return { progress: createEmptyExploreProgress(), persisted: true };
    }
    return {
      progress: parseExploreProgress(raw) ?? createEmptyExploreProgress(),
      persisted: true,
    };
  } catch {
    return { progress: createEmptyExploreProgress(), persisted: false };
  }
}

export function saveExploreProgress(
  storage: ProgressStorage | null,
  progress: ExploreProgress,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(EXPLORE_STORAGE_KEY, serializeExploreProgress(progress));
    return true;
  } catch {
    return false;
  }
}

/**
 * 清除本地记录并复核；removeItem 不可用时退化为写入空进度。
 * 返回 false 表示记录可能仍在（调用方应提示刷新后可能恢复）。
 */
export function clearExploreProgress(storage: ProgressStorage | null): boolean {
  if (!storage) return false;
  const empty = serializeExploreProgress(createEmptyExploreProgress());
  try {
    storage.removeItem(EXPLORE_STORAGE_KEY);
    return storage.getItem(EXPLORE_STORAGE_KEY) === null;
  } catch {
    try {
      storage.setItem(EXPLORE_STORAGE_KEY, empty);
      return storage.getItem(EXPLORE_STORAGE_KEY) === empty;
    } catch {
      return false;
    }
  }
}

/** 浏览器 Storage 入口：先探测可写，隐私模式 / 配额受限直接返回 null */
export function getBrowserProgressStorage(): ProgressStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const probeKey = "__ageha_progress_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}
