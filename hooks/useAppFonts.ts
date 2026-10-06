import i18n from "@/app/i18n/i18n";
import { useSyncExternalStore } from "react";

export type FontBase = "Pretendard" | "PretendardJP";

const baseFor = (language: string | undefined): FontBase =>
  language === "ja" ? "PretendardJP" : "Pretendard";

// One shared subscription instead of a useTranslation() inside every AppText: each of those
// registered its own i18n listeners, and AppText is on every screen many times over.
let currentBase = baseFor(i18n.language);
const listeners = new Set<() => void>();

i18n.on("languageChanged", (language: string) => {
  const next = baseFor(language);
  if (next === currentBase) return;
  currentBase = next;
  listeners.forEach((listener) => listener());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => currentBase;

export function useAppFonts() {
  return { sans: useSyncExternalStore(subscribe, getSnapshot) };
}
