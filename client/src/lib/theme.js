import { useEffect, useState } from "react";

// Light/dark theme. The choice is remembered per browser; first visit follows the system setting.
const KEY = 'unievents_theme';
const system = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const saved = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
export const applyTheme = (t) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0d0b21' : '#f5f4fa');
};
export const initTheme = () => applyTheme(saved() || system());

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || saved() || system());
  useEffect(() => applyTheme(theme), [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch {}
      return next;
    });
  return [theme, toggle];
}
