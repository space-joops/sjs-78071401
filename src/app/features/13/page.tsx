import type { Metadata, Viewport } from "next";
import DeepOrbit from "@/features/feature-13/DeepOrbit";

export const metadata: Metadata = {
  title: "줍스 딥오비트 — Space Joops",
  description:
    "three.js 3D. 지구 저궤도를 비행하며 앞에서 다가오는 우주쓰레기를 삼키고 피하세요.",
};

export const viewport: Viewport = {
  themeColor: "#050a16",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function Feature13Page() {
  return <DeepOrbit />;
}
