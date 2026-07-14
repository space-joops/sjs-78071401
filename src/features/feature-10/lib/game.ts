// KAPLAY 점프 러너 씬 — 줍스가 자동 질주하며 탭/스페이스 점프로 우주쓰레기를 넘는다.
// 텍스트는 전부 React 오버레이 담당(kaplay 기본 비트맵 폰트는 한글 미지원), 여기는 플레이 필드만.
import type { KAPLAYCtx } from "kaplay";
import {
  BASE_SPEED,
  COYOTE,
  GAP_DIST_MAX,
  GAP_DIST_MIN,
  GRAVITY,
  GROUND_H,
  HIT_H,
  HIT_W,
  JUMP_BUFFER,
  JUMP_FORCE,
  MAX_SPEED,
  OBSTACLES,
  PLAYER_R,
  PLAYER_X,
  RAMP,
  STAR_EVERY,
  STAR_SCORE,
  type GameHooks,
} from "./constants";

export type JumpRunner = {
  restart: () => void;
};

export function createJumpRunner(k: KAPLAYCtx, hooks: GameHooks): JumpRunner {
  k.setGravity(GRAVITY);

  k.scene("game", () => {
    const groundY = () => k.height() - GROUND_H;
    // 타이머를 씬 수명에 묶는 호스트 — k.go("game") 재시작 시 스포너 중복을 원천 차단
    const timers = k.add([k.timer()]);

    let speed = BASE_SPEED;
    let score = 0;
    let stars = 0;
    let elapsed = 0;
    let dead = false;

    // 달 표면 지면
    const ground = k.add([
      k.rect(k.width() * 2, GROUND_H),
      k.pos(0, groundY()),
      k.area(),
      k.body({ isStatic: true }),
      k.color(24, 24, 42),
      k.z(5),
    ]);
    const crust = k.add([
      k.rect(k.width() * 2, 3),
      k.pos(0, groundY()),
      k.color(110, 116, 148),
      k.z(6),
    ]);
    k.onResize(() => {
      ground.pos.y = groundY();
      ground.width = k.width() * 2;
      crust.pos.y = groundY();
      crust.width = k.width() * 2;
    });

    // 줍스 — 민트색 몸통, 히트박스는 시각보다 작게
    const player = k.add([
      k.circle(PLAYER_R),
      k.pos(PLAYER_X, groundY() - PLAYER_R - 1),
      k.area({ shape: new k.Rect(k.vec2(-HIT_W / 2, -HIT_H / 2), HIT_W, HIT_H) }),
      k.body(),
      k.color(126, 242, 216),
      k.outline(3, k.rgb(6, 42, 36)),
      k.z(10),
      "player",
    ]);
    player.add([k.circle(4), k.pos(9, -7), k.color(20, 24, 40)]);
    player.add([k.circle(2.5), k.pos(14, -2), k.color(255, 179, 199)]);

    // 수집/충돌 파티클 — 내장 스프라이트 의존 없이 도형으로
    const burst = (x: number, y: number, rgb: [number, number, number]) => {
      for (let i = 0; i < 8; i++) {
        k.add([
          k.circle(k.rand(2, 4)),
          k.pos(x, y),
          k.color(rgb[0], rgb[1], rgb[2]),
          k.opacity(1),
          k.move(k.rand(0, 360), k.rand(80, 220)),
          k.lifespan(0.35, { fade: 0.35 }),
          k.z(30),
        ]);
      }
    };

    // 점프 — 선입력 버퍼 + 코요테 타임으로 모바일 터치 공정성 확보
    let bufferT = 0;
    let coyoteT = 0;
    const queueJump = () => {
      if (!dead) bufferT = JUMP_BUFFER;
    };
    k.onKeyPress("space", queueJump);
    k.onMousePress(queueJump);
    player.onUpdate(() => {
      coyoteT = player.isGrounded() ? COYOTE : Math.max(0, coyoteT - k.dt());
      bufferT = Math.max(0, bufferT - k.dt());
      if (!dead && bufferT > 0 && coyoteT > 0) {
        player.jump(JUMP_FORCE);
        bufferT = 0;
        coyoteT = 0;
      }
    });

    // 장애물 — 다음 스폰까지 "거리(px)/속도" 초: 속도가 붙어도 간격 공정성 유지
    const spawnObstacle = () => {
      if (dead) return;
      const o = k.choose(OBSTACLES);
      k.add([
        k.rect(o.w, o.h, { radius: 4 }),
        k.pos(k.width() + 40, groundY() - o.h),
        k.area({ scale: k.vec2(0.75, 0.85) }),
        k.color(o.color[0], o.color[1], o.color[2]),
        k.outline(2, k.rgb(10, 10, 24)),
        k.z(9),
        k.offscreen({ destroy: true, distance: 140 }),
        "obstacle",
        "scroll",
      ]);
      timers.wait(k.rand(GAP_DIST_MIN, GAP_DIST_MAX) / speed, spawnObstacle);
    };
    timers.wait(1.2, spawnObstacle);

    // 별 조각 — 점프 궤적 높이에 1~3개 아치로
    timers.loop(STAR_EVERY, () => {
      if (dead) return;
      const count = k.randi(1, 4);
      const baseY = groundY() - k.rand(110, 170);
      const startX = k.width() + 40;
      for (let i = 0; i < count; i++) {
        const arc = count > 1 ? Math.sin((i / (count - 1)) * Math.PI) * 18 : 0;
        k.add([
          k.circle(8),
          k.pos(startX + i * 34, baseY - arc),
          k.area(),
          k.color(255, 214, 110),
          k.outline(2, k.rgb(120, 90, 20)),
          k.z(8),
          k.offscreen({ destroy: true, distance: 200 }),
          "star",
          "scroll",
        ]);
      }
    });

    // 배경 별(느린 패럴랙스) + 달 표면 점(전경 속도)
    const spawnBgStar = (x: number) => {
      k.add([
        k.circle(k.rand(1, 2.4)),
        k.pos(x, k.rand(20, groundY() - 40)),
        k.color(180, 190, 230),
        k.opacity(k.rand(0.3, 0.9)),
        k.z(1),
        k.offscreen({ destroy: true, distance: 60 }),
        "bg",
      ]);
    };
    const spawnDust = (x: number) => {
      k.add([
        k.rect(k.rand(6, 16), 3, { radius: 2 }),
        k.pos(x, groundY() + k.rand(14, GROUND_H - 16)),
        k.color(64, 68, 98),
        k.z(7),
        k.offscreen({ destroy: true, distance: 60 }),
        "scroll",
      ]);
    };
    for (let i = 0; i < 16; i++) spawnBgStar(k.rand(0, k.width()));
    for (let i = 0; i < 8; i++) spawnDust(k.rand(0, k.width()));
    timers.loop(0.6, () => spawnBgStar(k.width() + 20));
    timers.loop(0.35, () => {
      if (!dead) spawnDust(k.width() + 20);
    });

    // 메인 루프 — 속도 램프, 거리 비례 점수, 스크롤
    k.onUpdate(() => {
      if (dead) return;
      elapsed += k.dt();
      speed = Math.min(MAX_SPEED, BASE_SPEED + RAMP * elapsed);
      score += k.dt() * (speed / 32);
      hooks.onScore(Math.floor(score));
      for (const obj of k.get("scroll")) obj.move(-speed, 0);
      for (const obj of k.get("bg")) obj.move(-speed * 0.3, 0);
    });

    player.onCollide("star", (s) => {
      if (dead) return;
      burst(s.pos.x, s.pos.y, [255, 214, 110]);
      s.destroy();
      stars += 1;
      score += STAR_SCORE;
      hooks.onScore(Math.floor(score));
    });

    player.onCollide("obstacle", () => {
      if (dead) return;
      dead = true;
      player.color = k.rgb(255, 120, 120);
      k.shake(8);
      burst(player.pos.x, player.pos.y, [255, 120, 120]);
      hooks.onGameOver({
        score: Math.floor(score),
        stars,
        time: Math.floor(elapsed),
      });
    });
  });

  return {
    restart: () => k.go("game"),
  };
}
