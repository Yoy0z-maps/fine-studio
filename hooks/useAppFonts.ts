import { useTranslation } from "react-i18next";

export function useAppFonts() {
  const { i18n } = useTranslation();
  const isJa = i18n.language === "ja";

  return {
    sans: isJa ? "PretendardJP" : "Pretendard",
  };
}
