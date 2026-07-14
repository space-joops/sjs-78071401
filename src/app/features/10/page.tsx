import type { Metadata } from "next";
import HubScreen from "@/features/feature-10/components/HubScreen";

export const metadata: Metadata = {
  title: "점프 러너 — Space Joops",
  description: "달 표면을 질주하는 줍스와 함께 우주쓰레기를 뛰어넘는 점프 러너",
};

export default function Feature10Page() {
  return <HubScreen />;
}
