"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { inputState } from "./systems/inputState";

/**
 * 世界 UI 上下文：只承载低频 UI 状态（加载阶段 / 当前区域 / 交互提示 /
 * 引导开关）。高频量（移动、视角、位置）一律走 refs 与 inputState，
 * 绝不进入 React 状态（蓝图 §10）。
 */
export type WorldPhase = "loading" | "ready" | "fallback";

export type WorldPrompt = {
  /** 项目名（来自 lib/world 登记的名牌文案） */
  label: string;
  /** 项目 slug → 详情路由 /projects/<slug> 的数据键 */
  slug: string;
} | null;

type WorldUIContextValue = {
  phase: WorldPhase;
  /** 当前区域名（getZoneName 低频采样，变化才更新） */
  zone: string | null;
  /** 最近可交互项目（无目标为 null） */
  prompt: WorldPrompt;
  /** 引导卡是否展开（任意操作即隐 / 手动关闭，会话内不重复弹出） */
  introOpen: boolean;
  isMobileLike: boolean;
  setPhase: (phase: WorldPhase) => void;
  setZone: (zone: string | null) => void;
  setPrompt: (prompt: WorldPrompt) => void;
  closeIntro: () => void;
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
  const [phase, setPhase] = useState<WorldPhase>("loading");
  const [zone, setZone] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<WorldPrompt>(null);
  const [introOpen, setIntroOpen] = useState(false);

  const setPhaseAndIntro = useCallback((next: WorldPhase) => {
    setPhase(next);
    // 世界就绪后展开引导（仅一次；关闭后不再自动弹出）
    setIntroOpen((open) => (next === "ready" ? true : open));
  }, []);

  const closeIntro = useCallback(() => setIntroOpen(false), []);

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
      setPhase: setPhaseAndIntro,
      setZone,
      setPrompt,
      closeIntro,
      requestRespawn,
    }),
    [
      phase,
      zone,
      prompt,
      introOpen,
      isMobileLike,
      setPhaseAndIntro,
      closeIntro,
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
