import type { Metadata } from "next";
import VersionPicker from "@/features/feature-1/VersionPicker";

export const metadata: Metadata = {
  title: "줍줍스 — Space Joops",
  description:
    "케슬러 신드롬의 시대, 우주쓰레기를 먹고 자라는 애완 생명체 줍스. 줍줍스1과 줍줍스2 중 선택해 플레이하세요.",
};

export default function Feature1Page() {
  return <VersionPicker />;
}
