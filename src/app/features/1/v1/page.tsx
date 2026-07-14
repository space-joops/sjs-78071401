import type { Metadata } from "next";
import JoopsGame from "@/features/feature-1/JoopsGame";

export const metadata: Metadata = {
  title: "줍줍스1 — Space Joops",
  description:
    "케슬러 신드롬의 시대, 우주쓰레기를 먹고 자라는 애완 생명체 줍스와 함께 지구 궤도를 청소하세요.",
};

export default function JoopJoops1Page() {
  return <JoopsGame />;
}
