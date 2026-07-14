import type { Metadata } from "next";
import HubScreen from "@/features/feature-11/components/HubScreen";

export const metadata: Metadata = {
  title: "줍스 스웜 — Space Joops",
  description: "자석 줍스로 파편 폭풍을 빨아들이는 75초 궤도 대청소",
};

export default function Feature11Page() {
  return <HubScreen />;
}
