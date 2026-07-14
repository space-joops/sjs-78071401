// 줍스 캐릭터 아트 — 두들풍 SVG를 문자열로 생성해
// <img> 와 캔버스 drawImage 양쪽에서 같은 그림을 쓴다.
import { STAGES } from "./constants";
import type { Mood } from "./types";

export type JoopsArtOpts = {
  stage: number; // 0~4
  mood?: Mood;
  /** 몸통 hue 강제 지정(친구 줍스용) */
  hue?: number;
  /** 아래쪽 추진 불꽃 표시(비행 중) */
  flame?: boolean;
};

function eyes(mood: Mood) {
  switch (mood) {
    case "sleeping":
      return `
        <path d="M38 56 q7 6 14 0" class="ln"/>
        <path d="M68 56 q7 6 14 0" class="ln"/>
        <text x="88" y="38" font-size="14" fill="#ffffff" opacity="0.9" font-family="sans-serif">z</text>
        <text x="97" y="28" font-size="10" fill="#ffffff" opacity="0.7" font-family="sans-serif">z</text>`;
    case "tired":
      return `
        <circle cx="45" cy="56" r="8" fill="#fff"/>
        <circle cx="75" cy="56" r="8" fill="#fff"/>
        <circle cx="45" cy="58" r="4" fill="#26243a"/>
        <circle cx="75" cy="58" r="4" fill="#26243a"/>
        <path d="M35 48 h20" class="ln"/>
        <path d="M65 48 h20" class="ln"/>
        <path d="M52 74 q8 -5 16 0" class="ln"/>`;
    case "neutral":
      return `
        <circle cx="45" cy="55" r="9" fill="#fff"/>
        <circle cx="75" cy="55" r="9" fill="#fff"/>
        <circle cx="47" cy="56" r="4.5" fill="#26243a"/>
        <circle cx="77" cy="56" r="4.5" fill="#26243a"/>
        <circle cx="48.5" cy="54.5" r="1.5" fill="#fff"/>
        <circle cx="78.5" cy="54.5" r="1.5" fill="#fff"/>
        <path d="M55 72 h10" class="ln"/>`;
    default:
      return `
        <circle cx="45" cy="55" r="9.5" fill="#fff"/>
        <circle cx="75" cy="55" r="9.5" fill="#fff"/>
        <circle cx="47" cy="56" r="5" fill="#26243a"/>
        <circle cx="77" cy="56" r="5" fill="#26243a"/>
        <circle cx="49" cy="54" r="1.8" fill="#fff"/>
        <circle cx="79" cy="54" r="1.8" fill="#fff"/>
        <path d="M52 71 q8 8 16 0" class="ln"/>`;
  }
}

function extras(stage: number, hue: number) {
  let s = "";
  if (stage >= 1) {
    // 옆 지느러미
    s += `
      <path d="M14 62 q-10 -4 -8 8 q8 4 12 -2" class="body ln"/>
      <path d="M106 62 q10 -4 8 8 q-8 4 -12 -2" class="body ln"/>`;
  }
  if (stage >= 2) {
    // 청소부 목도리
    s += `
      <path d="M32 84 q28 14 56 0 l-4 10 q-24 10 -48 0 z" fill="hsl(${(hue + 140) % 360},70%,62%)" stroke="#26243a" stroke-width="2.5" stroke-linejoin="round"/>`;
  }
  if (stage >= 3) {
    // 베테랑 고글(이마 위)
    s += `
      <path d="M30 34 q30 -12 60 0" class="ln" stroke-width="5"/>
      <circle cx="46" cy="30" r="7" fill="#bfe8ff" stroke="#26243a" stroke-width="2.5"/>
      <circle cx="74" cy="30" r="7" fill="#bfe8ff" stroke="#26243a" stroke-width="2.5"/>`;
  }
  if (stage >= 4) {
    // 코스모 왕관 + 오라
    s += `
      <path d="M46 16 l6 -10 l8 8 l8 -8 l6 10 z" fill="#ffd95e" stroke="#26243a" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="60" cy="62" r="55" fill="none" stroke="hsl(${hue},90%,70%)" stroke-width="2" opacity="0.5" stroke-dasharray="4 7"/>`;
  }
  return s;
}

/** 줍스 SVG 문자열 (viewBox 0 0 120 130) */
export function joopsSvg(opts: JoopsArtOpts): string {
  const { stage, mood = "happy", flame = false } = opts;
  const hue = opts.hue ?? STAGES[Math.max(0, Math.min(4, stage))].hue;
  const bodyA = `hsl(${hue},85%,74%)`;
  const bodyB = `hsl(${hue},70%,58%)`;
  const antennaTip =
    stage >= 2
      ? `<path d="M60 8 l3.2 6.2 6.8 1 -4.9 4.8 1.1 6.8 -6.2 -3.2 -6.2 3.2 1.1 -6.8 -4.9 -4.8 6.8 -1 z" fill="#ffd95e" stroke="#26243a" stroke-width="2.2" stroke-linejoin="round"/>`
      : `<circle cx="60" cy="13" r="5.5" fill="#ffd95e" stroke="#26243a" stroke-width="2.5"/>`;
  const flameSvg = flame
    ? `<g opacity="0.95">
        <path d="M50 106 q10 22 20 0 q-5 8 -10 8 q-5 0 -10 -8z" fill="#7ef2d8"/>
        <path d="M55 106 q5 13 10 0 q-2.5 6 -5 6 q-2.5 0 -5 -6z" fill="#fff7c2"/>
      </g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">
  <defs>
    <linearGradient id="jb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bodyA}"/>
      <stop offset="1" stop-color="${bodyB}"/>
    </linearGradient>
  </defs>
  <style>
    .ln{fill:none;stroke:#26243a;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
    .body{fill:url(#jb)}
  </style>
  ${flameSvg}
  <path d="M60 13 q-2 8 0 14" class="ln"/>
  ${antennaTip}
  ${extras(stage, hue)}
  <path class="body" d="M60 24
    c 26 0 40 16 40 40
    c 0 26 -16 42 -40 42
    c -24 0 -40 -16 -40 -42
    c 0 -24 14 -40 40 -40 z"
    stroke="#26243a" stroke-width="3.2" stroke-linejoin="round"/>
  <ellipse cx="60" cy="86" rx="20" ry="12" fill="#ffffff" opacity="0.35"/>
  <circle cx="32" cy="68" r="6" fill="#ff9fb2" opacity="0.75"/>
  <circle cx="88" cy="68" r="6" fill="#ff9fb2" opacity="0.75"/>
  ${eyes(mood)}
</svg>`;
}

export function joopsDataUrl(opts: JoopsArtOpts): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(joopsSvg(opts))}`;
}
