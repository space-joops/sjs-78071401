// 게임 루프 — 씬·줍스·쓰레기를 묶고 충돌·점수·레벨·게임오버를 처리한다.
// React는 HUD만 그리고, 상태는 250ms 스로틀로 올려 매 프레임 리렌더를 막는다.

import * as THREE from "three";
import { createDebrisField, type DebrisField } from "./debris";
import { createPlayer, type Player } from "./player";
import { createSpaceScene, type SpaceScene } from "./scene";
import {
  RUN,
  SCENE,
  comboMultFor,
  levelForXp,
  stageForLevel,
  xpForLevel,
} from "./constants";
import type { RunResult } from "./store";

export type GamePhase = "ready" | "playing" | "over";

export type Hud = {
  phase: GamePhase;
  score: number;
  level: number;
  stageName: string;
  maxTier: number;
  lives: number;
  combo: number;
  comboMult: number;
  xpInLevel: number;
  xpNeeded: number;
  speed: number;
  debris: number;
};

export type Popup = { id: number; text: string; color: string };

export type Game = {
  start: () => void;
  /** 드래그 입력 — 정규화 좌표(-1~1) */
  aim: (nx: number, ny: number) => void;
  resize: () => void;
  dispose: () => void;
};

export function createGame(
  container: HTMLDivElement,
  onHud: (h: Hud) => void,
  onPopup: (p: Popup) => void,
  onGameOver: (r: RunResult) => void,
): Game {
  const isCoarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isCoarse,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const space: SpaceScene = createSpaceScene();
  const player: Player = createPlayer();
  const debris: DebrisField = createDebrisField();
  space.scene.add(player.group);
  space.scene.add(debris.group);

  // ---- 런 상태 ----
  const run = {
    phase: "ready" as GamePhase,
    score: 0,
    xp: 0,
    lives: RUN.lives,
    combo: 0,
    comboUntil: 0,
    bestCombo: 0,
    debrisEaten: 0,
    invulnUntil: 0,
    nextSpawnAt: 0,
    shake: 0,
  };
  let popupSeq = 0;

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    space.resize(w, h);
  };
  resize();

  const level = () => levelForXp(run.xp);
  const speed = () =>
    Math.min(RUN.maxSpeed, RUN.baseSpeed + (level() - 1) * RUN.speedPerLevel);

  const pushHud = () => {
    const lv = level();
    const st = stageForLevel(lv);
    onHud({
      phase: run.phase,
      score: Math.floor(run.score),
      level: lv,
      stageName: st.name,
      maxTier: st.maxTier,
      lives: run.lives,
      combo: run.combo,
      comboMult: comboMultFor(run.combo),
      xpInLevel: run.xp - xpForLevel(lv),
      xpNeeded: xpForLevel(lv + 1) - xpForLevel(lv),
      speed: Math.round(speed()),
      debris: run.debrisEaten,
    });
  };

  const popup = (text: string, color: string) => {
    onPopup({ id: ++popupSeq, text, color });
  };

  // ---- 루프 ----
  let raf = 0;
  let last = performance.now();
  let hudAt = 0;
  const clock = { t: 0 };

  const loop = (now: number) => {
    const dtMs = Math.min(50, now - last);
    last = now;
    const dt = dtMs / 1000;
    clock.t += dt;

    const lv = level();
    const stage = stageForLevel(lv);
    const spd = run.phase === "playing" ? speed() : RUN.baseSpeed * 0.35;

    // 지구는 항상 돈다 (대기 화면에서도) — 속도에 비례해 함께 빨라진다
    space.update(dt, run.phase === "playing" ? spd / RUN.baseSpeed : 0.5);
    player.setStage(lv);
    player.update(dt, space.bounds, clock.t);

    if (run.phase === "playing") {
      // 스폰
      if (now >= run.nextSpawnAt) {
        debris.spawn(space.bounds, stage.maxTier);
        const rush = 1 - Math.min(0.45, (lv - 1) * 0.05);
        run.nextSpawnAt =
          now +
          (RUN.spawnMinMs + Math.random() * (RUN.spawnMaxMs - RUN.spawnMinMs)) * rush;
      }

      // 콤보 만료
      if (run.combo > 0 && now > run.comboUntil) {
        run.combo = 0;
      }

      debris.update(dt, spd, stage.maxTier, clock.t);
      checkCollisions(now, stage.maxTier);

      // 생존 점수
      run.score += dt * 6 * lv;
    } else {
      debris.update(dt, spd, stage.maxTier, clock.t);
    }

    // 피격 흔들림
    run.shake *= Math.exp(-dt * 5);
    if (run.shake > 0.01) {
      space.camera.position.x = SCENE.camPos[0] + (Math.random() - 0.5) * run.shake;
      space.camera.position.y = SCENE.camPos[1] + (Math.random() - 0.5) * run.shake;
    } else {
      space.camera.position.x = SCENE.camPos[0];
      space.camera.position.y = SCENE.camPos[1];
    }

    renderer.render(space.scene, space.camera);

    if (now - hudAt > 200) {
      hudAt = now;
      pushHud();
    }
    raf = requestAnimationFrame(loop);
  };

  function checkCollisions(now: number, maxTier: number) {
    const p = player.group.position;
    const pr = player.radius;

    for (const it of debris.items) {
      if (!it.alive) continue;
      const m = it.mesh.position;

      // 스윕 판정 — 이번 프레임에 쓸고 지나간 z 구간 [prevZ, z] 안에서
      // 줍스 평면에 가장 가까운 지점을 잡는다. 고정 폭 윈도로 판정하면
      // 저프레임(30fps)·고속(120u/s)에서 프레임당 4유닛을 건너뛰어
      // 작은 쓰레기가 줍스를 그대로 통과해버린다(터널링).
      // 쓰레기는 z로만 움직이고 x/y는 불변이라 이 판정이 정확하다.
      const zc = Math.min(Math.max(p.z, it.prevZ), m.z);
      const dz = zc - p.z;

      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const hitR = pr + it.def.radius;
      if (dx * dx + dy * dy + dz * dz > hitR * hitR) continue;

      if (it.tier <= maxTier) {
        // 흡수
        run.combo += 1;
        run.comboUntil = now + RUN.comboWindowMs;
        run.bestCombo = Math.max(run.bestCombo, run.combo);
        const mult = comboMultFor(run.combo);
        const gained = it.def.xp * mult;
        run.xp += it.def.xp;
        run.score += gained;
        run.debrisEaten += 1;

        const prevLv = levelForXp(run.xp - it.def.xp);
        if (levelForXp(run.xp) > prevLv) {
          const st = stageForLevel(levelForXp(run.xp));
          popup(`진화! ${st.name} — ${st.maxTier}등급까지 흡수`, "#ffd97a");
          player.flash(st.color);
        } else if (mult > 1 && run.combo % 4 === 0) {
          popup(`${run.combo} COMBO ×${mult}`, "#8ff0df");
        }
      } else if (now > run.invulnUntil) {
        // 충돌 — 처리 불가 등급
        run.lives -= 1;
        run.invulnUntil = now + RUN.invulnMs;
        run.combo = 0;
        run.shake = 0.9;
        player.flash(0xff5a5a);
        popup(`${it.def.name} 충돌! -1`, "#ff8080");

        if (run.lives <= 0) {
          run.phase = "over";
          onGameOver({
            score: Math.floor(run.score),
            level: levelForXp(run.xp),
            bestCombo: run.bestCombo,
            debris: run.debrisEaten,
          });
          pushHud();
        }
      } else {
        continue; // 무적 중엔 통과
      }

      it.alive = false;
      it.mesh.visible = false;
      it.ring.visible = false;
    }
  }

  // 백그라운드에서는 멈춘다
  const onVis = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(loop);
  pushHud();

  return {
    start() {
      run.phase = "playing";
      run.score = 0;
      run.xp = 0;
      run.lives = RUN.lives;
      run.combo = 0;
      run.bestCombo = 0;
      run.debrisEaten = 0;
      run.invulnUntil = 0;
      run.nextSpawnAt = performance.now() + 400;
      run.shake = 0;
      debris.clear();
      player.group.position.set(0, 0, SCENE.playZ);
      player.target.set(0, 0);
      player.velocity.set(0, 0);
      pushHud();
    },

    aim(nx: number, ny: number) {
      player.target.set(nx * space.bounds.x, ny * space.bounds.y);
    },

    resize,

    dispose() {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      debris.dispose();
      player.dispose();
      space.dispose();
      renderer.dispose();
      // 브라우저 WebGL 컨텍스트 상한(~16) 방어 — 명시적으로 해제한다
      renderer.forceContextLoss();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
