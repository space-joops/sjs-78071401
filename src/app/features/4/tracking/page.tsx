import type { Metadata } from "next";
import TrackingScreen from "@/features/feature-4/components/TrackingScreen";

export const metadata: Metadata = {
  title: "관제 센터 — 줍스 오비트",
  description: "줍스의 실시간 궤도와 위치, 교신 일정을 확인하는 관제 화면",
};

export default function Feature4TrackingPage() {
  return <TrackingScreen />;
}
