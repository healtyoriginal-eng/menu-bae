"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { playKitchenChimeTriple } from "@/lib/audioUtils";
import { ReceiptModal } from "@/components/ReceiptModal";
import { ClosingShiftModal } from "@/components/ClosingShiftModal";

interface OrderItem {
  id?: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
}

interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  notes?: string | null; // Nomor meja (misal: "Meja 01")
  total: number;
  order_status: "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  payment_status: "unpaid" | "paid";
  payment_method: string;
  created_at: string;
  items?: OrderItem[];
}

interface OrdersViewProps {
  restaurantId?: string;
  onOrderAccepted?: (orderId: string) => void;
}

export function OrdersView({
  restaurantId = "9435081d-0f91-4ae5-97aa-30df127d569d",
  onOrderAccepted,
}: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderRecord | null>(null);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Gagal memuat pesanan:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*, items:order_items(*)")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false });

        if (isMounted) {
          if (error) console.error("Gagal memuat pesanan:", error);
          setOrders(data || []);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Gagal memuat pesanan:", err);
          setLoading(false);
        }
      }
    }

    initialFetch();

    // Subscribe ke Realtime Channel untuk notifikasi pesanan masuk & status update
    const channel = supabase
      .channel(`restaurant-${restaurantId}`)
      .on("broadcast", { event: "new_order" }, () => {
        // Bunyikan bel 3 kali
        playKitchenChimeTriple();
        // Refresh daftar pesanan
        loadOrders();
      })
      .on("broadcast", { event: "order_status_updated" }, (payload) => {
        if (payload?.payload?.order_id) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.payload.order_id
                ? {
                    ...o,
                    ...(payload.payload.status ? { order_status: payload.payload.status } : {}),
                    ...(payload.payload.payment_status
                      ? { payment_status: payload.payload.payment_status }
                      : {}),
                  }
                : o
            )
          );
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [restaurantId, loadOrders]);

  async function handleUpdateStatus(orderId: string, nextStatus: OrderRecord["order_status"]) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ order_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, order_status: nextStatus } : o))
      );

      if (nextStatus === "preparing" && onOrderAccepted) {
        onOrderAccepted(orderId);
      }

      // Broadcast update ke pelanggan
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.send({
        type: "broadcast",
        event: "order_status_updated",
        payload: { order_id: orderId, status: nextStatus },
      });
    } catch (err) {
      console.error("Gagal update status pesanan:", err);
    }
  }

  async function handleTogglePayment(orderId: string, currentStatus: "unpaid" | "paid") {
    const nextStatus = currentStatus === "paid" ? "unpaid" : "paid";
    try {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: nextStatus } : o))
      );
    } catch (err) {
      console.error("Gagal update status pembayaran:", err);
    }
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredOrders = orders.filter((o) => {
    let matchTab = true;
    if (activeTab === "new") matchTab = o.order_status === "new" || o.order_status === "accepted";
    else if (activeTab === "preparing") matchTab = o.order_status === "preparing";
    else if (activeTab === "ready") matchTab = o.order_status === "ready";
    else if (activeTab === "completed") matchTab = o.order_status === "completed";

    if (!matchTab) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = o.order_number.toLowerCase().includes(q);
      const matchName = o.customer_name?.toLowerCase().includes(q);
      const matchTable = o.notes?.toLowerCase().includes(q);
      return matchNum || matchName || matchTable;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-[#171717]">Layar Dapur & Kasir (Realtime KDS)</h3>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Pesanan dari HP pelanggan akan muncul instan di sini dengan bunyi bel 3 kali.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => playKitchenChimeTriple()}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
            title="Uji coba suara lonceng bel 3 kali"
          >
            🔔 Tes Bel (3x)
          </button>
          <button
            onClick={loadOrders}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-800 hover:bg-gray-100 transition active:scale-95"
            title="Sinkronisasi ulang pesanan dari database"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setIsClosingModalOpen(true)}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition active:scale-95 flex items-center gap-1.5"
            title="Tutup Kasir harian & cetak rekap shift Z-Report"
          >
            <span>🔒</span>
            <span>Tutup Kasir / Reset Harian</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {[
            { key: "all", label: `Semua (${orders.length})` },
            { key: "new", label: `Pesanan Baru (${orders.filter((o) => o.order_status === "new" || o.order_status === "accepted").length})` },
            { key: "preparing", label: `Sedang Dimasak (${orders.filter((o) => o.order_status === "preparing").length})` },
            { key: "ready", label: `Siap Disajikan (${orders.filter((o) => o.order_status === "ready").length})` },
            { key: "completed", label: `Selesai (${orders.filter((o) => o.order_status === "completed").length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 transition ${
                activeTab === tab.key
                  ? "bg-[#E87532] text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pencarian Cepat */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Cari nota, pemesan, meja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-[#E87532] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <span className="text-5xl">🍳</span>
          <p className="mt-3 text-base font-bold text-gray-800">
            Tidak ada pesanan di kategori ini
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Setiap ada pelanggan yang memesan via scan QR meja, pesanan otomatis tampil di sini.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const isNew = order.order_status === "new" || order.order_status === "accepted";
            const isCooking = order.order_status === "preparing";
            const isReady = order.order_status === "ready";
            const isCompleted = order.order_status === "completed";

            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                  isNew
                    ? "border-orange-400 ring-2 ring-orange-300 shadow-orange-100"
                    : "border-gray-200"
                }`}
              >
                <div>
                  {/* Top Bar: Table & Number */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-black text-[#E87532]">
                          {order.notes || "Meja"}
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-400">
                          {order.order_number}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <p className="text-xs font-bold text-gray-900">
                          {order.customer_name}
                        </p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            order.payment_method === "online" ||
                            order.payment_method === "qris" ||
                            order.payment_method === "transfer"
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {order.payment_method === "online" ||
                          order.payment_method === "qris" ||
                          order.payment_method === "transfer"
                            ? "📱 QRIS Dinamis"
                            : "💵 Tunai / Kasir"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {new Date(order.created_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((it, idx) => (
                        <div key={idx} className="text-xs">
                          <div className="flex justify-between font-medium text-gray-800">
                            <span>
                              <strong className="text-[#E87532] mr-1.5">{it.quantity}x</strong>
                              {it.product_name}
                            </span>
                            <span className="text-gray-500">
                              {formatRupiah(it.unit_price * it.quantity)}
                            </span>
                          </div>
                          {it.notes && (
                            <p className="text-[11px] text-gray-400 italic pl-5">
                              * {it.notes}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic">Rincian menu diproses</p>
                    )}
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="mt-5 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="text-gray-500">Total:</span>
                    <span className="text-base font-black text-gray-900">
                      {formatRupiah(order.total)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {isNew && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "preparing")}
                        className="flex-1 rounded-xl bg-[#E87532] py-2 text-xs font-bold text-white shadow-xs hover:bg-[#d46525] active:scale-95 transition"
                      >
                        ✓ Terima & Masak
                      </button>
                    )}
                    {isCooking && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "ready")}
                        className="flex-1 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-600 active:scale-95 transition"
                      >
                        🔔 Makanan Siap
                      </button>
                    )}
                    {isReady && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "completed")}
                        className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
                      >
                        ✓ Sudah Diantar
                      </button>
                    )}
                    {isCompleted && (
                      <span className="flex-1 text-center py-2 text-xs font-bold text-gray-400 bg-gray-50 rounded-xl">
                        ✓ Selesai
                      </span>
                    )}

                    <button
                      onClick={() => handleTogglePayment(order.id, order.payment_status)}
                      className={`rounded-xl px-3 py-1 text-[11px] font-bold transition ${
                        order.payment_status === "paid"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                      title="Klik untuk ubah status lunas"
                    >
                      {order.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
                    </button>

                    <button
                      onClick={() => setSelectedOrderForReceipt(order)}
                      className="rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:border-[#E87532] hover:text-[#E87532] transition active:scale-95 flex items-center gap-1 shrink-0"
                      title="Cetak nota struk thermal"
                    >
                      <span>🖨️</span>
                      <span className="hidden sm:inline">Struk</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cetak Struk */}
      {selectedOrderForReceipt && (
        <ReceiptModal
          order={selectedOrderForReceipt}
          restaurantName="Burjobae"
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}

      {/* Modal Tutup Kasir / Reset Harian */}
      {isClosingModalOpen && (
        <ClosingShiftModal
          orders={orders}
          restaurantName="Burjobae"
          restaurantId={restaurantId}
          onClose={() => setIsClosingModalOpen(false)}
          onResetSuccess={() => {
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
