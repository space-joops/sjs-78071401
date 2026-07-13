// ⚠️ 공유 파일 — 개별 기능 클로드는 이 파일을 수정하지 마세요.
// 버튼 문구/아이콘 변경은 자기 소유의 src/features/feature-<N>/config.ts에서 하세요.
import type { FeatureConfig } from "./types";
import feature1 from "./feature-1/config";
import feature2 from "./feature-2/config";
import feature3 from "./feature-3/config";
import feature4 from "./feature-4/config";
import feature5 from "./feature-5/config";
import feature6 from "./feature-6/config";
import feature7 from "./feature-7/config";
import feature8 from "./feature-8/config";
import feature9 from "./feature-9/config";

export type { FeatureConfig };

export const features: FeatureConfig[] = [
  feature1,
  feature2,
  feature3,
  feature4,
  feature5,
  feature6,
  feature7,
  feature8,
  feature9,
];
