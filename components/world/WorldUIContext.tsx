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

export type WorldPrompt = {
  /** 项目名（来自 lib/world 登记的名牌文案） */
  label: string;
  /** 项目 slug → 详情面板 / /projects/<slug> 路由的数据键 */
  slug: string;
} | null;

export type WorldPanel = "detail" | "nav" | "help" | null;

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
  /** 茧居所是否已发现（发现后导航面板点亮传送项，会话内保持） */
  nookDiscovered: boolean;
  /** 档位切换的一次性提示（AdaptiveQuality 写入，4s 后自动清除） */
  qualityNotice: string | null;
  /** WebGL 上下文是否丢失（ContextGuard 写入，遮罩层消费） */
  contextLost: boolean;
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
  /** 档位变化 HUD 通知（低频：仅在自适应升降档时调用一次） */
  notifyQuality: (label: string) => void;
  /** WebGL 上下文丢失/恢复上报（ContextGuard） */
  setContextLost: (lost: boolean) => void;
  /** 请求传送（写 inputState 标志，TeleportSystem 帧内消费） */
  requestTeleport: (targetId: string) => void;
  /** 请求软重置回出生点（写 inputState 标志，控制器帧内消费） */
  requestRespawn: () => void;
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
  const [introOpen, setIntroOpen] = useState(false);
  const [panel, setPanel] = useState<WorldPanel>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [nookDiscovered, setNookDiscovered] = useState(false);
  const [qualityNotice, setQualityNotice] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const qualityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (qualityTimer.current) clearTimeout(qualityTimer.current);
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
    setDetailSlug(slug);
    setPanel("detail");
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
    setDetailSlug(null);
  }, []);

  const toggleNav = useCallback(() => {
    setPanel((current) => (current === "nav" ? null : "nav"));
    setDetailSlug(null);
  }, []);

  const toggleHelp = useCallback(() => {
    setPanel((current) => (current === "help" ? null : "help"));
    setDetailSlug(null);
  }, []);

  const discoverNook = useCallback(() => setNookDiscovered(true), []);

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
      setPhase: setPhaseAndIntro,
      setZone,
      setPrompt,
      closeIntro,
      openDetail,
      closePanel,
      toggleNav,
      toggleHelp,
      discoverNook,
      notifyQuality,
      setContextLost,
      requestTeleport,
      requestRespawn,
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
      setPhaseAndIntro,
      closeIntro,
      openDetail,
      closePanel,
      toggleNav,
      toggleHelp,
      discoverNook,
      notifyQuality,
      setContextLost,
      requestTeleport,
      requestRespawn,
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
