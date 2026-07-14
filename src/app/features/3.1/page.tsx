import type { Metadata } from "next";
import Stellar2App from "@/features/feature-3/stellar2/Stellar2App";

export const metadata: Metadata = {
  title: "스텔라펫2 — Space Joops",
  description:
    "알에서 부화하는 줍스 2세대. 진화 분기·훈련 미니게임·도감·이벤트가 추가된 개선판.",
};

export default function Feature31Page() {
  return <Stellar2App />;
}
