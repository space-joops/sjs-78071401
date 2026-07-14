"use client";
// 궤도 비행 미니게임 — 드래그로 줍스를 조종해 우주쓰레기를 먹는다.
// 지구는 실제 대륙 텍스처가 스크롤되며 궤도 비행(자전) 느낌을 준다(요구 6).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { DEBRIS, FRIEND_NAMES, stageForLevel } from "../lib/constants";
import { buildCloudTexture, buildEarthTexture } from "../lib/earthTexture";
import { loadWorld } from "../lib/geo";
import { joopsDataUrl } from "../lib/joopsArt";
import { isInContact } from "../lib/orbit";
import {
  applyGameResult,
  boosterActive,
  coverageKmOf,
  isExhausted,
  loadSave,
  persistSave,
} from "../lib/state";
import type { DebrisType, GameResult, SaveState } from "../lib/types";
import SpaceBackdrop from "./SpaceBackdrop";

type Phase = "loading" | "blocked" | "playing" | "ended";

type Ent = {
  kind: "debris" | "sat" | "friend" | "booster";
  type?: DebrisType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  wob: number;
  met?: boolean;
  metT?: number;
  name?: string;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  heart?: boolean;
};
type FloatText = {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
};

type Hud = {
  hp: number;
  cleaned: number;
  xp: number;
  combo: number;
  mult: number;
  boost: number;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 두들풍 스프라이트 프리렌더 */
function makeSprite(kind: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const pad = 6;
  c.width = size * 2 + pad * 2;
  c.height = size * 2 + pad * 2;
  const x = c.getContext("2d")!;
  x.translate(size + pad, size + pad);
  x.lineWidth = 2.5;
  x.strokeStyle = "#26243a";
  x.lineJoin = "round";
  x.lineCap = "round";
  const s = size;
  switch (kind) {
    case "paint": {
      x.fillStyle = "#ffb3c7";
      x.beginPath();
      x.moveTo(-s, 0);
      x.quadraticCurveTo(-s * 0.4, -s, s * 0.3, -s * 0.5);
      x.quadraticCurveTo(s, 0, s * 0.3, s * 0.7);
      x.quadraticCurveTo(-s * 0.5, s, -s, 0);
      x.fill();
      x.stroke();
      break;
    }
    case "bolt": {
      x.fillStyle = "#c8cdd8";
      x.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * s;
        const py = Math.sin(a) * s;
        if (i === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.closePath();
      x.fill();
      x.stroke();
      x.fillStyle = "#7d8494";
      x.beginPath();
      x.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      break;
    }
    case "shard": {
      x.fillStyle = "#dfe6f2";
      x.beginPath();
      x.moveTo(-s, s * 0.6);
      x.lineTo(0, -s);
      x.lineTo(s, s * 0.2);
      x.lineTo(s * 0.2, s);
      x.closePath();
      x.fill();
      x.stroke();
      x.strokeStyle = "rgba(120,130,150,0.7)";
      x.beginPath();
      x.moveTo(-s * 0.4, s * 0.3);
      x.lineTo(s * 0.3, -s * 0.3);
      x.stroke();
      break;
    }
    case "panel": {
      x.fillStyle = "#3f6fd8";
      const w = s * 1.7;
      const h = s * 1.1;
      x.beginPath();
      x.roundRect(-w / 2, -h / 2, w, h, 4);
      x.fill();
      x.stroke();
      x.strokeStyle = "rgba(200,220,255,0.8)";
      x.lineWidth = 1.5;
      x.beginPath();
      for (let i = 1; i < 4; i++) {
        x.moveTo(-w / 2 + (w * i) / 4, -h / 2);
        x.lineTo(-w / 2 + (w * i) / 4, h / 2);
      }
      x.moveTo(-w / 2, 0);
      x.lineTo(w / 2, 0);
      x.stroke();
      break;
    }
    case "tank": {
      x.fillStyle = "#f2f4f8";
      x.beginPath();
      x.roundRect(-s * 0.7, -s, s * 1.4, s * 2, s * 0.7);
      x.fill();
      x.stroke();
      x.fillStyle = "#ff8f6e";
      x.beginPath();
      x.roundRect(-s * 0.7, -s * 0.25, s * 1.4, s * 0.5, 3);
      x.fill();
      x.stroke();
      break;
    }
    case "derelict": {
      x.fillStyle = "#aab2c2";
      x.beginPath();
      x.roundRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2, 5);
      x.fill();
      x.stroke();
      // 부러진 태양전지판
      x.fillStyle = "#54699c";
      x.beginPath();
      x.roundRect(-s * 1.5, -s * 0.3, s * 0.8, s * 0.6, 3);
      x.fill();
      x.stroke();
      // X자 눈 (수명이 다한 위성)
      x.beginPath();
      x.moveTo(-s * 0.3, -s * 0.25);
      x.lineTo(-s * 0.1, -s * 0.05);
      x.moveTo(-s * 0.1, -s * 0.25);
      x.lineTo(-s * 0.3, -s * 0.05);
      x.moveTo(s * 0.1, -s * 0.25);
      x.lineTo(s * 0.3, -s * 0.05);
      x.moveTo(s * 0.3, -s * 0.25);
      x.lineTo(s * 0.1, -s * 0.05);
      x.stroke();
      break;
    }
    case "sat": {
      // 운용 중인 위성 — 절대 먹으면 안 됨
      x.fillStyle = "#ffd95e";
      x.beginPath();
      x.roundRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1, 5);
      x.fill();
      x.stroke();
      x.fillStyle = "#2f6fe0";
      for (const side of [-1, 1]) {
        x.beginPath();
        x.roundRect(side === -1 ? -s * 1.8 : s * 0.7, -s * 0.4, s * 1.1, s * 0.8, 3);
        x.fill();
        x.stroke();
      }
      x.beginPath();
      x.moveTo(0, -s * 0.55);
      x.lineTo(0, -s * 1.1);
      x.stroke();
      break;
    }
    case "booster": {
      x.fillStyle = "#ffd95e";
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? s : s * 0.45;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.closePath();
      x.fill();
      x.stroke();
      break;
    }
  }
  return c;
}

export default function PlayGame() {
  const router = useRouter();
  const { save, ready, mutate } = useGameState();
  const [phase, setPhase] = useState<Phase>("loading");
  const [hud, setHud] = useState<Hud | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<SaveState | null>(null);
  saveRef.current = save;
  const startedRef = useRef(false);
  const appliedRef = useRef(false);
  const finishRef = useRef<(() => void) | null>(null);
  const boostReqRef = useRef(false);

  useEffect(() => {
    if (!ready || startedRef.current) return;
    const s0 = saveRef.current;
    if (!s0 || !s0.onboarded || isExhausted(s0)) {
      setPhase("blocked");
      return;
    }
    startedRef.current = true;
    setPhase("playing");

    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const stage = stageForLevel(s0.joops.level);
    const maxTier = stage.maxTier;
    const startHp = s0.joops.hp;

    // ----- 세션 상태 -----
    let w = 0;
    let h = 0;
    let dpr = 1;
    let horizonY = 0;
    const jp = { x: 0, y: 0, tx: 0, ty: 0, vy: 0 };
    let ents: Ent[] = [];
    let parts: Particle[] = [];
    let texts: FloatText[] = [];
    let orbitPx = 0;
    let elapsed = 0;
    let debrisT = 0.8;
    let friendT = 14;
    let boosterT = rand(45, 80);
    let combo = 0;
    let comboT = 0;
    let invulnT = 0;
    let shakeT = 0;
    let flashT = 0;
    let eatPulse = 0;
    let boostMeter = 30;
    let boostT = 0;
    let hp = startHp;
    let mult = 1;
    let multT = 0;
    const session = {
      cleaned: 0,
      byTier: [0, 0, 0, 0, 0, 0] as number[],
      xp: 0,
      friends: 0,
      bestCombo: 0,
      satiety: 0,
      boosters: 0,
    };

    // ----- 에셋 -----
    const joopsImg = new Image();
    joopsImg.src = joopsDataUrl({ stage: stage.idx, mood: "happy" });
    const friendImgs = [20, 210, 300].map((hue) => {
      const img = new Image();
      img.src = joopsDataUrl({ stage: Math.min(2, stage.idx), mood: "happy", hue });
      return img;
    });
    const sprites = new Map<string, HTMLCanvasElement>();
    for (const d of DEBRIS) sprites.set(d.id, makeSprite(d.id, d.radius));
    sprites.set("sat", makeSprite("sat", 20));
    sprites.set("booster", makeSprite("booster", 16));

    let earthTex: HTMLCanvasElement | null = null;
    let cloudTex: HTMLCanvasElement | null = null;
    let starsFar: HTMLCanvasElement | null = null;
    let starsNear: HTMLCanvasElement | null = null;
    loadWorld().then((world) => {
      earthTex = buildEarthTexture(world, 2048, 1024, "game");
      cloudTex = buildCloudTexture(1400, 500, 11);
    });

    const buildStars = () => {
      const make = (density: number, maxR: number) => {
        const c = document.createElement("canvas");
        c.width = Math.max(2, w);
        c.height = Math.max(2, h);
        const x = c.getContext("2d")!;
        const n = Math.round((w * h) / density);
        for (let i = 0; i < n; i++) {
          const tint = Math.random();
          x.fillStyle =
            tint > 0.92
              ? `rgba(126,242,216,${rand(0.4, 0.9)})`
              : tint > 0.85
                ? `rgba(255,170,190,${rand(0.35, 0.8)})`
                : `rgba(255,255,255,${rand(0.2, 0.8)})`;
          x.beginPath();
          x.arc(Math.random() * w, Math.random() * h, rand(0.3, maxR), 0, Math.PI * 2);
          x.fill();
        }
        return c;
      };
      starsFar = make(5200, 1.0);
      starsNear = make(9000, 1.6);
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      horizonY = h * 0.7;
      buildStars();
    };
    resize();
    jp.x = w * 0.3;
    jp.y = h * 0.38;
    jp.tx = jp.x;
    jp.ty = jp.y;
    window.addEventListener("resize", resize);

    // ----- 입력 -----
    let dragging = false;
    const clampTarget = () => {
      jp.tx = Math.max(36, Math.min(w * 0.82, jp.tx));
      jp.ty = Math.max(64, Math.min(horizonY - 36, jp.ty));
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      jp.tx = e.offsetX;
      jp.ty = e.offsetY - 60;
      clampTarget();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      jp.tx = e.offsetX;
      jp.ty = e.offsetY - 60;
      clampTarget();
    };
    const onUp = () => (dragging = false);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.key);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ----- 스폰 -----
    const spawnDebris = () => {
      const asSat = Math.random() < 0.13;
      if (asSat) {
        ents.push({
          kind: "sat",
          x: w + 60,
          y: rand(70, horizonY - 50),
          vx: -rand(210, 290),
          vy: 0,
          r: 30,
          rot: -0.15,
          vrot: 0,
          wob: rand(0, Math.PI * 2),
        });
        return;
      }
      // 내 티어 +1까지 등장 — 초과분은 장애물
      const pool = DEBRIS.filter((d) => d.tier <= Math.min(5, maxTier + 1));
      const totalW = pool.reduce((acc, d) => acc + d.weight, 0);
      let pick = Math.random() * totalW;
      let type = pool[0];
      for (const d of pool) {
        pick -= d.weight;
        if (pick <= 0) {
          type = d;
          break;
        }
      }
      ents.push({
        kind: "debris",
        type,
        x: w + 50,
        y: rand(70, horizonY - 40),
        vx: -rand(110, 260),
        vy: 0,
        r: type.radius,
        rot: rand(0, Math.PI * 2),
        vrot: rand(-1.6, 1.6),
        wob: rand(0, Math.PI * 2),
      });
    };
    const spawnFriend = () => {
      ents.push({
        kind: "friend",
        x: w + 70,
        y: rand(90, horizonY - 80),
        vx: -rand(70, 110),
        vy: 0,
        r: 30,
        rot: 0,
        vrot: 0,
        wob: rand(0, Math.PI * 2),
        name: FRIEND_NAMES[Math.floor(Math.random() * FRIEND_NAMES.length)],
      });
    };
    const spawnBooster = () => {
      ents.push({
        kind: "booster",
        x: w + 40,
        y: rand(80, horizonY - 60),
        vx: -rand(120, 170),
        vy: 0,
        r: 18,
        rot: 0,
        vrot: 0.8,
        wob: rand(0, Math.PI * 2),
      });
    };

    const burst = (x: number, y: number, colors: string[], n: number, heart = false) => {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(30, heart ? 90 : 160);
        parts.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (heart ? 40 : 0),
          life: rand(0.5, heart ? 1.4 : 0.9),
          max: 1,
          size: heart ? rand(10, 18) : rand(2, 5),
          color: colors[Math.floor(Math.random() * colors.length)],
          heart,
        });
        parts[parts.length - 1].max = parts[parts.length - 1].life;
      }
    };
    const addText = (x: number, y: number, text: string, color: string, size = 15) => {
      texts.push({ x, y, life: 1.1, max: 1.1, text, color, size });
    };

    // ----- 종료 -----
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    const finish = () => {
      if (appliedRef.current) return;
      appliedRef.current = true;
      cancelAnimationFrame(raf);
      const r: GameResult = {
        cleaned: session.cleaned,
        cleanedByTier: session.byTier,
        xp: Math.round(session.xp),
        friendsMet: session.friends,
        bestCombo: session.bestCombo,
        hpDelta: hp - startHp,
        satietyGain: Math.min(30, Math.round(session.satiety)),
        boostersFound: session.boosters,
      };
      // 언마운트 중에도 성과가 유실되지 않도록 스토리지에 직접 반영한 뒤
      // 훅의 메모리 상태를 재동기화한다
      const cur = loadSave();
      if (cur) {
        const ns = applyGameResult(cur, Date.now(), r);
        persistSave(ns);
        mutate(() => ns);
      }
      setResult(r);
      setPhase("ended");
    };
    finishRef.current = finish;

    // ----- 메인 루프 -----
    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      elapsed += dt;

      // 교신 배율(부스터/상공) 주기 갱신
      multT -= dt;
      if (multT <= 0) {
        multT = 5;
        const s = saveRef.current;
        if (s) {
          const t = Date.now();
          mult =
            boosterActive(s, t) || isInContact(s.orbit, s.owner, coverageKmOf(s, t), t)
              ? 2
              : 1;
        }
      }

      // --- 업데이트 ---
      const speedMul = boostT > 0 ? 2.1 : 1;
      if (boostReqRef.current) {
        boostReqRef.current = false;
        if (boostT <= 0 && boostMeter >= 30) {
          boostMeter -= 30;
          boostT = 3;
          addText(jp.x, jp.y - 50, "부스트! 🚀", "#7ef2d8", 18);
        }
      }
      if (boostT > 0) boostT -= dt;

      if (keys.size) {
        const sp = 320 * dt;
        if (keys.has("ArrowUp")) jp.ty -= sp;
        if (keys.has("ArrowDown")) jp.ty += sp;
        if (keys.has("ArrowLeft")) jp.tx -= sp;
        if (keys.has("ArrowRight")) jp.tx += sp;
        clampTarget();
      }
      const prevY = jp.y;
      jp.x += (jp.tx - jp.x) * Math.min(1, 9 * dt);
      jp.y += (jp.ty - jp.y) * Math.min(1, 9 * dt);
      jp.y += Math.sin(elapsed * 2.2) * 8 * dt; // 무중력 부유감
      jp.vy = (jp.y - prevY) / Math.max(dt, 0.001);

      orbitPx += 26 * speedMul * dt;

      debrisT -= dt * speedMul;
      if (debrisT <= 0) {
        debrisT = rand(0.5, 1.05) * Math.max(0.55, 1 - elapsed / 300);
        spawnDebris();
      }
      friendT -= dt;
      if (friendT <= 0) {
        friendT = rand(24, 42);
        spawnFriend();
      }
      boosterT -= dt;
      if (boosterT <= 0) {
        boosterT = rand(60, 110);
        spawnBooster();
      }

      comboT -= dt;
      if (comboT <= 0) combo = 0;
      if (invulnT > 0) invulnT -= dt;
      if (shakeT > 0) shakeT -= dt * 2.2;
      if (flashT > 0) flashT -= dt * 2.5;
      if (eatPulse > 0) eatPulse -= dt * 3;

      const eatR = 26 * (boostT > 0 ? 1.4 : 1);
      ents = ents.filter((e) => {
        e.wob += dt;
        e.x += e.vx * speedMul * dt;
        e.y += e.vy * dt + Math.sin(e.wob * 1.7) * 12 * dt;
        e.rot += e.vrot * dt;
        // 부스트 중 자석 효과: 먹을 수 있는 것만 끌어당김
        if (
          boostT > 0 &&
          e.kind === "debris" &&
          e.type &&
          e.type.tier <= maxTier
        ) {
          const dx = jp.x - e.x;
          const dy = jp.y - e.y;
          const d = Math.hypot(dx, dy);
          if (d < 220 && d > 1) {
            e.x += (dx / d) * 190 * dt;
            e.y += (dy / d) * 190 * dt;
          }
        }
        if (e.x < -120) return false;
        if (e.kind === "friend" && e.met) {
          e.metT = (e.metT ?? 0) + dt;
          e.vx += 60 * dt;
          e.vy -= 20 * dt;
        }

        const d = Math.hypot(e.x - jp.x, e.y - jp.y);
        if (e.kind === "debris" && e.type) {
          const edible = e.type.tier <= maxTier;
          if (edible && d < e.r + eatR) {
            // 냠! (요구 3: 먹으면 XP·추진력·포만감)
            if (comboT > 0) combo += 1;
            else combo = 1;
            comboT = 2.2;
            session.bestCombo = Math.max(session.bestCombo, combo);
            const comboBonus = 1 + Math.min(10, combo) * 0.1;
            const gained = e.type.xp * mult * comboBonus;
            session.xp += gained;
            session.cleaned += 1;
            session.byTier[e.type.tier] += 1;
            session.satiety += 1.2;
            boostMeter = Math.min(100, boostMeter + 7);
            eatPulse = 1;
            burst(e.x, e.y, ["#7ef2d8", "#ffd95e", "#ffffff"], 10);
            addText(e.x, e.y - 14, `+${Math.round(gained)}`, "#ffd95e");
            if (combo > 0 && combo % 5 === 0) {
              addText(jp.x, jp.y - 56, `콤보 ×${combo}!`, "#ff9fb2", 19);
            }
            return false;
          }
          if (!edible && invulnT <= 0 && d < e.r + 24) {
            hp = Math.max(0, hp - 12);
            invulnT = 1.6;
            shakeT = 1;
            flashT = 1;
            combo = 0;
            burst(e.x, e.y, ["#ff8f8f", "#ffd0d0"], 8);
            addText(jp.x, jp.y - 40, "쿵! -12", "#ff8f8f", 17);
            if (hp <= 0) finish();
            return true;
          }
        } else if (e.kind === "sat") {
          if (invulnT <= 0 && d < e.r + 26) {
            hp = Math.max(0, hp - 15);
            invulnT = 1.6;
            shakeT = 1;
            flashT = 1;
            combo = 0;
            burst(jp.x, jp.y, ["#ff8f8f", "#ffe2a8"], 10);
            addText(jp.x, jp.y - 40, "위성 충돌! -15", "#ff8f8f", 17);
            if (hp <= 0) finish();
          }
        } else if (e.kind === "friend" && !e.met) {
          if (d < e.r + 34) {
            // 친구 줍스 조우(요구 7) — 깜찍한 하트 폭죽
            e.met = true;
            e.metT = 0;
            session.friends += 1;
            const gained = 25 * mult;
            session.xp += gained;
            burst((e.x + jp.x) / 2, (e.y + jp.y) / 2, ["#ff9fb2", "#ffd95e"], 14, true);
            addText(e.x, e.y - 44, `${e.name} 만남! +${gained}`, "#ff9fb2", 16);
          }
        } else if (e.kind === "booster") {
          if (d < e.r + eatR) {
            session.boosters += 1;
            burst(e.x, e.y, ["#ffd95e", "#fff7c2"], 16);
            addText(e.x, e.y - 20, "전지구 부스터 획득!", "#ffd95e", 16);
            return false;
          }
        }
        return true;
      });

      parts = parts.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.heart ? -12 : 60) * dt;
        return p.life > 0;
      });
      texts = texts.filter((t) => {
        t.life -= dt;
        t.y -= 34 * dt;
        return t.life > 0;
      });

      // --- 그리기 ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shakeT > 0) {
        ctx.translate(
          Math.sin(elapsed * 60) * 7 * shakeT,
          Math.cos(elapsed * 47) * 6 * shakeT,
        );
      }
      // 우주 배경
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#03030d");
      bg.addColorStop(0.55, "#0a1030");
      bg.addColorStop(1, "#12305c");
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, w + 40, h + 40);
      // 성운
      const neb = ctx.createRadialGradient(w * 0.8, h * 0.15, 0, w * 0.8, h * 0.15, w * 0.7);
      neb.addColorStop(0, "rgba(120,80,200,0.14)");
      neb.addColorStop(1, "rgba(120,80,200,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);
      const neb2 = ctx.createRadialGradient(w * 0.1, h * 0.4, 0, w * 0.1, h * 0.4, w * 0.6);
      neb2.addColorStop(0, "rgba(40,150,170,0.12)");
      neb2.addColorStop(1, "rgba(40,150,170,0)");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);
      // 별(패럴랙스)
      if (starsFar) {
        const off = (orbitPx * 0.25) % w;
        ctx.drawImage(starsFar, -off, 0);
        ctx.drawImage(starsFar, w - off, 0);
      }
      if (starsNear) {
        const off = (orbitPx * 0.6) % w;
        ctx.drawImage(starsNear, -off, 0);
        ctx.drawImage(starsNear, w - off, 0);
      }

      // 지구 — 실제 대륙 텍스처가 흐르며 자전/궤도 비행 느낌(요구 6)
      const R = Math.max(w, h) * 1.5;
      const ecx = w / 2;
      const ecy = horizonY + R;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ecx, ecy, R, 0, Math.PI * 2);
      ctx.clip();
      if (earthTex) {
        const dh = h - horizonY + 90;
        const sh = earthTex.height * 0.5;
        const sy = earthTex.height * 0.23;
        const scale = dh / sh;
        const dw = earthTex.width * scale;
        const off = ((orbitPx * 2.2) % dw + dw) % dw;
        for (let dx = -off; dx < w + dw; dx += dw) {
          ctx.drawImage(earthTex, 0, sy, earthTex.width, sh, dx, horizonY - 6, dw + 1, dh);
        }
        if (cloudTex) {
          const cw = cloudTex.width;
          const coff = ((orbitPx * 2.9) % cw + cw) % cw;
          ctx.globalAlpha = 0.9;
          for (let dx = -coff; dx < w + cw; dx += cw) {
            ctx.drawImage(cloudTex, dx, horizonY - 10, cw, h - horizonY + 60);
          }
          ctx.globalAlpha = 1;
        }
      } else {
        const og = ctx.createLinearGradient(0, horizonY, 0, h);
        og.addColorStop(0, "#2e6ea8");
        og.addColorStop(1, "#1c4f86");
        ctx.fillStyle = og;
        ctx.fillRect(0, horizonY - 6, w, h - horizonY + 20);
      }
      // 대기 안쪽 림
      const rim = ctx.createLinearGradient(0, horizonY - 8, 0, horizonY + 46);
      rim.addColorStop(0, "rgba(190,235,255,0.55)");
      rim.addColorStop(1, "rgba(190,235,255,0)");
      ctx.fillStyle = rim;
      ctx.fillRect(0, horizonY - 8, w, 54);
      ctx.restore();
      // 대기 글로우(바깥)
      const glow = ctx.createRadialGradient(ecx, ecy, R * 0.995, ecx, ecy, R * 1.02);
      glow.addColorStop(0, "rgba(120,210,255,0.45)");
      glow.addColorStop(1, "rgba(120,210,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ecx, ecy, R * 1.03, 0, Math.PI * 2);
      ctx.arc(ecx, ecy, R * 0.99, 0, Math.PI * 2, true);
      ctx.fill();

      // 엔티티
      for (const e of ents) {
        if (e.kind === "friend") {
          const img = friendImgs[(e.name?.length ?? 0) % friendImgs.length];
          ctx.save();
          ctx.translate(e.x, e.y + Math.sin(e.wob * 2) * 5);
          if (img.complete) ctx.drawImage(img, -30, -33, 60, 65);
          if (e.met && (e.metT ?? 0) < 1.4) {
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText("안녕! 👋", 0, -44);
          }
          ctx.restore();
          continue;
        }
        const spriteKey = e.kind === "debris" ? e.type!.id : e.kind;
        const sp = sprites.get(spriteKey);
        if (!sp) continue;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rot);
        if (e.kind === "booster") {
          const pulse = 1 + Math.sin(elapsed * 5) * 0.12;
          ctx.scale(pulse, pulse);
        }
        ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
        ctx.restore();
        // 처리 불가 표시(빨간 점선 링)
        const danger =
          e.kind === "sat" || (e.kind === "debris" && e.type!.tier > maxTier);
        if (danger) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,110,110,${0.4 + Math.sin(elapsed * 5) * 0.2})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        if (e.kind === "sat") {
          // 운용등 깜빡임
          ctx.fillStyle = `rgba(255,60,60,${(Math.sin(elapsed * 6) + 1) / 2})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y - 26, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 줍스
      ctx.save();
      ctx.translate(jp.x, jp.y);
      ctx.rotate(Math.max(-0.3, Math.min(0.3, jp.vy * 0.0012)));
      const pulse = 1 + eatPulse * 0.16;
      ctx.scale(pulse, pulse);
      if (invulnT > 0) ctx.globalAlpha = 0.45 + Math.sin(elapsed * 24) * 0.3;
      // 추진 불꽃
      const flameL = (boostT > 0 ? 30 : 14) + Math.sin(elapsed * 22) * 5;
      const fg = ctx.createLinearGradient(-30, 0, -30 - flameL, 0);
      fg.addColorStop(0, "rgba(126,242,216,0.95)");
      fg.addColorStop(1, "rgba(126,242,216,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-26, -9);
      ctx.quadraticCurveTo(-30 - flameL, 0, -26, 9);
      ctx.closePath();
      ctx.fill();
      if (joopsImg.complete) ctx.drawImage(joopsImg, -34, -37, 68, 74);
      ctx.restore();

      // 파티클/텍스트
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        if (p.heart) {
          ctx.font = `${p.size}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("💗", p.x, p.y);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      for (const t of texts) {
        ctx.globalAlpha = Math.max(0, t.life / t.max);
        ctx.font = `bold ${t.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(10,10,30,0.8)";
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      // 피격 플래시
      if (flashT > 0) {
        ctx.fillStyle = `rgba(255,60,60,${flashT * 0.18})`;
        ctx.fillRect(-20, -20, w + 40, h + 40);
      }

      // HUD 동기화(200ms)
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.2;
        setHud({
          hp,
          cleaned: session.cleaned,
          xp: Math.round(session.xp),
          combo,
          mult,
          boost: boostMeter,
        });
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      // 페이지 이탈 시에도 세션 성과는 반영
      if (!appliedRef.current && (session.cleaned > 0 || session.xp > 0)) {
        finish();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (phase === "blocked") {
    const noSave = !save || !save.onboarded;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center text-white">
        <SpaceBackdrop />
        <div className="text-5xl">{noSave ? "🐣" : "😵"}</div>
        <p className="text-sm text-white/70">
          {noSave
            ? "아직 줍스가 없어요. 먼저 줍스를 깨워주세요!"
            : "줍스가 너무 지쳐서 비행할 수 없어요. 회복 캡슐이나 휴식으로 돌봐주세요."}
        </p>
        <Link
          href="/features/4"
          className="flex min-h-11 items-center rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold"
        >
          ← 관제소로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-dvh touch-none overflow-hidden bg-[#03030d]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3">
        <button
          onClick={() => {
            finishRef.current?.();
          }}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur"
          aria-label="비행 종료"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="mx-auto max-w-[240px]">
            <div className="h-3 overflow-hidden rounded-full border border-white/20 bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-[width]"
                style={{ width: `${hud?.hp ?? 100}%` }}
              />
            </div>
            <div className="mt-1 text-center text-[10px] text-white/70">
              ❤️ {Math.round(hud?.hp ?? 100)} · 🧹 {hud?.cleaned ?? 0}개 · ⭐{" "}
              {hud?.xp ?? 0} XP
              {hud && hud.mult > 1 && (
                <span className="ml-1 rounded bg-teal-300/25 px-1 text-teal-200">
                  📡 ×2
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="w-11" />
      </div>

      {/* 콤보 */}
      {hud && hud.combo >= 2 && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 text-center">
          <span className="text-lg font-black text-pink-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            콤보 ×{hud.combo}
          </span>
        </div>
      )}

      {/* 부스트 버튼 (요구 3: 먹은 쓰레기 = 추진력) */}
      <button
        onClick={() => {
          boostReqRef.current = true;
        }}
        className="absolute bottom-5 right-4 z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-teal-300/50 bg-black/50 text-white backdrop-blur active:scale-95"
        aria-label="부스트"
      >
        <span className="text-xl">🚀</span>
        <span className="text-[9px] tabular-nums text-teal-200">
          {Math.round(hud?.boost ?? 0)}%
        </span>
      </button>

      {/* 조작 힌트 */}
      {phase === "playing" && hud && hud.cleaned === 0 && (
        <p className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 animate-pulse text-center text-xs text-white/70">
          드래그로 줍스를 조종해요 — 빨간 점선은 아직 못 먹는 위험물!
        </p>
      )}

      {/* 종료 모달 */}
      {phase === "ended" && result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b22] p-6 text-center text-white">
            <div className="text-4xl">{result.hpDelta < 0 && (hud?.hp ?? 1) <= 0 ? "😵" : "🛰️"}</div>
            <h2 className="mt-2 text-lg font-bold">
              {(hud?.hp ?? 1) <= 0 ? "줍스가 지쳤어요…" : "비행 종료!"}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold text-teal-300">{result.cleaned}개</div>
                <div className="text-[11px] text-white/50">청소한 쓰레기</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold text-amber-300">+{result.xp}</div>
                <div className="text-[11px] text-white/50">획득 XP</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold text-pink-300">×{result.bestCombo}</div>
                <div className="text-[11px] text-white/50">최고 콤보</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold text-white/80">{result.friendsMet}</div>
                <div className="text-[11px] text-white/50">만난 친구</div>
              </div>
            </div>
            {result.boostersFound > 0 && (
              <p className="mt-3 text-xs text-amber-200">
                🌟 전지구 교신 부스터 {result.boostersFound}개 획득!
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="min-h-11 flex-1 rounded-full border border-white/15 bg-white/10 text-sm font-semibold active:scale-95"
              >
                다시 비행
              </button>
              <button
                onClick={() => router.push("/features/4")}
                className="min-h-11 flex-1 rounded-full bg-teal-300 text-sm font-semibold text-[#062a24] active:scale-95"
              >
                관제소로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
