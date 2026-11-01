"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { inputState } from "./systems/inputState";
import { useWorldAudio } from "./systems/WorldAudio";
import { isValidExperienceOption } from "@/lib/world/experiences";
import {
  completeExploreGoal,
  countCompletedGoals,
  createEmptyExploreProgress,
  EXPLORE_GOALS,
  getExploreGoal,
  goalIdForExperience,
  isExploreGoalId,
  type ExploreGoalId,
  type ExploreProgress,
} from "@/lib/world/exploration";
import {
  clearExploreProgress,
  getBrowserProgressStorage,
  loadExploreProgress,
  saveExploreProgress,
  type ProgressStorage,
} from "@/lib/world/explorationStorage";

/**
 * 世界 UI 上下文：只承载低频 UI 状态（加载阶段 / 当前区域 / 交互提示 /
 * 面板开关 / 引导开关 / 彩蛋发现）。高频量（移动、视角、位置、悬停）一律
 * 走 refs 与 inputState / interactionState 共享态，绝不进入 React 状态
 * （蓝图 §10）。
 *
 * 面板互斥：详情 / 导航 / 帮助三面板同时只开一个（打开一个即关闭其余），
 * Esc 按同一优先级关闭——键盘语义可预测（阶段 2 键盘可达要求）。
 */
export type WorldPhase = "loading" | "ready" | "fallback";

export type WorldPrompt =
  | {
      kind: "project";
      /** 项目名（来自 lib/world 登记的名牌文案） */
      label: string;
      /** 项目 slug → 详情面板 / /projects/<slug> 路由的数据键 */
      slug: string;
    }
  | {
      kind: "relay";
      label: string;
      relayId: string;
    }
  | null;

export type WorldPanel = "detail" | "nav" | "help" | null;

export type WorldProgressPersistence = "local" | "session";

type WorldUIContextValue = {
  phase: WorldPhase;
  /** 当前区域名（getZoneName 低频采样，变化才更新） */
  zone: string | null;
  /** 最近可交互项目（无目标为 null） */
  prompt: WorldPrompt;
  /** 引导卡是否展开（任意操作即隐 / 手动关闭，会话内不重复弹出） */
  introOpen: boolean;
  isMobileLike: boolean;
  /** 当前打开的面板（detail 时 detailSlug 非空） */
  panel: WorldPanel;
  /** 详情面板当前项目 slug */
  detailSlug: string | null;
  /** 茧居所是否已发现（P4 起由本地进度恢复；导航面板点亮传送项） */
  nookDiscovered: boolean;
  /** 档位切换的一次性提示（AdaptiveQuality 写入，4s 后自动清除） */
  qualityNotice: string | null;
  /** WebGL 上下文是否丢失（ContextGuard 写入，遮罩层消费） */
  contextLost: boolean;
  /** P4 探索目标完成状态（本地恢复；低频 UI 状态） */
  exploreProgress: ExploreProgress;
  exploreCompletedCount: number;
  /** local = 已保存到本地；session = Storage 不可用，仅本次会话有效 */
  progressPersistence: WorldProgressPersistence;
  /** 新完成目标的一次性提示（已完成目标复访不重复弹出） */
  progressNotice: string | null;
  setPhase: (phase: WorldPhase) => void;
  setZone: (zone: string | null) => void;
  setPrompt: (prompt: WorldPrompt) => void;
  closeIntro: () => void;
  openDetail: (slug: string) => void;
  closePanel: () => void;
  toggleNav: () => void;
  toggleHelp: () => void;
  /** 发现茧居所（幂等） */
  discoverNook: () => void;
  /** 记录探索目标（幂等；未知 id 忽略） */
  recordExploreGoal: (goalId: ExploreGoalId) => void;
  /** 清空目标与三项目体验显示；返回本地记录是否确认清除 */
  resetExploreProgress: () => boolean;
  /** 档位变化 HUD 通知（低频：仅在自适应升降档时调用一次） */
  notifyQuality: (label: string) => void;
  /** WebGL 上下文丢失/恢复上报（ContextGuard） */
  setContextLost: (lost: boolean) => void;
  /** 请求传送（写 inputState 标志，TeleportSystem 帧内消费） */
  requestTeleport: (targetId: string) => void;
  /** 请求软重置回出生点（写 inputState 标志，控制器帧内消费） */
  requestRespawn: () => void;
  /** 请求北径信标激活（写 inputState 计数，NorthRouteDressing 消费） */
  activateRelay: () => void;
  /** 三项目区场景体验状态（slug → 选项 id；缺省 = 真实截图/默认灯光） */
  experiences: Readonly<Record<string, string>>;
  setExperience: (slug: string, optionId: string | null) => void;
};

const WorldUIContext = createContext<WorldUIContextValue | null>(null);

export function WorldUIProvider({
  isMobileLike,
  children,
}: {
  isMobileLike: boolean;
  children: ReactNode;
}) {
  const [phase, setPhaseState] = useState<WorldPhase>("loading");
  const [zone, setZone] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<WorldPrompt>(null);
  const [experiences, setExperiences] = useState<Record<string, string>>({});
  const [introOpen, setIntroOpen] = useState(false);
  const [panel, setPanel] = useState<WorldPanel>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  // 惰性读取本地进度（仅客户端有 window；SSR 快照为空，进度 UI 只会在
  // 世界就绪后挂载——不会造成服务端 / 客户端首屏结构差异）
  const [progressBoot] = useState(() => {
    const storage = getBrowserProgressStorage();
    const loaded = loadExploreProgress(storage);
    return {
      progress: loaded.progress,
      persistence: (loaded.persisted ? "local" : "session") as WorldProgressPersistence,
      storage,
    };
  });
  const [exploreProgress, setExploreProgress] = useState<ExploreProgress>(
    progressBoot.progress,
  );
  const [progressPersistence, setProgressPersistence] =
    useState<WorldProgressPersistence>(progressBoot.persistence);
  const [progressNotice, setProgressNotice] = useState<string | null>(null);
  const [qualityNotice, setQualityNotice] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const audio = useWorldAudio();
  const qualityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(progressBoot.progress);
  const progressStorageRef = useRef<ProgressStorage | null>(progressBoot.storage);
  const nookDiscovered = exploreProgress["nook-discovery"];
  const exploreCompletedCount = countCompletedGoals(exploreProgress);

  useEffect(
    () => () => {
      if (qualityTimer.current) clearTimeout(qualityTimer.current);
      if (progressTimer.current) clearTimeout(progressTimer.current);
    },
    [],
  );

  const setPhaseAndIntro = useCallback((next: WorldPhase) => {
    setPhaseState(next);
    // 世界就绪后展开引导（仅一次；关闭后不再自动弹出）
    setIntroOpen((open) => (next === "ready" ? true : open));
  }, []);

  const closeIntro = useCallback(() => setIntroOpen(false), []);

  const openDetail = useCallback((slug: string) => {
    audio.playUi("confirm");
    setIntroOpen(false);
    setDetailSlug(slug);
    setPanel("detail");
  }, [audio]);

  const closePanel = useCallback(() => {
    if (panel !== null) audio.playUi("cancel");
    setPanel(null);
    setDetailSlug(null);
  }, [audio, panel]);

  const toggleNav = useCallback(() => {
    audio.playUi(panel === "nav" ? "cancel" : "confirm");
    setIntroOpen(false);
    setPanel((current) => (current === "nav" ? null : "nav"));
    setDetailSlug(null);
  }, [audio, panel]);

  const toggleHelp = useCallback(() => {
    audio.playUi(panel === "help" ? "cancel" : "confirm");
    setIntroOpen(false);
    setPanel((current) => (current === "help" ? null : "help"));
    setDetailSlug(null);
  }, [audio, panel]);

  const recordExploreGoal = useCallback((goalId: ExploreGoalId) => {
    if (!isExploreGoalId(goalId)) return;
    const current = progressRef.current;
    // 已完成的复访不重复写盘、不重复弹奖励提示
    if (current[goalId]) return;
    const next = completeExploreGoal(current, goalId);
    progressRef.current = next;
    setExploreProgress(next);
    const persisted = saveExploreProgress(progressStorageRef.current, next);
    if (!persisted) setProgressPersistence("session");

    const count = countCompletedGoals(next);
    setProgressNotice(
      `记忆环点亮 ${count} / ${EXPLORE_GOALS.length} · ${getExploreGoal(goalId).title}`,
    );
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => setProgressNotice(null), 4000);
  }, []);

  const resetExploreProgress = useCallback((): boolean => {
    const empty = createEmptyExploreProgress();
    progressRef.current = empty;
    setExploreProgress(empty);
    // 体验层同步复位：不留下项目区演示状态或错误高亮
    setExperiences({});
    setProgressNotice(null);
    if (progressTimer.current) clearTimeout(progressTimer.current);
    const storage = progressStorageRef.current;
    // 没有可用 Storage 时本来就不存在本地记录，重置在会话内已完成
    const cleared = storage ? clearExploreProgress(storage) : true;
    if (storage && !cleared) setProgressPersistence("session");
    return cleared;
  }, []);

  const discoverNook = useCallback(
    () => recordExploreGoal("nook-discovery"),
    [recordExploreGoal],
  );

  const notifyQuality = useCallback((label: string) => {
    setQualityNotice(label);
    if (qualityTimer.current) clearTimeout(qualityTimer.current);
    qualityTimer.current = setTimeout(() => setQualityNotice(null), 4000);
  }, []);

  const requestTeleport = useCallback((targetId: string) => {
    inputState.teleportTarget = targetId;
  }, []);

  const requestRespawn = useCallback(() => {
    inputState.wantRespawn = true;
  }, []);

  const activateRelay = useCallback(() => {
    inputState.relayToken += 1;
  }, []);

  const setExperience = useCallback((slug: string, optionId: string | null) => {
    if (!isValidExperienceOption(slug, optionId)) return;
    setExperiences((current) => {
      if (optionId === null) {
        if (!(slug in current)) return current;
        const next = { ...current };
        delete next[slug];
        return next;
      }
      if (current[slug] === optionId) return current;
      return { ...current, [slug]: optionId };
    });
    // 只有用户真正选择演示选项才记录目标；复位（null）不触发完成
    if (optionId !== null) {
      const goalId = goalIdForExperience(slug);
      if (goalId) recordExploreGoal(goalId);
    }
  }, [recordExploreGoal]);

  const value = useMemo<WorldUIContextValue>(
    () => ({
      phase,
      zone,
      prompt,
      introOpen,
      isMobileLike,
      panel,
      detailSlug,
      nookDiscovered,
      qualityNotice,
      contextLost,
      exploreProgress,
      exploreCompletedCount,
      progressPersistence,
      progressNotice,
      setPhase: setPhaseAndIntro,
      setZone,
      setPrompt,
      closeIntro,
      openDetail,
      closePanel,
      toggleNav,
      toggleHelp,
      discoverNook,
      recordExploreGoal,
      resetExploreProgress,
      notifyQuality,
      setContextLost,
      requestTeleport,
      requestRespawn,
      activateRelay,
      experiences,
      setExperience,
    }),
    [
      phase,
      zone,
      prompt,
      introOpen,
      isMobileLike,
      panel,
      detailSlug,
      nookDiscovered,
      qualityNotice,
      contextLost,
      exploreProgress,
      exploreCompletedCount,
      progressPersistence,
      progressNotice,
      setPhaseAndIntro,
      closeIntro,
      openDetail,
      closePanel,
      toggleNav,
      toggleHelp,
      discoverNook,
      recordExploreGoal,
      resetExploreProgress,
      notifyQuality,
      setContextLost,
      requestTeleport,
      requestRespawn,
      activateRelay,
      experiences,
      setExperience,
    ],
  );

  return <WorldUIContext.Provider value={value}>{children}</WorldUIContext.Provider>;
}

export function useWorldUI(): WorldUIContextValue {
  const value = useContext(WorldUIContext);
  if (!value) {
    throw new Error("useWorldUI 必须在 WorldUIProvider 内使用");
  }
  return value;
}
