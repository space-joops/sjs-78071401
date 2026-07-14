"use client";
// 전체화면 토글 — 표준 Fullscreen API + iOS/구형 Safari용 webkit 접두사 대응.
// iPhone Safari는 일반 탭에서 div 등 임의 요소의 Fullscreen API를 지원하지 않아
// (video 요소만 가능) supported=false로 계산되고, 호출측은 버튼 자체를 숨기면 된다.
import { useCallback, useEffect, useState, type RefObject } from "react";

type FSDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FSElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const fsElement = () =>
  document.fullscreenElement ?? (document as FSDocument).webkitFullscreenElement ?? null;

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const doc = document as FSDocument;
    setSupported(Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled));
    const onChange = () => setActive(fsElement() !== null);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const enter = useCallback(() => {
    const el = ref.current as FSElement | null;
    if (!el || fsElement()) return;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
      p?.catch?.(() => {});
    } catch {
      // 사용자 제스처 없이 호출되는 등 거부되는 경우 조용히 무시
    }
  }, [ref]);

  const exit = useCallback(() => {
    const doc = document as FSDocument;
    try {
      const p = document.exitFullscreen ? document.exitFullscreen() : doc.webkitExitFullscreen?.();
      p?.catch?.(() => {});
    } catch {
      // no-op
    }
  }, []);

  const toggle = useCallback(() => {
    if (fsElement()) exit();
    else enter();
  }, [enter, exit]);

  return { supported, active, enter, exit, toggle };
}
