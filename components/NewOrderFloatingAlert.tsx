"use client";

import { playKitchenChimeTriple } from "@/lib/audioUtils";

export interface UnacceptedOrder {
  id: string;
  order_number: string;
  customer_name: string;
  table_number: string;
  total: number;
}

interface NewOrderFloatingAlertProps {
  orders: UnacceptedOrder[];
  onAcceptOrder: (orderId: string) => void;
  onViewKitchen: () => void;
}

export function NewOrderFloatingAlert({
  orders,
  onAcceptOrder,
  onViewKitchen,
}: NewOrderFloatingAlertProps) {
  if (orders.length === 0) return null;

  const current = orders[0]; // Tampilkan pesanan paling mendesak

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="fixed top-5 right-5 z-50 w-full max-w-sm animate-in slide-in-from-top-4 duration-300">
      <div className="relative overflow-hidden rounded-3xl border-2 border-orange-400 bg-white p-5 shadow-2xl shadow-orange-500/25 ring-4 ring-orange-500/10">
        {/* Glowing Top Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-amber-500 via-[#E87532] to-rose-500 animate-pulse" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-2xl shadow-inner">
              <span className="animate-bounce">🔔</span>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-rose-500 text-[10px] font-black text-white items-center justify-center">
                  {orders.length}
                </span>
              </span>
            </div>

            <div>
              <h4 className="font-black text-sm text-gray-900 tracking-tight">
                PESANAN BARU MASUK!
              </h4>
              <p className="text-[11px] font-medium text-gray-400">
                Menunggu konfirmasi kasir / dapur
              </p>
            </div>
          </div>

          <button
            onClick={() => playKitchenChimeTriple()}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-orange-50 hover:text-[#E87532] hover:border-orange-300 transition"
            title="Bunyikan bel lagi"
          >
            🔊
          </button>
        </div>

        {/* Order Details Card */}
        <div className="mt-4 rounded-2xl bg-orange-50/70 p-3.5 border border-orange-100 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-white border border-orange-200 px-2 py-0.5 text-xs font-black text-[#E87532]">
              {current.table_number || "Meja"}
            </span>
            <span className="font-mono text-xs font-bold text-gray-500">
              {current.order_number}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-700 pt-1">
            <span className="font-medium text-gray-500">Pemesan:</span>
            <span className="font-bold text-gray-900">{current.customer_name}</span>
          </div>

          <div className="flex items-center justify-between border-t border-orange-100/80 pt-1.5">
            <span className="font-medium text-gray-500">Total Tagihan:</span>
            <span className="text-sm font-black text-[#E87532]">
              {formatRupiah(current.total)}
            </span>
          </div>
        </div>

        {orders.length > 1 && (
          <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">
            + Ada {orders.length - 1} pesanan baru lainnya menunggu
          </p>
        )}

        {/* Action Button */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAcceptOrder(current.id)}
            className="flex-1 rounded-xl bg-[#E87532] py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:bg-[#d46525] active:scale-95 transition"
          >
            ✓ Terima & Masak (Hilangkan Notif)
          </button>
          <button
            onClick={onViewKitchen}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition"
            title="Buka Layar Dapur"
          >
            Layar Dapur →
          </button>
        </div>
      </div>
    </div>
  );
}

