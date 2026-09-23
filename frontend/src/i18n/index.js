import { createContext, useContext, useState, useCallback, useEffect } from "react";
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

export const LANG_CODES = LANGS.map((l) => l.code);

const DICTS = { en, vi, mn, kk, ky, zh };
const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("atf_lang") || "en");
  const [urlLang, setUrlLang] = useState(null);
  const setLang = useCallback((code) => {
    localStorage.setItem("atf_lang", code);
    setLangState(code);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback(
    (key) => DICTS[lang]?.[key] ?? DICTS.en[key] ?? key,
    [lang]
  );
  const lp = useCallback(
    (path) => (urlLang ? `/${urlLang}${path === "/" ? "" : path}` : path),
    [urlLang]
  );
  return <LangCtx.Provider value={{ lang, setLang, t, lp, urlLang, setUrlLang }}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);
