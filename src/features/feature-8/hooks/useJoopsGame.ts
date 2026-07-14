"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLLISION_RATE_PER_MS,
  DEG_PER_MS,
  HOME_HALF_WINDOW_DEG,
  IDLE_EXP_AMOUNT,
  IDLE_EXP_CHANCE,
  IDLE_EXP_TICK_MS,
  MAX_HP,
  HEAL_TAPS_REQUIRED,
  applyExp,
  defaultSave,
  etaToHomeMs,
  isInHomeWindow,
  normalizeAngle,
  simulateOffline,
  type JoopsSave,
  type OfflineReport,
} from "../lib/game";
import { clearSave, loadSave, persistSave } from "../lib/storage";

export type Phase = "loading" | "setup" | "orbit" | "action" | "heal";

export type GainFloat = { id: number; text: string };

export function useJoopsGame() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [save, setSave] = useState<JoopsSave>(() => defaultSave(0));
  const [report, setReport] = useState<OfflineReport | null>(null);
  const [gains, setGains] = useState<GainFloat[]>([]);
  const [levelFlash, setLevelFlash] = useState(0);
  const [collideFlash, setCollideFlash] = useState(0);

  const saveRef = useRef(save);
  const idRef = useRef(0);
  const idleAccRef = useRef(0);
  const initedRef = useRef(false);

  const commit = useCallback((next: JoopsSave) => {
    saveRef.current = next;
    setSave(next);
  }, []);

  const pushGain = useCallback((text: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setGains((prev) => [...prev.slice(-2), { id, text }]);
    window.setTimeout(() => {
      setGains((prev) => prev.filter((g) => g.id !== id));
    }, 1500);
  }, []);

  // 최초 로드: 저장 데이터 복원 + 부재중(Time Delta) 시뮬레이션
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    const stored = loadSave();
    if (!stored) {
      commit(defaultSave(Date.now()));
      setPhase("setup");
      return;
    }
    const { save: next, report: offline } = simulateOffline(stored, Date.now());
    commit(next);
    persistSave(next);
    setReport(offline);
    setPhase(next.homeAngle === null ? "setup" : "orbit");
  }, [commit]);

  // 실시간 궤도 틱 (비행 중일 때만)
  const running = phase === "orbit" && !save.stopped && save.homeAngle !== null;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const tid = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;

      const prev = saveRef.current;
      if (prev.stopped) return;

      const total = prev.angle + dt * DEG_PER_MS;
      let next: JoopsSave = {
        ...prev,
        angle: normalizeAngle(total),
        orbits: prev.orbits + Math.floor(total / 360),
      };

      // 방치 EXP
      idleAccRef.current += dt;
      let gained = 0;
      while (idleAccRef.current >= IDLE_EXP_TICK_MS) {
        idleAccRef.current -= IDLE_EXP_TICK_MS;
        if (Math.random() < IDLE_EXP_CHANCE) gained += IDLE_EXP_AMOUNT;
      }
      if (gained > 0) {
        const grown = applyExp(next.level, next.exp, gained);
        next = { ...next, level: grown.level, exp: grown.exp };
        pushGain(`+${gained} EXP`);
        if (grown.levelUps > 0) {
          setLevelFlash((n) => n + 1);
          pushGain("🎉 LEVEL UP!");
        }
      }

      // 잔해 충돌 판정 (가변 dt에 안전한 지수식 확률)
      if (Math.random() < 1 - Math.exp(-COLLISION_RATE_PER_MS * dt)) {
        next = { ...next, hp: 0, stopped: true };
        setCollideFlash((n) => n + 1);
      }

      commit(next);
    }, 100);
    return () => window.clearInterval(tid);
  }, [running, commit, pushGain]);

  // 주기 저장 + 탭 이탈 시 저장 (부재중 시뮬레이션의 기준점 유지)
  useEffect(() => {
    if (phase === "loading") return;
    const persistNow = () => persistSave(saveRef.current);
    const tid = window.setInterval(persistNow, 3000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persistNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", persistNow);
    return () => {
      window.clearInterval(tid);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", persistNow);
    };
  }, [phase]);

  const pickHome = useCallback(
    (angleDeg: number) => {
      const next = { ...saveRef.current, homeAngle: normalizeAngle(angleDeg) };
      commit(next);
      persistSave(next);
      setPhase("orbit");
    },
    [commit],
  );

  const startAction = useCallback(() => {
    const s = saveRef.current;
    if (s.homeAngle === null || s.stopped || !isInHomeWindow(s.angle, s.homeAngle)) {
      return;
    }
    setPhase("action");
  }, []);

  const finishAction = useCallback(
    (expGained: number) => {
      const prev = saveRef.current;
      const grown = applyExp(prev.level, prev.exp, expGained);
      // 상공 창을 빠져나간 지점으로 이동시켜 다음 바퀴까지 ETA를 리셋한다.
      const angle =
        prev.homeAngle === null
          ? prev.angle
          : normalizeAngle(prev.homeAngle + HOME_HALF_WINDOW_DEG + 2);
      const next = { ...prev, level: grown.level, exp: grown.exp, angle };
      commit(next);
      persistSave(next);
      if (expGained > 0) pushGain(`+${expGained} EXP`);
      if (grown.levelUps > 0) {
        setLevelFlash((n) => n + 1);
        pushGain("🎉 LEVEL UP!");
      }
      setPhase("orbit");
    },
    [commit, pushGain],
  );

  const openHeal = useCallback(() => {
    if (saveRef.current.stopped) setPhase("heal");
  }, []);

  const healTap = useCallback(() => {
    const prev = saveRef.current;
    if (!prev.stopped) return;
    const hp = Math.min(MAX_HP, prev.hp + MAX_HP / HEAL_TAPS_REQUIRED);
    const done = hp >= MAX_HP;
    const next = { ...prev, hp, stopped: !done };
    commit(next);
    if (done) persistSave(next);
  }, [commit]);

  const closeHeal = useCallback(() => setPhase("orbit"), []);
  const dismissReport = useCallback(() => setReport(null), []);
  const startRelocate = useCallback(() => setPhase("setup"), []);

  const resetAll = useCallback(() => {
    clearSave();
    idleAccRef.current = 0;
    commit(defaultSave(Date.now()));
    setReport(null);
    setPhase("setup");
  }, [commit]);

  const inWindow =
    save.homeAngle !== null && isInHomeWindow(save.angle, save.homeAngle);
  const etaMs =
    save.homeAngle === null ? null : etaToHomeMs(save.angle, save.homeAngle);
  const canStartAction = phase === "orbit" && inWindow && !save.stopped;

  return {
    phase,
    save,
    report,
    gains,
    levelFlash,
    collideFlash,
    inWindow,
    etaMs,
    canStartAction,
    pickHome,
    startAction,
    finishAction,
    openHeal,
    healTap,
    closeHeal,
    dismissReport,
    startRelocate,
    resetAll,
  };
}
