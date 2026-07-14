import type { Metadata } from "next";
import PlayGame from "@/features/feature-4/components/PlayGame";

export const metadata: Metadata = {
  title: "궤도 비행 — 줍스 오비트",
  description: "줍스를 조종해 우주쓰레기를 청소하는 궤도 비행 훈련",
};

export default function Feature4PlayPage() {
  return <PlayGame />;
}
