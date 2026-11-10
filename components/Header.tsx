"use client";

import { PWAInstallButton } from "@/components/PWAInstallButton";
import { useOnlineDateTime } from "@/lib/timeUtils";

interface HeaderProps {
  active: string;
  restaurantName: string;
  onOpenMobileMenu?: () => void;
  onQuickAction?: () => void;
  quickActionLabel?: string;
}

export function Header({
  active,
  restaurantName,
  onOpenMobileMenu,
  onQuickAction,
  quickActionLabel,
}: HeaderProps) {
  const { dayDateString, timeString } = useOnlineDateTime();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-6 py-4 backdrop-blur-md md:px-10">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 md:hidden"
            aria-label="Buka navigasi"
          >
            ☰
          </button>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-[#171717]">{active}</h2>
            {dayDateString && (
              <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50/90 px-3 py-1 text-[11px] font-medium text-gray-700 shadow-2xs">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>📅</span>
                <span className="font-semibold">{dayDateString}</span>
                {timeString && (
                  <span className="font-mono text-[#E87532] font-bold">• {timeString}</span>
                )}
              </div>
            )}
          </div>
          <p className="hidden text-xs text-gray-400 sm:block">
            Kelola operasional restoran {restaurantName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <PWAInstallButton />

        <a
          href="/burjobae/meja-01"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-[#E87532] hover:text-[#E87532] transition"
          title="Buka tampilan menu pelanggan yang di-scan via QR meja"
        >
          <span>📱</span>
          <span>Buka Menu Pelanggan ↗</span>
        </a>

        {quickActionLabel && onQuickAction && (
          <button
            onClick={onQuickAction}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E87532] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d46525]"
          >
            <span>+</span>
            <span>{quickActionLabel}</span>
          </button>
        )}

        <div className="flex items-center gap-2 rounded-full border border-orange-200/70 bg-[#fff5ee] px-3.5 py-1.5 text-xs font-semibold text-[#E87532]">
          <span className="h-2 w-2 rounded-full bg-[#E87532]" />
          <span>{restaurantName}</span>
        </div>
      </div>
    </header>
  );
}

