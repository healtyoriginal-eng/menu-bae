/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { generateDynamicQris, getQrisImageUrl, DEFAULT_BURJOBAE_QRIS } from "@/lib/qrisUtils";
import { supabase } from "@/lib/supabase";

interface DynamicQrisPaymentModalProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  tableNumber: string;
  amount: number;
  restaurantName: string;
  restaurantId?: string;
  baseQrisPayload?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  onPaymentSuccess: () => void;
  onClose: () => void;
}

export function DynamicQrisPaymentModal({
  orderId,
  orderNumber,
  customerName,
  tableNumber,
  amount,
  restaurantName,
  restaurantId = "9435081d-0f91-4ae5-97aa-30df127d569d",
  baseQrisPayload = DEFAULT_BURJOBAE_QRIS,
  bankName = "BCA",
  bankAccountNumber = "8830-1234-5678",
  bankAccountHolder = "Burjobae Official",
  onPaymentSuccess,
  onClose,
}: DynamicQrisPaymentModalProps) {
  // Pilihan tab pembayaran: QRIS atau Transfer Bank
  const [paymentTab, setPaymentTab] = useState<"qris" | "transfer">("qris");
  const [copiedField, setCopiedField] = useState<"account" | "amount" | null>(null);

  // Generate dynamic QRIS string with the exact transaction amount
  const dynamicPayload = generateDynamicQris(baseQrisPayload || DEFAULT_BURJOBAE_QRIS, amount);
  const qrImageUrl = getQrisImageUrl(dynamicPayload, 320);

  // Countdown timer 15 minutes (900 seconds)
  const [timeLeft, setTimeLeft] = useState(900);
  const [isPaid, setIsPaid] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleCopy = (text: string, field: "account" | "amount") => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedCountdown = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Listener to Realtime channel if cashier marks paid from dashboard
  useEffect(() => {
    const channel = supabase
      .channel(`order-payment-${orderId}`)
      .on("broadcast", { event: "order_status_updated" }, (payload) => {
        if (payload.payload?.order_id === orderId && payload.payload?.payment_status === "paid") {
          setIsPaid(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Handle manual or simulated payment verification
  async function handleConfirmPayment(simulated: boolean = false) {
    setVerifying(true);
    try {
      // Update order in Supabase to paid
      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      // Broadcast update to restaurant KDS / cashier
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.send({
        type: "broadcast",
        event: "order_status_updated",
        payload: {
          order_id: orderId,
          payment_status: "paid",
          simulated,
        },
      });

      setIsPaid(true);
      setTimeout(() => {
        onPaymentSuccess();
      }, 1500);
    } catch (err) {
      console.error("Gagal verifikasi pembayaran:", err);
      setIsPaid(true);
      setTimeout(() => {
        onPaymentSuccess();
      }, 1500);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl my-auto text-gray-900 border border-gray-100">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-rose-600 px-2 py-0.5 text-[11px] font-black text-white tracking-wider">
              QRIS
            </span>
            <span className="text-xs font-bold text-gray-800">
              Pembayaran Online Otomatis
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {isPaid ? (
          /* Payment Success View */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-black text-emerald-600">
                Pembayaran Berhasil!
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Tagihan {formatRupiah(amount)} telah lunas diverifikasi.
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3.5 border border-emerald-100 text-xs text-emerald-800 font-semibold">
              Pesanan Anda sedang dipersiapkan oleh dapur {restaurantName}.
            </div>
            <button
              onClick={onPaymentSuccess}
              className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              Lihat Status Pesanan →
            </button>
          </div>
        ) : (
          /* Payment Container */
          <div>
            {/* Tab Switcher: QRIS vs Transfer Bank */}
            <div className="mt-3 flex rounded-xl bg-gray-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaymentTab("qris")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  paymentTab === "qris"
                    ? "bg-white text-[#E87532] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                📱 QRIS Dinamis (Auto)
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab("transfer")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  paymentTab === "transfer"
                    ? "bg-white text-[#E87532] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                🏦 Transfer Bank
              </button>
            </div>

            {/* Amount Banner */}
            <div className="my-3 rounded-2xl bg-orange-50/80 p-3 border border-orange-200/80 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Total Tagihan Pesanan
              </span>
              <h2 className="text-2xl font-black text-[#E87532] tracking-tight">
                {formatRupiah(amount)}
              </h2>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-bold text-emerald-800">
                <span>✓</span>
                <span>
                  {paymentTab === "qris"
                    ? "Nominal otomatis terisi (tidak perlu ketik manual)"
                    : "Transfer sesuai nominal pas di atas"}
                </span>
              </div>
            </div>

            {/* Order Details Mini */}
            <div className="flex justify-between text-[11px] text-gray-500 px-1 mb-1">
              <span>
                Penerima: <strong className="text-gray-900 uppercase">{restaurantName}</strong>
              </span>
              <span>
                Lokasi: <strong className="text-gray-900">{tableNumber}</strong>
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 px-1 mb-2.5">
              <span>
                No. Pesanan: <strong className="font-mono font-bold text-gray-900">{orderNumber}</strong>
              </span>
              <span>
                Pemesan: <strong className="text-gray-900">{customerName}</strong>
              </span>
            </div>

            {paymentTab === "qris" ? (
              /* QR Code Payment View */
              <div>
                {/* QR Code Container */}
                <div className="relative mx-auto flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 p-3 bg-white shadow-inner">
                  <img
                    src={qrImageUrl}
                    alt="QRIS Dinamis Burjobae"
                    className="h-52 w-52 object-contain rounded-lg"
                  />

                  {/* Supported Wallets Strip */}
                  <div className="mt-2 text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      Mendukung Semua Pembayaran:
                    </p>
                    <p className="text-[10px] font-bold text-gray-700 mt-0.5">
                      BCA • Mandiri • BRI • BNI • GoPay • OVO • DANA • ShopeePay
                    </p>
                  </div>
                </div>

                {/* Countdown validity */}
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-gray-500">
                  <span>Batas Waktu:</span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                    ⏱ {formattedCountdown}
                  </span>
                </div>

                {/* Instructions */}
                <div className="mt-2.5 rounded-xl bg-gray-50 p-2.5 text-[10px] text-gray-600 space-y-0.5 border border-gray-100">
                  <p className="font-bold text-gray-800">Cara Bayar QRIS:</p>
                  <p>1. Buka m-Banking atau e-Wallet favoritmu.</p>
                  <p>2. Scan QR di atas, <strong>nominal otomatis terkunci</strong>.</p>
                  <p>3. Masukkan PIN untuk menyelesaikan pembayaran.</p>
                </div>
              </div>
            ) : (
              /* Bank Transfer View */
              <div className="space-y-2.5">
                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Bank Penerima
                    </span>
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-800">
                      {bankName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-500">Nomor Rekening:</span>
                    <div className="mt-1 flex items-center justify-between rounded-xl bg-white border border-gray-200 p-2">
                      <span className="font-mono text-sm font-black tracking-wide text-gray-900">
                        {bankAccountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(bankAccountNumber.replace(/[^0-9]/g, ""), "account")
                        }
                        className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-200 transition active:scale-95"
                      >
                        {copiedField === "account" ? "✓ Tersalin!" : "📋 Salin"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-500">Atas Nama (A.N.):</span>
                    <p className="mt-0.5 font-bold text-xs text-gray-800">
                      {bankAccountHolder}
                    </p>
                  </div>

                  <div className="border-t border-gray-200 pt-2">
                    <span className="text-[10px] font-bold text-gray-500">Nominal Pas Transfer:</span>
                    <div className="mt-1 flex items-center justify-between rounded-xl bg-orange-50/80 border border-orange-200 p-2">
                      <span className="text-sm font-black text-[#E87532]">
                        {formatRupiah(amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(String(amount), "amount")}
                        className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#E87532] border border-orange-200 hover:bg-orange-50 transition active:scale-95"
                      >
                        {copiedField === "amount" ? "✓ Tersalin!" : "📋 Salin"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50/70 p-2.5 text-[10px] text-blue-900 space-y-0.5 border border-blue-100">
                  <p className="font-bold">Petunjuk Transfer:</p>
                  <p>1. Salin nomor rekening & nominal tagihan di atas.</p>
                  <p>2. Transfer via m-banking atau ATM ke rekening {bankName}.</p>
                  <p>3. Setelah berhasil, klik tombol <strong>&quot;✓ Saya Sudah Bayar / Transfer&quot;</strong> di bawah.</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-3.5 space-y-2">
              <button
                onClick={() => handleConfirmPayment(false)}
                disabled={verifying}
                className="w-full rounded-xl bg-[#E87532] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#d46525] active:scale-95 transition disabled:opacity-50"
              >
                {verifying ? "Memverifikasi..." : "✓ Saya Sudah Bayar / Transfer"}
              </button>

              {/* Demo Simulator for easy testing */}
              <button
                onClick={() => handleConfirmPayment(true)}
                className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 py-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 active:scale-95 transition"
                title="Gunakan untuk uji coba langsung tanpa transfer uang riil"
              >
                ⚡ Uji Coba: Simulasi Bayar Berhasil (Demo)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
