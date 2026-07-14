"use client";
// 궤도 비행 미니게임 — 드래그로 줍스를 조종해 우주쓰레기를 먹는다.
// 지구는 실제 대륙 텍스처가 스크롤되며 궤도 비행(자전) 느낌을 준다(요구 6).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFullscreen } from "../hooks/useFullscreen";
import { useGameState } from "../hooks/useGameState";
import {
  buildGrain,
  buildMoonSprite,
  buildSunSprite,
  buildVignette,
  drawAtmosphereRings,
  drawAurora,
  drawBrightStars,
  drawGrain,
  drawLensFlare,
  makeBrightStars,
  type BrightStar,
} from "../lib/cinematic";
import { DEBRIS, FRIEND_NAMES, stageForLevel } from "../lib/constants";
import {
  buildCloudTexture,
  buildEarthTexture,
  buildNightTexture,
} from "../lib/earthTexture";
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
  /** 지정 시 중심 주위를 도는 궤도 하트(친구 조우 연출) */
  orbit?: { cx: number; cy: number; ang: number; vang: number; rad: number; vrad: number };
};
type FloatText = {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
  rot: number;
};

type Hud = {
  hp: number;
  cleaned: number;
  xp: number;
  combo: number;
  mult: number;
  boost: number;
  /** 최근 4초간 이벤트가 없으면 true — HUD 자동 딤 */
  dim: boolean;
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

/** 전체화면 진입/종료 아이콘 — 네 모서리 브래킷이 안/밖으로 뒤집힌다 */
function FullscreenIcon({ active }: { active: boolean }) {
  const corners = active
    ? ["9 3 9 9 3 9", "15 3 15 9 21 9", "15 21 15 15 21 15", "9 21 9 15 3 15"]
    : ["3 9 3 3 9 3", "21 9 21 3 15 3", "21 15 21 21 15 21", "3 15 3 21 9 21"];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      {corners.map((pts) => (
        <polyline key={pts} points={pts} />
      ))}
    </svg>
  );
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
  const fs = useFullscreen(wrapRef);

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
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

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
    let flashT = 0;
    let eatPulse = 0;
    // 게임필: 히트스톱·카메라(킥/셰이크/줌)·스쿼시&스트레치·링·스피드라인
    let lastEventT = 0;
    let hitStopT = 0;
    const cam = { kx: 0, ky: 0, shake: 0, zoom: 1 };
    const squash = { sx: 1, sy: 1 };
    let rings: {
      x: number;
      y: number;
      r: number;
      vr: number;
      life: number;
      max: number;
      color: string;
    }[] = [];
    let speedLines: { x: number; y: number; len: number; life: number }[] = [];
    // 하늘 이벤트: 유성 + 위성 행렬(스타링크 오마주)
    let meteors: { x: number; y: number; vx: number; vy: number; life: number; max: number }[] = [];
    let meteorT = rand(6, 14);
    let train: { x: number; y: number; vx: number; n: number } | null = null;
    let trainT = rand(28, 50);
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

    // 시네마틱 프리렌더 에셋
    const sunSprite = buildSunSprite(460);
    const moonSprite = buildMoonSprite(76);
    const grainTex = buildGrain(224);
    let vignetteTex: HTMLCanvasElement | null = null;
    let brightStars: BrightStar[] = [];
    // 배경 그라데이션+성운+태양을 1장으로 프리컴포짓 — 프레임당 drawImage 1회
    let staticSky: HTMLCanvasElement | null = null;
    const buildStaticSky = () => {
      const c = document.createElement("canvas");
      c.width = Math.max(2, w);
      c.height = Math.max(2, h);
      const sctx = c.getContext("2d")!;
      const sx = w * 0.84;
      const sy2 = h * 0.12;
      const bg = sctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#01020a");
      bg.addColorStop(0.55, "#050d20");
      bg.addColorStop(1, "#0a1e3c");
      sctx.fillStyle = bg;
      sctx.fillRect(0, 0, w, h);
      const neb = sctx.createRadialGradient(sx, sy2, 0, sx, sy2, w * 0.75);
      neb.addColorStop(0, "rgba(255,180,110,0.10)");
      neb.addColorStop(1, "rgba(255,180,110,0)");
      sctx.fillStyle = neb;
      sctx.fillRect(0, 0, w, h);
      const neb2 = sctx.createRadialGradient(
        w * 0.06,
        h * 0.45,
        0,
        w * 0.06,
        h * 0.45,
        w * 0.6,
      );
      neb2.addColorStop(0, "rgba(40,150,170,0.11)");
      neb2.addColorStop(1, "rgba(40,150,170,0)");
      sctx.fillStyle = neb2;
      sctx.fillRect(0, 0, w, h);
      // 원경 별은 스크롤이 사실상 0이라 하늘에 함께 굽는다(풀스크린 블릿 2회 절약)
      if (starsFar) sctx.drawImage(starsFar, 0, 0);
      sctx.drawImage(
        sunSprite,
        sx - sunSprite.width / 2,
        sy2 - sunSprite.height / 2,
      );
      staticSky = c;
    };

    let earthTex: HTMLCanvasElement | null = null;
    let nightTex: HTMLCanvasElement | null = null;
    let cloudTex: HTMLCanvasElement | null = null;
    let starsFar: HTMLCanvasElement | null = null;
    let starsNear: HTMLCanvasElement | null = null;
    // 주야 블렌드용 오프스크린 밴드(밤 텍스처 + 터미네이터 마스크)
    const nightBand = document.createElement("canvas");
    const nightBandCtx = nightBand.getContext("2d")!;
    let nightFrame = 0;
    const nightCache = { off: 0, bandW: 0, bandH: 0 };
    loadWorld().then((world) => {
      earthTex = buildEarthTexture(world, 2048, 1024, "game");
      nightTex = buildNightTexture(world, 2048, 1024);
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
      nightBand.width = Math.max(2, Math.ceil(w * 0.52));
      nightBand.height = Math.max(2, Math.ceil(h - horizonY + 96));
      vignetteTex = buildVignette(w, h);
      brightStars = makeBrightStars(w, h);
      buildStars();
      buildStaticSky();
    };
    resize();
    jp.x = w * 0.3;
    jp.y = h * 0.38;
    jp.tx = jp.x;
    jp.ty = jp.y;
    window.addEventListener("resize", resize);

    // ----- 입력 -----
    let dragging = false;
    let firstTouch = true;
    const clampTarget = () => {
      jp.tx = Math.max(36, Math.min(w * 0.82, jp.tx));
      jp.ty = Math.max(64, Math.min(horizonY - 36, jp.ty));
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      jp.tx = e.offsetX;
      jp.ty = e.offsetY - 60;
      clampTarget();
      // 첫 터치 제스처에 편승해 전체화면 진입 시도(지원 브라우저만 — iOS Safari는
      // 임의 요소의 Fullscreen API를 지원하지 않아 여기선 조용히 no-op된다)
      if (firstTouch && e.pointerType === "touch") {
        firstTouch = false;
        fs.enter();
      }
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
      texts.push({
        x,
        y,
        life: 1.1,
        max: 1.1,
        text,
        color,
        size,
        rot: rand(-0.14, 0.14),
      });
    };
    const addRing = (x: number, y: number, color: string, r0 = 6, vr = 170) => {
      rings.push({ x, y, r: r0, vr, life: 0.45, max: 0.45, color });
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

    /** 피격 공통 처리 — 카메라 킥·셰이크·히트스톱·스쿼시 */
    const applyHit = (dmg: number, hx: number, hy: number, label: string) => {
      hp = Math.max(0, hp - dmg);
      invulnT = 1.6;
      flashT = 1;
      combo = 0;
      cam.shake = 1;
      const dx = jp.x - hx;
      const dy = jp.y - hy;
      const d = Math.max(1, Math.hypot(dx, dy));
      cam.kx += (dx / d) * 9;
      cam.ky += (dy / d) * 8;
      squash.sx = 0.82;
      squash.sy = 1.18;
      if (!reduceMotion) hitStopT = 0.07;
      lastEventT = elapsed;
      addText(jp.x, jp.y - 40, label, "#ff8f8f", 17);
      if (hp <= 0) finish();
    };

    // ----- 메인 루프 -----
    let frameAvgMs = 16;
    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop);
      const rawMs = nowMs - last;
      const dt = Math.min(0.05, rawMs / 1000);
      last = nowMs;
      elapsed += dt;
      // 적응형 저사양 모드 — 평균 프레임타임이 45ms를 넘으면 장식 효과 생략
      frameAvgMs = frameAvgMs * 0.95 + Math.min(120, rawMs) * 0.05;
      const lowFx = frameAvgMs > 45;

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
      // 히트스톱: 임팩트 순간 세계를 잠깐 멈춘다(렌더는 계속) — udt=0
      if (hitStopT > 0) hitStopT -= rawMs / 1000;
      const udt = hitStopT > 0 ? 0 : dt;
      const speedMul = boostT > 0 ? 2.1 : 1;
      if (boostReqRef.current) {
        boostReqRef.current = false;
        if (boostT <= 0 && boostMeter >= 30) {
          boostMeter -= 30;
          boostT = 3;
          lastEventT = elapsed;
          addText(jp.x, jp.y - 50, "부스트! 🚀", "#7ef2d8", 18);
          addRing(jp.x, jp.y, "rgba(126,242,216,0.9)", 10, 260);
        }
      }
      if (boostT > 0) boostT -= udt;

      // 카메라 스프링·감쇠와 스쿼시 복원(실시간 dt — 히트스톱과 무관)
      cam.kx *= Math.exp(-7 * dt);
      cam.ky *= Math.exp(-7 * dt);
      cam.shake *= Math.exp(-4.2 * dt);
      if (cam.shake < 0.01) cam.shake = 0;
      const zoomTarget = boostT > 0 ? 1.04 : 1;
      cam.zoom += (zoomTarget - cam.zoom) * Math.min(1, 6 * dt);
      squash.sx += (1 - squash.sx) * Math.min(1, 11 * dt);
      squash.sy += (1 - squash.sy) * Math.min(1, 11 * dt);
      // 부스트 스피드라인
      if (boostT > 0 && !reduceMotion) {
        speedLines.push({
          x: w + 10,
          y: rand(40, horizonY),
          len: rand(40, 110),
          life: rand(0.25, 0.45),
        });
      }
      speedLines = speedLines.filter((sl) => {
        sl.life -= dt;
        sl.x -= 900 * dt;
        return sl.life > 0 && sl.x + sl.len > -20;
      });
      rings = rings.filter((rg) => {
        rg.life -= dt;
        rg.r += rg.vr * dt;
        return rg.life > 0;
      });

      if (keys.size) {
        const sp = 320 * udt;
        if (keys.has("ArrowUp")) jp.ty -= sp;
        if (keys.has("ArrowDown")) jp.ty += sp;
        if (keys.has("ArrowLeft")) jp.tx -= sp;
        if (keys.has("ArrowRight")) jp.tx += sp;
        clampTarget();
      }
      const prevY = jp.y;
      jp.x += (jp.tx - jp.x) * Math.min(1, 9 * udt);
      jp.y += (jp.ty - jp.y) * Math.min(1, 9 * udt);
      jp.y += Math.sin(elapsed * 2.2) * 8 * udt; // 무중력 부유감
      jp.vy = udt > 0 ? (jp.y - prevY) / udt : 0;

      orbitPx += 26 * speedMul * udt;

      debrisT -= udt * speedMul;
      if (debrisT <= 0) {
        debrisT = rand(0.5, 1.05) * Math.max(0.55, 1 - elapsed / 300);
        spawnDebris();
      }
      friendT -= udt;
      if (friendT <= 0) {
        friendT = rand(24, 42);
        spawnFriend();
      }
      boosterT -= udt;
      if (boosterT <= 0) {
        boosterT = rand(60, 110);
        spawnBooster();
      }
      // 하늘 이벤트
      meteorT -= udt;
      if (meteorT <= 0) {
        meteorT = rand(8, 20);
        meteors.push({
          x: rand(w * 0.25, w * 1.05),
          y: rand(0, h * 0.3),
          vx: -rand(340, 540),
          vy: rand(130, 230),
          life: 0.7,
          max: 0.7,
        });
      }
      meteors = meteors.filter((m) => {
        m.life -= udt;
        m.x += m.vx * udt;
        m.y += m.vy * udt;
        return m.life > 0;
      });
      trainT -= udt;
      if (trainT <= 0 && !train) {
        train = {
          x: w + 30,
          y: rand(h * 0.08, h * 0.3),
          vx: -rand(36, 56),
          n: 4 + Math.floor(Math.random() * 3),
        };
      }
      if (train) {
        train.x += train.vx * udt;
        if (train.x < -train.n * 14 - 30) {
          train = null;
          trainT = rand(40, 70);
        }
      }

      comboT -= udt;
      if (comboT <= 0) combo = 0;
      if (invulnT > 0) invulnT -= udt;
      if (flashT > 0) flashT -= dt * 2.5;
      if (eatPulse > 0) eatPulse -= dt * 3;

      const eatR = 26 * (boostT > 0 ? 1.4 : 1);
      ents = ents.filter((e) => {
        e.wob += udt;
        e.x += e.vx * speedMul * udt;
        e.y += e.vy * udt + Math.sin(e.wob * 1.7) * 12 * udt;
        e.rot += e.vrot * udt;
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
            e.x += (dx / d) * 190 * udt;
            e.y += (dy / d) * 190 * udt;
          }
        }
        if (e.x < -120) return false;
        if (e.kind === "friend" && e.met) {
          e.metT = (e.metT ?? 0) + udt;
          e.vx += 60 * udt;
          e.vy -= 20 * udt;
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
            lastEventT = elapsed;
            // 냠 반응: 스쿼시 + 링 펄스 + 살짝 카메라 킥, 큰 쓰레기는 미세 히트스톱
            squash.sx = 1.2;
            squash.sy = 0.82;
            addRing(e.x, e.y, "rgba(126,242,216,0.8)");
            cam.kx += (e.x - jp.x) * 0.014;
            cam.ky += (e.y - jp.y) * 0.014;
            if (e.type.tier >= 3 && !reduceMotion) hitStopT = 0.035;
            burst(e.x, e.y, ["#7ef2d8", "#ffd95e", "#ffffff"], 10);
            addText(e.x, e.y - 14, `+${Math.round(gained)}`, "#ffd95e");
            if (combo > 0 && combo % 5 === 0) {
              addText(jp.x, jp.y - 56, `콤보 ×${combo}!`, "#ff9fb2", 19);
              addRing(jp.x, jp.y, "rgba(255,159,178,0.9)", 12, 240);
              if (combo >= 10) {
                burst(jp.x, jp.y - 10, ["#ffd95e", "#ffffff"], 12);
              }
            }
            return false;
          }
          if (!edible && invulnT <= 0 && d < e.r + 24) {
            burst(e.x, e.y, ["#ff8f8f", "#ffd0d0"], 8);
            applyHit(12, e.x, e.y, "쿵! -12");
            return true;
          }
        } else if (e.kind === "sat") {
          if (invulnT <= 0 && d < e.r + 26) {
            burst(jp.x, jp.y, ["#ff8f8f", "#ffe2a8"], 10);
            applyHit(15, e.x, e.y, "위성 충돌! -15");
          }
        } else if (e.kind === "friend" && !e.met) {
          if (d < e.r + 34) {
            // 친구 줍스 조우(요구 7) — 하트 폭죽 + 1초간 도는 궤도 하트
            e.met = true;
            e.metT = 0;
            session.friends += 1;
            const gained = 25 * mult;
            session.xp += gained;
            const mx = (e.x + jp.x) / 2;
            const my = (e.y + jp.y) / 2;
            burst(mx, my, ["#ff9fb2", "#ffd95e"], 8, true);
            for (let i = 0; i < 6; i++) {
              parts.push({
                x: mx,
                y: my,
                vx: 0,
                vy: 0,
                life: 1.1,
                max: 1.1,
                size: 13,
                color: "#ff9fb2",
                heart: true,
                orbit: {
                  cx: mx,
                  cy: my,
                  ang: (i / 6) * Math.PI * 2,
                  vang: 3.6,
                  rad: 12,
                  vrad: 26,
                },
              });
            }
            addRing(mx, my, "rgba(255,159,178,0.8)", 10, 200);
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
        p.life -= udt;
        if (p.orbit) {
          p.orbit.ang += p.orbit.vang * udt;
          p.orbit.rad += p.orbit.vrad * udt;
          p.x = p.orbit.cx + Math.cos(p.orbit.ang) * p.orbit.rad;
          p.y = p.orbit.cy + Math.sin(p.orbit.ang) * p.orbit.rad * 0.6;
        } else {
          p.x += p.vx * udt;
          p.y += p.vy * udt;
          p.vy += (p.heart ? -12 : 60) * udt;
        }
        return p.life > 0;
      });
      texts = texts.filter((t) => {
        t.life -= udt;
        t.y -= 34 * udt;
        return t.life > 0;
      });

      // --- 그리기 ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 카메라: 저주파 드리프트 + 임팩트 킥 + 지수감쇠 셰이크 + 부스트 줌
      if (cam.zoom > 1.001) {
        ctx.translate(w / 2, h / 2);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-w / 2, -h / 2);
      }
      if (!reduceMotion) {
        ctx.translate(
          Math.sin(elapsed * 0.35) * 3 + cam.kx + Math.sin(elapsed * 61) * 8 * cam.shake,
          Math.cos(elapsed * 0.27) * 2.5 + cam.ky + Math.cos(elapsed * 47) * 7 * cam.shake,
        );
      }
      // 태양 위치 — 우상단 고정, 터미네이터(왼쪽 밤)와 방향 일치
      const sunX = w * 0.84;
      const sunY = h * 0.12;
      // 우주 배경(그라데이션+성운+태양) — 프리컴포짓 1장
      ctx.fillStyle = "#01020a";
      ctx.fillRect(-20, -20, w + 40, h + 40);
      if (staticSky) ctx.drawImage(staticSky, 0, 0);
      // 달 — 최저속 패럴랙스
      {
        const span = w + 200;
        const mx =
          ((((w * 0.18 + 100 - orbitPx * 0.05) % span) + span) % span) - 100;
        ctx.drawImage(moonSprite, mx - 38, h * 0.1 - 38);
      }
      // 근경 별(패럴랙스) — 원경 별은 staticSky에 구워져 있다
      if (starsNear) {
        const off = (orbitPx * 0.6) % w;
        ctx.drawImage(starsNear, -off, 0);
        ctx.drawImage(starsNear, w - off, 0);
      }
      // 밝은 별 십자 글린트
      drawBrightStars(ctx, brightStars, elapsed, orbitPx, w);
      // 유성
      for (const m of meteors) {
        const a = Math.max(0, m.life / m.max);
        const tx = m.x - m.vx * 0.13;
        const ty = m.y - m.vy * 0.13;
        const mg = ctx.createLinearGradient(m.x, m.y, tx, ty);
        mg.addColorStop(0, `rgba(255,255,255,${0.85 * a})`);
        mg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = mg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      // 위성 행렬 — 원경을 일렬로 지나가는 작은 점들
      if (train) {
        ctx.fillStyle = "rgba(220,235,255,0.75)";
        for (let i = 0; i < train.n; i++) {
          ctx.beginPath();
          ctx.arc(train.x + i * 14, train.y + i * 1.2, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 지구 — 실제 대륙 텍스처가 흐르며 자전/궤도 비행 느낌(요구 6)
      const R = Math.max(w, h) * 1.5;
      const ecx = w / 2;
      const ecy = horizonY + R;
      // 지구 곡률을 따르는 수평선 y(x) — 대기·오로라가 이 곡선에 붙는다
      const yAt = (x: number) =>
        ecy - Math.sqrt(Math.max(0, R * R - (x - ecx) * (x - ecx)));
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
        // 밤 지역 — 태양 반대편(왼쪽)에서 천천히 표류하는 터미네이터.
        // 밤 텍스처를 같은 스크롤 오프셋으로 밴드에 그리고 가로 그라데이션으로
        // 마스킹해 낮 위에 얹는다 → 도시 불빛이 밤 지역에서 반짝인다.
        // 밴드 합성은 3프레임마다 갱신하고, 사이 프레임은 스크롤 오프셋만 보정해 블릿.
        if (nightTex) {
          nightFrame++;
          if (nightFrame % 3 === 1 || nightCache.bandW === 0) {
            const termX = w * (0.3 + 0.05 * Math.sin(elapsed * 0.01));
            const soft = w * 0.16;
            nightCache.bandW = Math.min(nightBand.width, Math.ceil(termX + soft));
            nightCache.bandH = Math.min(nightBand.height, Math.ceil(dh));
            nightCache.off = off;
            nightBandCtx.clearRect(0, 0, nightBand.width, nightBand.height);
            for (let dx = -off; dx < nightCache.bandW + dw; dx += dw) {
              nightBandCtx.drawImage(
                nightTex,
                0,
                sy,
                nightTex.width,
                sh,
                dx,
                0,
                dw + 1,
                dh,
              );
            }
            nightBandCtx.globalCompositeOperation = "destination-in";
            const mask = nightBandCtx.createLinearGradient(
              termX - soft,
              0,
              termX + soft,
              0,
            );
            mask.addColorStop(0, "rgba(0,0,0,0.93)");
            mask.addColorStop(1, "rgba(0,0,0,0)");
            nightBandCtx.fillStyle = mask;
            nightBandCtx.fillRect(0, 0, nightCache.bandW, nightCache.bandH);
            nightBandCtx.globalCompositeOperation = "source-over";
          }
          // 텍스처는 계속 흐르므로 캐시와의 오프셋 차이만큼 왼쪽으로 밀어 그린다
          const shift = off - nightCache.off;
          ctx.drawImage(
            nightBand,
            0,
            0,
            nightCache.bandW,
            nightCache.bandH,
            -shift,
            horizonY - 6,
            nightCache.bandW,
            nightCache.bandH,
          );
        }
      } else {
        const og = ctx.createLinearGradient(0, horizonY, 0, h);
        og.addColorStop(0, "#2e6ea8");
        og.addColorStop(1, "#1c4f86");
        ctx.fillStyle = og;
        ctx.fillRect(0, horizonY - 6, w, h - horizonY + 20);
      }
      // 수평선 안쪽으로 잦아드는 산란광(림) — 클립 안이라 곡률을 따라간다
      const rim = ctx.createLinearGradient(0, horizonY - 8, 0, horizonY + 46);
      rim.addColorStop(0, "rgba(190,235,255,0.5)");
      rim.addColorStop(1, "rgba(190,235,255,0)");
      ctx.fillStyle = rim;
      ctx.fillRect(0, horizonY - 8, w, 54);
      ctx.restore();
      // 3겹 대기(바이올렛 헤일로→블루→시안 림) — 지구 곡률을 그대로 감싼다
      drawAtmosphereRings(ctx, ecx, ecy, R, sunX, yAt(sunX));
      // 오로라 커튼 — 수평선 위에서 서서히 명멸
      if (!lowFx) drawAurora(ctx, w, yAt, elapsed);

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

      // 스피드라인(부스트)
      if (speedLines.length) {
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const sl of speedLines) {
          ctx.moveTo(sl.x, sl.y);
          ctx.lineTo(sl.x + sl.len, sl.y);
        }
        ctx.stroke();
      }

      // 줍스 — 스쿼시&스트레치로 탱글탱글하게
      ctx.save();
      ctx.translate(jp.x, jp.y);
      ctx.rotate(Math.max(-0.3, Math.min(0.3, jp.vy * 0.0012)));
      const pulse = 1 + eatPulse * 0.16;
      ctx.scale(pulse * squash.sx, pulse * squash.sy);
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

      // 링 펄스(섭취·콤보·조우)
      for (const rg of rings) {
        ctx.globalAlpha = Math.max(0, rg.life / rg.max);
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

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
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.life / t.max);
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rot);
        ctx.font = `bold ${t.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(10,10,30,0.8)";
        ctx.strokeText(t.text, 0, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // 피격·저체력 연출 — 화면 가장자리 붉은 비네트(심박 펄스)
      const lowHp = hp > 0 && hp <= 25;
      const hurtA =
        flashT * 0.3 + (lowHp ? 0.1 + 0.08 * Math.sin(elapsed * 4.2) : 0);
      if (hurtA > 0.015) {
        const hg = ctx.createRadialGradient(
          w / 2,
          h / 2,
          Math.min(w, h) * 0.35,
          w / 2,
          h / 2,
          Math.max(w, h) * 0.72,
        );
        hg.addColorStop(0, "rgba(255,60,60,0)");
        hg.addColorStop(1, `rgba(255,60,60,${Math.min(0.45, hurtA)})`);
        ctx.fillStyle = hg;
        ctx.fillRect(-30, -30, w + 60, h + 60);
      }

      // 시네마 후처리: 렌즈 플레어 → 비네트 → 필름 그레인
      drawLensFlare(ctx, sunX, sunY, w, h, elapsed);
      if (vignetteTex) ctx.drawImage(vignetteTex, 0, 0);
      if (!lowFx) drawGrain(ctx, grainTex, w, h, elapsed, !reduceMotion);

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
          dim: elapsed - lastEventT > 4,
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

      {/* HUD — 프로스트 글래스, 4초 무이벤트 시 자동 딤. 노치·다이내믹 아일랜드를 피하도록
          safe-area-inset을 반영(가로 모드에서도 좌우가 잘리지 않는다) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <button
          onClick={() => {
            finishRef.current?.();
          }}
          className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-lg text-white backdrop-blur-md transition active:scale-95"
          aria-label="비행 종료"
        >
          ←
        </button>
        <div
          className={`flex-1 transition-opacity duration-700 ${
            hud?.dim ? "opacity-55" : "opacity-100"
          }`}
        >
          <div className="mx-auto max-w-[262px] rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]" aria-hidden>
                ❤️
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-[width]"
                  style={{ width: `${hud?.hp ?? 100}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-white/80">
                {Math.round(hud?.hp ?? 100)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-white/75">
              <span>🧹 {hud?.cleaned ?? 0}개</span>
              <span className="text-white/25">·</span>
              <span>⭐ {hud?.xp ?? 0} XP</span>
              {hud && hud.mult > 1 && (
                <span className="rounded-full border border-teal-300/40 bg-teal-300/15 px-1.5 font-semibold text-teal-200">
                  📡 ×2
                </span>
              )}
            </div>
          </div>
        </div>
        {fs.supported ? (
          <button
            onClick={fs.toggle}
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white backdrop-blur-md transition active:scale-95"
            aria-label={fs.active ? "전체화면 종료" : "전체화면"}
          >
            <FullscreenIcon active={fs.active} />
          </button>
        ) : (
          <div className="w-11 shrink-0" />
        )}
      </div>

      {/* 콤보 — 갱신될 때마다 팝 */}
      {hud && hud.combo >= 2 && (
        <div
          key={hud.combo}
          className="pointer-events-none absolute left-1/2 top-16 z-10 animate-[comboPop4_0.35s_ease-out_both]"
        >
          <span className="text-xl font-black text-pink-300 [text-shadow:0_0_16px_rgba(255,159,178,0.6),0_1px_4px_rgba(0,0,0,0.85)]">
            콤보 ×{hud.combo}
          </span>
        </div>
      )}
      <style>{`@keyframes comboPop4{0%{transform:translateX(-50%) scale(1.7);opacity:0.15}100%{transform:translateX(-50%) scale(1);opacity:1}}`}</style>

      {/* 부스트 버튼 — 코닉 링 게이지 (요구 3: 먹은 쓰레기 = 추진력) */}
      <button
        onClick={() => {
          boostReqRef.current = true;
        }}
        className="absolute z-10 h-[68px] w-[68px] rounded-full p-[3px] transition active:scale-95"
        style={{
          background: `conic-gradient(#7ef2d8 ${(hud?.boost ?? 0) * 3.6}deg, rgba(255,255,255,0.10) 0deg)`,
          bottom: "max(1.25rem, env(safe-area-inset-bottom))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
        aria-label="부스트"
      >
        <span
          className={`flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0a1020]/85 text-white backdrop-blur-md ${
            (hud?.boost ?? 0) >= 30
              ? "shadow-[0_0_18px_rgba(126,242,216,0.45)]"
              : ""
          }`}
        >
          <span className="text-xl">🚀</span>
          <span className="text-[9px] tabular-nums text-teal-200">
            {Math.round(hud?.boost ?? 0)}%
          </span>
        </span>
      </button>

      {/* 조작 힌트 — 부스트 버튼과 겹치지 않게 위로 */}
      {phase === "playing" && hud && hud.cleaned === 0 && (
        <p className="pointer-events-none absolute bottom-28 left-1/2 z-10 w-max max-w-[86vw] -translate-x-1/2 animate-pulse rounded-full border border-white/10 bg-black/45 px-4 py-2 text-center text-[11px] text-white/85 backdrop-blur-md">
          드래그로 줍스를 조종해요 — 빨간 점선은 아직 못 먹는 위험물!
        </p>
      )}

      {/* 종료 모달 */}
      {phase === "ended" && result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b22]/90 p-6 text-center text-white backdrop-blur-xl">
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
