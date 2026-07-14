"use client";

// 줍스 오비탈 루트 컴포넌트.
// 스토어 로드 → (첫 방문) 입양 화면 → 플레이/관제 화면 전환 + 부재 중 보고서.

import { useEffect, useState, useSyncExternalStore } from "react";
import { getJoopsStore } from "./store";
import IntroScreen from "./IntroScreen";
import PlayView from "./PlayView";
import TrackView from "./TrackView";
import AwayReportModal from "./AwayReportModal";

export default function JoopsApp() {
  const store = getJoopsStore();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"play" | "track">("play");
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);

  useEffect(() => {
    store.load();
    setReady(true);
    const save = () => store.saveNow();
    const onVis = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [store]);

  return (
    <div className="min-h-dvh h-dvh flex flex-col overflow-hidden bg-[#02040a] text-white font-sans">
      {!ready ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span className="text-4xl animate-pulse" aria-hidden>
            🛰️
          </span>
          <p className="text-sm text-white/60">궤도에 접속하는 중…</p>
        </div>
      ) : !snap ? (
        <IntroScreen onCreate={(name, home) => store.create(name, home)} />
      ) : view === "play" ? (
        <PlayView snap={snap} onOpenTrack={() => setView("track")} />
      ) : (
        <TrackView snap={snap} onBack={() => setView("play")} />
      )}

      {ready && snap && store.awayReport && (
        <AwayReportModal
          report={store.awayReport}
          name={snap.st.name}
          onClose={() => store.dismissAwayReport()}
        />
      )}
    </div>
  );
}
