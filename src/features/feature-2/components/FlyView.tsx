"use client";

// 비행 모드 — 그래비티풍 지구 위 저궤도에서 줍스를 조종해 우주쓰레기를 청소한다.
// 지구 텍스처 윈도는 groundTrack(현재시각)을 따라 움직여서
// 관제 화면의 위치와 비행 화면의 풍경이 항상 일치한다 (요구사항 6).

import { useEffect, useRef, useState } from "react";
import {
  coverageRadiusKm,
  DEBRIS_TIERS,
  levelFromXp,
  maxTierForLevel,
  stageForLevel,
  xpForLevel,
  xpToNext,
} from "../lib/gameConfig";
import { groundTrack, isInRange, solarSubpoint } from "../lib/orbit";
import type { EarthTextures } from "../lib/earthTexture";
import { lonToX, latToY, TEX_W, TEX_H } from "../lib/earthTexture";
import type { Country } from "../lib/geo";
import { placeNameAt } from "../lib/geo";
import { drawHeart, drawJoops, drawStarShape, type Mood } from "../lib/draw";
import { sfx } from "../lib/sound";
import { getState, isQuantumActive, mutate, persist, useSave } from "../lib/store";

type Entity = {
  kind: "debris" | "sat" | "item" | "friend";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  tier: number; // debris 전용
  itemType?: "candy" | "shield" | "magnet" | "quantum";
  name?: string; // friend 전용
  hue?: number;
  met?: boolean;
  bobPhase: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: "dot" | "star" | "heart";
};

type Popup = { x: number; y: number; text: string; life: number; color: string };

type Toast = { id: number; text: string };

const FRIEND_NAMES = ["모모", "보리", "츄츄", "코코", "별이", "두부", "마루", "라떼", "콩이", "솜이"];
const ITEM_EMOJI = { candy: "🍬", shield: "🛡️", magnet: "🧲", quantum: "🔮" } as const;

export default function FlyView({
  textures,
  countries,
  onNeedCare,
}: {
  textures: EarthTextures;
  countries: Country[] | null;
  onNeedCare: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onNeedCareRef = useRef(onNeedCare);
  onNeedCareRef.current = onNeedCare;

  const save = useSave();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showHint, setShowHint] = useState(true);
  const [, setTick] = useState(0); // 아이템 남은시간 등 1초 갱신용
  const [place, setPlace] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    const hint = setTimeout(() => setShowHint(false), 6000);
    return () => {
      clearInterval(id);
      clearTimeout(hint);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars: { x: number; y: number; r: number; ph: number }[] = [];

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      stars = Array.from({ length: 130 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        ph: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ---- 게임 상태 (렌더 프레임 로컬) ----
    const pos = { x: w * 0.32, y: h * 0.3 };
    const target = { x: pos.x, y: pos.y };
    let joopsVx = 0;
    const entities: Entity[] = [];
    const particles: Particle[] = [];
    const popups: Popup[] = [];
    let debrisTimer = 0.6;
    let satTimer = 8;
    let itemTimer = 25;
    let friendTimer = 45;
    let shootingStar: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let shootingTimer = 6;
    let boost = 1;
    let shake = 0;
    let redFlash = 0;
    let whiteFlash = 0;
    let invulnUntil = 0;
    let eatMouthUntil = 0;
    let energyDrainAcc = 0;
    let eatenSinceSnack = 0;
    let inRangeCached = false;
    let rangeCheckAt = 0;
    let placeCheckAt = 0;
    let toastId = 0;
    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const pushToast = (text: string) => {
      const id = ++toastId + Math.floor(Math.random() * 1e6);
      setToasts((prev) => [...prev.slice(-2), { id, text }]);
      setTimeout(() => {
        if (!disposed) setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2800);
    };

    const burst = (
      x: number,
      y: number,
      color: string,
      count: number,
      shape: Particle["shape"] = "dot",
      speed = 120
    ) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.8);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.7 + Math.random() * 0.5,
          maxLife: 1.1,
          size: shape === "dot" ? 2 + Math.random() * 3 : 5 + Math.random() * 5,
          color,
          shape,
        });
      }
    };

    const addXp = (amount: number, x: number, y: number) => {
      const s = getState();
      if (!s) return;
      const before = levelFromXp(s.xp);
      mutate((st) => {
        st.xp += amount;
      });
      popups.push({ x, y, text: `+${amount}`, life: 1, color: "#a5f3fc" });
      const after = levelFromXp(s.xp);
      if (after > before) {
        sfx.levelUp();
        whiteFlash = 0.5;
        burst(pos.x, pos.y, "#fde047", 22, "star", 200);
        const stB = stageForLevel(before);
        const stA = stageForLevel(after);
        if (stA.stage > stB.stage) {
          pushToast(`✨ 진화! ${stA.name}이(가) 되었어요!`);
          whiteFlash = 0.9;
        } else {
          pushToast(`레벨 업! Lv.${after}`);
        }
      }
    };

    const spawnDebris = () => {
      const s = getState();
      if (!s) return;
      const maxTier = maxTierForLevel(levelFromXp(s.xp));
      let tier: number;
      if (Math.random() < 0.82) {
        // 소화 가능 등급 (낮은 등급 가중)
        const weights = [50, 30, 12, 6, 2].slice(0, maxTier);
        const total = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;
        tier = 1;
        for (let i = 0; i < weights.length; i++) {
          roll -= weights[i];
          if (roll <= 0) {
            tier = i + 1;
            break;
          }
        }
      } else {
        // 아직 처리 못 하는 위험 쓰레기
        tier = Math.min(5, maxTier + 1 + Math.floor(Math.random() * 2));
        if (tier <= maxTier) tier = Math.min(5, maxTier + 1);
      }
      const td = DEBRIS_TIERS[tier - 1];
      entities.push({
        kind: "debris",
        x: w + 40,
        y: 40 + Math.random() * (h * 0.62),
        vx: -(110 + Math.random() * 70),
        vy: (Math.random() - 0.5) * 30,
        r: td.radius,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 3,
        tier,
        bobPhase: Math.random() * Math.PI * 2,
      });
    };

    const drawEarthScene = (now: number, t: number) => {
      const s = getState();
      const horizonY = h * 0.6;
      // 별
      ctx.fillStyle = "#020409";
      ctx.fillRect(0, 0, w, h);
      for (const st of stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + st.ph));
        ctx.globalAlpha = a;
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (shootingStar) {
        ctx.strokeStyle = `rgba(255,255,255,${shootingStar.life})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(shootingStar.x - shootingStar.vx * 0.12, shootingStar.y - shootingStar.vy * 0.12);
        ctx.stroke();
      }

      const g = s ? groundTrack(now, s.epochMs) : { lat: 0, lon: 0 };
      const R = Math.max(w, h) * 1.5;
      const cx = w / 2;
      const cy = horizonY + R;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // 지도 윈도: 현재 지상 궤적점 중심 (경도 랩은 패딩 캔버스가 흡수)
      const lonSpan = 64;
      const dw = w * 1.2;
      const dx = -w * 0.1;
      const dy = horizonY - 24;
      const dh = h - horizonY + 64;
      const sw = (lonSpan / 360) * TEX_W;
      const sh = (sw * dh) / dw;
      let sx = lonToX(g.lon) - sw / 2;
      if (sx < 0) sx += TEX_W;
      let sy = latToY(g.lat) - sh / 2;
      sy = Math.max(0, Math.min(TEX_H - sh, sy));
      ctx.drawImage(textures.map, sx, sy, sw, sh, dx, dy, dw, dh);

      // 구름 (살짝 다른 속도로 흘러 몽환적인 깊이감)
      const cloudDriftDeg = (now / 60000) * 1.2;
      let cxs = lonToX(g.lon - cloudDriftDeg * 0.5) - sw / 2;
      cxs = ((cxs % TEX_W) + TEX_W) % TEX_W;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(textures.clouds, cxs, sy, sw, sh, dx - 8, dy - 6, dw, dh);
      ctx.globalAlpha = 1;

      // 밤 지역 진입 시 어두워짐
      const sun = solarSubpoint(now);
      const d2r = Math.PI / 180;
      const cosang =
        Math.sin(g.lat * d2r) * Math.sin(sun.lat * d2r) +
        Math.cos(g.lat * d2r) * Math.cos(sun.lat * d2r) * Math.cos((g.lon - sun.lon) * d2r);
      const nightA = Math.max(0, Math.min(0.5, (0.12 - cosang) * 0.45));
      if (nightA > 0.01) {
        ctx.fillStyle = `rgba(2,6,23,${nightA})`;
        ctx.fillRect(0, dy, w, dh + 40);
      }

      // 대기 산란: 수평선 안쪽 글로우 (이즈-아웃으로 경계선 없이)
      const atm = ctx.createLinearGradient(0, horizonY, 0, horizonY + 90);
      atm.addColorStop(0, "rgba(165,230,255,0.5)");
      atm.addColorStop(0.3, "rgba(165,230,255,0.16)");
      atm.addColorStop(0.65, "rgba(165,230,255,0.05)");
      atm.addColorStop(1, "rgba(165,230,255,0)");
      ctx.fillStyle = atm;
      ctx.fillRect(0, horizonY, w, 90);
      ctx.restore();

      // 수평선 림 글로우 (대기층)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(190,240,255,0.9)";
      ctx.lineWidth = 2.2;
      ctx.shadowColor = "rgba(120,210,255,0.95)";
      ctx.shadowBlur = 26;
      ctx.stroke();
      ctx.strokeStyle = "rgba(90,170,255,0.2)";
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.restore();
    };

    const drawDebris = (e: Entity, t: number) => {
      const s = getState();
      const maxTier = s ? maxTierForLevel(levelFromXp(s.xp)) : 1;
      const td = DEBRIS_TIERS[e.tier - 1];
      const hazard = e.tier > maxTier;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.fillStyle = td.color;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      const r = e.r;
      if (e.tier === 1) {
        ctx.fillRect(-r, -r * 0.5, r * 2, r);
        ctx.strokeRect(-r, -r * 0.5, r * 2, r);
      } else if (e.tier === 2) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, 0);
        ctx.lineTo(r * 0.5, 0);
        ctx.stroke();
      } else if (e.tier === 3) {
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.3);
        ctx.lineTo(0, -r);
        ctx.lineTo(r, -r * 0.1);
        ctx.lineTo(r * 0.4, r * 0.8);
        ctx.lineTo(-r * 0.5, r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.tier === 4) {
        ctx.fillRect(-r, -r * 0.45, r * 2, r * 0.9);
        ctx.strokeRect(-r, -r * 0.45, r * 2, r * 0.9);
        ctx.fillStyle = "#f43f5e";
        ctx.fillRect(-r, -r * 0.45, r * 0.5, r * 0.9);
      } else {
        ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(-r * 1.6, -r * 0.35, r * 0.8, r * 0.7);
        ctx.fillRect(r * 0.8, -r * 0.35, r * 0.8, r * 0.7);
      }
      ctx.restore();
      if (hazard) {
        const pulse = 0.4 + 0.4 * Math.abs(Math.sin(t * 4 + e.bobPhase));
        ctx.strokeStyle = `rgba(248,113,113,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const drawSat = (e: Entity, t: number) => {
      ctx.save();
      ctx.translate(e.x, e.y + Math.sin(t + e.bobPhase) * 4);
      ctx.rotate(Math.sin(t * 0.4 + e.bobPhase) * 0.15);
      // 태양전지판
      ctx.fillStyle = "#1d4ed8";
      ctx.strokeStyle = "rgba(147,197,253,0.8)";
      ctx.lineWidth = 1;
      for (const side of [-1, 1]) {
        ctx.fillRect(side * 16 - (side < 0 ? 26 : 0), -9, 26, 18);
        ctx.strokeRect(side * 16 - (side < 0 ? 26 : 0), -9, 26, 18);
      }
      // 본체
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(-13, -11, 26, 22);
      ctx.strokeRect(-13, -11, 26, 22);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(-13, -11, 26, 6);
      // 경고등
      const blink = Math.sin(t * 6 + e.bobPhase) > 0.4;
      if (blink) {
        ctx.fillStyle = "#f87171";
        ctx.beginPath();
        ctx.arc(0, -14, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const pulse = 0.35 + 0.35 * Math.abs(Math.sin(t * 4 + e.bobPhase));
      ctx.strokeStyle = `rgba(248,113,113,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 9, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawItem = (e: Entity, t: number) => {
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + e.bobPhase));
      ctx.save();
      ctx.shadowColor = "#fef08a";
      ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(253,224,71,${0.4 + 0.5 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ITEM_EMOJI[e.itemType ?? "candy"], e.x, e.y + 1);
      ctx.restore();
    };

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const now = Date.now();
      const t = ts / 1000;
      const s = getState();
      if (!s) return;

      const level = levelFromXp(s.xp);
      const maxTier = maxTierForLevel(level);
      const paused = s.careNeeded;
      const horizonY = h * 0.6;

      // 교신 범위 캐시 (1초마다)
      if (now > rangeCheckAt) {
        rangeCheckAt = now + 1000;
        inRangeCached = isInRange(now, s.epochMs, s.owner, coverageRadiusKm(level));
        if (now > placeCheckAt) {
          placeCheckAt = now + 5000;
          const gp = groundTrack(now, s.epochMs);
          setPlace(placeNameAt(gp.lon, gp.lat, countries).name);
        }
      }
      const mult = isQuantumActive(s, now) || inRangeCached ? 2 : 1;

      // ---- 업데이트 ----
      boost = Math.max(1, boost - dt * 0.8);
      shake = Math.max(0, shake - dt);
      redFlash = Math.max(0, redFlash - dt * 1.2);
      whiteFlash = Math.max(0, whiteFlash - dt * 1.1);

      if (!paused) {
        const tired = s.energy <= 12;
        const ease = tired ? 2.4 : 5;
        const prevX = pos.x;
        pos.x += (target.x - pos.x) * Math.min(1, dt * ease);
        pos.y += (target.y - pos.y) * Math.min(1, dt * ease);
        pos.x = Math.max(30, Math.min(w - 30, pos.x));
        pos.y = Math.max(46, Math.min(horizonY + 46, pos.y));
        joopsVx = (pos.x - prevX) / Math.max(dt, 1e-4);

        // 에너지 소모 (1초 주기로 저장소에 반영)
        energyDrainAcc += dt * 0.12;
        if (energyDrainAcc >= 0.5) {
          const drain = energyDrainAcc;
          energyDrainAcc = 0;
          mutate((st) => {
            st.energy = Math.max(0, st.energy - drain);
          });
        }

        // 스폰
        debrisTimer -= dt;
        if (debrisTimer <= 0) {
          debrisTimer = 0.55 + Math.random() * 0.9;
          spawnDebris();
        }
        satTimer -= dt;
        if (satTimer <= 0) {
          satTimer = 9 + Math.random() * 8;
          entities.push({
            kind: "sat",
            x: w + 60,
            y: 60 + Math.random() * (horizonY - 80),
            vx: -(90 + Math.random() * 40),
            vy: 0,
            r: 24,
            rot: 0,
            vr: 0,
            tier: 0,
            bobPhase: Math.random() * Math.PI * 2,
          });
        }
        itemTimer -= dt;
        if (itemTimer <= 0) {
          itemTimer = 40 + Math.random() * 40;
          const roll = Math.random();
          const itemType =
            roll < 0.38 ? "candy" : roll < 0.62 ? "shield" : roll < 0.86 ? "magnet" : "quantum";
          entities.push({
            kind: "item",
            x: w + 30,
            y: 60 + Math.random() * (horizonY - 90),
            vx: -(70 + Math.random() * 30),
            vy: Math.sin(Math.random()) * 10,
            r: 14,
            rot: 0,
            vr: 0,
            tier: 0,
            itemType,
            bobPhase: Math.random() * Math.PI * 2,
          });
        }
        friendTimer -= dt;
        if (friendTimer <= 0) {
          friendTimer = 90 + Math.random() * 90;
          entities.push({
            kind: "friend",
            x: w + 50,
            y: 70 + Math.random() * (horizonY - 110),
            vx: -(55 + Math.random() * 25),
            vy: 0,
            r: 22,
            rot: 0,
            vr: 0,
            tier: 0,
            name: FRIEND_NAMES[Math.floor(Math.random() * FRIEND_NAMES.length)],
            hue: 40 + Math.random() * 280,
            bobPhase: Math.random() * Math.PI * 2,
          });
        }

        // 엔티티 이동 + 충돌
        const magnetOn = s.magnetUntil > now;
        const shieldOn = s.shieldUntil > now;
        for (let i = entities.length - 1; i >= 0; i--) {
          const e = entities[i];
          e.x += e.vx * boost * dt;
          e.y += e.vy * dt;
          e.rot += e.vr * dt;
          if (e.kind === "friend") e.y += Math.sin(t * 1.5 + e.bobPhase) * 12 * dt;
          if (e.kind === "friend" && e.met) e.vx -= 140 * dt; // 인사 후 우주 저편으로

          if (magnetOn && e.kind === "debris" && e.tier <= maxTier) {
            const ddx = pos.x - e.x;
            const ddy = pos.y - e.y;
            const dist = Math.hypot(ddx, ddy);
            if (dist < 170 && dist > 1) {
              e.x += (ddx / dist) * 190 * dt;
              e.y += (ddy / dist) * 190 * dt;
            }
          }

          if (e.x < -80) {
            entities.splice(i, 1);
            continue;
          }

          const dist = Math.hypot(pos.x - e.x, pos.y - e.y);
          const joopsR = 24;
          if (e.kind === "debris" && e.tier <= maxTier && dist < joopsR + e.r) {
            // 냠! 추진력 + 경험치 + 에너지 (요구사항 3, 5)
            const td = DEBRIS_TIERS[e.tier - 1];
            entities.splice(i, 1);
            boost = 1.7;
            eatMouthUntil = now + 350;
            sfx.eat(e.tier);
            burst(e.x, e.y, td.color, 7);
            burst(e.x, e.y, "#a5f3fc", 4, "star", 150);
            eatenSinceSnack++;
            mutate((st) => {
              st.energy = Math.min(100, st.energy + 1.5 + e.tier);
              st.cleanedCount += 1;
              st.cleanedMassKg += td.massKg;
              if (eatenSinceSnack >= 15) {
                eatenSinceSnack = 0;
                st.snacks += 1;
              }
            });
            if (eatenSinceSnack === 0) pushToast("간식 획득! 🍬 (돌봄 탭에서 사용)");
            addXp(td.xp * mult, e.x, e.y);
            continue;
          }
          if (
            (e.kind === "sat" || (e.kind === "debris" && e.tier > maxTier)) &&
            dist < joopsR + e.r
          ) {
            if (shieldOn) {
              e.vx = Math.abs(e.vx) * 0.9;
              e.vy = (e.y - pos.y) * 2;
              burst(e.x, e.y, "#67e8f9", 8);
              continue;
            }
            if (now >= invulnUntil) {
              invulnUntil = now + 2500;
              shake = 0.5;
              redFlash = 0.55;
              sfx.hurt();
              burst(pos.x, pos.y, "#f87171", 12);
              const dmg = e.kind === "sat" ? 24 : 8 + e.tier * 3.5;
              let nowCare = false;
              mutate((st) => {
                st.hp = Math.max(5, st.hp - dmg);
                if (st.hp <= 20 && !st.careNeeded) {
                  st.careNeeded = true;
                  nowCare = true;
                }
              });
              if (nowCare) {
                persist();
                pushToast("줍스가 크게 다쳤어요 😢 돌봄이 필요해요!");
              }
            }
            continue;
          }
          if (e.kind === "item" && dist < joopsR + e.r + 4) {
            entities.splice(i, 1);
            sfx.item();
            burst(e.x, e.y, "#fde047", 10, "star", 160);
            const it = e.itemType ?? "candy";
            mutate((st) => {
              if (it === "candy") st.energy = Math.min(100, st.energy + 25);
              if (it === "shield") st.shieldUntil = now + 20_000;
              if (it === "magnet") st.magnetUntil = now + 15_000;
              if (it === "quantum") st.quantumCapsules += 1;
            });
            pushToast(
              it === "candy"
                ? "스타 캔디! 에너지 +25 🍬"
                : it === "shield"
                  ? "보호막 활성화! 20초 🛡️"
                  : it === "magnet"
                    ? "디브리 자석! 15초 🧲"
                    : "퀀텀 링크 캡슐 획득 🔮 (돌봄 탭에서 사용)"
            );
            continue;
          }
          if (e.kind === "friend" && !e.met && dist < joopsR + e.r + 26) {
            // 다른 줍스와 조우 — 깜찍한 인사 (요구사항 7)
            e.met = true;
            e.vr = 6;
            sfx.friend();
            for (let k = 0; k < 12; k++) {
              particles.push({
                x: (pos.x + e.x) / 2,
                y: (pos.y + e.y) / 2 - 10,
                vx: (Math.random() - 0.5) * 90,
                vy: -40 - Math.random() * 70,
                life: 0.9 + Math.random() * 0.5,
                maxLife: 1.4,
                size: 5 + Math.random() * 6,
                color: ["#fb7185", "#f9a8d4", "#fda4af"][k % 3],
                shape: "heart",
              });
            }
            mutate((st) => {
              st.encounters += 1;
            });
            pushToast(`💞 ${e.name}네 줍스와 인사했어요!`);
            addXp(50 * mult, (pos.x + e.x) / 2, (pos.y + e.y) / 2);
          }
        }

        // 추진 트레일
        if (boost > 1.08) {
          particles.push({
            x: pos.x - 22,
            y: pos.y + (Math.random() - 0.5) * 12,
            vx: -120 - Math.random() * 60,
            vy: (Math.random() - 0.5) * 30,
            life: 0.4,
            maxLife: 0.4,
            size: 2.5 + Math.random() * 2.5,
            color: Math.random() < 0.5 ? "#67e8f9" : "#bae6fd",
            shape: "dot",
          });
        }
      }

      // 파티클/팝업
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.y -= 34 * dt;
        p.life -= dt * 0.9;
        if (p.life <= 0) popups.splice(i, 1);
      }
      shootingTimer -= dt;
      if (shootingTimer <= 0 && !shootingStar) {
        shootingTimer = 7 + Math.random() * 9;
        shootingStar = {
          x: Math.random() * w * 0.8,
          y: Math.random() * h * 0.25,
          vx: 320 + Math.random() * 200,
          vy: 90 + Math.random() * 60,
          life: 1,
        };
      }
      if (shootingStar) {
        shootingStar.x += shootingStar.vx * dt;
        shootingStar.y += shootingStar.vy * dt;
        shootingStar.life -= dt * 1.4;
        if (shootingStar.life <= 0) shootingStar = null;
      }

      // ---- 렌더 ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
      }
      drawEarthScene(now, t);

      for (const e of entities) {
        if (e.kind === "debris") drawDebris(e, t);
        else if (e.kind === "sat") drawSat(e, t);
        else if (e.kind === "item") drawItem(e, t);
        else {
          drawJoops(ctx, {
            x: e.x,
            y: e.y + Math.sin(t * 1.5 + e.bobPhase) * 6,
            r: e.r,
            stage: Math.floor((e.bobPhase * 100) % 3),
            t: t + e.bobPhase,
            mood: "happy",
            hue: e.hue,
            lookX: -0.6,
          });
          if (e.name) {
            ctx.font = "11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(226,232,240,0.85)";
            ctx.fillText(`${e.name}네 줍스`, e.x, e.y - e.r - 14);
          }
        }
      }

      // 보호막 표시
      if (s.shieldUntil > now && !paused) {
        const a = 0.35 + 0.2 * Math.sin(t * 5);
        ctx.strokeStyle = `rgba(103,232,249,${a})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 36, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 줍스 본체 (피격 무적 중엔 깜빡임)
      const blinking = now < invulnUntil && Math.floor(t * 10) % 2 === 0;
      if (!blinking) {
        let mood: Mood = "happy";
        if (paused) mood = "hurt";
        else if (now < eatMouthUntil) mood = "eat";
        else if (s.hp <= 35) mood = "hurt";
        else if (s.energy <= 12) mood = "tired";
        drawJoops(ctx, {
          x: pos.x,
          y: pos.y,
          r: 26,
          stage: stageForLevel(level).stage,
          t,
          mood,
          lookX: Math.max(-1, Math.min(1, joopsVx / 300)),
          vx: joopsVx,
        });
      }

      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        if (p.shape === "dot") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "star") {
          drawStarShape(ctx, p.x, p.y, p.size);
          ctx.fill();
        } else {
          drawHeart(ctx, p.x, p.y, p.size);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = "center";
      for (const p of popups) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;

      if (redFlash > 0) {
        ctx.fillStyle = `rgba(239,68,68,${redFlash * 0.28})`;
        ctx.fillRect(0, 0, w, h);
      }
      if (whiteFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${whiteFlash * 0.5})`;
        ctx.fillRect(0, 0, w, h);
      }
    };
    raf = requestAnimationFrame(loop);

    // ---- 입력 ----
    const toLocal = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    let dragging = false;
    const onDown = (ev: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(ev.pointerId);
      const p = toLocal(ev);
      target.x = p.x;
      target.y = p.y - 46; // 손가락에 가려지지 않게 위로
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      const p = toLocal(ev);
      target.x = p.x;
      target.y = p.y - 46;
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const onVis = () => {
      if (document.hidden) persist();
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVis);
      persist();
    };
  }, [textures, countries]);

  if (!save) return null;
  const now = Date.now();
  const level = levelFromXp(save.xp);
  const quantum = isQuantumActive(save, now);
  const inRange = isInRange(now, save.epochMs, save.owner, coverageRadiusKm(level));
  const boosted = quantum || inRange;
  const xpCur = save.xp - xpBase(level);
  const xpNeed = xpSpan(level);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden touch-none select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-col gap-1.5 text-[11px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex w-40 flex-col gap-1 rounded-xl bg-black/45 p-2 backdrop-blur-sm">
            <Bar label="체력" value={save.hp} max={100} color="bg-rose-400" />
            <Bar label="에너지" value={save.energy} max={100} color="bg-amber-300" />
            <Bar label={`Lv.${level}`} value={xpCur} max={xpNeed} color="bg-cyan-300" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
              🧹 {save.cleanedCount.toLocaleString()}개 · {formatMass(save.cleanedMassKg)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 backdrop-blur-sm ${
                boosted ? "bg-emerald-500/70 text-white" : "bg-black/45 text-slate-300"
              }`}
            >
              {quantum ? "🌐 퀀텀 링크 ×2" : inRange ? "📡 주인 상공 교신 ×2" : "🛰️ 원격 링크 ×1"}
            </span>
            {place && (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-slate-300 backdrop-blur-sm">
                {place} 상공
              </span>
            )}
            <div className="flex gap-1">
              {save.shieldUntil > now && (
                <span className="rounded-full bg-cyan-500/60 px-2 py-0.5">
                  🛡️ {Math.ceil((save.shieldUntil - now) / 1000)}s
                </span>
              )}
              {save.magnetUntil > now && (
                <span className="rounded-full bg-violet-500/60 px-2 py-0.5">
                  🧲 {Math.ceil((save.magnetUntil - now) / 1000)}s
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      <div className="pointer-events-none absolute inset-x-4 top-24 flex flex-col items-center gap-1.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-full bg-black/60 px-3.5 py-1.5 text-xs text-white backdrop-blur-sm"
          >
            {t.text}
          </div>
        ))}
      </div>

      {showHint && !save.careNeeded && (
        <p className="pointer-events-none absolute inset-x-0 bottom-8 animate-pulse text-center text-xs text-slate-300">
          화면을 드래그해서 줍스를 조종하세요 · 반짝이는 빨간 테두리는 피하세요!
        </p>
      )}

      {/* 돌봄 필요 오버레이 (요구사항 5) */}
      {save.careNeeded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/90 p-5 text-center">
            <span className="text-4xl">🚑</span>
            <p className="text-sm font-semibold text-white">
              {save.name}가 다쳐서 비행할 수 없어요
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              처리할 수 없는 물체와 부딪혀 체력이 바닥났어요.
              주인의 보살핌이 필요해요.
            </p>
            <button
              onClick={onNeedCare}
              className="mt-1 h-11 w-full rounded-xl bg-rose-500 text-sm font-semibold text-white transition-colors hover:bg-rose-400"
            >
              돌봄 탭으로 가기 💗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-right text-[10px] text-slate-300">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-300`}
          style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
        />
      </div>
    </div>
  );
}

function formatMass(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)}t`;
  if (kg >= 1) return `${kg.toFixed(1)}kg`;
  return `${(kg * 1000).toFixed(0)}g`;
}

function xpBase(level: number): number {
  return xpForLevel(level);
}
function xpSpan(level: number): number {
  return xpToNext(level);
}
