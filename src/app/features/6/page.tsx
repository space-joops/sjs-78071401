import type { Metadata } from "next";
import JoopsOdyssey from "@/features/feature-6/components/JoopsOdyssey";

export const metadata: Metadata = {
  title: "줍스 오디세이 — Space Joops",
  description:
    "케슬러 신드롬에 맞서 우주쓰레기를 청소하는 애완 우주 생명체 '줍스'를 키우는 영속성 궤도 비행 게임",
};

export default function Feature6Page() {
  return <JoopsOdyssey />;
}
