import type { Metadata } from "next";
import JoopsSnakeGame from "@/features/feature-9/JoopsSnakeGame";

export const metadata: Metadata = {
  title: "줍스 스네이크 — Space Joops",
  description: "우주쓰레기를 먹고 성장하는 줍스의 궤도 비행 아케이드 게임",
};

export default function Feature9Page() {
  return <JoopsSnakeGame />;
}
