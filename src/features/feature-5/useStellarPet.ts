"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EVOLUTION_STAGES,
  OFFLINE_AVG_KG,
  OFFLINE_CAP_MS,
  OFFLINE_MIN_MS,
  stageIndexForTotal,
} from "./constants";
import { localDayKey } from "./format";
import type { PetState } from "./types";

const STORAGE_KEY = "sjs.feature5.pet.v1";

export type OfflineReport = {
  awayMs: number;
  count: number;
  kg: number;
};

function freshPet(now: number): PetState {
  return {
    name: "코스모",
    hue: Math.floor(Math.random() * 360),
    bornAt: now,
    lastSeenAt: now,
    totalEaten: 0,
    totalKg: 0,
    todayEaten: 0,
    todayKey: localDayKey(),
  };
}

function loadPet(): PetState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PetState;
    if (typeof p.totalEaten !== "number" || typeof p.lastSeenAt !== "number") {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function savePet(p: PetState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // 저장 실패는 치명적이지 않음 (사파리 프라이빗 모드 등)
  }
}

export function useStellarPet() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [report, setReport] = useState<OfflineReport | null>(null);
  const petRef = useRef<PetState | null>(null);
  petRef.current = pet;

  // 최초 로드 — 저장된 펫을 깨우고 자리 비운 동안의 수거량을 정산한다.
  useEffect(() => {
    const now = Date.now();
    const saved = loadPet();
    let p = saved ?? freshPet(now);

    if (saved) {
      const away = Math.max(0, now - saved.lastSeenAt);
      if (away >= OFFLINE_MIN_MS) {
        const effective = Math.min(away, OFFLINE_CAP_MS);
        const rate = EVOLUTION_STAGES[stageIndexForTotal(saved.totalEaten)].ratePerMin;
        const count = Math.floor((effective / 60000) * rate);
        if (count > 0) {
          const kg = count * OFFLINE_AVG_KG;
          p = { ...p, totalEaten: p.totalEaten + count, totalKg: p.totalKg + kg };
          setReport({ awayMs: away, count, kg });
        }
      }
    }

    const today = localDayKey();
    p = {
      ...p,
      lastSeenAt: now,
      todayEaten: p.todayKey === today ? p.todayEaten : 0,
      todayKey: today,
    };
    setPet(p);
    savePet(p);
  }, []);

  // 변경될 때마다 저장 + 5초 심장박동으로 lastSeenAt 갱신
  useEffect(() => {
    if (pet) savePet(pet);
  }, [pet]);

  useEffect(() => {
    const touch = () => {
      setPet((p) => (p ? { ...p, lastSeenAt: Date.now() } : p));
    };
    const interval = setInterval(touch, 5000);
    const onHide = () => {
      const p = petRef.current;
      if (p) savePet({ ...p, lastSeenAt: Date.now() });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  const eat = useCallback((massKg: number) => {
    setPet((p) => {
      if (!p) return p;
      const today = localDayKey();
      return {
        ...p,
        totalEaten: p.totalEaten + 1,
        totalKg: p.totalKg + massKg,
        todayEaten: (p.todayKey === today ? p.todayEaten : 0) + 1,
        todayKey: today,
        lastSeenAt: Date.now(),
      };
    });
  }, []);

  const rename = useCallback((name: string) => {
    const next = name.trim().slice(0, 12);
    if (!next) return;
    setPet((p) => (p ? { ...p, name: next } : p));
  }, []);

  const dismissReport = useCallback(() => setReport(null), []);

  return { pet, report, eat, rename, dismissReport };
}
