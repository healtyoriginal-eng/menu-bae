"use client";

import { useState } from "react";

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
  notes?: string | null;
  total: number;
  order_status: string;
  payment_status: "unpaid" | "paid";
  payment_method: string;
  created_at: string;
  items?: OrderItem[];
}

interface ReceiptModalProps {
  order: OrderRecord;
  restaurantName: string;
  onClose: () => void;
}

export function ReceiptModal({
  order,
  restaurantName,
  onClose,
}: ReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("58mm");
  const [printType, setPrintType] = useState<"customer" | "kitchen">("customer");

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="flex flex-col items-center my-auto py-6">
        {/* Toolbar (Hidden when printing) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 w-full max-w-sm rounded-2xl bg-white p-3 shadow-lg no-print">
          <div className="flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setPrintType("customer")}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                printType === "customer"
                  ? "bg-[#E87532] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              🧾 Struk Kasir
            </button>
            <button
              onClick={() => setPrintType("kitchen")}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                printType === "kitchen"
                  ? "bg-[#171717] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              🍳 Tiket Dapur
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setPaperWidth("58mm")}
              className={`rounded-lg px-2 py-1 text-[11px] transition ${
                paperWidth === "58mm"
                  ? "bg-gray-200 text-gray-900 font-bold"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setPaperWidth("80mm")}
              className={`rounded-lg px-2 py-1 text-[11px] transition ${
                paperWidth === "80mm"
                  ? "bg-gray-200 text-gray-900 font-bold"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              80mm
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div
          id="printable-receipt"
          className={`${
            paperWidth === "58mm" ? "w-72" : "w-88"
          } rounded-2xl bg-white p-6 shadow-2xl text-gray-900 font-mono text-xs border border-gray-200 transition-all`}
        >
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400">
            <h2 className="text-base font-black tracking-wider uppercase">
              {restaurantName}
            </h2>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {printType === "customer"
                ? "Sistem Manajemen Restoran MENU BAE"
                : "TIKET PESANAN DAPUR (KDS)"}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {new Date(order.created_at).toLocaleDateString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {" • "}
              {new Date(order.created_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Info Transaksi */}
          <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-600">No. Nota:</span>
              <span className="font-bold">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lokasi/Meja:</span>
              <span className="font-black text-[#E87532]">
                {order.notes || "Meja 01"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pelanggan:</span>
              <span className="font-bold">{order.customer_name}</span>
            </div>
          </div>

          {/* Daftar Menu */}
          <div className="py-3 border-b-2 border-dashed border-gray-400 space-y-2">
            {order.items && order.items.length > 0 ? (
              order.items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span className="truncate pr-2">
                      <strong className="text-[#E87532] mr-1">{it.quantity}x</strong>
                      {it.product_name}
                    </span>
                    {printType === "customer" && (
                      <span className="shrink-0">{formatRupiah(it.subtotal)}</span>
                    )}
                  </div>
                  {printType === "customer" && (
                    <div className="text-[10px] text-gray-500">
                      <span>
                        {it.quantity} x {formatRupiah(it.unit_price)}
                      </span>
                    </div>
                  )}
                  {it.notes && (
                    <p className="text-[11px] font-semibold text-rose-600 bg-rose-50/70 p-1 rounded">
                      * Catatan: {it.notes}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-[10px]">
                Menu telah diproses
              </p>
            )}
          </div>

          {/* Total & Status Pembayaran (Only for Customer Receipt) */}
          {printType === "customer" ? (
            <div className="py-3 space-y-1.5 border-b-2 border-dashed border-gray-400">
              <div className="flex justify-between text-sm font-black pt-1">
                <span>TOTAL</span>
                <span className="text-[#E87532]">{formatRupiah(order.total)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>Pembayaran:</span>
                <span className="uppercase font-bold">
                  {order.payment_method === "cash"
                    ? "Kasir (Tunai/QRIS)"
                    : order.payment_method === "online" ||
                      order.payment_method === "qris"
                    ? "QRIS Dinamis (Online)"
                    : order.payment_method}
                </span>
              </div>
              <div className="flex justify-between text-[10px] pt-1">
                <span>Status Tagihan:</span>
                <span
                  className={`font-black uppercase ${
                    order.payment_status === "paid"
                      ? "text-emerald-700 font-bold"
                      : "text-rose-700 font-bold"
                  }`}
                >
                  {order.payment_status === "paid" ? "● LUNAS" : "○ BELUM BAYAR"}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2.5 text-center text-[10px] text-gray-500 border-b border-dashed border-gray-300">
              Segera siapkan dan antarkan ke {order.notes || "Meja 01"}
            </div>
          )}

          {/* Footer Ucapan Terima Kasih */}
          <div className="text-center pt-3 text-[10px] text-gray-500">
            <p>Terima Kasih Atas Kunjungan Anda!</p>
            <p className="mt-0.5 font-sans text-[9px] text-gray-400">
              Ditenagai oleh MENU BAE • Burjobae
            </p>
          </div>
        </div>

        {/* Action Buttons (Hidden when printing) */}
        <div className="mt-4 flex gap-2 w-full max-w-sm no-print">
          <button
            onClick={handlePrint}
            className="flex-1 rounded-xl bg-[#E87532] py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-[#d46525] active:scale-95 transition flex items-center justify-center gap-1.5"
          >
            <span>🖨️</span>
            <span>Cetak Struk Sekarang</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Print CSS isolation */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt,
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: ${paperWidth === "58mm" ? "58mm" : "80mm"} !important;
            border: none !important;
            box-shadow: none !important;
            padding: 8px !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
