// Small helpers so the same React code works in the browser and inside the Android app.
import { useEffect } from "react";
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isApp = Capacitor.isNativePlatform();

// Address of the public website, used for links that must work outside the app (certificates).
export const publicUrl = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');

// The website keeps the sign-in for the browser tab only; the app keeps it until the user signs out.
export const store = isApp ? window.localStorage : window.sessionStorage;

// Browsers download the file. The app saves it and opens the share sheet (Drive, WhatsApp, Files…).
export async function saveFile(name, text) {
  if (!isApp) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: name, files: [uri] });
}

// Opens a page in the phone's browser (used where the app's web view cannot print).
export const openInBrowser = (url) => (isApp ? Browser.open({ url }) : window.open(url, '_blank', 'noopener'));

// Status bar icons: light on dark pages (home and sign-in open on a dark photo, or the dark theme),
// dark on light pages. Re-checked on every page change and theme switch.
export function useSystemBars(pathname) {
  useEffect(() => {
    if (!isApp) return;
    const apply = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      const darkTop = dark || !!document.querySelector('.site-nav, .auth-art');
      const style = (d) => (d ? SystemBarsStyle.Dark : SystemBarsStyle.Light);
      SystemBars.setStyle({ style: style(darkTop), bar: SystemBarType.StatusBar });
      SystemBars.setStyle({ style: style(dark), bar: SystemBarType.NavigationBar });
    };
    const frame = requestAnimationFrame(apply);
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, [pathname]);
}

// The Android back button goes back a page, and closes the app from the first page.
export function setupBackButton() {
  if (!isApp) return;
  App.addListener('backButton', ({ canGoBack }) => (canGoBack ? window.history.back() : App.exitApp()));
}
