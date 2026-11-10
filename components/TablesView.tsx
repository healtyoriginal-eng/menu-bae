/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface TablesViewProps {
  restaurantSlug: string;
  restaurantId?: string;
}

interface ActiveOrderInfo {
  order_number: string;
  customer_name: string;
  status: string;
  total: number;
}

interface TableItem {
  id: string;
  number: string;
  capacity: number;
  status: "available" | "occupied";
  activeOrder?: ActiveOrderInfo;
}

export function TablesView({
  restaurantSlug,
  restaurantId = "9435081d-0f91-4ae5-97aa-30df127d569d",
}: TablesViewProps) {
  // Pre-configured default tables for Burjobae
  const [tables, setTables] = useState<TableItem[]>([
    { id: "1", number: "Meja 01", capacity: 4, status: "available" },
    { id: "2", number: "Meja 02", capacity: 4, status: "available" },
    { id: "3", number: "Meja 03", capacity: 2, status: "available" },
    { id: "4", number: "Meja 04", capacity: 6, status: "available" },
    { id: "5", number: "Meja 05", capacity: 4, status: "available" },
    { id: "6", number: "Meja 06", capacity: 4, status: "available" },
    { id: "7", number: "Meja 07", capacity: 2, status: "available" },
    { id: "8", number: "Meja 08", capacity: 8, status: "available" },
  ]);

  const [selectedTableForQr, setSelectedTableForQr] = useState<TableItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newCapacity, setNewCapacity] = useState(4);

  // Sync active orders from Supabase with table occupancy
  const syncTableOccupancy = useCallback(async () => {
    try {
      const { data: activeOrders, error } = await supabase
        .from("orders")
        .select("notes, order_number, customer_name, order_status, total")
        .eq("restaurant_id", restaurantId)
        .in("order_status", ["new", "accepted", "preparing", "ready"]);

      if (error) {
        console.error("Gagal sinkron status meja:", error);
        return;
      }

      const activeMap: { [tableLabel: string]: ActiveOrderInfo } = {};
      if (activeOrders) {
        for (const ord of activeOrders) {
          if (ord.notes) {
            // standardizes "Meja 01", "Meja 1", "meja-01"
            const cleanKey = ord.notes.toLowerCase().trim();
            activeMap[cleanKey] = {
              order_number: ord.order_number,
              customer_name: ord.customer_name || "Pelanggan",
              status: ord.order_status,
              total: ord.total,
            };
          }
        }
      }

      setTables((prev) =>
        prev.map((t) => {
          const matchKey = t.number.toLowerCase().trim();
          const activeOrder = activeMap[matchKey];
          return {
            ...t,
            status: activeOrder ? "occupied" : "available",
            activeOrder: activeOrder || undefined,
          };
        })
      );
    } catch (err) {
      console.error("Error sync table occupancy:", err);
    }
  }, [restaurantId]);

  useEffect(() => {
    let isMounted = true;

    async function initialSync() {
      if (isMounted) {
        await syncTableOccupancy();
      }
    }

    initialSync();

    // Realtime channel listener for live sync
    const channel = supabase
      .channel(`restaurant-tables-${restaurantId}`)
      .on("broadcast", { event: "new_order" }, () => {
        syncTableOccupancy();
      })
      .on("broadcast", { event: "order_status_updated" }, () => {
        syncTableOccupancy();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [restaurantId, syncTableOccupancy]);

  function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    const newId = String(tables.length + 1);
    setTables((prev) => [
      ...prev,
      {
        id: newId,
        number: newTableNumber.trim(),
        capacity: newCapacity,
        status: "available",
      },
    ]);
    setNewTableNumber("");
    setIsAddModalOpen(false);
  }

  function handleToggleTableStatus(id: string) {
    setTables((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: t.status === "available" ? "occupied" : "available",
              activeOrder: undefined,
            }
          : t
      )
    );
  }

  // Helper to generate ordering URL for this table
  const getTableOrderUrl = (tableNumber: string) => {
    const slug = restaurantSlug || "burjobae";
    const formattedNum = encodeURIComponent(tableNumber.toLowerCase().replace(/\s+/g, "-"));
    return `/${slug}/${formattedNum}`;
  };

  const getFullOrderUrl = (tableNumber: string) => {
    const relative = getTableOrderUrl(tableNumber);
    if (typeof window !== "undefined") {
      return `${window.location.origin}${relative}`;
    }
    return `https://menu-bae.com${relative}`;
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-[#171717]">Manajemen Meja & QR Code</h3>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Status meja tersinkronisasi otomatis dengan pesanan aktif dari dapur & kasir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncTableOccupancy()}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
            title="Refresh status meja"
          >
            🔄 Sinkron Meja
          </button>
          <button
            onClick={() => {
              setNewTableNumber(`Meja ${String(tables.length + 1).padStart(2, "0")}`);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E87532] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#d46525]"
          >
            <span>+</span>
            <span>Tambah Meja Baru</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-4 text-xs font-semibold">
        <span className="rounded-full bg-white border border-gray-200 px-3.5 py-1.5 text-gray-700">
          Total: {tables.length} Meja
        </span>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-emerald-700 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Kosong (Tersedia): {tables.filter((t) => t.status === "available").length} Meja
        </span>
        <span className="rounded-full bg-orange-50 border border-orange-200 px-3.5 py-1.5 text-orange-700 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#E87532]" />
          Terisi (Ada Pesanan): {tables.filter((t) => t.status === "occupied").length} Meja
        </span>
      </div>

      {/* Grid Meja */}
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => {
          const isOccupied = table.status === "occupied";
          return (
            <div
              key={table.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition shadow-xs hover:shadow-md ${
                isOccupied
                  ? "border-orange-300 bg-orange-50/40 ring-1 ring-orange-200"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🪑</span>
                  <button
                    onClick={() => handleToggleTableStatus(table.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                      isOccupied
                        ? "bg-[#E87532] text-white shadow-xs"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                    title="Klik untuk ubah manual status meja"
                  >
                    {isOccupied ? "● Terisi" : "○ Kosong"}
                  </button>
                </div>

                <div className="mt-3">
                  <h4 className="text-lg font-black text-[#171717]">{table.number}</h4>
                  <p className="text-xs text-gray-400">Kapasitas: {table.capacity} Kursi</p>
                </div>

                {/* Active Order Card if Occupied */}
                {isOccupied && (
                  <div className="mt-3 rounded-xl bg-white/80 p-2.5 border border-orange-200 text-xs">
                    {table.activeOrder ? (
                      <div>
                        <div className="flex items-center justify-between font-bold text-gray-900">
                          <span className="text-[#E87532]">{table.activeOrder.order_number}</span>
                          <span className="text-[10px] text-gray-500 uppercase">
                            {table.activeOrder.status === "new" && "Pesanan Baru"}
                            {table.activeOrder.status === "preparing" && "Dimasak"}
                            {table.activeOrder.status === "ready" && "Siap"}
                          </span>
                        </div>
                        <p className="text-gray-600 font-medium truncate mt-0.5">
                          {table.activeOrder.customer_name}
                        </p>
                        <p className="font-bold text-gray-900 mt-1">
                          {formatRupiah(table.activeOrder.total)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-orange-700 italic">
                        Ditandai terisi manual
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <button
                  onClick={() => setSelectedTableForQr(table)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2 text-xs font-bold text-gray-700 hover:border-[#E87532] hover:text-[#E87532] transition active:scale-95"
                >
                  <span>📷</span>
                  <span>Lihat QR & Stiker Meja</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal QR Code Stand & Stiker Meja */}
      {selectedTableForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="flex flex-col items-center my-auto py-6">
            {/* Printable Tent Card Container */}
            <div
              id="printable-table-card"
              className="w-80 rounded-3xl bg-white p-7 text-center shadow-2xl border-2 border-orange-200"
            >
              {/* Resto Branding Header */}
              <div className="flex items-center justify-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E87532] text-sm font-black text-white">
                  M
                </span>
                <span className="text-lg font-black tracking-wide text-gray-900">
                  BURJO<span className="text-[#E87532]">BAE.</span>
                </span>
              </div>

              <p className="text-[11px] font-semibold text-gray-500 mt-1">
                Scan QR untuk Pesan & Bayar Langsung
              </p>

              {/* Table Number Highlight */}
              <div className="my-3 inline-block rounded-2xl bg-orange-100/80 px-5 py-1.5">
                <span className="text-base font-black text-[#E87532] tracking-wider uppercase">
                  {selectedTableForQr.number}
                </span>
              </div>

              {/* QR Image */}
              <div className="my-3 flex justify-center">
                <div className="rounded-2xl border-4 border-gray-900 p-2.5 bg-white shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      getFullOrderUrl(selectedTableForQr.number)
                    )}`}
                    alt={`QR Code ${selectedTableForQr.number}`}
                    className="h-44 w-44"
                  />
                </div>
              </div>

              {/* Step instructions */}
              <div className="mt-3 rounded-xl bg-gray-50 p-3 text-left text-[11px] space-y-1 text-gray-600 border border-gray-100">
                <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wider text-center">
                  Cara Memesan:
                </p>
                <p>1. Buka kamera HP & scan QR Code di atas.</p>
                <p>2. Pilih menu makanan & minuman favoritmu.</p>
                <p>3. Pesanan langsung diproses di dapur!</p>
              </div>

              <p className="mt-3 font-mono text-[9px] text-gray-400 truncate">
                {getFullOrderUrl(selectedTableForQr.number)}
              </p>
            </div>

            {/* Modal Controls (Hidden when printing) */}
            <div className="mt-4 flex gap-2 w-full max-w-xs no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-[#E87532] py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-[#d46525] active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span>
                <span>Cetak Stiker Meja</span>
              </button>
              <button
                onClick={() => setSelectedTableForQr(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition"
              >
                Tutup
              </button>
            </div>
          </div>

          {/* Printable Tent Card Isolation */}
          <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-table-card,
              #printable-table-card * {
                visibility: visible !important;
              }
              #printable-table-card {
                position: absolute !important;
                left: 50% !important;
                top: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 300px !important;
                border: 2px solid #E87532 !important;
                box-shadow: none !important;
                padding: 24px !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}} />
        </div>
      )}

      {/* Modal Tambah Meja */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Tambah Meja Baru</h3>
            <p className="mt-1 text-xs text-gray-400">
              Masukkan nomor meja dan kapasitas kursi.
            </p>

            <form onSubmit={handleAddTable} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600">
                  Nomor / Label Meja
                </label>
                <input
                  type="text"
                  required
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600">
                  Kapasitas Kursi (Orang)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(parseInt(e.target.value) || 2)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#E87532] px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Meja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
