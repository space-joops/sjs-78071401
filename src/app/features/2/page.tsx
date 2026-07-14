import type { Metadata } from "next";
import JoopsApp from "@/features/feature-2/components/JoopsApp";

export const metadata: Metadata = {
  title: "줍스 키우기 — Space Joops",
  description:
    "케슬러 신드롬 시대, 지구 궤도를 도는 애완 생명체 줍스와 함께 우주쓰레기를 청소하는 게임",
};

export default function Feature2Page() {
  return <JoopsApp />;
}
