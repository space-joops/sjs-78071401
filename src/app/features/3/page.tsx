import type { Metadata } from "next";
import JoopsApp from "@/features/feature-3/JoopsApp";

export const metadata: Metadata = {
  title: "줍스 오비탈 — Space Joops",
  description:
    "케슬러 신드롬의 지구 궤도에서 우주쓰레기를 먹고 자라는 애완 생명체 줍스를 보살피고 훈련시키세요.",
};

export default function Feature3Page() {
  return <JoopsApp />;
}
