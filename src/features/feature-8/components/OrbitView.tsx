"use client";

import { useCallback } from "react";
import type { PointerEvent } from "react";
import { HOME_HALF_WINDOW_DEG, normalizeAngle } from "../lib/game";
import type { GainFloat } from "../hooks/useJoopsGame";
import styles from "../styles.module.css";

const CENTER = 200;
const ORBIT_R = 148;
const PLANET_R = 68;

function pos(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, r: number): string {
  const s = pos(startDeg, r);
  const e = pos(endDeg, r);
  const large = normalizeAngle(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}

// 별 배치는 하이드레이션 안전하도록 결정적으로 생성
const STARS = Array.from({ length: 48 }, (_, i) => ({
  x: ((i * 89.7 + 13) % 396) + 2,
  y: ((i * 53.3 + 41) % 396) + 2,
  r: 0.6 + ((i * 7) % 10) / 10,
  o: 0.25 + ((i * 13) % 60) / 100,
}));

type Props = {
  angle: number;
  homeAngle: number | null;
  level: number;
  stopped: boolean;
  setupMode: boolean;
  inWindow: boolean;
  levelFlash: number;
  gains: GainFloat[];
  onPickHome: (angle: number) => void;
  onJoopsClick: () => void;
};

export default function OrbitView({
  angle,
  homeAngle,
  level,
  stopped,
  setupMode,
  inWindow,
  levelFlash,
  gains,
  onPickHome,
  onJoopsClick,
}: Props) {
  const joops = pos(angle, ORBIT_R);
  const joopsR = 10 + Math.min(level - 1, 24) * 0.6; // 레벨업 → 몸집 성장
  const hue = (190 + (level - 1) * 24) % 360; // 레벨업 → 색상 변화
  const homeMark = homeAngle === null ? null : pos(homeAngle, ORBIT_R + 20);
  const homeLabel = homeAngle === null ? null : pos(homeAngle, ORBIT_R + 38);

  const handlePick = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!setupMode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 400 - CENTER;
      const y = ((e.clientY - rect.top) / rect.height) * 400 - CENTER;
      if (Math.hypot(x, y) < 20) return; // 정중앙 오탭 방지
      onPickHome(normalizeAngle((Math.atan2(y, x) * 180) / Math.PI + 90));
    },
    [setupMode, onPickHome],
  );

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label={
          setupMode
            ? "궤도 지도 — 원하는 지점을 탭해 내 상공을 지정"
            : "줍스 궤도 관제 화면"
        }
        onPointerDown={handlePick}
        className={`w-full touch-none select-none rounded-2xl bg-[#050914] ${
          setupMode ? "cursor-crosshair" : ""
        }`}
      >
        <defs>
          <radialGradient id="f8-planet" cx="38%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="55%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
          <clipPath id="f8-planet-clip">
            <circle cx={CENTER} cy={CENTER} r={PLANET_R} />
          </clipPath>
        </defs>

        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" opacity={s.o} />
        ))}

        {/* 지구 */}
        <circle cx={CENTER} cy={CENTER} r={PLANET_R + 6} fill="#38bdf8" opacity={0.12} />
        <circle cx={CENTER} cy={CENTER} r={PLANET_R} fill="url(#f8-planet)" />
        <g clipPath="url(#f8-planet-clip)" fill="#34d399" opacity={0.85}>
          <ellipse cx={175} cy={180} rx={26} ry={16} />
          <ellipse cx={225} cy={215} rx={20} ry={12} />
          <ellipse cx={195} cy={240} rx={14} ry={8} />
          <ellipse cx={232} cy={172} rx={12} ry={9} />
        </g>

        {/* 궤도선 */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={ORBIT_R}
          fill="none"
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="5 7"
          opacity={0.7}
          className={setupMode ? "animate-pulse" : ""}
        />

        {/* 내 상공 (Home Point) */}
        {homeAngle !== null && homeMark !== null && homeLabel !== null && (
          <g>
            <path
              d={arcPath(
                homeAngle - HOME_HALF_WINDOW_DEG,
                homeAngle + HOME_HALF_WINDOW_DEG,
                ORBIT_R,
              )}
              stroke={inWindow ? "#34d399" : "#22d3ee"}
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
              opacity={inWindow ? 0.9 : 0.4}
            />
            <text
              x={homeMark.x}
              y={homeMark.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={16}
            >
              📍
            </text>
            <text
              x={homeLabel.x}
              y={homeLabel.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="#94a3b8"
            >
              내 상공
            </text>
          </g>
        )}

        {setupMode && (
          <text
            x={CENTER}
            y={26}
            textAnchor="middle"
            fontSize={13}
            fill="#cbd5e1"
          >
            궤도 위 원하는 지점을 탭하세요
          </text>
        )}

        {/* 줍스 */}
        <g
          transform={`translate(${joops.x.toFixed(2)} ${joops.y.toFixed(2)})`}
          onPointerDown={(e) => {
            if (stopped) {
              e.stopPropagation();
              onJoopsClick();
            }
          }}
          className={stopped ? "cursor-pointer" : ""}
          aria-label={stopped ? "정지한 줍스 — 탭해서 치료" : `줍스 (레벨 ${level})`}
        >
          {stopped && (
            <circle
              r={joopsR + 10}
              fill="none"
              stroke="#f87171"
              strokeWidth={2.5}
              className="animate-pulse"
            />
          )}
          {levelFlash > 0 && !stopped && (
            <circle
              key={levelFlash}
              r={joopsR + 6}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={3}
              className={styles.levelRing}
            />
          )}
          <circle
            r={joopsR}
            fill={stopped ? "#94a3b8" : `hsl(${hue} 85% 62%)`}
            stroke="#0f172a"
            strokeWidth={1.5}
          />
          <circle
            r={joopsR * 0.3}
            cx={-joopsR * 0.35}
            cy={-joopsR * 0.4}
            fill="#ffffff"
            opacity={0.45}
          />
          {stopped ? (
            <text y={1} textAnchor="middle" dominantBaseline="middle" fontSize={joopsR}>
              😵
            </text>
          ) : (
            <>
              <circle cx={-joopsR * 0.32} cy={-1.5} r={1.8} fill="#0f172a" />
              <circle cx={joopsR * 0.32} cy={-1.5} r={1.8} fill="#0f172a" />
              <path
                d={`M ${-joopsR * 0.3} ${joopsR * 0.3} Q 0 ${joopsR * 0.55} ${joopsR * 0.3} ${joopsR * 0.3}`}
                stroke="#0f172a"
                strokeWidth={1.4}
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          {stopped && (
            <text y={-joopsR - 12} textAnchor="middle" fontSize={16}>
              💥
            </text>
          )}
          {/* 손가락 터치 타깃 확장용 투명 히트 영역 */}
          <circle r={Math.max(joopsR + 8, 24)} fill="transparent" />
        </g>
      </svg>

      {/* EXP 획득 플로팅 표시 */}
      <div className="pointer-events-none absolute inset-x-0 top-5 flex flex-col items-center gap-1">
        {gains.map((g) => (
          <span
            key={g.id}
            className={`${styles.floatUp} rounded-full bg-emerald-400/90 px-2.5 py-0.5 text-xs font-bold text-black`}
          >
            {g.text}
          </span>
        ))}
      </div>
    </div>
  );
}
