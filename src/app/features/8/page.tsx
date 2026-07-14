import type { Metadata } from "next";
import JoopsGame from "@/features/feature-8/JoopsGame";

export const metadata: Metadata = {
  title: "줍스 궤도 관제 | Space Joops",
  description:
    "궤도를 도는 우주 다마고치 줍스 — 방치 비행, 상공 진입 액션, 치료 케어 MVP 프로토타입",
};

export default function Feature8Page() {
  return <JoopsGame />;
}
