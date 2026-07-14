import type { Metadata } from "next";
import PixelLab from "@/features/feature-1/pixel/PixelLab";

export const metadata: Metadata = {
  title: "픽셀 랩 — 줍스 스네이크 에셋",
  description:
    "16비트 슈퍼패미컴 스타일의 줍스 스네이크 픽셀 에셋: 16x16 스프라이트, 꿀꺽 성장 데모, 이미지 생성 AI 프롬프트.",
};

export default function PixelLabPage() {
  return <PixelLab />;
}
