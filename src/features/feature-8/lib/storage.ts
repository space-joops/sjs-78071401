import type { JoopsSave } from "./game";

const SAVE_KEY = "sjs-feature-8-joops-save-v1";

export function loadSave(): JoopsSave | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<JoopsSave>;
    if (
      data.v !== 1 ||
      !Number.isFinite(data.angle) ||
      !Number.isFinite(data.savedAt) ||
      !Number.isFinite(data.level) ||
      !Number.isFinite(data.exp) ||
      !Number.isFinite(data.hp) ||
      !(data.homeAngle === null || Number.isFinite(data.homeAngle))
    ) {
      return null;
    }
    return data as JoopsSave;
  } catch {
    return null;
  }
}

export function persistSave(save: JoopsSave): void {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...save, savedAt: Date.now() }),
    );
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 게임 진행을 막지 않는다.
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // 무시
  }
}
