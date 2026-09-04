import type { InitOptions } from "i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/app/i18n/locales/en.json";
import es from "@/app/i18n/locales/es.json";
import fr from "@/app/i18n/locales/fr.json";
import ja from "@/app/i18n/locales/ja.json";
import ko from "@/app/i18n/locales/ko.json";
import zh from "@/app/i18n/locales/zh.json";
import { getLocales } from "expo-localization";

const resources = {
  en: {
    common: en,
  },
  ko: {
    common: ko,
  },
  ja: {
    common: ja,
  },
  zh: {
    common: zh,
  },
  es: {
    common: es,
  },
  fr: {
    common: fr,
  },
};

const options: InitOptions = {
  resources,
  lng: getLocales()[0].languageCode ?? "en",
  fallbackLng: "en", // 번역 키가 없을 때
  ns: ["common"],
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
};

// eslint-disable-next-line import/no-named-as-default-member
void i18next.use(initReactI18next).init(options);

export default i18next;
