import type { Metadata } from "next";
import ArchiveScreen from "@/features/feature-7/components/ArchiveScreen";

export const metadata: Metadata = {
  title: "우주쓰레기 도감 — Space Joops",
  description:
    "스푸트니크 파편부터 테슬라 로드스터까지, 실제 우주 역사 기반 레전더리 쓰레기를 수집하는 아카이브",
};

export default function Feature7Page() {
  return <ArchiveScreen />;
}
