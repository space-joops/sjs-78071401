import type { Metadata } from "next";
import PlayGame from "@/features/feature-11/components/PlayGame";

export const metadata: Metadata = {
  title: "줍스 스웜 · 플레이 — Space Joops",
  description: "드래그로 줍스를 조종해 우주쓰레기 파편을 빨아들이세요",
};

export default function Feature11PlayPage() {
  return <PlayGame />;
}
