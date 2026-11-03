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
import { useFrame } from "@react-three/fiber";
import { DEFAULT_WORLD_VOLUME, motionAudioParams, parseStoredVolume } from "@/lib/world/audioModel";
import { inputState } from "./inputState";
import type { PlayerApi } from "./usePlayerController";

/**
 * 世界声音层（P2）：全部 Web Audio 程序化合成，无外部音频资产。
 *
 * - 首次键盘/指针手势后才创建并恢复 AudioContext（避免自动播放拦截）；
 * - 运动风声与悬停低频随速度/冲刺变化（10Hz 更新，不逐帧占用 React）；
 * - 北径信标激活音效、项目/面板确认与取消短音；
 * - 静音/音量控制、页面隐藏暂停、卸载释放；静音时视觉反馈完整保留。
 */
type UiSound = "confirm" | "cancel";

export type WorldAudioValue = {
  started: boolean;
  muted: boolean;
  volume: number;
  toggleMuted: () => void;
  setVolume: (value: number) => void;
  setMotion: (speed: number, sprint: boolean) => void;
  playRelay: () => void;
  playUi: (kind: UiSound) => void;
};

type AudioEngine = ReturnType<typeof createWorldAudioEngine>;

function createWorldAudioEngine() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let motionSource: AudioBufferSourceNode | null = null;
  let motionFilter: BiquadFilterNode | null = null;
  let motionGain: GainNode | null = null;
  let humOsc: OscillatorNode | null = null;
  let humGain: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let started = false;
  let muted = false;
  let volume = DEFAULT_WORLD_VOLUME;
  let relayCount = 0;
  let uiSoundCount = 0;
  let activeVoices = 0;
  let lastRelayAt = -Infinity;
  let motion = motionAudioParams(0, false);

  const clampVolume = (value: number) =>
    Math.min(1, Math.max(0, Number.isFinite(value) ? value : DEFAULT_WORLD_VOLUME));
  const masterLevel = () => (muted ? 0 : volume);

  const ensureGraph = (): boolean => {
    if (ctx) return true;
    if (typeof window === "undefined") return false;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = masterLevel();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(ctx.destination);

    // 2s 棕噪声：风声与激活 whoosh 共用，避免每次创建长缓冲
    const length = Math.floor(ctx.sampleRate * 2);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 3.2;
    }

    motionSource = ctx.createBufferSource();
    motionSource.buffer = noiseBuffer;
    motionSource.loop = true;
    motionFilter = ctx.createBiquadFilter();
    motionFilter.type = "lowpass";
    motionFilter.frequency.value = motion.cutoff;
    motionFilter.Q.value = 0.7;
    motionGain = ctx.createGain();
    motionGain.gain.value = motion.gain;
    motionSource.connect(motionFilter).connect(motionGain).connect(master);
    motionSource.start();

    humOsc = ctx.createOscillator();
    humOsc.type = "triangle";
    humOsc.frequency.value = 110 * motion.pitch;
    humGain = ctx.createGain();
    humGain.gain.value = motion.hum;
    humOsc.connect(humGain).connect(master);
    humOsc.start();
    return true;
  };

  const start = async (): Promise<boolean> => {
    if (!ensureGraph() || !ctx) return false;
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }
    started = ctx.state === "running";
    return started;
  };

  const applyMaster = () => {
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.03);
  };

  const setMuted = (next: boolean) => {
    muted = next;
    applyMaster();
  };

  const setVolume = (next: number) => {
    volume = clampVolume(next);
    applyMaster();
  };

  const setMotion = (speed: number, sprint: boolean) => {
    motion = motionAudioParams(speed, sprint);
    if (!ctx || !motionGain || !motionFilter || !humGain || !humOsc) return;
    const now = ctx.currentTime;
    motionGain.gain.setTargetAtTime(motion.gain, now, 0.12);
    motionFilter.frequency.setTargetAtTime(motion.cutoff, now, 0.12);
    humGain.gain.setTargetAtTime(motion.hum, now, 0.2);
    humOsc.frequency.setTargetAtTime(110 * motion.pitch, now, 0.2);
  };

  const reserveVoice = (): boolean => {
    if (activeVoices >= 32) return false;
    activeVoices += 1;
    return true;
  };
  const releaseVoice = () => {
    activeVoices = Math.max(0, activeVoices - 1);
  };

  const scheduleTone = (
    frequency: number,
    offset: number,
    duration: number,
    peak: number,
    type: OscillatorType = "sine",
  ) => {
    if (!ctx || !master || !reserveVoice()) return;
    const now = ctx.currentTime + Math.max(0, offset);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      releaseVoice();
    };
  };

  const scheduleWhoosh = () => {
    if (!ctx || !master || !noiseBuffer || !reserveVoice()) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 1.1);
    filter.frequency.exponentialRampToValueAtTime(300, now + 2.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + 2.8);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      releaseVoice();
    };
  };

  const playRelaySounds = () => {
    if (!ctx) return;
    // 声音冷却：视觉可立即重播，但快速连按不叠加整组和弦
    if (ctx.currentTime - lastRelayAt < 0.5) return;
    lastRelayAt = ctx.currentTime;
    relayCount += 1;
    // 温暖的 C/G 和弦 + 上行泛音 + 风声，控制在低音量
    scheduleTone(130.81, 0, 2.4, 0.07);
    scheduleTone(392, 0.02, 1.9, 0.05);
    scheduleTone(523.25, 0.14, 1.7, 0.045);
    scheduleTone(659.25, 0.28, 1.5, 0.04);
    scheduleTone(783.99, 0.42, 1.3, 0.035, "triangle");
    scheduleWhoosh();
  };

  const runIfAudible = (fn: () => void) => {
    if (muted) return;
    if (!started) {
      void start().then((ok) => {
        if (ok && !muted) fn();
      });
      return;
    }
    fn();
  };

  const playRelay = () => runIfAudible(playRelaySounds);

  const playUi = (kind: UiSound) =>
    runIfAudible(() => {
      uiSoundCount += 1;
      if (kind === "confirm") {
        scheduleTone(880, 0, 0.08, 0.035);
        scheduleTone(1318.5, 0.045, 0.1, 0.028);
      } else {
        scheduleTone(587.33, 0, 0.09, 0.03);
        scheduleTone(440, 0.05, 0.1, 0.025);
      }
    });

  const suspend = () => {
    if (ctx && ctx.state === "running") void ctx.suspend();
  };
  const resume = () => {
    if (ctx && ctx.state === "suspended" && started) void ctx.resume();
  };
  const dispose = () => {
    try {
      motionSource?.stop();
      humOsc?.stop();
    } catch {
      /* already stopped */
    }
    motionSource = null;
    humOsc = null;
    try {
      void ctx?.close();
    } catch {
      /* context already closed */
    }
    ctx = null;
    master = null;
    motionFilter = null;
    motionGain = null;
    humGain = null;
    noiseBuffer = null;
    started = false;
  };
  const getState = () => ({
    started,
    contextState: ctx?.state ?? "unavailable",
    muted,
    volume,
    relays: relayCount,
    uiSounds: uiSoundCount,
  });

  return {
    start,
    setMuted,
    setVolume,
    setMotion,
    playRelay,
    playUi,
    suspend,
    resume,
    dispose,
    getState,
  };
}

const WorldAudioContext = createContext<WorldAudioValue | null>(null);

export function WorldAudioProvider({ children }: { children: ReactNode }) {
  // useState 惰性初始化：引擎闭包本身不含渲染期可变状态，AudioContext 仍到手势后才创建
  const [engine] = useState<AudioEngine>(() => createWorldAudioEngine());
  const [started, setStarted] = useState(false);
  // 惰性读取本地静音/音量偏好（纯本地，不发送）；HUD 仅在客户端 ready 后渲染
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem("ageha.world.muted") === "1";
    } catch {
      return false;
    }
  });
  const [volume, setVolumeState] = useState(() => {
    try {
      return parseStoredVolume(localStorage.getItem("ageha.world.volume"));
    } catch {
      return DEFAULT_WORLD_VOLUME;
    }
  });

  useEffect(() => {
    engine.setMuted(muted);
    try {
      localStorage.setItem("ageha.world.muted", muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [engine, muted]);

  useEffect(() => {
    engine.setVolume(volume);
    try {
      localStorage.setItem("ageha.world.volume", String(volume));
    } catch {
      /* ignore */
    }
  }, [engine, volume]);

  // 首次键盘/指针手势解锁 AudioContext；启动失败时监听继续保留以便重试
  useEffect(() => {
    let cancelled = false;
    const unlock = () => {
      void engine.start().then((ok) => {
        if (!cancelled && ok) setStarted(true);
      });
    };
    // Touch and pen activate the page on release. Mouse activates on press.
    const unlockMouse = (event: PointerEvent) => {
      if (event.pointerType === "mouse") unlock();
    };
    const unlockTouch = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") unlock();
    };
    window.addEventListener("pointerdown", unlockMouse);
    window.addEventListener("pointerup", unlockTouch);
    window.addEventListener("keydown", unlock);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", unlockMouse);
      window.removeEventListener("pointerup", unlockTouch);
      window.removeEventListener("keydown", unlock);
    };
  }, [engine]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) engine.suspend();
      else engine.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [engine]);

  useEffect(() => () => engine.dispose(), [engine]);

  // 开发态音频探针：验收脚本读取上下文状态/静音/音量/播放次数
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const read = () => engine.getState();
    (window as unknown as { __AGEHA_AUDIO__?: () => unknown }).__AGEHA_AUDIO__ = read;
    return () => {
      delete (window as unknown as { __AGEHA_AUDIO__?: () => unknown }).__AGEHA_AUDIO__;
    };
  }, [engine]);

  const toggleMuted = useCallback(() => {
    setMutedState((current) => {
      const next = !current;
      engine.setMuted(next);
      if (!next) void engine.start();
      return next;
    });
  }, [engine]);

  const setVolume = useCallback(
    (value: number) => {
      const next = Math.min(1, Math.max(0, value));
      setVolumeState(next);
      engine.setVolume(next);
      void engine.start();
    },
    [engine],
  );

  const value = useMemo<WorldAudioValue>(
    () => ({
      started,
      muted,
      volume,
      toggleMuted,
      setVolume,
      setMotion: engine.setMotion,
      playRelay: engine.playRelay,
      playUi: engine.playUi,
    }),
    [started, muted, volume, toggleMuted, setVolume, engine],
  );

  return (
    <WorldAudioContext.Provider value={value}>
      {children}
    </WorldAudioContext.Provider>
  );
}

export function useWorldAudio(): WorldAudioValue {
  const value = useContext(WorldAudioContext);
  if (!value) throw new Error("useWorldAudio 必须在 WorldAudioProvider 内使用");
  return value;
}

/** 10Hz 将玩家速度写入音频引擎；不产生逐帧 React 更新。 */
export function WorldAudioMotion({ player }: { player: PlayerApi }) {
  const { setMotion } = useWorldAudio();
  const frame = useRef(0);
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 6 !== 0) return;
    setMotion(player.speed.current, inputState.sprint);
  });
  return null;
}
