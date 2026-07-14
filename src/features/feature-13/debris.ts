// 우주쓰레기 — 화면 안쪽 먼 곳(-Z)에서 스폰되어 카메라 쪽(+Z)으로 다가온다.
// 좌우로 흐르는 2D 방식이 아니라 원근으로 다가오는 것이 이 게임의 핵심.
//
// 등급별 지오메트리 5종과 머티리얼을 공유하고, 객체 40개를 풀로 재사용한다.
// 먹을 수 있는지 여부는 항상 카메라를 향하는 Sprite 링으로 표시한다 (3D에서 가장 읽기 쉽다).

import * as THREE from "three";
import { DEBRIS_TIERS, SCENE, type DebrisDef } from "./constants";

export type DebrisItem = {
  alive: boolean;
  tier: number;
  def: DebrisDef;
  mesh: THREE.Mesh;
  ring: THREE.Sprite;
  spinX: number;
  spinY: number;
  /**
   * 직전 프레임의 z. 스윕 충돌 판정에 쓴다.
   * 고정 폭 윈도로 판정하면 30fps × 120u/s에서 프레임당 4유닛을 건너뛰어
   * 작은 쓰레기(결합 반지름 ~1.1)를 그대로 통과해버린다(터널링).
   */
  prevZ: number;
};

export type DebrisField = {
  group: THREE.Group;
  items: DebrisItem[];
  spawn: (bounds: { x: number; y: number }, maxTier: number) => void;
  /** 모든 쓰레기를 전진시키고, 카메라를 지나친 것을 회수한다 */
  update: (dt: number, speed: number, maxTier: number, tSec: number) => void;
  clear: () => void;
  dispose: () => void;
};

/** 등급별 지오메트리 — 실루엣이 서로 확연히 다르게 */
function makeGeometries(): THREE.BufferGeometry[] {
  return [
    // 1 페인트 조각 — 불규칙한 작은 파편
    new THREE.TetrahedronGeometry(1, 0),
    // 2 볼트·너트 — 육각 기둥
    new THREE.CylinderGeometry(0.85, 0.85, 1.1, 6),
    // 3 패널 파편 — 납작한 판
    new THREE.BoxGeometry(2.2, 0.16, 1.5),
    // 4 로켓 잔해 — 찌그러진 노즐
    new THREE.CylinderGeometry(0.55, 1.0, 2.0, 10, 1, true),
    // 5 폐위성 — 본체
    new THREE.BoxGeometry(1.5, 1.0, 1.2),
  ];
}

/** 캔버스로 링 텍스처를 만든다 (먹기=시안 / 위험=빨강) */
function makeRingTexture(color: string): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();
    // 네 귀퉁이 타겟 틱
    ctx.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const r0 = s / 2 - 18;
      const r1 = s / 2 - 2;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0);
      ctx.lineTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const POOL_SIZE = 44;

export function createDebrisField(): DebrisField {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  const geos = makeGeometries().map(track);
  const mats = DEBRIS_TIERS.map((d) =>
    track(
      new THREE.MeshStandardMaterial({
        color: d.color,
        roughness: 0.62,
        metalness: 0.55,
        flatShading: d.tier <= 2,
        side: d.tier === 4 ? THREE.DoubleSide : THREE.FrontSide,
        // fog: true (기본) — 쓰레기만 안개에 반응해 어둠 속에서 서서히 나타난다
      }),
    ),
  );

  const eatTex = track(makeRingTexture("#7de8d8"));
  const dangerTex = track(makeRingTexture("#ff5a5a"));
  const eatRingMat = track(
    new THREE.SpriteMaterial({
      map: eatTex,
      color: 0x7de8d8,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: false,
    }),
  );
  const dangerRingMat = track(
    new THREE.SpriteMaterial({
      map: dangerTex,
      color: 0xff5a5a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    }),
  );

  const items: DebrisItem[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const mesh = new THREE.Mesh(geos[0], mats[0]);
    mesh.visible = false;
    const ring = new THREE.Sprite(eatRingMat);
    ring.visible = false;
    group.add(mesh);
    group.add(ring);
    items.push({
      alive: false,
      tier: 1,
      def: DEBRIS_TIERS[0],
      mesh,
      ring,
      spinX: 0,
      spinY: 0,
      prevZ: SCENE.spawnZ,
    });
  }

  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  /** 가중치로 등급을 뽑되, 처리 가능 등급 + 2까지만 나오게 한다 */
  const pickTier = (maxTier: number): DebrisDef => {
    const cap = Math.min(5, maxTier + 2);
    const pool = DEBRIS_TIERS.filter((d) => d.tier <= cap);
    const total = pool.reduce((s, d) => s + d.weight, 0);
    let roll = Math.random() * total;
    for (const d of pool) {
      roll -= d.weight;
      if (roll <= 0) return d;
    }
    return pool[0];
  };

  return {
    group,
    items,

    spawn(bounds, maxTier) {
      const slot = items.find((it) => !it.alive);
      if (!slot) return;
      const def = pickTier(maxTier);

      slot.alive = true;
      slot.tier = def.tier;
      slot.def = def;
      slot.mesh.geometry = geos[def.tier - 1];
      slot.mesh.material = mats[def.tier - 1];
      slot.mesh.scale.setScalar(def.radius);
      slot.mesh.visible = true;

      // 비행 회랑 안에서 스폰 — 플레이 영역보다 살짝 넓게
      slot.mesh.position.set(
        rand(-bounds.x * 1.15, bounds.x * 1.15),
        rand(-bounds.y * 1.1, bounds.y * 1.1),
        SCENE.spawnZ + rand(-40, 0),
      );
      slot.prevZ = slot.mesh.position.z;
      slot.spinX = rand(-1.6, 1.6);
      slot.spinY = rand(-1.6, 1.6);
      slot.mesh.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));

      slot.ring.visible = true;
      slot.ring.position.copy(slot.mesh.position);
      slot.ring.scale.setScalar(def.radius * 3.4);
    },

    update(dt, speed, maxTier, tSec) {
      for (const it of items) {
        if (!it.alive) continue;
        const m = it.mesh;
        it.prevZ = m.position.z;
        m.position.z += speed * dt; // 카메라 쪽으로 다가온다
        // 스핀만 준다 — x/y가 이동하면 스윕 충돌 판정(game.ts)이 깨진다
        m.rotation.x += it.spinX * dt;
        m.rotation.y += it.spinY * dt;

        const edible = it.tier <= maxTier;
        it.ring.material = edible ? eatRingMat : dangerRingMat;
        it.ring.position.copy(m.position);
        // 위험한 것은 링이 맥동해서 눈에 띈다
        const pulse = edible ? 1 : 1 + Math.sin(tSec * 7 + it.tier) * 0.12;
        it.ring.scale.setScalar(it.def.radius * 3.4 * pulse);
        // 멀리 있을 땐 링을 흐리게 (가까워질수록 또렷)
        const near = THREE.MathUtils.clamp(
          1 - (Math.abs(m.position.z) - 20) / 200,
          0.12,
          1,
        );
        it.ring.material.opacity = (edible ? 0.7 : 0.95) * near;

        if (m.position.z > SCENE.despawnZ) {
          it.alive = false;
          m.visible = false;
          it.ring.visible = false;
        }
      }
    },

    clear() {
      for (const it of items) {
        it.alive = false;
        it.mesh.visible = false;
        it.ring.visible = false;
      }
    },

    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
