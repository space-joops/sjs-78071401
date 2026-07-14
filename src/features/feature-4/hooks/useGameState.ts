"use client";
// 세이브 로딩 + 부재중 시뮬레이션 적용 + 실시간 틱 + 액션 디스패치
import { useCallback, useEffect, useState } from "react";
import {
  applyOffline,
  defaultSave,
  loadSave,
  persistSave,
} from "../lib/state";
import type { OfflineReport, OwnerLoc, SaveState } from "../lib/types";

export function useGameState() {
  const [save, setSave] = useState<SaveState | null>(null);
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<OfflineReport | null>(null);

  useEffect(() => {
    const now = Date.now();
    const loaded = loadSave();
    if (loaded) {
      const { save: s, report: rep } = applyOffline(loaded, now);
      persistSave(s);
      setSave(s);
      setReport(rep);
    }
    setReady(true);
  }, []);

  // 열려 있는 동안에도 줍스는 계속 궤도를 돈다 — 5초마다 진행 반영
  useEffect(() => {
    const id = setInterval(() => {
      setSave((s) => {
        if (!s || !s.onboarded) return s;
        const { save: ns } = applyOffline(s, Date.now());
        if (ns !== s) persistSave(ns);
        return ns;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  /** 액션 적용: mutate((save, now) => newSave) */
  const mutate = useCallback(
    (fn: (s: SaveState, now: number) => SaveState) => {
      setSave((s) => {
        if (!s) return s;
        const ns = fn(s, Date.now());
        if (ns !== s) persistSave(ns);
        return ns;
      });
    },
    [],
  );

  /** 온보딩 완료 — 새 줍스 탄생 */
  const create = useCallback((name: string, owner: OwnerLoc) => {
    const s = defaultSave(Date.now(), name, owner);
    s.onboarded = true;
    persistSave(s);
    setSave(s);
  }, []);

  const dismissReport = useCallback(() => setReport(null), []);

  return { save, ready, report, dismissReport, mutate, create };
}
