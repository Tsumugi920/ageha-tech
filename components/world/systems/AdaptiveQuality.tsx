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
import { useFrame, useThree } from "@react-three/fiber";
import {
  TIER_PARAMS,
  pickInitialTier,
  type QualityTier,
  type TierParams,
} from "@/lib/world/performance";
import { useWorldUI } from "../WorldUIContext";

/**
 * 帧率自适应（蓝图 §12.2，阶段 4）：
 * - 帧时间滑动平均（120 帧窗口）：平均 >22ms 持续 2s → 降一档；
 *   <14ms 持续 8s → 升一档（每次运行最多升 2 次，防振荡）；
 * - 档位经 QualityContext 注入场景各组件（粒子 / 远景 / 贴图 / transmission
 *   随重渲生效），DPR 由 setDpr 即时接管，阴影在 WorldScene 的档位 effect
 *   里动态开关（含阴影贴图显存释放与材质重编译标记）；
 * - 档位变化经 WorldUIContext 通知 HUD 显示一次性提示；
 * - 升降判定都在 useFrame 内完成（纯 refs 累计，零逐帧 React 状态），
   档位切换本身是低频事件，setTier 才触发一次重渲。
 */

/** 判定参数（§12.2 数据化，responsive-perf 测试源码级守护） */
export const ADAPTIVE_RULES = {
  /** 滑动窗口帧数 */
  windowFrames: 120,
  /** 慢线：平均帧时间阈值（ms）与持续秒数 → 降档 */
  slowAvgMs: 22,
  slowHoldSeconds: 2,
  /** 快线：平均帧时间阈值（ms）与持续秒数 → 升档 */
  fastAvgMs: 14,
  fastHoldSeconds: 8,
  /** 每次运行最多升档次数（防升降振荡） */
  maxUpgrades: 2,
  /** 预热秒数：世界挂载初期（着色器编译 / 纹理上传抖动）不参与判定 */
  warmupSeconds: 3,
} as const;

/** 档位升降序（index 0 = low） */
const TIER_ORDER: readonly QualityTier[] = ["low", "medium", "high"];

/** 档位变化的一次性 HUD 文案（如实描述当前档位，不做性能宣称） */
const TIER_NOTICE: Record<QualityTier, string> = {
  high: "性能充足 · 已恢复高画质",
  medium: "已切换到均衡画质，保证流畅",
  low: "已自动调低画质，保证流畅探索",
};

type QualityContextValue = {
  /** 当前档位参数（初始 = 设备形态静态选档，此后由 AdaptiveQuality 接管） */
  tier: TierParams;
  /** 档位切换（同档传入为空操作；仅低频调用） */
  setTier: (next: QualityTier) => void;
};

const QualityContext = createContext<QualityContextValue | null>(null);

export function QualityProvider({
  isMobileLike,
  children,
}: {
  isMobileLike: boolean;
  children: ReactNode;
}) {
  const [tier, setTierState] = useState<TierParams>(() =>
    pickInitialTier(isMobileLike),
  );

  const setTier = useCallback((next: QualityTier) => {
    setTierState((current) =>
      current.tier === next ? current : TIER_PARAMS[next],
    );
  }, []);

  const value = useMemo<QualityContextValue>(
    () => ({ tier, setTier }),
    [tier, setTier],
  );

  return (
    <QualityContext.Provider value={value}>
      {children}
    </QualityContext.Provider>
  );
}

export function useQuality(): QualityContextValue {
  const value = useContext(QualityContext);
  if (!value) {
    throw new Error("useQuality 必须在 QualityProvider 内使用");
  }
  return value;
}

/** 帧时间监测与升降档执行器（挂在 QualityProvider 内，无渲染输出） */
export function AdaptiveQuality() {
  const { tier, setTier } = useQuality();
  const { notifyQuality } = useWorldUI();
  const setDpr = useThree((state) => state.setDpr);

  // DPR 随档位动态生效（初始值由 Canvas dpr prop 声明，此后由本 effect 接管）
  useEffect(() => {
    const devicePixelRatio =
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    setDpr(Math.min(devicePixelRatio, tier.dprMax));
  }, [tier, setDpr]);

  // 帧循环读当前档位：用 ref 同步（避免渲染期写 ref）
  const tierRef = useRef(tier);
  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);

  const samples = useRef<number[]>([]);
  const elapsed = useRef(0);
  const slowSince = useRef<number | null>(null);
  const fastSince = useRef<number | null>(null);
  const upgrades = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.25);
    elapsed.current += delta;
    const buffer = samples.current;
    buffer.push(rawDelta * 1000);
    if (buffer.length > ADAPTIVE_RULES.windowFrames) buffer.shift();

    // 预热期 / 未满窗口：只采样不判定（低帧率设备满窗约需 4~8s，更稳）
    if (elapsed.current < ADAPTIVE_RULES.warmupSeconds) return;
    if (buffer.length < ADAPTIVE_RULES.windowFrames) return;

    let sum = 0;
    for (const sample of buffer) sum += sample;
    const avg = sum / buffer.length;

    const index = TIER_ORDER.indexOf(tierRef.current.tier);
    if (avg > ADAPTIVE_RULES.slowAvgMs) {
      fastSince.current = null;
      slowSince.current ??= elapsed.current;
      if (
        index > 0 &&
        elapsed.current - slowSince.current >= ADAPTIVE_RULES.slowHoldSeconds
      ) {
        const next = TIER_ORDER[index - 1];
        slowSince.current = null;
        buffer.length = 0; // 换档重采样：旧帧时间不代表新档负载
        setTier(next);
        notifyQuality(TIER_NOTICE[next]);
      }
    } else if (avg < ADAPTIVE_RULES.fastAvgMs) {
      slowSince.current = null;
      const canUpgrade =
        index < TIER_ORDER.length - 1 && upgrades.current < ADAPTIVE_RULES.maxUpgrades;
      if (!canUpgrade) {
        fastSince.current = null;
        return;
      }
      fastSince.current ??= elapsed.current;
      if (
        elapsed.current - fastSince.current >= ADAPTIVE_RULES.fastHoldSeconds
      ) {
        const next = TIER_ORDER[index + 1];
        upgrades.current += 1;
        fastSince.current = null;
        buffer.length = 0;
        setTier(next);
        notifyQuality(TIER_NOTICE[next]);
      }
    } else {
      slowSince.current = null;
      fastSince.current = null;
    }
  });

  return null;
}
