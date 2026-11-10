"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ClosingOrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  payment_method: string;
  payment_status: "unpaid" | "paid";
  order_status: "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  notes?: string | null;
  created_at: string;
}

interface ClosingShiftModalProps {
  orders: ClosingOrderRecord[];
  restaurantName?: string;
  restaurantId?: string;
  onClose: () => void;
  onResetSuccess: () => void;
}

export function ClosingShiftModal({
  orders,
  restaurantName = "Burjobae",
  restaurantId = "9435081d-0f91-4ae5-97aa-30df127d569d",
  onClose,
  onResetSuccess,
}: ClosingShiftModalProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "print_preview">("summary");
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("58mm");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const now = new Date();
  const formattedDateTime = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }) + " • " + now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

  // Financial Calculations
  const totalOrders = orders.length;
  const completedOrders = orders.filter(
    (o) => o.order_status === "completed" || o.payment_status === "paid"
  );
  const unpaidOrders = orders.filter(
    (o) => o.payment_status !== "paid" && o.order_status !== "completed"
  );

  const totalOmzet = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalUnpaidAmount = unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const cashOrders = completedOrders.filter((o) => o.payment_method === "cash");
  const cashOmzet = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const onlineOrders = completedOrders.filter(
    (o) => o.payment_method === "online" || o.payment_method === "qris" || o.payment_method === "transfer"
  );
  const onlineOmzet = onlineOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const avgOrderValue = totalOrders > 0 ? Math.round(totalOmzet / (completedOrders.length || 1)) : 0;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Action 1: Selesaikan Semua Pesanan Menggantung (Tutup Shift Aman)
  const handleCloseShiftNormal = async () => {
    setIsProcessing(true);
    setActionMessage(null);
    try {
      // Tandai semua pesanan yang belum selesai menjadi completed
      const pendingIds = orders
        .filter((o) => o.order_status !== "completed")
        .map((o) => o.id);

      if (pendingIds.length > 0) {
        await supabase
          .from("orders")
          .update({ order_status: "completed", updated_at: new Date().toISOString() })
          .in("id", pendingIds);
      }

      // Reset semua status meja menjadi available
      await supabase
        .from("dining_tables")
        .update({ status: "available" })
        .eq("restaurant_id", restaurantId);

      // Broadcast update ke semua channel
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.send({
        type: "broadcast",
        event: "shift_closed",
        payload: { timestamp: new Date().toISOString() },
      });

      setActionMessage("✓ Shift kasir berhasil ditutup! Semua meja siap digunakan.");
      setTimeout(() => {
        onResetSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Gagal tutup shift:", err);
      setActionMessage("Gagal menutup shift. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Action 2: Hapus Bersih Data Pesanan Uji Coba (Reset ke 0)
  const handlePurgeAllDemoOrders = async () => {
    setIsProcessing(true);
    setActionMessage(null);
    try {
      // 1. Hapus semua order_items
      await supabase
        .from("order_items")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // 2. Hapus semua orders untuk restoran ini
      await supabase
        .from("orders")
        .delete()
        .eq("restaurant_id", restaurantId);

      // 3. Reset meja ke available
      await supabase
        .from("dining_tables")
        .update({ status: "available" })
        .eq("restaurant_id", restaurantId);

      // 4. Broadcast realtime event
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.send({
        type: "broadcast",
        event: "orders_purged",
        payload: { timestamp: new Date().toISOString() },
      });

      setActionMessage("✓ Semua pesanan demo berhasil dibersihkan! Database kembali 0.");
      setTimeout(() => {
        onResetSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Gagal menghapus data demo:", err);
      setActionMessage("Gagal membersihkan data pesanan.");
    } finally {
      setIsProcessing(false);
      setShowConfirmPurge(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl my-auto text-gray-900 border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-[#171717] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-xl text-rose-400">
              🔒
            </span>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                Tutup Kasir & Rekap Harian (End of Day)
              </h3>
              <p className="text-xs text-gray-400">
                {formattedDateTime}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-3 px-3 transition border-b-2 ${
              activeTab === "summary"
                ? "border-[#E87532] text-[#E87532]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            📊 Ringkasan Keuangan Shift
          </button>
          <button
            onClick={() => setActiveTab("print_preview")}
            className={`pb-3 px-3 transition border-b-2 ${
              activeTab === "print_preview"
                ? "border-[#E87532] text-[#E87532]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            🖨️ Cetak Struk Rekap (Z-Report)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {actionMessage && (
            <div
              className={`rounded-2xl p-4 text-xs font-bold ${
                actionMessage.startsWith("✓")
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {actionMessage}
            </div>
          )}

          {activeTab === "summary" ? (
            <>
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-orange-50/80 p-4 border border-orange-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Total Omzet
                  </span>
                  <p className="mt-1 text-lg font-black text-[#E87532]">
                    {formatRupiah(totalOmzet)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {completedOrders.length} transaksi selesai
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50/80 p-4 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Tunai (Laci Kasir)
                  </span>
                  <p className="mt-1 text-lg font-black text-emerald-700">
                    {formatRupiah(cashOmzet)}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    {cashOrders.length} pembayaran tunai
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50/80 p-4 border border-purple-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    QRIS Dinamis
                  </span>
                  <p className="mt-1 text-lg font-black text-purple-700">
                    {formatRupiah(onlineOmzet)}
                  </p>
                  <p className="text-[10px] text-purple-600 font-semibold mt-0.5">
                    {onlineOrders.length} bayar via QRIS
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Total Pesanan
                  </span>
                  <p className="mt-1 text-lg font-black text-gray-800">
                    {totalOrders} Pesanan
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Rata-rata {formatRupiah(avgOrderValue)}
                  </p>
                </div>
              </div>

              {/* Warning if there are unpaid orders */}
              {unpaidOrders.length > 0 && (
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">
                      Ada {unpaidOrders.length} Pesanan yang Belum Lunas ({formatRupiah(totalUnpaidAmount)})
                    </p>
                    <p className="text-amber-700 mt-0.5">
                      Pastikan kasir sudah menagih pembayaran atau mengubah statusnya sebelum shift ditutup.
                    </p>
                  </div>
                </div>
              )}

              {/* Order List Table Mini */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">
                    Daftar Transaksi Shift Ini ({orders.length})
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Restoran: {restaurantName}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
                  {orders.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      Belum ada transaksi di shift ini.
                    </div>
                  ) : (
                    orders.map((ord) => (
                      <div key={ord.id} className="p-3 flex items-center justify-between hover:bg-gray-50/50">
                        <div className="flex items-center gap-2.5">
                          <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-[#E87532]">
                            {ord.notes || "Meja"}
                          </span>
                          <div>
                            <p className="font-bold text-gray-900">
                              {ord.order_number} • <span className="font-normal">{ord.customer_name}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(ord.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} •{" "}
                              {ord.payment_method === "online" ? "QRIS Otomatis" : "Tunai Kasir"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatRupiah(ord.total)}</p>
                          <span
                            className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              ord.payment_status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {ord.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons Section */}
              <div className="space-y-3 pt-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-800">
                    Pilihan Tindakan Tutup Kasir:
                  </h4>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {/* Opsi 1: Tutup Shift Normal */}
                    <button
                      onClick={handleCloseShiftNormal}
                      disabled={isProcessing}
                      className="rounded-xl bg-[#171717] px-4 py-3 text-left text-white hover:bg-gray-800 transition active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span>🔒</span>
                        <span className="text-xs font-bold">Tutup Shift & Kosongkan Meja</span>
                      </div>
                      <p className="mt-1 text-[10px] text-gray-400">
                        Selesaikan pesanan aktif, reset meja jadi hijau, dan simpan omzet ke laporan.
                      </p>
                    </button>

                    {/* Opsi 2: Cetak Z-Report */}
                    <button
                      onClick={() => setActiveTab("print_preview")}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2">
                        <span>🖨️</span>
                        <span className="text-xs font-bold">Cetak Rekap Z-Report</span>
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">
                        Cetak struk penutupan kasir fisik untuk arsip setoran shift toko.
                      </p>
                    </button>
                  </div>

                  {/* Opsi 3: Reset Bersih Demo */}
                  <div className="pt-2 border-t border-gray-200">
                    {!showConfirmPurge ? (
                      <button
                        onClick={() => setShowConfirmPurge(true)}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition underline underline-offset-2 flex items-center gap-1"
                      >
                        <span>🗑️</span>
                        <span>Ingin reset bersih semua pesanan uji coba / demo ke nol? Klik di sini</span>
                      </button>
                    ) : (
                      <div className="rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-xs text-rose-900 space-y-2">
                        <p className="font-bold">
                          ⚠️ Konfirmasi Hapus Bersih Pesanan Demo:
                        </p>
                        <p className="text-[11px] text-rose-700">
                          Tindakan ini akan menghapus permanen seluruh <strong>{orders.length} pesanan demo</strong> yang ada di database agar sistem siap dipakai transaksi nyata dari 0.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handlePurgeAllDemoOrders}
                            disabled={isProcessing}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
                          >
                            {isProcessing ? "Menghapus..." : "Ya, Hapus Bersih Semua"}
                          </button>
                          <button
                            onClick={() => setShowConfirmPurge(false)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Print Preview Z-Report Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Ukuran Kertas Thermal:</span>
                  <button
                    onClick={() => setPaperWidth("58mm")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      paperWidth === "58mm"
                        ? "bg-[#E87532] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    58mm (Kecil)
                  </button>
                  <button
                    onClick={() => setPaperWidth("80mm")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      paperWidth === "80mm"
                        ? "bg-[#E87532] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    80mm (Standar)
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition flex items-center gap-1.5"
                >
                  <span>🖨️</span>
                  <span>Cetak Struk Sekarang</span>
                </button>
              </div>

              {/* Printable Area */}
              <div className="flex justify-center bg-gray-100 p-4 rounded-2xl border border-gray-200">
                <div
                  id="printable-z-report"
                  className={`${
                    paperWidth === "58mm" ? "w-[58mm]" : "w-[80mm]"
                  } bg-white p-4 shadow-md text-gray-900 font-mono text-[11px] leading-tight border border-gray-300`}
                >
                  {/* Struk Header */}
                  <div className="text-center pb-2 border-b border-dashed border-gray-400">
                    <p className="font-black text-sm uppercase tracking-wider">{restaurantName}</p>
                    <p className="text-[10px] text-gray-600">LAPORAN TUTUP KASIR (Z-REPORT)</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">{formattedDateTime}</p>
                    <p className="text-[9px] text-gray-500">Kasir: Shift Manager / Owner</p>
                  </div>

                  {/* Summary Omzet */}
                  <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>TOTAL OMZET:</span>
                      <span>{formatRupiah(totalOmzet)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[10px]">
                      <span>Tunai (Cash):</span>
                      <span>{formatRupiah(cashOmzet)} ({cashOrders.length}x)</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[10px]">
                      <span>QRIS Dinamis:</span>
                      <span>{formatRupiah(onlineOmzet)} ({onlineOrders.length}x)</span>
                    </div>
                    {unpaidOrders.length > 0 && (
                      <div className="flex justify-between text-rose-600 text-[10px]">
                        <span>Belum Lunas:</span>
                        <span>{formatRupiah(totalUnpaidAmount)} ({unpaidOrders.length}x)</span>
                      </div>
                    )}
                  </div>

                  {/* Stat Pesanan */}
                  <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>Total Transaksi:</span>
                      <span>{totalOrders} pesanan</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pesanan Lunas:</span>
                      <span>{completedOrders.length} pesanan</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rata-rata/Nota:</span>
                      <span>{formatRupiah(avgOrderValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status Meja:</span>
                      <span>Semua Kosong</span>
                    </div>
                  </div>

                  {/* Footer Struk */}
                  <div className="text-center pt-3 text-[9px] text-gray-500 space-y-0.5">
                    <p>*** SHIFT DITUTUP DENGAN SUKSES ***</p>
                    <p>MENU BAE 2.0 • RESTAURANT MANAGEMENT</p>
                    <p className="pt-1">Tanda Tangan Kasir:</p>
                    <div className="h-10 border-b border-dashed border-gray-300 w-32 mx-auto" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            MENU BAE 2.0 • Sistem Penutupan Shift Kasir
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
          >
            Tutup Jendela
          </button>
        </div>
      </div>
    </div>
  );
}

