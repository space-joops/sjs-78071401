// 스텔라펫2 스프라이트: 기본 세트(부모 로더 재사용) + 진화 분기(포지/테크노) 색 변형

import { loadSprites, makeVariant, mixWithWhite } from "../sprites";
import { BRANCHES, type BranchId } from "./balance";

const ART = "/feature-3/art";

export type Sprites2 = {
  joopsByStage: (HTMLImageElement | null)[];
  joopsByBranch: Record<Exclude<BranchId, "none">, HTMLImageElement | null>;
  friends: (HTMLImageElement | null)[];
  debris: (HTMLImageElement | null)[];
};

export function loadSprites2(): Sprites2 {
  const base = loadSprites(); // 배열 참조 공유 — 부모 로더가 비동기로 채운다
  const sprites: Sprites2 = {
    joopsByStage: base.joopsByStage,
    joopsByBranch: { forge: null, techno: null },
    friends: base.friends,
    debris: base.debris,
  };
  if (typeof window === "undefined") return sprites;

  fetch(`${ART}/joops.svg`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((svg) => {
      (["forge", "techno"] as const).forEach((b) => {
        const def = BRANCHES[b];
        makeVariant(svg, def.bodyColor, mixWithWhite(def.bodyColor, 0.55), (img) => {
          sprites.joopsByBranch[b] = img;
        });
      });
    })
    .catch(() => {
      // 폴백: 단계 색 스프라이트 사용
    });

  return sprites;
}
