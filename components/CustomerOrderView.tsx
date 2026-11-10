/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Product, Category, Restaurant, getRestaurantPaymentInfo } from "@/lib/types";
import { DynamicQrisPaymentModal } from "@/components/DynamicQrisPaymentModal";
import { CustomerOrderTracker, ActiveOrderTrackingData } from "@/components/CustomerOrderTracker";

interface CustomerOrderViewProps {
  restaurantSlug: string;
  tableParam?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

function generateOrderId() {
  return `ORD-${Date.now().toString().slice(-4)}`;
}

export function CustomerOrderView({
  restaurantSlug,
  tableParam,
}: CustomerOrderViewProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected table
  const formattedTable = tableParam
    ? decodeURIComponent(tableParam)
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
    : "Meja 01";

  // Filter & Search
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart & Checkout
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");

  // Item Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemNotes, setItemNotes] = useState("");

  // Order Success Screen
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string>("");
  const [liveOrderStatus, setLiveOrderStatus] = useState<string>("new");
  const [livePaymentStatus, setLivePaymentStatus] = useState<string>("unpaid");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [activeTrackingOrder, setActiveTrackingOrder] =
    useState<ActiveOrderTrackingData | null>(null);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [qrisOrderData, setQrisOrderData] = useState<{
    id: string;
    order_number: string;
    total: number;
  } | null>(null);

  // Load saved active order for this table from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `menu_bae_active_order_${tableParam || "meja-01"}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id) {
          supabase
            .from("orders")
            .select(
              "id, order_number, customer_name, notes, total, payment_method, payment_status, order_status, created_at, items:order_items(product_name, quantity, unit_price, notes)"
            )
            .eq("id", parsed.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                const isVeryOld =
                  Date.now() - new Date(data.created_at).getTime() > 3 * 3600 * 1000;
                if (!isVeryOld) {
                  setActiveTrackingOrder({
                    id: data.id,
                    order_number: data.order_number,
                    customer_name: data.customer_name || "Pelanggan",
                    table_number: data.notes || formattedTable,
                    total: data.total,
                    payment_method: data.payment_method,
                    payment_status: data.payment_status,
                    order_status: data.order_status,
                    created_at: data.created_at,
                    items: data.items as Array<{
                      product_name: string;
                      quantity: number;
                      unit_price?: number;
                      notes?: string | null;
                    }>,
                  });
                }
              }
            });
        }
      } catch {
        // ignore
      }
    }
  }, [tableParam, formattedTable]);

  useEffect(() => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel(`restaurant-${restaurant.id}`)
      .on("broadcast", { event: "order_status_updated" }, (payload) => {
        if (payload.payload?.status) {
          setLiveOrderStatus(payload.payload.status);
          setActiveTrackingOrder((prev) =>
            prev &&
            (prev.id === payload.payload.order_id ||
              prev.order_number === payload.payload.order_number)
              ? { ...prev, order_status: payload.payload.status }
              : prev
          );
        }
        if (payload.payload?.payment_status) {
          setLivePaymentStatus(payload.payload.payment_status);
          setActiveTrackingOrder((prev) =>
            prev &&
            (prev.id === payload.payload.order_id ||
              prev.order_number === payload.payload.order_number)
              ? { ...prev, payment_status: payload.payload.payment_status }
              : prev
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Fetch Restaurant by Slug
        const { data: restData, error: restErr } = await supabase
          .from("restaurants")
          .select("*")
          .eq("slug", restaurantSlug)
          .maybeSingle();

        if (restErr) throw restErr;
        if (!active) return;

        if (!restData) {
          setErrorMsg("Restoran tidak ditemukan.");
          setLoading(false);
          return;
        }

        setRestaurant(restData);

        // 2. Fetch Categories
        const { data: catData, error: catErr } = await supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", restData.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (catErr) throw catErr;
        if (!active) return;
        setCategories(catData || []);

        // 3. Fetch Products
        const { data: prodData, error: prodErr } = await supabase
          .from("products")
          .select("*, category:categories(id, name)")
          .eq("restaurant_id", restData.id)
          .order("created_at", { ascending: false });

        if (prodErr) throw prodErr;
        if (!active) return;
        setProducts(prodData || []);
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : "Gagal memuat menu";
          setErrorMsg(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [restaurantSlug]);

  // Cart operations
  function openProductDetail(product: Product) {
    if (!product.is_available) return;
    setSelectedProduct(product);
    const inCart = cart.find((ci) => ci.product.id === product.id);
    if (inCart) {
      setItemQty(inCart.quantity);
      setItemNotes(inCart.notes || "");
    } else {
      setItemQty(1);
      setItemNotes("");
    }
  }

  function handleSaveItemFromModal() {
    if (!selectedProduct) return;

    if (itemQty === 0) {
      // Hapus dari keranjang jika porsi diset ke 0
      setCart((prev) => prev.filter((ci) => ci.product.id !== selectedProduct.id));
      setSelectedProduct(null);
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.product.id === selectedProduct.id
      );
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: itemQty,
          notes: itemNotes,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            product: selectedProduct,
            quantity: itemQty,
            notes: itemNotes,
          },
        ];
      }
    });

    setSelectedProduct(null);
  }

  function handleQuickChangeQty(e: React.MouseEvent, product: Product, delta: number) {
    e.stopPropagation();
    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => ci.product.id === product.id);
      if (existingIdx > -1) {
        const next = [...prev];
        const newQty = next[existingIdx].quantity + delta;
        if (newQty <= 0) {
          next.splice(existingIdx, 1);
        } else {
          next[existingIdx].quantity = newQty;
        }
        return next;
      } else if (delta > 0) {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            notes: "",
          },
        ];
      }
      return prev;
    });
  }

  function handleUpdateCartQty(index: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index].quantity = newQty;
      }
      return next;
    });
  }

  const cartTotalQty = cart.reduce((acc, it) => acc + it.quantity, 0);
  const cartTotalPrice = cart.reduce(
    (acc, it) => acc + it.product.price * it.quantity,
    0
  );

  async function handleConfirmOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || submittingOrder) return;

    setSubmittingOrder(true);
    const orderNumber = generateOrderId();
    const restaurantId = restaurant?.id || "9435081d-0f91-4ae5-97aa-30df127d569d";

    try {
      // 1. Simpan order ke database Supabase
      const { data: ord, error: ordErr } = await supabase
        .from("orders")
        .insert([
          {
            restaurant_id: restaurantId,
            order_number: orderNumber,
            order_type: "dine_in",
            customer_name: customerName.trim() || "Pelanggan Meja",
            subtotal: cartTotalPrice,
            total: cartTotalPrice,
            payment_method: paymentMethod === "online" ? "online" : "cash",
            payment_status: "unpaid",
            order_status: "new",
            notes: formattedTable,
          },
        ])
        .select()
        .single();

      if (ordErr) {
        console.error("Gagal simpan ke Supabase orders:", ordErr?.message || ordErr);
      }

      // 2. Simpan order items jika order berhasil dibuat
      if (ord) {
        const itemsPayload = cart.map((it) => ({
          order_id: ord.id,
          product_id: it.product.id || null,
          product_name: it.product.name,
          unit_price: it.product.price,
          quantity: it.quantity,
          subtotal: it.product.price * it.quantity,
          notes: it.notes || null,
        }));

        await supabase.from("order_items").insert(itemsPayload);
      }

      // 3. Broadcast Realtime ke Kitchen Display / Kasir
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "new_order",
        payload: {
          id: ord?.id || orderNumber,
          order_number: orderNumber,
          table_number: formattedTable,
          customer_name: customerName.trim() || "Pelanggan Meja",
          total: cartTotalPrice,
        },
      });

      setSubmittedOrderId(orderNumber);
      setLiveOrderStatus("new");
      setLivePaymentStatus("unpaid");

      const trackingData: ActiveOrderTrackingData = {
        id: ord?.id || orderNumber,
        order_number: orderNumber,
        customer_name: customerName.trim() || "Pelanggan Meja",
        table_number: formattedTable,
        total: cartTotalPrice,
        payment_method: paymentMethod === "online" ? "online" : "cash",
        payment_status: "unpaid",
        order_status: "new",
        created_at: new Date().toISOString(),
        items: cart.map((it) => ({
          product_name: it.product.name,
          quantity: it.quantity,
          unit_price: it.product.price,
          notes: it.notes,
        })),
      };
      setActiveTrackingOrder(trackingData);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `menu_bae_active_order_${tableParam || "meja-01"}`,
            JSON.stringify(trackingData)
          );
        } catch {
          // ignore
        }
      }

      if (paymentMethod === "online") {
        setQrisOrderData({
          id: ord?.id || orderNumber,
          order_number: orderNumber,
          total: cartTotalPrice,
        });
        setIsCartOpen(false);
      } else {
        setOrderSubmitted(true);
        setIsCartOpen(false);
      }
    } catch (err) {
      console.error("Error confirm order:", err);
      setSubmittedOrderId(orderNumber);
      setLiveOrderStatus("new");
      const fallbackData: ActiveOrderTrackingData = {
        id: orderNumber,
        order_number: orderNumber,
        customer_name: customerName.trim() || "Pelanggan Meja",
        table_number: formattedTable,
        total: cartTotalPrice,
        payment_method: paymentMethod === "online" ? "online" : "cash",
        payment_status: "unpaid",
        order_status: "new",
        created_at: new Date().toISOString(),
        items: cart.map((it) => ({
          product_name: it.product.name,
          quantity: it.quantity,
          unit_price: it.product.price,
          notes: it.notes,
        })),
      };
      setActiveTrackingOrder(fallbackData);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `menu_bae_active_order_${tableParam || "meja-01"}`,
            JSON.stringify(fallbackData)
          );
        } catch {
          // ignore
        }
      }
      setOrderSubmitted(true);
      setIsCartOpen(false);
    } finally {
      setSubmittingOrder(false);
    }
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCat === "all" || p.category_id === selectedCat;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description &&
        p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa] p-4">
        <div className="flex flex-col items-center gap-3">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#E87532] border-t-transparent" />
          <p className="text-sm font-semibold text-gray-600">
            Menyiapkan Menu Makanan...
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa] p-6 text-center">
        <div className="max-w-sm rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <span className="text-5xl">🍽️</span>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Oops!</h2>
          <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-[#E87532] px-6 py-2.5 text-xs font-bold text-white"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  // SUCCESS ORDER SCREEN
  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] p-4 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-lg border border-gray-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            🎉
          </div>
          <h2 className="mt-4 text-2xl font-black text-gray-900">
            Pesanan Berhasil Dikirim!
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Pesanan Anda langsung masuk ke dapur {restaurant?.name}.
          </p>

          <div className="my-6 rounded-2xl bg-orange-50/70 p-4 border border-orange-100 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Nomor Pesanan:</span>
              <span className="font-mono font-bold text-[#E87532]">
                {submittedOrderId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Meja:</span>
              <span className="font-bold text-gray-900">{formattedTable}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pemesan:</span>
              <span className="font-bold text-gray-900">
                {customerName || "Pelanggan Meja"}
              </span>
            </div>
            <div className="flex justify-between border-t border-orange-100 pt-2 font-bold">
              <span>Total Pembayaran:</span>
              <span className="text-sm text-[#E87532]">
                {formatRupiah(cartTotalPrice)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>Metode:</span>
              <span className="font-semibold text-gray-800">
                {paymentMethod === "cash"
                  ? "Bayar di Kasir (Tunai / QRIS)"
                  : "📱 QRIS Dinamis Otomatis"}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Status Pembayaran:</span>
              <span
                className={`font-bold ${
                  livePaymentStatus === "paid"
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {livePaymentStatus === "paid"
                  ? "✓ Lunas (QRIS Otomatis)"
                  : "Belum Lunas"}
              </span>
            </div>
          </div>

          {paymentMethod === "online" && livePaymentStatus !== "paid" && (
            <button
              type="button"
              onClick={() => {
                setQrisOrderData({
                  id: submittedOrderId,
                  order_number: submittedOrderId,
                  total: cartTotalPrice,
                });
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50/80 py-2.5 text-xs font-bold text-[#E87532] shadow-xs hover:bg-orange-100 transition"
            >
              <span>📱</span>
              <span>Buka QRIS Pembayaran ({formatRupiah(cartTotalPrice)})</span>
            </button>
          )}

          <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 text-left">
            <p className="text-xs font-bold text-gray-800 mb-2">
              Status Pengerjaan:
            </p>
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                {liveOrderStatus !== "completed" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    liveOrderStatus === "completed"
                      ? "bg-emerald-500"
                      : "bg-[#E87532]"
                  }`}
                />
              </span>
              <span
                className={`text-xs font-semibold ${
                  liveOrderStatus === "completed"
                    ? "text-emerald-700"
                    : "text-[#E87532]"
                }`}
              >
                {liveOrderStatus === "new" && "Pesanan Diterima & Masuk Antrean Dapur"}
                {liveOrderStatus === "accepted" && "Pesanan Dikonfirmasi Dapur 👍"}
                {liveOrderStatus === "preparing" && "Sedang Dimasak di Dapur 🍳"}
                {liveOrderStatus === "ready" && "Makanan Siap & Sedang Diantar ke Meja 🔔"}
                {liveOrderStatus === "completed" && "Pesanan Selesai Disajikan. Selamat Menikmati! ✨"}
                {liveOrderStatus === "cancelled" && "Pesanan Dibatalkan ❌"}
              </span>
            </div>
          </div>

          {/* Notifikasi Pengingat Pembayaran saat Selesai */}
          {liveOrderStatus === "completed" && (
            livePaymentStatus === "paid" ? (
              <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-300 p-3.5 text-left text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <span>✅</span>
                  <span>Pembayaran Lunas</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-700 leading-relaxed font-medium">
                  Semua pesanan telah disajikan dan tagihan telah lunas. Terima kasih atas kunjungan Anda di {restaurant?.name}! 🙏✨
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-amber-50 border-2 border-amber-400 p-3.5 text-left text-xs animate-pulse ring-2 ring-amber-400/20">
                <div className="flex items-center gap-2 font-black text-amber-950">
                  <span>⚠️</span>
                  <span>PENGINGAT: BELUM DIBAYAR</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-900 font-medium leading-relaxed">
                  Pesanan telah selesai disajikan di {formattedTable}. Mohon selesaikan pembayaran tagihan sebesar{" "}
                  <strong className="font-black text-amber-950 underline">{formatRupiah(cartTotalPrice)}</strong>{" "}
                  di kasir (Tunai / QRIS) atau bayar via QRIS otomatis.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQrisOrderData({
                      id: submittedOrderId,
                      order_number: submittedOrderId,
                      total: cartTotalPrice,
                    });
                  }}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-md hover:from-orange-600 hover:to-amber-600 transition"
                >
                  <span>📱</span>
                  <span>Bayar Sekarang via QRIS ({formatRupiah(cartTotalPrice)})</span>
                </button>
              </div>
            )
          )}

          {/* Tombol Buka Live Tracking Pesanan */}
          <button
            type="button"
            onClick={() => setIsTrackerModalOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 py-3.5 text-xs font-black text-white shadow-md hover:from-orange-600 hover:to-amber-600 transition active:scale-[0.99]"
          >
            <span className="text-base">🛵</span>
            <span>Buka Live Tracking Pesanan Lengkap</span>
          </button>

          {/* Tombol WhatsApp Kasir */}
          {restaurant?.phone && (
            <a
              href={`https://wa.me/${restaurant.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `Halo ${restaurant.name}! Saya sudah memesan lewat Menu Digital:\n• No. Pesanan: ${submittedOrderId}\n• Meja: ${formattedTable}\n• Nama: ${customerName || "Pelanggan"}\n• Total: ${formatRupiah(cartTotalPrice)}\n• Pembayaran: ${paymentMethod === "cash" ? "Bayar di Kasir (Tunai / QRIS)" : "Online"}\n\nMohon segera diproses ya. Terima kasih! 🙏`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition active:scale-[0.99]"
            >
              <span className="text-base">💬</span>
              <span>Kirim Bukti Pesanan ke WhatsApp Kasir</span>
            </a>
          )}

          <button
            onClick={() => {
              setCart([]);
              setOrderSubmitted(false);
            }}
            className="mt-3 w-full rounded-xl bg-[#E87532] py-3 text-xs font-bold text-white shadow-sm hover:bg-[#d46525] transition"
          >
            Pesan Menu Tambahan
          </button>
        </div>

        {/* Modal Live Order Tracker (jika dibuka dari layar sukses) */}
        {activeTrackingOrder && (
          <CustomerOrderTracker
            order={activeTrackingOrder}
            restaurantName={restaurant?.name || "Burjobae"}
            restaurantPhone={restaurant?.phone}
            isOpen={isTrackerModalOpen}
            onClose={() => setIsTrackerModalOpen(false)}
            onOpenQris={() => {
              setIsTrackerModalOpen(false);
              setQrisOrderData({
                id: activeTrackingOrder.id,
                order_number: activeTrackingOrder.order_number,
                total: activeTrackingOrder.total,
              });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-28 text-[#171717] font-sans antialiased">
      {/* Mobile Header / Banner */}
      <header className="relative bg-white border-b border-gray-200">
        <div className="h-32 w-full bg-linear-to-r from-orange-500 via-[#E87532] to-amber-500 overflow-hidden relative">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-3 left-4 rounded-full bg-black/30 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white">
            📍 {formattedTable}
          </div>
          {activeTrackingOrder && (
            <button
              type="button"
              onClick={() => setIsTrackerModalOpen(true)}
              className={`absolute top-3 right-4 flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-black shadow-md hover:bg-white active:scale-95 transition ${
                activeTrackingOrder.order_status === "completed"
                  ? "text-emerald-700"
                  : "text-[#E87532]"
              }`}
            >
              {activeTrackingOrder.order_status !== "completed" ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E87532]"></span>
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              )}
              <span>
                {activeTrackingOrder.order_status === "completed"
                  ? "Pesanan Selesai ✨"
                  : "Lacak Pesanan 🛵"}
              </span>
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                {restaurant?.name || "Burjobae"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {restaurant?.description ||
                  "Menu lezat khas Burjo, sajian hangat & cepat saji."}
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-lg font-black text-[#E87532] shadow-xs">
              M
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Restoran Buka
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">Pesan langsung dari meja</span>
          </div>
        </div>
      </header>

      {/* Sticky Search & Category Filter */}
      <div className="sticky top-0 z-30 bg-[#f7f7f5]/90 backdrop-blur-md px-4 py-3 border-b border-gray-200/60 shadow-2xs">
        {/* Search Input */}
        <div className="relative mb-2.5">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Cari makanan, minuman, cemilan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
          />
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            onClick={() => setSelectedCat("all")}
            className={`rounded-full px-3.5 py-1.5 font-semibold whitespace-nowrap transition ${
              selectedCat === "all"
                ? "bg-[#E87532] text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`rounded-full px-3.5 py-1.5 font-semibold whitespace-nowrap transition ${
                selectedCat === c.id
                  ? "bg-[#E87532] text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List */}
      <main className="px-4 pt-4 max-w-2xl mx-auto">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center mt-4">
            <span className="text-4xl">🍜</span>
            <p className="mt-3 text-sm font-bold text-gray-800">
              Menu belum tersedia
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Silakan pilih kategori lain atau cari dengan kata kunci lain.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              const inCart = cart.find((c) => c.product.id === p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => openProductDetail(p)}
                  className={`group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xs transition ${
                    p.is_available
                      ? "cursor-pointer active:scale-[0.99] hover:border-[#E87532]/50 hover:shadow-sm"
                      : "opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-gray-900 truncate">
                        {p.name}
                      </h3>
                      {!p.is_available && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                          Habis
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                      {p.description || "Menu favorit dengan bumbu spesial."}
                    </p>
                    <p className="mt-2 text-sm font-black text-[#E87532]">
                      {formatRupiah(p.price)}
                    </p>
                  </div>

                  {/* Thumbnail & Add Button */}
                  <div className="relative h-20 w-20 shrink-0 rounded-xl bg-orange-50/80 flex items-center justify-center overflow-hidden border border-gray-100">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🍲</span>
                    )}

                    {p.is_available && (
                      inCart ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-1.5 right-1.5 flex items-center bg-white border border-[#E87532] rounded-lg shadow-sm overflow-hidden"
                        >
                          <button
                            onClick={(e) => handleQuickChangeQty(e, p, -1)}
                            className="flex h-7 w-6 items-center justify-center font-bold text-sm text-[#E87532] hover:bg-orange-50 active:scale-90 transition"
                            title="Kurang porsi"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-xs font-black text-gray-900">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={(e) => handleQuickChangeQty(e, p, 1)}
                            className="flex h-7 w-6 items-center justify-center font-bold text-sm bg-[#E87532] text-white hover:bg-[#d46525] active:scale-90 transition"
                            title="Tambah porsi"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(p);
                          }}
                          className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[#E87532] shadow-sm font-black text-sm text-white hover:bg-[#d46525] transition active:scale-95"
                          title="Tambah ke Keranjang"
                        >
                          +
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-[#171717] px-5 py-3.5 text-white shadow-xl shadow-black/25 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E87532] text-sm font-black text-white">
                {cartTotalQty}
              </span>
              <div className="text-left">
                <p className="text-[11px] text-gray-400">Keranjang ({formattedTable})</p>
                <p className="text-sm font-black">{formatRupiah(cartTotalPrice)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#E87532]">
              <span>Lihat Pesanan</span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Tracking Bar (Saat Keranjang Kosong tapi Ada Pesanan Aktif) */}
      {cart.length === 0 && activeTrackingOrder && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setIsTrackerModalOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-[#171717]/95 backdrop-blur-md border border-orange-500/30 px-5 py-3.5 text-white shadow-xl shadow-black/25 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-orange-500 to-amber-500 text-lg shadow-sm">
                {activeTrackingOrder.order_status === "new" && "📋"}
                {activeTrackingOrder.order_status === "accepted" && "👍"}
                {activeTrackingOrder.order_status === "preparing" && "🍳"}
                {activeTrackingOrder.order_status === "ready" && "🔔"}
                {activeTrackingOrder.order_status === "completed" && "✨"}
                {activeTrackingOrder.order_status === "cancelled" && "❌"}
              </span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-orange-400">
                    {activeTrackingOrder.order_number}
                  </span>
                  <span className="text-[10px] text-gray-400">• {activeTrackingOrder.table_number}</span>
                </div>
                <p className="text-xs font-black text-gray-100">
                  {activeTrackingOrder.order_status === "new" && "Pesanan Diterima Dapur"}
                  {activeTrackingOrder.order_status === "accepted" && "Pesanan Dikonfirmasi"}
                  {activeTrackingOrder.order_status === "preparing" && "Sedang Dimasak 🍳"}
                  {activeTrackingOrder.order_status === "ready" && "Makanan Siap & Diantar 🔔"}
                  {activeTrackingOrder.order_status === "completed" && (
                    activeTrackingOrder.payment_status === "paid"
                      ? "Pesanan Selesai • Lunas ✨"
                      : "Pesanan Selesai • Belum Bayar ⚠️"
                  )}
                  {activeTrackingOrder.order_status === "cancelled" && "Pesanan Dibatalkan"}
                </p>
              </div>
            </div>
            <div
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${
                activeTrackingOrder.order_status === "completed"
                  ? activeTrackingOrder.payment_status === "paid"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-amber-300 bg-amber-500/20 border-amber-400/40 animate-pulse"
                  : "text-orange-400 bg-orange-500/10 border-orange-500/20"
              }`}
            >
              <span>
                {activeTrackingOrder.order_status === "completed"
                  ? activeTrackingOrder.payment_status === "paid"
                    ? "Lunas ✓"
                    : "Bayar ⚠️"
                  : "Lacak →"}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Modal Detail Item & Add to Cart */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {selectedProduct.name}
                </h3>
                <p className="text-sm font-bold text-[#E87532] mt-0.5">
                  {formatRupiah(selectedProduct.price)}
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {selectedProduct.description && (
                <p className="text-xs text-gray-500">
                  {selectedProduct.description}
                </p>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Catatan untuk Dapur (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: jangan pakai sawi, tidak terlalu pedas..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs focus:border-[#E87532] focus:outline-none"
                />
              </div>

              {/* Quantity Counter */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <div>
                  <span className="text-xs font-bold text-gray-700">Jumlah Porsi</span>
                  {itemQty === 0 && (
                    <p className="text-[10px] text-gray-400">Porsi 0 = Batal pesan menu ini</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setItemQty((prev) => Math.max(0, prev - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-base font-bold text-gray-700 hover:bg-gray-100 active:scale-95 transition"
                    title="Kurangi porsi"
                  >
                    -
                  </button>
                  <span
                    className={`w-8 text-center text-base font-black ${
                      itemQty === 0 ? "text-rose-500" : "text-[#171717]"
                    }`}
                  >
                    {itemQty}
                  </span>
                  <button
                    onClick={() => setItemQty((prev) => prev + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-base font-bold text-gray-700 hover:bg-gray-100 active:scale-95 transition"
                    title="Tambah porsi"
                  >
                    +
                  </button>
                </div>
              </div>

              {itemQty === 0 ? (
                <button
                  onClick={handleSaveItemFromModal}
                  className={`w-full rounded-xl py-3 text-xs font-bold transition shadow-sm ${
                    cart.some((c) => c.product.id === selectedProduct.id)
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {cart.some((c) => c.product.id === selectedProduct.id)
                    ? "Hapus Menu dari Pesanan (0 Porsi)"
                    : "Batal / Tutup (0 Porsi)"}
                </button>
              ) : (
                <button
                  onClick={handleSaveItemFromModal}
                  className="w-full rounded-xl bg-[#E87532] py-3 text-xs font-bold text-white shadow-sm hover:bg-[#d46525] transition active:scale-[0.99]"
                >
                  {cart.some((c) => c.product.id === selectedProduct.id)
                    ? `Perbarui Pesanan • ${formatRupiah(selectedProduct.price * itemQty)}`
                    : `Tambah ke Keranjang • ${formatRupiah(selectedProduct.price * itemQty)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart & Checkout Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧾</span>
                  <h3 className="text-base font-black text-gray-900">
                    Konfirmasi Pesanan ({formattedTable})
                  </h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Items List */}
              <div className="mt-4 max-h-56 overflow-y-auto space-y-3 pr-1">
                {cart.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">
                        {it.product.name}
                      </p>
                      {it.notes && (
                        <p className="text-[10px] text-gray-400 italic">
                          * {it.notes}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-[#E87532] mt-0.5">
                        {formatRupiah(it.product.price * it.quantity)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateCartQty(idx, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white font-bold"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-bold">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateCartQty(idx, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form Input Pelanggan */}
              <form onSubmit={handleConfirmOrder} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    Nama Pemesan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kak Rian"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs focus:border-[#E87532] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`rounded-xl border p-2.5 font-bold transition text-left ${
                        paymentMethod === "cash"
                          ? "border-[#E87532] bg-orange-50 text-[#E87532] ring-1 ring-[#E87532]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      💵 Bayar di Kasir
                      <p className="text-[10px] font-normal text-gray-400 mt-0.5">
                        Tunai atau QRIS kasir
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("online")}
                      className={`relative rounded-xl border p-2.5 font-bold transition text-left ${
                        paymentMethod === "online"
                          ? "border-[#E87532] bg-orange-50 text-[#E87532] ring-1 ring-[#E87532]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>📱 QRIS Otomatis</span>
                        <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-black text-emerald-800">
                          Auto
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                        ⚡ Nominal terisi otomatis
                      </p>
                      <p className="text-[9px] text-gray-400">
                        E-Wallet & m-Banking
                      </p>
                    </button>
                  </div>
                </div>

                {/* Subtotal & Action */}
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-gray-500">Total Pembayaran:</span>
                    <span className="text-base font-black text-gray-900">
                      {formatRupiah(cartTotalPrice)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="w-full rounded-xl bg-[#E87532] py-3 text-xs font-bold text-white shadow-md hover:bg-[#d46525] transition active:scale-[0.99] disabled:opacity-50"
                  >
                    {submittingOrder
                      ? "Memproses Pesanan..."
                      : paymentMethod === "online"
                      ? `Lanjut Bayar QRIS Otomatis (${formatRupiah(cartTotalPrice)}) ⚡`
                      : "Kirim Pesanan ke Dapur 🚀"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal QRIS Dinamis Otomatis & Transfer Bank */}
      {qrisOrderData && (
        <DynamicQrisPaymentModal
          orderId={qrisOrderData.id}
          orderNumber={qrisOrderData.order_number}
          customerName={customerName || "Pelanggan Meja"}
          tableNumber={formattedTable}
          amount={qrisOrderData.total}
          restaurantName={restaurant?.name || "Burjobae"}
          restaurantId={restaurant?.id || "9435081d-0f91-4ae5-97aa-30df127d569d"}
          baseQrisPayload={getRestaurantPaymentInfo(restaurant).qrisPayload}
          bankName={getRestaurantPaymentInfo(restaurant).bankName}
          bankAccountNumber={getRestaurantPaymentInfo(restaurant).accountNumber}
          bankAccountHolder={getRestaurantPaymentInfo(restaurant).accountHolder}
          onPaymentSuccess={() => {
            setLivePaymentStatus("paid");
            setActiveTrackingOrder((prev) =>
              prev ? { ...prev, payment_status: "paid" } : prev
            );
            if (typeof window !== "undefined") {
              const storageKey = `menu_bae_active_order_${tableParam || "meja-01"}`;
              try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  parsed.payment_status = "paid";
                  localStorage.setItem(storageKey, JSON.stringify(parsed));
                }
              } catch {}
            }
            setQrisOrderData(null);
            setOrderSubmitted(true);
          }}
          onClose={() => {
            setQrisOrderData(null);
            setOrderSubmitted(true);
          }}
        />
      )}

      {/* Modal Live Order Tracker (jika dibuka dari menu utama) */}
      {activeTrackingOrder && (
        <CustomerOrderTracker
          order={activeTrackingOrder}
          restaurantName={restaurant?.name || "Burjobae"}
          restaurantPhone={restaurant?.phone}
          isOpen={isTrackerModalOpen}
          onClose={() => setIsTrackerModalOpen(false)}
          onOpenQris={() => {
            setIsTrackerModalOpen(false);
            setQrisOrderData({
              id: activeTrackingOrder.id,
              order_number: activeTrackingOrder.order_number,
              total: activeTrackingOrder.total,
            });
          }}
        />
      )}
    </div>
  );
}
