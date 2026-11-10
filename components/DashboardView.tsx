"use client";

import { useEffect, useState } from "react";
import { Restaurant } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useOnlineDateTime } from "@/lib/timeUtils";

interface DashboardViewProps {
  restaurant: Restaurant | null;
  productCount: number;
  categoryCount: number;
  dbConnected: boolean | null;
  onNavigate: (sectionName: string) => void;
}

export function DashboardView({
  restaurant,
  productCount,
  categoryCount,
  dbConnected,
  onNavigate,
}: DashboardViewProps) {
  const restaurantName = restaurant?.name || "Burjobae";
  const restaurantId = restaurant?.id || "9435081d-0f91-4ae5-97aa-30df127d569d";

  const { dayDateString, timeString } = useOnlineDateTime();

  const [todayOmzet, setTodayOmzet] = useState<number>(0);
  const [todayOrderCount, setTodayOrderCount] = useState<number>(0);

  interface ActiveOrderSummary {
    id: string;
    order_number: string;
    customer_name: string;
    table_number: string;
    total: number;
    order_status: string;
    payment_status: string;
    created_at: string;
    items?: Array<{ product_name: string; quantity: number }>;
  }

  const [activeOrders, setActiveOrders] = useState<ActiveOrderSummary[]>([]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchStats() {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Fetch Today stats (omzet & count)
        const { data, error } = await supabase
          .from("orders")
          .select("total, payment_status, order_status")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", today.toISOString());

        if (error) return;

        if (isMounted && data) {
          setTodayOrderCount(data.length);
          const omzet = data
            .filter((o) => o.payment_status === "paid" || o.order_status === "completed")
            .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          setTodayOmzet(omzet);
        }

        // 2. Fetch Active Orders untuk widget realtime
        const { data: activeData } = await supabase
          .from("orders")
          .select("id, order_number, customer_name, notes, total, order_status, payment_status, created_at, items:order_items(product_name, quantity)")
          .eq("restaurant_id", restaurantId)
          .in("order_status", ["new", "accepted", "preparing", "ready"])
          .order("created_at", { ascending: false });

        if (isMounted && activeData) {
          setActiveOrders(
            activeData.map((o) => ({
              id: o.id,
              order_number: o.order_number,
              customer_name: o.customer_name || "Pelanggan",
              table_number: o.notes || "Meja",
              total: o.total,
              order_status: o.order_status,
              payment_status: o.payment_status,
              created_at: o.created_at,
              items: o.items as Array<{ product_name: string; quantity: number }>,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      }
    }

    fetchStats();

    // Subscribe Realtime channel untuk update instan di dashboard
    const channel = supabase
      .channel(`restaurant-${restaurantId}-dashboard`)
      .on("broadcast", { event: "new_order" }, () => {
        fetchStats();
      })
      .on("broadcast", { event: "order_status_updated" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl bg-linear-to-r from-orange-500 via-[#E87532] to-amber-500 p-8 text-white shadow-lg shadow-orange-500/15 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Operasional Aktif
            </span>

            {/* Hari & Tanggal Online Live */}
            <div className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3.5 py-1 text-xs font-medium backdrop-blur-md text-white shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>📅</span>
              <span className="font-bold">{dayDateString || "Memuat hari & tanggal..."}</span>
              {timeString && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="font-mono font-bold text-amber-200 tracking-wider">
                    {timeString}
                  </span>
                </>
              )}
            </div>
          </div>

          <h3 className="mt-3.5 text-2xl font-black tracking-tight sm:text-3xl">
            Selamat datang, Owner {restaurantName}! 👋
          </h3>
          <p className="mt-1 text-sm text-orange-100">
            Berikut ringkasan operasional dan katalog menu restoran Anda hari ini.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 sm:self-center">
          <button
            onClick={() => onNavigate("Daftar Menu")}
            className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#E87532] shadow-sm transition hover:bg-orange-50"
          >
            + Tambah Menu
          </button>
          <button
            onClick={() => onNavigate("Meja")}
            className="rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20"
          >
            🪑 Kelola Meja
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Pesanan",
            value: `${todayOrderCount} Pesanan`,
            note: "Pesanan masuk hari ini",
            icon: "🧾",
            color: "text-blue-600 bg-blue-50",
            action: () => onNavigate("Pesanan"),
          },
          {
            title: "Penjualan",
            value: formatRupiah(todayOmzet),
            note: "Omzet hari ini",
            icon: "💰",
            color: "text-emerald-600 bg-emerald-50",
            action: () => onNavigate("Laporan"),
          },
          {
            title: "Menu & Produk",
            value: `${productCount} Menu`,
            note: `${categoryCount} Kategori aktif`,
            icon: "🍜",
            color: "text-orange-600 bg-orange-50",
            action: () => onNavigate("Daftar Menu"),
          },
          {
            title: "Meja Restoran",
            value: "Siap Digunakan",
            note: "QR Code meja unik",
            icon: "🪑",
            color: "text-purple-600 bg-purple-50",
            action: () => onNavigate("Meja"),
          },
        ].map((item) => (
          <div
            key={item.title}
            onClick={item.action}
            className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-[#E87532]/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">{item.title}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${item.color}`}>
                {item.icon}
              </span>
            </div>
            <h4 className="my-3 text-2xl font-black text-[#171717] group-hover:text-[#E87532] transition">
              {item.value}
            </h4>
            <p className="text-xs text-gray-400">{item.note}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Orders Activity & Restaurant Info */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Aktivitas Pesanan */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">Aktivitas Pesanan Realtime</h3>
                  {activeOrders.length > 0 && (
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-black text-[#E87532]">
                      {activeOrders.length} Aktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">Pesanan dari pelanggan via scan QR meja</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("Layar Dapur")}
              className="flex items-center gap-1 text-xs font-bold text-[#E87532] hover:underline"
            >
              <span>🍳</span>
              <span>Buka Layar Dapur KDS →</span>
            </button>
          </div>

          {activeOrders.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center text-center p-8">
              <span className="text-5xl">🧾</span>
              <p className="mt-4 font-bold text-gray-800">Belum ada pesanan aktif</p>
              <p className="mt-1 text-xs text-gray-400 max-w-sm">
                Ketika pelanggan melakukan scan QR di meja dan memesan makanan, pesanan akan langsung muncul secara realtime di sini.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {activeOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => onNavigate("Pesanan")}
                  className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50/50 p-4 transition hover:border-[#E87532]/60 hover:bg-orange-50/40 cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-xs font-black text-[#E87532]">
                      {ord.table_number.replace(/Meja\s*/i, "M-")}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-gray-900 group-hover:text-[#E87532] transition">
                          {ord.customer_name}
                        </p>
                        <span className="font-mono text-[10px] text-gray-400">
                          {ord.order_number}
                        </span>
                        <span className="text-[10px] text-gray-400">• {ord.table_number}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {ord.items && ord.items.length > 0
                          ? ord.items.map((it) => `${it.quantity}x ${it.product_name}`).join(", ")
                          : "Memproses menu..."}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">
                      {formatRupiah(ord.total)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                          ord.payment_status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ord.payment_status === "paid" ? "✓ Lunas" : "Belum Bayar"}
                      </span>
                      <span className="rounded bg-orange-100 px-1.5 py-0.2 text-[9px] font-bold text-[#E87532]">
                        {ord.order_status === "new" && "Baru 🔔"}
                        {ord.order_status === "accepted" && "Diterima"}
                        {ord.order_status === "preparing" && "Dimasak 🍳"}
                        {ord.order_status === "ready" && "Siap Antar 🚀"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informasi Restoran & Status Sistem */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-4">
            Informasi Restoran
          </h3>

          <div className="mt-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <span className="text-gray-400">Nama Restoran</span>
              <span className="font-bold text-gray-900">{restaurantName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <span className="text-gray-400">Slug Web</span>
              <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                /{restaurant?.slug || "burjobae"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <span className="text-gray-400">Database Supabase</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {dbConnected ? "Terhubung (Live)" : "Menghubungkan..."}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <span className="text-gray-400">Status Operasional</span>
              <span className="font-bold text-emerald-600">
                {restaurant?.is_active ? "Buka & Aktif" : "Nonaktif"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-gray-400">Platform</span>
              <span className="font-black text-[#E87532]">MENU BAE 2.0</span>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-orange-50/70 p-3.5 text-xs text-orange-950">
            <p className="font-bold text-[#E87532]">💡 Tips Penggunaan</p>
            <p className="mt-1 text-gray-600 leading-relaxed">
              Pastikan Anda sudah mengisi daftar kategori dan menu makanan sebelum mencetak QR Code meja.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

