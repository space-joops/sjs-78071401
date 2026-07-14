import type { Metadata } from "next";
import HubScreen from "@/features/feature-4/components/HubScreen";

export const metadata: Metadata = {
  title: "줍스 오비트 — Space Joops",
  description: "우주쓰레기를 먹는 애완 줍스와 함께하는 지구 궤도 대청소",
};

export default function Feature4Page() {
  return <HubScreen />;
}
