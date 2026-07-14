// 3D 우주 씬 — 그래비티풍 지구, 대기 글로우, 별, 원근 안개.
//
// [궤도 회전의 핵심]
// 지구를 아래에 큰 구로 깔고 월드 X축 기준 +방향으로 돌린다.
// 플레이어 아래 표면점의 중심 기준 위치는 r = (0, +R, 0) 이므로
//   v = ω × r = (ωx, 0, 0) × (0, R, 0) = (0, 0, ωx·R)
// ωx > 0 이면 v_z > 0 → 표면이 카메라 쪽으로 흐른다. 우주쓰레기의 진행 방향과 같다.
// 이건 연출 트릭이 아니라 우주선 기준계에서 본 궤도 운동 그 자체다.
//
// 궤도 운동(표면이 뒤로 흐름)과 지구 자체 자전(동서)을 그룹 중첩으로 분리해
// 대륙 모양이 계속 알아볼 수 있게 유지한다.

import * as THREE from "three";
import { EARTH, SCENE } from "./constants";

const ATMO_VERT = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const ATMO_FRAG = `
uniform vec3 uColor;
uniform float uPower;
uniform float uStrength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  // 안쪽 면(BackSide)에서 본 프레넬 — 가장자리로 갈수록 밝아지는 대기 산란
  float f = pow(1.0 - abs(dot(vNormal, vView)), uPower);
  gl_FragColor = vec4(uColor, f * uStrength);
}
`;

export type SpaceScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 궤도 운동 그룹 — 매 프레임 rotation.x를 증가시킨다 */
  orbitGroup: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudMesh: THREE.Mesh;
  sun: THREE.DirectionalLight;
  /** 매 프레임 지구를 굴린다 */
  update: (dt: number, speedScale: number) => void;
  resize: (w: number, h: number) => void;
  /** 플레이어가 움직일 수 있는 범위 (프러스텀에서 계산) */
  bounds: { x: number; y: number };
  dispose: () => void;
};

export function createSpaceScene(): SpaceScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE.fogColor);
  // 안개는 쓰레기에만 적용된다 (지구·별·대기는 각 머티리얼에 fog:false)
  scene.fog = new THREE.Fog(SCENE.fogColor, SCENE.fogNear, SCENE.fogFar);

  const camera = new THREE.PerspectiveCamera(SCENE.fov, 1, SCENE.near, SCENE.far);
  camera.position.set(...SCENE.camPos);
  camera.lookAt(new THREE.Vector3(...SCENE.camLookAt));

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  // ---- 조명 ----
  const sun = new THREE.DirectionalLight(0xfff4e0, 3.1);
  sun.position.set(-0.55, 0.42, 0.72).multiplyScalar(1000);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x2a3550, 0.55));

  // ---- 지구 (궤도 그룹 → 기울기 그룹 → 메시) ----
  const loader = new THREE.TextureLoader();
  const dayTex = track(loader.load("/feature-13/earth-day.jpg"));
  dayTex.colorSpace = THREE.SRGBColorSpace;
  dayTex.anisotropy = 4;
  const cloudTex = track(loader.load("/feature-13/earth-clouds.jpg"));
  cloudTex.colorSpace = THREE.SRGBColorSpace;

  const orbitGroup = new THREE.Group();
  orbitGroup.position.set(0, EARTH.centerY, EARTH.centerZ);
  scene.add(orbitGroup);

  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = EARTH.tiltZ;
  orbitGroup.add(tiltGroup);

  const earthGeo = track(new THREE.SphereGeometry(EARTH.radius, 72, 48));
  const earthMat = track(
    new THREE.MeshStandardMaterial({
      map: dayTex,
      roughness: 0.92,
      metalness: 0,
      fog: false, // 지구는 안개에 먹히지 않는다
    }),
  );
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  tiltGroup.add(earthMesh);

  // 구름 — 그레이스케일 jpg를 알파맵으로 재사용
  const cloudGeo = track(new THREE.SphereGeometry(EARTH.radius * 1.006, 64, 40));
  const cloudMat = track(
    new THREE.MeshStandardMaterial({
      map: cloudTex,
      alphaMap: cloudTex,
      transparent: true,
      opacity: 0.72,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
      fog: false,
    }),
  );
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  tiltGroup.add(cloudMesh);

  // 대기 글로우 — 안쪽 면 프레넬. 그래비티풍 푸른 테두리.
  const atmoGeo = track(new THREE.SphereGeometry(EARTH.radius * 1.028, 48, 32));
  const atmoMat = track(
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(0x4aa3ff) },
        uPower: { value: 2.6 },
        uStrength: { value: 1.15 },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  orbitGroup.add(atmoMesh); // 기울기와 무관하게 항상 구를 감싼다

  // ---- 별 ----
  const starCount = 1600;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // 구면에 균일 분포
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = 1400;
    const s = Math.sqrt(1 - u * u);
    starPos[i * 3] = r * s * Math.cos(th);
    starPos[i * 3 + 1] = r * u;
    starPos[i * 3 + 2] = r * s * Math.sin(th);
    const t = 0.65 + Math.random() * 0.35;
    starCol[i * 3] = t * (0.85 + Math.random() * 0.15);
    starCol[i * 3 + 1] = t * 0.95;
    starCol[i * 3 + 2] = t;
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    }),
  );
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---- 플레이 영역 (프러스텀에서 계산) ----
  // 고정 좌표를 쓰면 세로 화면(aspect ~0.5)에서 줍스가 화면 밖으로 나간다.
  const bounds = { x: 6, y: 5 };
  const camDist = SCENE.camPos[2] - SCENE.playZ;
  const recomputeBounds = () => {
    const halfH = Math.tan((SCENE.fov * Math.PI) / 360) * camDist;
    const halfW = halfH * camera.aspect;
    bounds.x = halfW * 0.82;
    bounds.y = halfH * 0.72;
  };

  return {
    scene,
    camera,
    orbitGroup,
    earthMesh,
    cloudMesh,
    sun,
    bounds,

    update(dt: number, speedScale: number) {
      // 궤도 운동 — 표면이 카메라 쪽(+Z)으로 흐른다. 속도가 빨라지면 지구도 함께 빨라진다.
      orbitGroup.rotation.x += EARTH.orbitRate * speedScale * dt;
      // 지구 자체 자전 (동서) — 대륙이 알아볼 수 있게 천천히
      earthMesh.rotation.y += EARTH.spinRate * dt;
      cloudMesh.rotation.y += EARTH.cloudSpinRate * dt;
    },

    resize(w: number, h: number) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      recomputeBounds();
    },

    dispose() {
      for (const d of disposables) d.dispose();
      scene.clear();
    },
  };
}
