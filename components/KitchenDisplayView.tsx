"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { playKitchenChimeTriple } from "@/lib/audioUtils";

interface OrderItem {
  id?: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
}

interface KitchenOrder {
  id: string;
  order_number: string;
  customer_name: string;
  notes?: string | null; // Nomor meja (misal: "Meja 01")
  total: number;
  order_status: "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  payment_status: "unpaid" | "paid";
  payment_method: string;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
}

interface KitchenDisplayViewProps {
  restaurantId?: string;
  restaurantName?: string;
  isStandalone?: boolean;
}

export function KitchenDisplayView({
  restaurantId = "9435081d-0f91-4ae5-97aa-30df127d569d",
  restaurantName = "Burjobae",
  isStandalone = false,
}: KitchenDisplayViewProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "new" | "preparing" | "ready" | "completed">("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Hitung waktu sejak dibuat (relatif)
  const getElapsedTime = (isoDate: string) => {
    if (!lastUpdated) return "Baru saja";
    const diffMs = lastUpdated.getTime() - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "< 1 mnt lalu";
    if (diffMins >= 60) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} jam ${diffMins % 60} mnt`;
    }
    return `${diffMins} mnt lalu`;
  };

  const loadKitchenOrders = useCallback(async () => {
    try {
      // Ambil pesanan hari ini yang relevan untuk dapur
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: true }); // Dapur memprioritaskan pesanan tertua lebih dulu (FIFO)

      if (error) throw error;
      setOrders(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Gagal memuat pesanan dapur:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadKitchenOrders();

    // Timer setiap 30 detik untuk memperbarui tampilan waktu tunggu kartu
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);

    // Subscribe Realtime Channel untuk pesanan baru & update status
    const channel = supabase
      .channel(`restaurant-${restaurantId}`)
      .on("broadcast", { event: "new_order" }, () => {
        if (soundEnabled) {
          playKitchenChimeTriple();
        }
        loadKitchenOrders();
      })
      .on("broadcast", { event: "order_status_updated" }, (payload) => {
        if (payload?.payload?.order_id) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.payload.order_id
                ? {
                    ...o,
                    ...(payload.payload.status ? { order_status: payload.payload.status } : {}),
                    ...(payload.payload.payment_status ? { payment_status: payload.payload.payment_status } : {}),
                  }
                : o
            )
          );
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, soundEnabled, loadKitchenOrders]);

  // Handler mengubah status dari Dapur (Mulai Masak / Makanan Matang / Selesai Saji)
  async function handleUpdateKitchenStatus(orderId: string, nextStatus: KitchenOrder["order_status"]) {
    setActionLoadingId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ order_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      // Update state lokal
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, order_status: nextStatus } : o))
      );

      // Broadcast Realtime ke:
      // 1. Pelanggan (agar stepper di HP langsung update)
      // 2. Kasir & Dashboard Utama
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.send({
        type: "broadcast",
        event: "order_status_updated",
        payload: { order_id: orderId, status: nextStatus },
      });
    } catch (err) {
      console.error("Gagal update status dapur:", err);
      alert("Gagal memperbarui status ke server. Silakan coba lagi.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Hitung ringkasan status antrean dapur
  const countNew = orders.filter((o) => o.order_status === "new" || o.order_status === "accepted").length;
  const countPreparing = orders.filter((o) => o.order_status === "preparing").length;
  const countReady = orders.filter((o) => o.order_status === "ready").length;
  const countCompleted = orders.filter((o) => o.order_status === "completed").length;
  const countActiveTotal = countNew + countPreparing + countReady;

  // Filter pesanan sesuai tab aktif
  const filteredOrders = orders.filter((o) => {
    if (activeTab === "active") {
      return o.order_status === "new" || o.order_status === "accepted" || o.order_status === "preparing" || o.order_status === "ready";
    }
    if (activeTab === "new") return o.order_status === "new" || o.order_status === "accepted";
    if (activeTab === "preparing") return o.order_status === "preparing";
    if (activeTab === "ready") return o.order_status === "ready";
    if (activeTab === "completed") return o.order_status === "completed";
    return true;
  });

  return (
    <div className={`space-y-6 ${isStandalone ? "min-h-screen bg-[#121316] text-white p-4 md:p-8" : ""}`}>
      {/* Top Banner / KDS Header */}
      <div className={`rounded-3xl p-6 ${isStandalone ? "bg-[#1c1e24] border border-gray-800" : "bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white shadow-lg"}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-2xl shadow-md">
              🍳
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  Layar Dapur (KDS)
                </h2>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Kitchen Display System {restaurantName} • Pesanan pelanggan langsung masuk seketika
              </p>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tombol Bunyi Bell */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playKitchenChimeTriple();
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition border ${
                soundEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
              }`}
              title="Aktifkan / Matikan suara bel saat ada pesanan baru"
            >
              <span>{soundEnabled ? "🔔" : "🔕"}</span>
              <span>{soundEnabled ? "Suara Bel Aktif" : "Suara Senyap"}</span>
            </button>

            {/* Test Bell */}
            <button
              onClick={() => playKitchenChimeTriple()}
              className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800/80 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
              title="Coba bunyikan bel dapur"
            >
              <span>🔊</span>
              <span>Tes Bel</span>
            </button>

            {/* Refresh Manual */}
            <button
              onClick={() => loadKitchenOrders()}
              className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800/80 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
              title="Muat ulang data dapur"
            >
              <span>🔄</span>
              <span>Perbarui</span>
            </button>

            {/* Standalone Fullscreen Link */}
            {!isStandalone && (
              <Link
                href="/dapur"
                target="_blank"
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition"
                title="Buka layar dapur di tab penuh (cocok untuk tablet/monitor dapur)"
              >
                <span>🖥️</span>
                <span>Mode Fullscreen</span>
              </Link>
            )}

            {isStandalone && (
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 px-3.5 py-2 text-xs font-bold text-gray-300 transition"
              >
                <span>←</span>
                <span>Dashboard Utama</span>
              </Link>
            )}
          </div>
        </div>

        {/* Counter Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-800">
          <div
            onClick={() => setActiveTab("new")}
            className={`cursor-pointer rounded-2xl p-3.5 border transition ${
              activeTab === "new"
                ? "bg-rose-500/20 border-rose-500/60 ring-1 ring-rose-500"
                : "bg-gray-800/50 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-rose-300 font-bold">
              <span>📋 Perlu Dimasak</span>
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
            </div>
            <p className="text-2xl font-black text-white mt-1">{countNew}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Pesanan baru masuk</p>
          </div>

          <div
            onClick={() => setActiveTab("preparing")}
            className={`cursor-pointer rounded-2xl p-3.5 border transition ${
              activeTab === "preparing"
                ? "bg-orange-500/20 border-orange-500/60 ring-1 ring-orange-500"
                : "bg-gray-800/50 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-orange-300 font-bold">
              <span>🍳 Sedang Dimasak</span>
              <span className="h-2 w-2 rounded-full bg-orange-400" />
            </div>
            <p className="text-2xl font-black text-white mt-1">{countPreparing}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Sedang diracik koki</p>
          </div>

          <div
            onClick={() => setActiveTab("ready")}
            className={`cursor-pointer rounded-2xl p-3.5 border transition ${
              activeTab === "ready"
                ? "bg-amber-500/20 border-amber-500/60 ring-1 ring-amber-500"
                : "bg-gray-800/50 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
              <span>🔔 Siap & Diantar</span>
              <span className="h-2 w-2 rounded-full bg-amber-400" />
            </div>
            <p className="text-2xl font-black text-white mt-1">{countReady}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Matang, tunggu pelayan</p>
          </div>

          <div
            onClick={() => setActiveTab("completed")}
            className={`cursor-pointer rounded-2xl p-3.5 border transition ${
              activeTab === "completed"
                ? "bg-emerald-500/20 border-emerald-500/60 ring-1 ring-emerald-500"
                : "bg-gray-800/50 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
              <span>✨ Selesai Disajikan</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white mt-1">{countCompleted}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Sudah sampai di meja</p>
          </div>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("active")}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === "active"
                ? "bg-[#E87532] text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            🔥 Semua Antrean Dapur ({countActiveTotal})
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === "new"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            📋 Baru ({countNew})
          </button>
          <button
            onClick={() => setActiveTab("preparing")}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === "preparing"
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            🍳 Sedang Dimasak ({countPreparing})
          </button>
          <button
            onClick={() => setActiveTab("ready")}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === "ready"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            🔔 Siap Diantar ({countReady})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === "completed"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            ✨ Selesai Hari Ini ({countCompleted})
          </button>
        </div>

        <p className="text-[11px] text-gray-400">
          Diperbarui: {lastUpdated ? lastUpdated.toLocaleTimeString("id-ID") : "--:--:--"}
        </p>
      </div>

      {/* Grid of Kitchen Tickets */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-[#E87532] border-t-transparent" />
            <p className="text-xs font-semibold text-gray-400">Sinkronisasi pesanan dapur...</p>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={`flex min-h-72 flex-col items-center justify-center rounded-3xl p-8 text-center border ${isStandalone ? "border-gray-800 bg-[#17191e]" : "border-gray-200 bg-white"}`}>
          <span className="text-6xl mb-3">🍳✨</span>
          <h3 className="text-lg font-black text-gray-800 dark:text-white">
            Tidak ada pesanan pada filter ini
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mt-1">
            {activeTab === "active"
              ? "Semua pesanan dapur telah selesai disajikan. Dapur dalam kondisi bersih dan siap menerima pesanan berikutnya!"
              : "Belum ada tiket pesanan dengan status ini."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {filteredOrders.map((ord) => {
            const isNew = ord.order_status === "new" || ord.order_status === "accepted";
            const isPreparing = ord.order_status === "preparing";
            const isReady = ord.order_status === "ready";
            const isCompleted = ord.order_status === "completed";
            const isLoading = actionLoadingId === ord.id;

            return (
              <div
                key={ord.id}
                className={`flex flex-col justify-between rounded-3xl border transition shadow-sm overflow-hidden ${
                  isNew
                    ? "border-rose-300 bg-rose-50/30 dark:bg-[#1f1517] dark:border-rose-900/60 ring-2 ring-rose-400/30"
                    : isPreparing
                    ? "border-orange-300 bg-orange-50/30 dark:bg-[#201813] dark:border-orange-900/60 ring-2 ring-orange-400/30"
                    : isReady
                    ? "border-amber-300 bg-amber-50/30 dark:bg-[#201b13] dark:border-amber-900/60 ring-2 ring-amber-400/30"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181a1f] opacity-80"
                }`}
              >
                {/* Header Tiket KDS */}
                <div
                  className={`p-4 border-b ${
                    isNew
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40"
                      : isPreparing
                      ? "bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/40"
                      : isReady
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40"
                      : "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Badge Meja Besar */}
                      <span
                        className={`inline-block rounded-xl px-3 py-1 text-sm font-black tracking-wide shadow-xs ${
                          isNew
                            ? "bg-rose-600 text-white"
                            : isPreparing
                            ? "bg-orange-600 text-white"
                            : isReady
                            ? "bg-amber-600 text-white"
                            : "bg-gray-700 text-gray-200"
                        }`}
                      >
                        📍 {ord.notes || "Meja"}
                      </span>
                      <p className="mt-1.5 text-xs font-bold text-gray-900 dark:text-white">
                        {ord.customer_name || "Pelanggan"}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        No. {ord.order_number}
                      </p>
                    </div>

                    <div className="text-right">
                      {/* Timer Waktu Tunggu Tiket */}
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                          ⏱ {getElapsedTime(ord.created_at)}
                        </span>
                      </div>
                      <span
                        className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          isNew
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                            : isPreparing
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200"
                            : isReady
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                        }`}
                      >
                        {isNew && "📋 Baru Masuk"}
                        {isPreparing && "🍳 Dimasak"}
                        {isReady && "🔔 Siap Antar"}
                        {isCompleted && "✓ Selesai"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Daftar Menu / Item yang Harus Dimasak */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-72">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Daftar Masakan ({ord.items?.length || 0} Menu):
                  </p>

                  <div className="space-y-2">
                    {ord.items && ord.items.length > 0 ? (
                      ord.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl bg-white dark:bg-gray-800/80 p-3 border border-gray-100 dark:border-gray-700/60 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/60 text-xs font-black text-orange-600 dark:text-orange-400">
                              {item.quantity}x
                            </span>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
                                {item.product_name}
                              </p>
                              {/* Highlight Catatan Khusus Dapur jika ada */}
                              {item.notes ? (
                                <div className="mt-1.5 flex items-start gap-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2 border border-amber-200 dark:border-amber-800/50">
                                  <span className="text-xs">⚠️</span>
                                  <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200 italic leading-tight">
                                    Catatan: {item.notes}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic">Rincian menu tidak tersedia.</p>
                    )}
                  </div>
                </div>

                {/* Footer Tombol Aksi Dapur */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-2">
                  {/* Status Pembayaran Mini Note */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
                    <span>Status Bayar:</span>
                    <span
                      className={`font-bold ${
                        ord.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {ord.payment_status === "paid" ? "✓ Lunas" : "Belum Lunas"}
                    </span>
                  </div>

                  {/* Tombol Step 1: Mulai Masak */}
                  {isNew && (
                    <button
                      disabled={isLoading}
                      onClick={() => handleUpdateKitchenStatus(ord.id, "preparing")}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-600 py-3 text-xs font-black text-white shadow-md active:scale-[0.99] transition disabled:opacity-50"
                    >
                      <span>🍳</span>
                      <span>{isLoading ? "Menyimpan..." : "Mulai Masak Pesanan"}</span>
                    </button>
                  )}

                  {/* Tombol Step 2: Makanan Siap & Diantar */}
                  {isPreparing && (
                    <button
                      disabled={isLoading}
                      onClick={() => handleUpdateKitchenStatus(ord.id, "ready")}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 py-3 text-xs font-black text-white shadow-md active:scale-[0.99] transition disabled:opacity-50"
                    >
                      <span>🔔</span>
                      <span>{isLoading ? "Menyimpan..." : "Makanan Matang (Siap Diantar)"}</span>
                    </button>
                  )}

                  {/* Tombol Step 3: Selesai Disajikan ke Meja */}
                  {isReady && (
                    <button
                      disabled={isLoading}
                      onClick={() => handleUpdateKitchenStatus(ord.id, "completed")}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-black text-white shadow-md active:scale-[0.99] transition disabled:opacity-50"
                    >
                      <span>✨</span>
                      <span>{isLoading ? "Menyimpan..." : "Selesai Disajikan ke Meja"}</span>
                    </button>
                  )}

                  {/* Jika sudah selesai */}
                  {isCompleted && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-600">✓ Sudah tersaji di meja</span>
                      <button
                        disabled={isLoading}
                        onClick={() => handleUpdateKitchenStatus(ord.id, "ready")}
                        className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                      >
                        Batal Selesai
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
