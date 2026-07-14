import type { Metadata } from "next";
import GameScreen from "@/features/feature-12/components/GameScreen";

export const metadata: Metadata = {
  title: "줍스 스위퍼 — Space Joops",
  description: "관성으로 미끄러지는 줍스 비행선으로 우주쓰레기를 쓸어 담는 물리 아케이드",
};

export default function Feature12Page() {
  return <GameScreen />;
}
