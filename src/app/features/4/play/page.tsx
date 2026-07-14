import type { Metadata, Viewport } from "next";
import PlayGame from "@/features/feature-4/components/PlayGame";

export const metadata: Metadata = {
  title: "궤도 비행 — 줍스 오비트",
  description: "줍스를 조종해 우주쓰레기를 청소하는 궤도 비행 훈련",
};

// 배경이 노치·다이내믹 아일랜드·홈 인디케이터 아래까지 꽉 차도록.
// 상호작용 요소(HUD 버튼 등)는 PlayGame에서 safe-area-inset으로 별도 보정한다.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function Feature4PlayPage() {
  return <PlayGame />;
}
