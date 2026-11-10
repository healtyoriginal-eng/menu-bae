"use client";

import { useState } from "react";

export interface ActiveOrderTrackingData {
  id: string;
  order_number: string;
  customer_name: string;
  table_number: string;
  total: number;
  payment_method: string;
  payment_status: "unpaid" | "paid";
  order_status: "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  created_at: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price?: number;
    notes?: string | null;
  }>;
}

interface CustomerOrderTrackerProps {
  order: ActiveOrderTrackingData;
  restaurantName: string;
  restaurantPhone?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQris?: () => void;
  onClearActiveOrder?: () => void;
}

export function CustomerOrderTracker({
  order,
  restaurantName,
  restaurantPhone,
  isOpen,
  onClose,
  onOpenQris,
  onClearActiveOrder,
}: CustomerOrderTrackerProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "items">("timeline");

  if (!isOpen) return null;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const steps = [
    {
      key: "new",
      title: "Pesanan Diterima",
      desc: "Pesanan Anda masuk ke sistem antrean dapur.",
      icon: "📋",
      activeStates: ["new", "accepted", "preparing", "ready", "completed"],
    },
    {
      key: "preparing",
      title: "Sedang Dimasak",
      desc: "Koki dapur sedang menyiapkan & meracik masakan Anda.",
      icon: "🍳",
      activeStates: ["preparing", "ready", "completed"],
    },
    {
      key: "ready",
      title: "Makanan Siap & Sedang Diantar",
      desc: `Makanan selesai dimasak & sedang dibawa ke ${order.table_number}.`,
      icon: "🔔",
      activeStates: ["ready", "completed"],
    },
    {
      key: "completed",
      title: "Pesanan Selesai Disajikan",
      desc: "Semua hidangan telah disajikan. Selamat menikmati!",
      icon: "✨",
      activeStates: ["completed"],
    },
  ];

  const isOrderCompleted = order.order_status === "completed";

  const currentStepIndex =
    order.order_status === "completed"
      ? 3
      : order.order_status === "ready"
      ? 2
      : order.order_status === "preparing"
      ? 1
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs transition">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl text-gray-900 border border-gray-100 overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-orange-500 via-[#E87532] to-amber-500 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg backdrop-blur-md">
              🛵
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight text-white">
                  Live Tracking Pesanan
                </h3>
                {isOrderCompleted ? (
                  <span className="rounded-full bg-emerald-500/30 border border-emerald-300/40 px-2 py-0.5 text-[10px] font-bold text-white">
                    Selesai ✓
                  </span>
                ) : (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
                )}
              </div>
              <p className="text-[11px] text-orange-100 font-medium">
                {order.table_number} • No. {order.order_number}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-5 pt-2.5 gap-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`pb-2.5 px-1 transition border-b-2 ${
              activeTab === "timeline"
                ? "border-[#E87532] text-[#E87532]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            ⏱ Status Pengerjaan
          </button>
          <button
            onClick={() => setActiveTab("items")}
            className={`pb-2.5 px-1 transition border-b-2 ${
              activeTab === "items"
                ? "border-[#E87532] text-[#E87532]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            📋 Rincian Menu ({order.items?.length || 0})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === "timeline" ? (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`rounded-2xl p-3.5 border flex items-center justify-between transition ${
                  isOrderCompleted
                    ? "bg-emerald-50/90 border-emerald-200"
                    : "bg-orange-50/80 border-orange-200/80"
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Status Saat Ini:
                  </span>
                  <h4
                    className={`text-sm font-black mt-0.5 ${
                      isOrderCompleted ? "text-emerald-700" : "text-[#E87532]"
                    }`}
                  >
                    {order.order_status === "new" && "Pesanan Diterima Dapur 📋"}
                    {order.order_status === "accepted" && "Dikonfirmasi Kasir ✓"}
                    {order.order_status === "preparing" && "Sedang Dimasak di Dapur 🍳"}
                    {order.order_status === "ready" && "Makanan Siap & Sedang Diantar 🔔"}
                    {order.order_status === "completed" && "Pesanan Selesai Disajikan ✨"}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 block">Total Tagihan:</span>
                  <span className="text-xs font-black text-gray-900">
                    {formatRupiah(order.total)}
                  </span>
                </div>
              </div>

              {/* Notifikasi Pengingat Pembayaran saat Pesanan Selesai */}
              {isOrderCompleted && (
                order.payment_status === "paid" ? (
                  <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-500/40 p-4 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white text-xl shadow-xs">
                        ✓
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                            Pembayaran Lunas
                          </h4>
                          <span className="rounded-full bg-emerald-200/90 px-2 py-0.5 text-[9px] font-black text-emerald-800">
                            ✓ Lunas
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-emerald-800 leading-relaxed font-medium">
                          Terima kasih! Pembayaran untuk {order.table_number} telah lunas dan semua hidangan telah disajikan. Selamat menikmati hidangan Burjobae! 🙏✨
                        </p>
                        {onClearActiveOrder && (
                          <button
                            type="button"
                            onClick={() => {
                              onClearActiveOrder();
                              onClose();
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-400 bg-white py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 active:scale-95 transition"
                          >
                            <span>👋</span>
                            <span>Selesai Bersantap & Pulang (Tutup Sesi Meja)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-amber-50 border-2 border-amber-400 p-4 shadow-md animate-in fade-in duration-300 ring-2 ring-amber-400/20">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white text-xl shadow-xs">
                        ⚠️
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                            Pengingat: Belum Dibayar
                          </h4>
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-black text-amber-900">
                            Belum Bayar
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-amber-900 leading-relaxed font-medium">
                          Semua makanan sudah selesai disajikan di meja Anda. Mohon selesaikan pembayaran tagihan sebesar{" "}
                          <strong className="font-black text-amber-950 underline">{formatRupiah(order.total)}</strong>{" "}
                          di kasir (Tunai / QRIS) atau bayar langsung secara online via QRIS di bawah ini.
                        </p>
                        {onOpenQris && (
                          <button
                            type="button"
                            onClick={onOpenQris}
                            className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-md hover:from-orange-600 hover:to-amber-600 transition active:scale-[0.99]"
                          >
                            <span>📱</span>
                            <span>Bayar Sekarang via QRIS ({formatRupiah(order.total)})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Visual Timeline Stepper */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {steps.map((st, idx) => {
                  const isPassed = isOrderCompleted ? true : idx < currentStepIndex;
                  const isCurrent = !isOrderCompleted && idx === currentStepIndex;

                  return (
                    <div key={st.key} className="relative flex items-start gap-3.5">
                      {/* Step Circle Marker */}
                      <span
                        className={`absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ring-4 ring-white ${
                          isOrderCompleted
                            ? "bg-emerald-500 text-white"
                            : isCurrent
                            ? "bg-[#E87532] text-white shadow-md shadow-orange-500/30 scale-110"
                            : isPassed
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-200 text-gray-400"
                        }`}
                      >
                        {isOrderCompleted || isPassed ? "✓" : st.icon}
                      </span>

                      <div className="flex-1 pt-0.5">
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-xs font-bold transition ${
                              isOrderCompleted
                                ? "text-gray-900"
                                : isCurrent
                                ? "text-[#E87532]"
                                : isPassed
                                ? "text-gray-900"
                                : "text-gray-400"
                            }`}
                          >
                            {st.title}
                          </p>

                          {/* Badge Status per Step */}
                          {isCurrent && (
                            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-black text-[#E87532]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#E87532] animate-ping" />
                              Diproses
                            </span>
                          )}

                          {isOrderCompleted && idx === steps.length - 1 && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                              ✓ Selesai
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                          {st.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Pembayaran Card */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold block">Status Pembayaran:</span>
                  <span
                    className={`inline-block mt-0.5 text-xs font-bold ${
                      order.payment_status === "paid"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {order.payment_status === "paid" ? "✓ Lunas" : "Belum Bayar (Kasir / QRIS)"}
                  </span>
                </div>

                {order.payment_status !== "paid" && onOpenQris && (
                  <button
                    onClick={onOpenQris}
                    className="rounded-xl bg-[#E87532] px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-[#d46525] transition"
                  >
                    Bayar QRIS
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Items List View */
            <div className="space-y-2">
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white overflow-hidden text-xs">
                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">
                          <span className="text-[#E87532] mr-1">{it.quantity}x</span>
                          {it.product_name}
                        </p>
                        {it.notes && (
                          <p className="text-[10px] text-gray-400 italic mt-0.5">
                            * Catatan: {it.notes}
                          </p>
                        )}
                      </div>
                      {it.unit_price && (
                        <span className="text-gray-600 font-semibold text-right">
                          {formatRupiah(it.unit_price * it.quantity)}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400 text-xs">
                    Rincian menu sedang diproses oleh dapur.
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-orange-50/60 p-3 border border-orange-100 flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">Total Pembayaran:</span>
                <span className="text-base font-black text-[#E87532]">
                  {formatRupiah(order.total)}
                </span>
              </div>
            </div>
          )}

          {/* Quick Actions WhatsApp */}
          {restaurantPhone && (
            <a
              href={`https://wa.me/${restaurantPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `Halo ${restaurantName}! Saya dari ${order.table_number} (No. Pesanan: ${order.order_number}). Mau menanyakan pesanan saya. Terima kasih! 🙏`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-[0.99]"
            >
              <span>💬</span>
              <span>Hubungi Kasir via WhatsApp</span>
            </a>
          )}
        </div>

        {/* Footer Modal */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-[11px] text-gray-400">
            Realtime KDS Tracking • {restaurantName}
          </span>
          <div className="flex items-center gap-2">
            {isOrderCompleted && order.payment_status === "paid" && onClearActiveOrder && (
              <button
                onClick={() => {
                  onClearActiveOrder();
                  onClose();
                }}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-bold text-gray-700 hover:bg-gray-100 transition text-[11px]"
              >
                👋 Tutup Sesi
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl bg-[#171717] px-4 py-2 font-bold text-white hover:bg-gray-800 transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

