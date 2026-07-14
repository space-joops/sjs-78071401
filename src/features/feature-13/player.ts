// 줍스(플레이어) — 발광하는 몸통 + 눈 + 추진 불꽃.
// z = 0 평면에서 드래그로 X/Y만 움직이고, 이동 방향으로 기울어진다(뱅킹).

import * as THREE from "three";
import { SCENE, stageForLevel } from "./constants";

export type Player = {
  group: THREE.Group;
  /** 목표 위치 (드래그로 갱신) */
  target: THREE.Vector2;
  velocity: THREE.Vector2;
  radius: number;
  setStage: (level: number) => void;
  update: (dt: number, bounds: { x: number; y: number }, tSec: number) => void;
  flash: (color: number) => void;
  dispose: () => void;
};

export function createPlayer(): Player {
  const group = new THREE.Group();
  group.position.set(0, 0, SCENE.playZ);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  // 몸통 — 발광 구
  const bodyGeo = track(new THREE.SphereGeometry(1, 32, 24));
  const bodyMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x7de8d8,
      emissive: 0x2ba99a,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.1,
      fog: false,
    }),
  );
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // 배 — 밝은 부분
  const bellyGeo = track(new THREE.SphereGeometry(0.72, 24, 16));
  const bellyMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd8fff8,
      emissive: 0x88e8dd,
      emissiveIntensity: 0.5,
      roughness: 0.6,
      transparent: true,
      opacity: 0.55,
      fog: false,
    }),
  );
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, -0.18, 0.42);
  group.add(belly);

  // 눈 (흰자 + 눈동자)
  const eyeGeo = track(new THREE.SphereGeometry(0.26, 16, 12));
  const eyeMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  const pupilGeo = track(new THREE.SphereGeometry(0.13, 12, 10));
  const pupilMat = track(new THREE.MeshBasicMaterial({ color: 0x1c2740, fog: false }));
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * 0.34, 0.22, 0.78);
    group.add(eye);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(sx * 0.36, 0.22, 0.96);
    group.add(pupil);
  }

  // 추진 불꽃 (뒤쪽 = +Z)
  const flameGeo = track(new THREE.ConeGeometry(0.42, 1.7, 16, 1, true));
  const flameMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x9fdcff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.rotation.x = -Math.PI / 2; // 원뿔 끝이 +Z를 향하게
  flame.position.set(0, 0, 1.35);
  group.add(flame);

  // 자기 발광 (지구를 살짝 비춘다)
  const glow = new THREE.PointLight(0x7de8d8, 24, 40, 2);
  group.add(glow);

  const target = new THREE.Vector2(0, 0);
  const velocity = new THREE.Vector2(0, 0);
  const state = { radius: 0.62, scale: 0.62, flashUntil: 0, flashColor: 0xffffff };
  const baseEmissive = new THREE.Color(0x2ba99a);

  return {
    group,
    target,
    velocity,
    get radius() {
      return state.radius;
    },

    setStage(level: number) {
      const st = stageForLevel(level);
      state.radius = st.size;
      bodyMat.color.setHex(st.color);
      baseEmissive.setHex(st.color).multiplyScalar(0.45);
      bodyMat.emissive.copy(baseEmissive);
      glow.color.setHex(st.color);
    },

    update(dt: number, bounds: { x: number; y: number }, tSec: number) {
      // 스프링 추적 — 관성이 붙어 무게감이 생긴다
      const p = group.position;
      const tx = THREE.MathUtils.clamp(target.x, -bounds.x, bounds.x);
      const ty = THREE.MathUtils.clamp(target.y, -bounds.y, bounds.y);
      const STIFF = 42;
      const DAMP = 9.5;
      velocity.x += ((tx - p.x) * STIFF - velocity.x * DAMP) * dt;
      velocity.y += ((ty - p.y) * STIFF - velocity.y * DAMP) * dt;
      p.x = THREE.MathUtils.clamp(p.x + velocity.x * dt, -bounds.x, bounds.x);
      p.y = THREE.MathUtils.clamp(p.y + velocity.y * dt, -bounds.y, bounds.y);

      // 뱅킹 — 이동 방향으로 기울어진다
      group.rotation.z = THREE.MathUtils.clamp(-velocity.x * 0.035, -0.5, 0.5);
      group.rotation.x = THREE.MathUtils.clamp(velocity.y * 0.02, -0.3, 0.3);

      // 크기 (진화) + 숨쉬기
      const breathe = 1 + Math.sin(tSec * 2.4) * 0.03;
      state.scale += (state.radius - state.scale) * Math.min(1, dt * 6);
      group.scale.setScalar(state.scale * breathe);

      // 불꽃 flicker — 빠르게 움직일수록 길어진다
      const sp = Math.hypot(velocity.x, velocity.y);
      flame.scale.set(1, 0.75 + Math.min(1.1, sp * 0.03) + Math.sin(tSec * 40) * 0.08, 1);
      flameMat.opacity = 0.55 + Math.min(0.35, sp * 0.012);

      // 피격 플래시
      if (tSec * 1000 < state.flashUntil) {
        const blink = Math.sin(tSec * 60) * 0.5 + 0.5;
        bodyMat.emissive.setHex(state.flashColor).multiplyScalar(0.3 + blink * 0.8);
      } else {
        bodyMat.emissive.copy(baseEmissive);
      }
    },

    flash(color: number) {
      state.flashColor = color;
      state.flashUntil = performance.now() + 600;
    },

    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
