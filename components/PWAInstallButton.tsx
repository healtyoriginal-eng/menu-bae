"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeToDisplayMode(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getDisplayModeSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getServerSnapshot() {
  return false;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const isStandalone = useSyncExternalStore(
    subscribeToDisplayMode,
    getDisplayModeSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      alert(
        "Untuk memasang aplikasi MENU BAE di Layar Kasir / Dapur:\n\n• Di Chrome/Edge PC: Klik ikon 'Install' di ujung kanan bilah URL browser.\n• Di Tablet / HP: Tekan tombol Menu browser (titik 3) lalu pilih 'Tambahkan ke Layar Utama' (Add to Home Screen)."
      );
    }
  }

  return (
    <button
      onClick={handleInstall}
      className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-[#E87532] hover:text-[#E87532] transition active:scale-95"
      title="Pasang MENU BAE di Tablet Dapur / Kasir untuk tampilan Fullscreen tanpa bilah browser"
    >
      <span>📲</span>
      <span>Pasang App</span>
    </button>
  );
}
