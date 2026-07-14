"use client";

import { useId } from "react";

/**
 * 진화 단계·색상(hue)에 따라 달라지는 프로시저럴 SVG 아바타.
 * 0단계는 알, 이후는 젤리형 생명체 + 단계별 장식(지느러미/오로라 고리/왕관).
 */
export default function PetAvatar({
  hue,
  stage,
  size = 56,
}: {
  hue: number;
  stage: number;
  size?: number;
}) {
  const gid = useId();
  const body = `hsl(${hue}, 75%, 70%)`;
  const bodyDeep = `hsl(${(hue + 30) % 360}, 65%, 52%)`;
  const glow = `hsl(${hue}, 90%, 80%)`;

  if (stage === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <defs>
          <radialGradient id={`${gid}-egg`} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fdfdfd" />
            <stop offset="100%" stopColor={body} />
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="36" rx="18" ry="22" fill={`url(#${gid}-egg)`} />
        <circle cx="26" cy="30" r="2.4" fill={bodyDeep} opacity="0.6" />
        <circle cx="38" cy="42" r="3" fill={bodyDeep} opacity="0.5" />
        <circle cx="34" cy="22" r="1.8" fill={bodyDeep} opacity="0.5" />
        <circle cx="27" cy="40" r="1.5" fill={bodyDeep} opacity="0.45" />
        <path d="M32 14 q3 -6 7 -4" stroke={glow} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="40" cy="9" r="2.4" fill={glow} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={`${gid}-body`} cx="38%" cy="32%" r="85%">
          <stop offset="0%" stopColor={glow} />
          <stop offset="100%" stopColor={bodyDeep} />
        </radialGradient>
      </defs>

      {stage >= 5 && (
        <ellipse
          cx="32" cy="40" rx="26" ry="9"
          fill="none" stroke={glow} strokeWidth="2.5" opacity="0.55"
        />
      )}

      {stage >= 2 && (
        <>
          <ellipse cx="11" cy="40" rx="7" ry="4.5" fill={bodyDeep} transform="rotate(-22 11 40)" />
          <ellipse cx="53" cy="40" rx="7" ry="4.5" fill={bodyDeep} transform="rotate(22 53 40)" />
        </>
      )}

      <ellipse cx="32" cy="38" rx="19" ry="17" fill={`url(#${gid}-body)`} />
      <ellipse cx="32" cy="44" rx="11" ry="7.5" fill="#ffffff" opacity="0.35" />

      {/* 더듬이 + 별 */}
      <path d="M32 22 q1 -8 7 -9" stroke={body} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="12" r="3" fill={glow} />
      {stage >= 7 && (
        <path d="M22 15 l4 4 M42 19 l4 -4" stroke={glow} strokeWidth="2" strokeLinecap="round" />
      )}

      {/* 눈 · 볼터치 · 입 */}
      <circle cx="25" cy="36" r="4.6" fill="#fff" />
      <circle cx="39" cy="36" r="4.6" fill="#fff" />
      <circle cx="26" cy="37" r="2.4" fill="#1b1e3a" />
      <circle cx="40" cy="37" r="2.4" fill="#1b1e3a" />
      <circle cx="20.5" cy="43" r="2.6" fill="#ff9db1" opacity="0.75" />
      <circle cx="43.5" cy="43" r="2.6" fill="#ff9db1" opacity="0.75" />
      <path d="M29.5 45 q2.5 2.6 5 0" stroke="#1b1e3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
