// 이미지 생성 AI(미드저니·DALL·E·SD 등)용 영문 프롬프트.
// 픽셀 랩 화면에서 복사 버튼으로 제공한다.

export type AiPrompt = {
  id: string;
  title: string;
  usage: string;
  prompt: string;
};

const STYLE =
  "16-bit SNES-era retro pixel art, strong light-and-shadow contrast, dark navy outlines, " +
  "limited teal/orange palette, crisp hard-edged pixels, no anti-aliasing, no blur, no gradients, " +
  "transparent background, clean game-ready sprite asset";

export const AI_PROMPTS: AiPrompt[] = [
  {
    id: "joops-head",
    title: "줍스 캐릭터 (입 벌린 픽셀 몬스터)",
    usage: "머리 스프라이트 시트 — 냠냠 2프레임",
    prompt:
      "16x16 pixel art sprite sheet with 2 animation frames side by side: a cute round teal " +
      "space-monster head flying to the right through orbit, Pac-Man-style mouth — frame 1 wide " +
      "open showing a dark magenta mouth interior and one tiny white fang on the upper jaw, " +
      "frame 2 mid-chomp almost closed. Single antenna on top with a glowing yellow bulb, one big " +
      "white eye with a dark pupil looking toward the mouth, mint highlight on the upper-left and " +
      "darker teal shading on the lower-left. A small orange-and-yellow thruster flame with a " +
      "white-hot core sparks off its tail. " +
      STYLE,
  },
  {
    id: "growth-sheet",
    title: "꿀꺽 성장 세그먼트 시트",
    usage: "몸통 성장 애니메이션 — 쓰레기가 몸을 타고 내려가는 연출",
    prompt:
      "16x16 pixel art sprite sheet with 3 frames: (1) a small round teal body segment ball with " +
      "an upper-left mint highlight and lower-right shadow, (2) the same segment swollen one pixel " +
      "larger in every direction as if a swallowed piece of space junk is passing through it — a " +
      "gulp bulge, (3) back to the normal segment. Designed for a snake-style creature whose body " +
      "grows by exactly one segment every time it eats orbital debris. " +
      STYLE,
  },
  {
    id: "starfield",
    title: "빛나는 별무리 배경 타일",
    usage: "배경 — 심리스 타일 + 2프레임 트윙클",
    prompt:
      "seamless tileable 16x16 pixel art of deep space for a retro arcade background: one " +
      "5-pixel cross-shaped white star with pale cyan tips, four to six scattered single-pixel " +
      "stars in pale cyan and dim slate blue on a very dark navy (#060b18) sky, arranged so the " +
      "tile repeats without visible seams, with a second twinkle frame where bright stars dim and " +
      "dim stars brighten. " +
      STYLE,
  },
  {
    id: "orbit-line",
    title: "레트로 궤도 점선",
    usage: "배경 — 비행 경로 HUD 라인 (가로 반복 타일)",
    prompt:
      "retro 16-bit HUD element: a horizontal dashed orbit trajectory line made of glowing cyan " +
      "pixel dashes 4 pixels long with dimmer teal end-cap pixels, repeating every 8 pixels, evoking " +
      "a classic SNES shoot-em-up radar interface, drawn on a transparent background as a seamless " +
      "horizontal tile. " +
      STYLE,
  },
  {
    id: "debris",
    title: "우주쓰레기 세트",
    usage: "먹이 아이템 — 등급별 쓰레기",
    prompt:
      "16x16 pixel art sprite sheet of floating space junk, 4 items in a row: a steel hex bolt " +
      "with threading hole, a torn blue solar-panel shard with thin grid lines, a beige crumpled " +
      "rocket nozzle fragment, and a tiny defunct satellite with one bent panel — each with light " +
      "steel top-left shading and dark slate bottom-right shadow, slightly rotated as if tumbling " +
      "in zero gravity. " +
      STYLE,
  },
];
