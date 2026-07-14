import type { Metadata } from "next";
import PlayGame from "@/features/feature-10/components/PlayGame";

export const metadata: Metadata = {
  title: "점프 러너 플레이 — Space Joops",
  description: "탭으로 점프해 우주쓰레기를 넘고 별 조각을 모으는 러너 게임",
};

export default function Feature10PlayPage() {
  return <PlayGame />;
}
