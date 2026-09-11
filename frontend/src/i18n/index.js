import { createContext, useContext, useState, useCallback } from "react";
import en from "./en";
import vi from "./vi";
import mn from "./mn";
import kk from "./kk";
import ky from "./ky";
import zh from "./zh";

export const LANGS = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
  { code: "mn", label: "MN" },
  { code: "kk", label: "KK" },
  { code: "ky", label: "KY" },
  { code: "zh", label: "中文" },
];

const DICTS = { en, vi, mn, kk, ky, zh };
const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("atf_lang") || "en");
  const setLang = (code) => {
    localStorage.setItem("atf_lang", code);
    setLangState(code);
  };
  const t = useCallback(
    (key) => DICTS[lang]?.[key] ?? DICTS.en[key] ?? key,
    [lang]
  );
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);
