"use client";

import { useEffect, useRef } from "react";
import { DEBRIS_TYPES } from "./constants";
import { fmtMass } from "./format";
import type { DebrisType } from "./types";

type Star = { x: number; y: number; r: number; layer: number; phase: number };
type Debris = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  type: DebrisType;
  seed: number;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
};
type Floater = { x: number; y: number; text: string; life: number; max: number };
type ShootingStar = { x: number; y: number; vx: number; vy: number; life: number };

type Props = {
  hue: number;
  stage: number;
  onEat: (massKg: number, label: string) => void;
  onInteract?: () => void;
};

function pickDebrisType(): DebrisType {
  const total = DEBRIS_TYPES.reduce((s, t) => s + t.weight, 0);
  let roll = Math.random() * total;
  for (const t of DEBRIS_TYPES) {
    roll -= t.weight;
    if (roll <= 0) return t;
  }
  return DEBRIS_TYPES[0];
}

export default function GameCanvas({ hue, stage, onEat, onInteract }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ hue, stage, onEat, onInteract });
  propsRef.current = { hue, stage, onEat, onInteract };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrapper = canvas.parentElement;
    if (!wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let bg: HTMLCanvasElement | null = null;

    const stars: Star[] = [];
    const debris: Debris[] = [];
    const particles: Particle[] = [];
    const floaters: Floater[] = [];
    let shooting: ShootingStar | null = null;
    let shootTimer = 8;

    const pet = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ang: 0,
      blinkAt: 2.5,
      blinking: 0,
      eatPulse: 0,
      trail: [] as { x: number; y: number }[],
    };
    let userTarget: { x: number; y: number; life: number } | null = null;
    let marker: { x: number; y: number; age: number } | null = null;
    let spawnCooldown = 0;
    let interacted = false;

    const targetPopulation = () =>
      Math.min(12, Math.max(5, Math.floor((w * h) / 40000)));

    function spawnDebris(atEdge: boolean) {
      const type = pickDebrisType();
      let x = Math.random() * w;
      let y = Math.random() * h;
      if (atEdge) {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) x = -30;
        else if (edge === 1) x = w + 30;
        else if (edge === 2) y = -30;
        else y = h + 30;
      } else {
        // 초기 배치 — 펫 바로 위에는 놓지 않는다
        if (Math.hypot(x - pet.x, y - pet.y) < 90) {
          x = (x + w / 2) % w;
        }
      }
      debris.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 26 + (x < 0 ? 14 : x > w ? -14 : 0),
        vy: (Math.random() - 0.5) * 26 + (y < 0 ? 14 : y > h ? -14 : 0),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 1.2,
        type,
        seed: Math.random(),
      });
    }

    function paintBackground() {
      bg = document.createElement("canvas");
      bg.width = Math.max(1, Math.floor(w * dpr));
      bg.height = Math.max(1, Math.floor(h * dpr));
      const b = bg.getContext("2d");
      if (!b) return;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sky = b.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#03040c");
      sky.addColorStop(0.55, "#070a1c");
      sky.addColorStop(1, "#0b1030");
      b.fillStyle = sky;
      b.fillRect(0, 0, w, h);

      // 성운
      const blobs = [
        { x: w * 0.22, y: h * 0.25, r: Math.max(w, h) * 0.4, c: "99, 70, 255" },
        { x: w * 0.85, y: h * 0.15, r: Math.max(w, h) * 0.32, c: "56, 160, 255" },
        { x: w * 0.6, y: h * 0.6, r: Math.max(w, h) * 0.36, c: "255, 110, 199" },
      ];
      for (const blob of blobs) {
        const g = b.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
        g.addColorStop(0, `rgba(${blob.c}, 0.10)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        b.fillStyle = g;
        b.fillRect(0, 0, w, h);
      }

      // 지구 — 화면 아래쪽 가장자리의 푸른 호
      const R = Math.max(w, h) * 0.9;
      const cx = w * 0.5;
      const cy = h + R * 0.86;
      const earth = b.createRadialGradient(cx, cy - R * 0.6, R * 0.2, cx, cy, R);
      earth.addColorStop(0, "#2f6db8");
      earth.addColorStop(0.75, "#144a86");
      earth.addColorStop(1, "#0a2450");
      b.fillStyle = earth;
      b.beginPath();
      b.arc(cx, cy, R, 0, Math.PI * 2);
      b.fill();

      // 대기 광층
      b.save();
      b.strokeStyle = "rgba(120, 200, 255, 0.5)";
      b.lineWidth = 2.5;
      b.shadowColor = "rgba(120, 200, 255, 0.9)";
      b.shadowBlur = 18;
      b.beginPath();
      b.arc(cx, cy, R + 2, 0, Math.PI * 2);
      b.stroke();
      b.restore();

      // 구름 띠
      b.fillStyle = "rgba(255,255,255,0.10)";
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 1.28 + i * 0.075;
        const px = cx + Math.cos(a) * R * 0.94;
        const py = cy + Math.sin(a) * R * 0.94;
        b.beginPath();
        b.ellipse(px, py, 26 + (i % 3) * 14, 7, a + Math.PI / 2, 0, Math.PI * 2);
        b.fill();
      }
    }

    function seedStars() {
      stars.length = 0;
      const count = Math.min(160, Math.max(60, Math.floor((w * h) / 9000)));
      for (let i = 0; i < count; i++) {
        const layer = i % 3;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: [0.7, 1.1, 1.7][layer],
          layer,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function resize() {
      const rect = wrapper!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (pet.x === 0 && pet.y === 0) {
        pet.x = w / 2;
        pet.y = h * 0.42;
      }
      pet.x = Math.min(pet.x, w);
      pet.y = Math.min(pet.y, h);
      paintBackground();
      seedStars();
      while (debris.length < targetPopulation()) spawnDebris(false);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    function onPointer(ev: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      userTarget = { x, y, life: 6 };
      marker = { x, y, age: 0 };
      if (!interacted) {
        interacted = true;
        propsRef.current.onInteract?.();
      }
    }
    function onPointerDown(ev: PointerEvent) {
      canvas!.setPointerCapture(ev.pointerId);
      onPointer(ev);
    }
    function onPointerMove(ev: PointerEvent) {
      if (ev.buttons > 0) onPointer(ev);
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);

    function drawDebris(d: Debris, t: number) {
      const c = ctx!;
      c.save();
      c.translate(d.x, d.y + Math.sin(t * 0.8 + d.seed * 9) * 2.5);
      c.rotate(d.rot);
      const r = d.type.radius;
      c.strokeStyle = "rgba(200, 210, 230, 0.9)";
      c.fillStyle = "rgba(148, 160, 184, 0.95)";
      c.lineWidth = 1;

      switch (d.type.id) {
        case "paint": {
          c.fillStyle = `hsl(${Math.floor(d.seed * 360)}, 45%, 70%)`;
          c.beginPath();
          c.moveTo(-r, 0);
          c.lineTo(0, -r * 0.8);
          c.lineTo(r, -r * 0.1);
          c.lineTo(r * 0.3, r * 0.8);
          c.closePath();
          c.fill();
          break;
        }
        case "bolt": {
          c.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const px = Math.cos(a) * r * 0.7;
            const py = Math.sin(a) * r * 0.7;
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.closePath();
          c.fill();
          c.fillRect(-r * 0.22, 0, r * 0.44, r * 1.3);
          break;
        }
        case "shard": {
          c.fillStyle = "#1c3f74";
          c.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
          c.strokeStyle = "rgba(140, 190, 255, 0.75)";
          for (let i = 1; i < 4; i++) {
            const gx = -r + (i * r) / 2;
            c.beginPath();
            c.moveTo(gx, -r * 0.6);
            c.lineTo(gx, r * 0.6);
            c.stroke();
          }
          c.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);
          break;
        }
        case "fairing": {
          c.beginPath();
          c.arc(0, 0, r, Math.PI * 0.15, Math.PI * 0.95);
          c.arc(0, 0, r * 0.55, Math.PI * 0.95, Math.PI * 0.15, true);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case "antenna": {
          c.beginPath();
          c.moveTo(-r, r * 0.7);
          c.lineTo(r * 0.3, -r * 0.6);
          c.lineWidth = 2;
          c.stroke();
          c.beginPath();
          c.ellipse(r * 0.35, -r * 0.65, r * 0.55, r * 0.3, -0.6, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          break;
        }
        case "satcore": {
          c.fillStyle = "#3a4260";
          c.fillRect(-r * 0.5, -r * 0.5, r, r);
          c.strokeRect(-r * 0.5, -r * 0.5, r, r);
          c.fillStyle = "#1c3f74";
          c.fillRect(-r * 1.4, -r * 0.28, r * 0.8, r * 0.56);
          c.fillRect(r * 0.6, -r * 0.28, r * 0.8, r * 0.56);
          c.fillStyle = "rgba(255, 200, 90, 0.9)";
          c.beginPath();
          c.arc(0, 0, r * 0.16, 0, Math.PI * 2);
          c.fill();
          break;
        }
      }
      c.restore();
    }

    function drawPet(t: number) {
      const c = ctx!;
      const st = propsRef.current.stage;
      const petHue = propsRef.current.hue;
      const speed = Math.hypot(pet.vx, pet.vy);
      const petR = st === 0 ? 13 : 15 + st * 1.6;

      // 잔광 트레일
      const trailMax = st >= 5 ? 26 : 16;
      pet.trail.push({ x: pet.x, y: pet.y });
      if (pet.trail.length > trailMax) pet.trail.shift();
      for (let i = 0; i < pet.trail.length; i++) {
        const p = pet.trail[i];
        const f = i / pet.trail.length;
        const trailHue = st >= 5 ? (petHue + (1 - f) * 90) % 360 : petHue;
        c.fillStyle = `hsla(${trailHue}, 85%, 75%, ${f * 0.16})`;
        c.beginPath();
        c.arc(p.x, p.y, petR * 0.55 * f, 0, Math.PI * 2);
        c.fill();
      }

      const glow = `hsl(${petHue}, 90%, 80%)`;
      const deep = `hsl(${(petHue + 30) % 360}, 65%, 52%)`;

      c.save();
      c.translate(pet.x, pet.y);

      if (st === 0) {
        // 알 — 데굴데굴 구르며 흡수한다
        c.rotate(Math.sin(t * 2.2) * 0.14 + pet.vx * 0.004);
        const eg = c.createRadialGradient(-4, -6, 2, 0, 0, 20);
        eg.addColorStop(0, "#ffffff");
        eg.addColorStop(1, `hsl(${petHue}, 70%, 68%)`);
        c.fillStyle = eg;
        c.beginPath();
        c.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `hsla(${(petHue + 30) % 360}, 60%, 45%, 0.5)`;
        for (const [sx, sy, sr] of [[-4, -5, 1.6], [5, 3, 2], [1, 9, 1.3], [-6, 5, 1.2]]) {
          c.beginPath();
          c.arc(sx, sy, sr, 0, Math.PI * 2);
          c.fill();
        }
        // 아기 눈
        c.fillStyle = "#1b1e3a";
        c.beginPath();
        c.arc(-4, -1, 1.5, 0, Math.PI * 2);
        c.arc(4, -1, 1.5, 0, Math.PI * 2);
        c.fill();
        c.restore();
        return;
      }

      const stretch = Math.min(0.22, speed / 700);
      const ang = Math.atan2(pet.vy, pet.vx);

      // 오로라 고리 (5단계 이상)
      if (st >= 5) {
        c.save();
        c.rotate(Math.sin(t * 0.6) * 0.2);
        c.strokeStyle = `hsla(${(petHue + 60) % 360}, 90%, 78%, 0.5)`;
        c.lineWidth = 2.5;
        c.beginPath();
        c.ellipse(0, 2, petR + 11, petR * 0.42, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }

      // 지느러미 (2단계 이상)
      if (st >= 2) {
        const flap = Math.sin(t * 5) * 0.35;
        c.fillStyle = deep;
        for (const side of [-1, 1]) {
          c.save();
          c.rotate(side * (0.5 + flap));
          c.beginPath();
          c.ellipse(side * (petR + 3), 2, petR * 0.42, petR * 0.24, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      }

      // 몸통
      c.save();
      c.rotate(ang * 0.12);
      const grad = c.createRadialGradient(-petR * 0.3, -petR * 0.4, petR * 0.15, 0, 0, petR * 1.25);
      grad.addColorStop(0, glow);
      grad.addColorStop(1, deep);
      c.fillStyle = grad;
      c.beginPath();
      c.ellipse(0, 0, petR * (1 + stretch), petR * (1 - stretch * 0.55), 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.32)";
      c.beginPath();
      c.ellipse(0, petR * 0.38, petR * 0.62, petR * 0.36, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // 더듬이 + 별
      c.strokeStyle = `hsl(${petHue}, 70%, 65%)`;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(0, -petR * 0.85);
      c.quadraticCurveTo(2, -petR - 9, petR * 0.45, -petR - 11);
      c.stroke();
      const starR = 2.6 + Math.sin(t * 3) * 0.9;
      c.save();
      c.shadowColor = glow;
      c.shadowBlur = 10;
      c.fillStyle = glow;
      c.beginPath();
      c.arc(petR * 0.5, -petR - 12, starR, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // 왕관 광채 (최종 진화)
      if (st >= 7) {
        for (let i = 0; i < 3; i++) {
          const a = t * 1.2 + (i * Math.PI * 2) / 3;
          c.fillStyle = `hsla(${(petHue + i * 40) % 360}, 95%, 82%, 0.85)`;
          c.beginPath();
          c.arc(Math.cos(a) * (petR + 12), Math.sin(a) * (petR + 12) * 0.5 - 4, 1.8, 0, Math.PI * 2);
          c.fill();
        }
      }

      // 눈 — 이동 방향을 바라보고, 가끔 깜빡인다
      const lookX = Math.cos(ang) * Math.min(2.5, speed * 0.02);
      const lookY = Math.sin(ang) * Math.min(2, speed * 0.015);
      const eyeY = -petR * 0.12;
      const eyeGap = petR * 0.42;
      if (pet.blinking > 0) {
        c.strokeStyle = "#1b1e3a";
        c.lineWidth = 2;
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(side * eyeGap - 3.5, eyeY);
          c.lineTo(side * eyeGap + 3.5, eyeY);
          c.stroke();
        }
      } else {
        for (const side of [-1, 1]) {
          c.fillStyle = "#fff";
          c.beginPath();
          c.arc(side * eyeGap, eyeY, petR * 0.26, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "#1b1e3a";
          c.beginPath();
          c.arc(side * eyeGap + lookX, eyeY + lookY, petR * 0.14, 0, Math.PI * 2);
          c.fill();
        }
      }

      // 볼터치
      c.fillStyle = "rgba(255, 157, 177, 0.75)";
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(side * petR * 0.68, petR * 0.28, petR * 0.15, 0, Math.PI * 2);
        c.fill();
      }

      // 입 — 파편이 가까우면 아앙 벌린다
      const nearest = debris.reduce(
        (best, d) => Math.min(best, Math.hypot(d.x - pet.x, d.y - pet.y)),
        Infinity
      );
      c.fillStyle = "#1b1e3a";
      if (pet.eatPulse > 0 || nearest < 90) {
        const open = 2.6 + (pet.eatPulse > 0 ? pet.eatPulse * 5 : 1.5);
        c.beginPath();
        c.ellipse(0, petR * 0.34, open * 0.8, open, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.strokeStyle = "#1b1e3a";
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, petR * 0.22, petR * 0.2, Math.PI * 0.15, Math.PI * 0.85);
        c.stroke();
      }

      c.restore();
    }

    let raf = 0;
    let lastT = performance.now();

    function frame(nowMs: number) {
      raf = requestAnimationFrame(frame);
      const t = nowMs / 1000;
      const dt = Math.min(0.05, (nowMs - lastT) / 1000);
      lastT = nowMs;
      const c = ctx!;

      // --- 업데이트 ---
      spawnCooldown -= dt;
      if (debris.length < targetPopulation() && spawnCooldown <= 0) {
        spawnDebris(true);
        spawnCooldown = 0.7;
      }

      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        if (d.x < -60 || d.x > w + 60 || d.y < -60 || d.y > h + 60) {
          debris.splice(i, 1);
        }
      }

      // 펫 조향 — 탭 지점 우선, 없으면 가장 가까운 파편으로
      let tx = pet.x + Math.cos(t * 0.4) * 60;
      let ty = pet.y + Math.sin(t * 0.31) * 40;
      let cruise = 40;
      if (userTarget) {
        userTarget.life -= dt;
        const dToTarget = Math.hypot(userTarget.x - pet.x, userTarget.y - pet.y);
        if (userTarget.life <= 0 || dToTarget < 16) {
          userTarget = null;
        } else {
          tx = userTarget.x;
          ty = userTarget.y;
          cruise = 175;
        }
      }
      if (!userTarget && debris.length > 0) {
        let best: Debris | null = null;
        let bestD = Infinity;
        for (const d of debris) {
          const dist = Math.hypot(d.x - pet.x, d.y - pet.y);
          if (dist < bestD) {
            bestD = dist;
            best = d;
          }
        }
        if (best) {
          tx = best.x;
          ty = best.y;
          cruise = 52 + propsRef.current.stage * 6;
        }
      }
      const dirX = tx - pet.x;
      const dirY = ty - pet.y;
      const dist = Math.hypot(dirX, dirY) || 1;
      const desiredX = (dirX / dist) * cruise;
      const desiredY = (dirY / dist) * cruise;
      const steer = Math.min(1, dt * 2.4);
      pet.vx += (desiredX - pet.vx) * steer;
      pet.vy += (desiredY - pet.vy) * steer;
      pet.x += pet.vx * dt;
      pet.y += pet.vy * dt;
      pet.x = Math.max(10, Math.min(w - 10, pet.x));
      pet.y = Math.max(10, Math.min(h - 10, pet.y));
      pet.eatPulse = Math.max(0, pet.eatPulse - dt * 2.5);

      pet.blinkAt -= dt;
      if (pet.blinking > 0) pet.blinking -= dt;
      if (pet.blinkAt <= 0) {
        pet.blinking = 0.13;
        pet.blinkAt = 2 + Math.random() * 3.5;
      }

      // 먹기 판정
      const st = propsRef.current.stage;
      const petR = st === 0 ? 13 : 15 + st * 1.6;
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        if (Math.hypot(d.x - pet.x, d.y - pet.y) < petR + d.type.radius + 5) {
          debris.splice(i, 1);
          pet.eatPulse = 1;
          propsRef.current.onEat(d.type.massKg, d.type.label);
          floaters.push({
            x: d.x,
            y: d.y - 14,
            text: `+${fmtMass(d.type.massKg)}`,
            life: 1.4,
            max: 1.4,
          });
          if (d.type.radius >= 11) {
            floaters.push({
              x: d.x,
              y: d.y + 4,
              text: d.type.label,
              life: 1.4,
              max: 1.4,
            });
          }
          for (let k = 0; k < 9; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 25 + Math.random() * 70;
            particles.push({
              x: d.x,
              y: d.y,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              life: 0.7,
              max: 0.7,
              color:
                k % 3 === 0
                  ? "rgba(255,255,255,0.9)"
                  : `hsla(${propsRef.current.hue}, 90%, 75%, 0.9)`,
            });
          }
          spawnCooldown = 0.5;
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        f.y -= 22 * dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }
      if (marker) {
        marker.age += dt;
        if (marker.age > 0.9) marker = null;
      }

      shootTimer -= dt;
      if (shootTimer <= 0 && !shooting) {
        shooting = {
          x: Math.random() * w * 0.7,
          y: Math.random() * h * 0.3,
          vx: 380 + Math.random() * 200,
          vy: 130 + Math.random() * 80,
          life: 0.9,
        };
        shootTimer = 14 + Math.random() * 16;
      }
      if (shooting) {
        shooting.x += shooting.vx * dt;
        shooting.y += shooting.vy * dt;
        shooting.life -= dt;
        if (shooting.life <= 0) shooting = null;
      }

      // --- 그리기 ---
      if (bg) c.drawImage(bg, 0, 0, w, h);
      else c.clearRect(0, 0, w, h);

      for (const s of stars) {
        s.x -= (2 + s.layer * 2.5) * dt;
        if (s.x < -2) s.x = w + 2;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + s.layer * 0.35) + s.phase));
        c.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.5})`;
        c.beginPath();
        c.arc(s.x, s.y, s.r * tw + 0.3, 0, Math.PI * 2);
        c.fill();
      }

      if (shooting) {
        const f = shooting.life / 0.9;
        const g = c.createLinearGradient(
          shooting.x,
          shooting.y,
          shooting.x - shooting.vx * 0.25,
          shooting.y - shooting.vy * 0.25
        );
        g.addColorStop(0, `rgba(255,255,255,${0.85 * f})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = g;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(shooting.x, shooting.y);
        c.lineTo(shooting.x - shooting.vx * 0.25, shooting.y - shooting.vy * 0.25);
        c.stroke();
      }

      if (marker) {
        const f = 1 - marker.age / 0.9;
        c.strokeStyle = `hsla(${propsRef.current.hue}, 90%, 80%, ${f * 0.8})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(marker.x, marker.y, 8 + marker.age * 30, 0, Math.PI * 2);
        c.stroke();
      }

      for (const d of debris) drawDebris(d, t);

      for (const p of particles) {
        c.globalAlpha = Math.max(0, p.life / p.max);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, 2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      drawPet(t);

      c.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      c.textAlign = "center";
      for (const f of floaters) {
        c.globalAlpha = Math.max(0, f.life / f.max);
        c.fillStyle = "#e8f0ff";
        c.fillText(f.text, f.x, f.y);
      }
      c.globalAlpha = 1;
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      aria-label="스텔라펫 유영 공간 — 탭한 곳으로 펫이 이동합니다"
    />
  );
}
