import type { Metadata, Viewport } from "next";
import JoopsGameV2 from "@/features/feature-1/v2/JoopsGameV2";

export const metadata: Metadata = {
  title: "줍줍스2 — Space Joops",
  description:
    "히트스톱·콤보 체인·니어미스로 손맛을 살리고 모바일 조작을 개선한 줍줍스 개선판.",
};

// 공유 파일인 layout.tsx를 건드리지 않고 세이프에어리어를 켜는 방법.
// viewportFit: "cover"가 있어야 env(safe-area-inset-*)가 실제 값을 갖는다.
export const viewport: Viewport = {
  themeColor: "#050a16",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function JoopJoops2Page({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string }>;
}) {
  const { debug } = await searchParams;
  return <JoopsGameV2 debug={debug === "1"} />;
}
