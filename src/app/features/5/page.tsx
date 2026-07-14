import type { Metadata } from "next";
import StellarPetApp from "@/features/feature-5/StellarPetApp";

export const metadata: Metadata = {
  title: "스텔라펫 — 우주쓰레기 힐링 게임 | Space Joops",
  description:
    "케슬러 신드롬의 시대, 우주쓰레기를 먹고 진화하는 나만의 스텔라펫과 함께 궤도를 청소하세요. 자리를 비워도 펫은 계속 유영합니다.",
};

export default function Feature5Page() {
  return <StellarPetApp />;
}
