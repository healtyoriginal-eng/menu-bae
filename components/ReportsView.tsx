"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ReportsViewProps {
  restaurantId?: string;
}

interface BestSellerItem {
  name: string;
  qty: number;
  totalRevenue: number;
}

export function ReportsView({
  restaurantId = "9435081d-0f91-4ae5-97aa-30df127d569d",
}: ReportsViewProps) {
  const [period, setPeriod] = useState<string>("today");
  const [loading, setLoading] = useState(true);
  const [totalOmzet, setTotalOmzet] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchReports() {
      try {
        let timeFilter: Date | null = new Date();
        if (period === "today") {
          timeFilter.setHours(0, 0, 0, 0);
        } else if (period === "7days") {
          timeFilter.setDate(timeFilter.getDate() - 7);
        } else if (period === "month") {
          timeFilter.setDate(1);
          timeFilter.setHours(0, 0, 0, 0);
        } else {
          timeFilter = null;
        }

        let query = supabase
          .from("orders")
          .select("id, total, order_status, payment_status, created_at, items:order_items(*)")
          .eq("restaurant_id", restaurantId);

        if (timeFilter) {
          query = query.gte("created_at", timeFilter.toISOString());
        }

        const { data, error } = await query;
        if (!isMounted) return;
        if (error) throw error;

        if (data) {
          const validOrders = data.filter(
            (o) => o.payment_status === "paid" || o.order_status === "completed"
          );

          const omzet = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
          const orderCount = validOrders.length;
          const avg = orderCount > 0 ? Math.round(omzet / orderCount) : 0;

          setTotalOmzet(omzet);
          setTotalOrders(orderCount);
          setAvgOrderValue(avg);

          const itemMap: { [name: string]: { qty: number; revenue: number } } = {};
          for (const order of validOrders) {
            const items =
              (order.items as Array<{
                product_name: string;
                quantity: number;
                subtotal: number;
              }>) || [];
            for (const it of items) {
              if (!itemMap[it.product_name]) {
                itemMap[it.product_name] = { qty: 0, revenue: 0 };
              }
              itemMap[it.product_name].qty += it.quantity;
              itemMap[it.product_name].revenue += it.subtotal;
            }
          }

          const sortedBestSellers = Object.keys(itemMap)
            .map((name) => ({
              name,
              qty: itemMap[name].qty,
              totalRevenue: itemMap[name].revenue,
            }))
            .sort((a, b) => b.qty - a.qty);

          setBestSellers(sortedBestSellers);
        }
      } catch (err) {
        if (isMounted) console.error("Gagal memuat laporan:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchReports();

    return () => {
      isMounted = false;
    };
  }, [restaurantId, period]);

  // Export CSV sederhana
  function handleExportCSV() {
    if (bestSellers.length === 0) {
      alert("Belum ada data penjualan untuk diekspor.");
      return;
    }

    let csv = "Menu,Jumlah Terjual (Porsi),Total Omzet (Rp)\n";
    bestSellers.forEach((b) => {
      csv += `"${b.name}",${b.qty},${b.totalRevenue}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `laporan-penjualan-${period}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold text-[#171717]">Laporan & Analitik Penjualan</h3>
          <p className="mt-1 text-sm text-gray-500">
            Pantau performa omzet harian, transaksi per meja, dan menu paling laris.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#E87532]"
          >
            <option value="today">Hari Ini</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="month">Bulan Ini</option>
            <option value="all">Semua Waktu</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs text-gray-400">Total Omzet ({period === "today" ? "Hari Ini" : period})</p>
          <h4 className="my-2 text-2xl font-black text-gray-900">
            {loading ? "..." : formatRupiah(totalOmzet)}
          </h4>
          <p className="text-[11px] text-gray-400">{totalOrders} transaksi berhasil</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs text-gray-400">Rata-rata Nilai Pesanan</p>
          <h4 className="my-2 text-2xl font-black text-gray-900">
            {loading ? "..." : formatRupiah(avgOrderValue)}
          </h4>
          <p className="text-[11px] text-gray-400">Per meja / pesanan</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs text-gray-400">Menu Terlaris</p>
          <h4 className="my-2 text-lg font-bold text-gray-900 truncate">
            {loading ? "..." : bestSellers[0]?.name || "Belum ada transaksi"}
          </h4>
          <p className="text-[11px] text-gray-400">
            {bestSellers[0] ? `${bestSellers[0].qty} Porsi Terjual` : "Menunggu pesanan"}
          </p>
        </div>
      </div>

      {/* Best Seller Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
          <h4 className="font-bold text-gray-900 text-sm">Peringkat Menu Makanan & Minuman Terlaris</h4>
          <span className="text-xs text-gray-400 font-semibold">{bestSellers.length} Menu Terjual</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Memuat data analitik...</div>
        ) : bestSellers.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center p-6">
            <span className="text-4xl">📊</span>
            <p className="mt-3 text-sm font-semibold text-gray-700">Belum ada transaksi pada periode ini</p>
            <p className="mt-1 text-xs text-gray-400 max-w-sm">
              Setelah pelanggan menyelesaikan pemesanan dan pembayaran, statistik menu favorit dan grafik omzet akan tampil di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                  <th className="pb-3 w-12">No</th>
                  <th className="pb-3">Nama Menu</th>
                  <th className="pb-3 text-center">Porsi Terjual</th>
                  <th className="pb-3 text-right">Kontribusi Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bestSellers.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition">
                    <td className="py-3 font-bold text-gray-400">#{idx + 1}</td>
                    <td className="py-3 font-bold text-gray-900">{item.name}</td>
                    <td className="py-3 text-center">
                      <span className="rounded-full bg-orange-100/70 px-2.5 py-0.5 font-black text-[#E87532]">
                        {item.qty} porsi
                      </span>
                    </td>
                    <td className="py-3 text-right font-black text-gray-900">
                      {formatRupiah(item.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
