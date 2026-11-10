"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { playKitchenChimeTriple } from "@/lib/audioUtils";

// Modular Components
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/DashboardView";
import { CategoriesView } from "@/components/CategoriesView";
import { ProductsView } from "@/components/ProductsView";
import { TablesView } from "@/components/TablesView";
import { OrdersView } from "@/components/OrdersView";
import { ReportsView } from "@/components/ReportsView";
import { SettingsView } from "@/components/SettingsView";
import {
  NewOrderFloatingAlert,
  UnacceptedOrder,
} from "@/components/NewOrderFloatingAlert";

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categoryCount, setCategoryCount] = useState<number>(0);
  const [productCount, setProductCount] = useState<number>(0);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Pesanan baru yang belum diterima kasir (untuk notif mengambang)
  const [unacceptedOrders, setUnacceptedOrders] = useState<UnacceptedOrder[]>([]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadRestaurant() {
      try {
        const { data: restData, error: restError } = await supabase
          .from("restaurants")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (!isSubscribed) return;

        if (restError) {
          console.error("Error fetching restaurant:", restError);
          setDbConnected(false);
          return;
        }

        setDbConnected(true);
        if (restData) {
          setRestaurant(restData);

          const { count: catCount } = await supabase
            .from("categories")
            .select("*", { count: "exact", head: true })
            .eq("restaurant_id", restData.id);

          if (isSubscribed) {
            setCategoryCount(catCount ?? 0);
          }

          const { count: prodCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("restaurant_id", restData.id);

          if (isSubscribed) {
            setProductCount(prodCount ?? 0);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          console.error("Unexpected error connecting to Supabase:", err);
          setDbConnected(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      isSubscribed = false;
    };
  }, [refreshTrigger]);

  const restaurantName = restaurant?.name || "Burjobae";
  const restaurantId = restaurant?.id || "9435081d-0f91-4ae5-97aa-30df127d569d";

  useEffect(() => {
    let isSubscribed = true;

    async function fetchUnacceptedInitial() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_number, customer_name, notes, total, order_status")
          .eq("restaurant_id", restaurantId)
          .in("order_status", ["new", "accepted"])
          .order("created_at", { ascending: false });

        if (!isSubscribed) return;
        if (error) {
          console.error("Gagal membaca unaccepted orders:", error);
          return;
        }

        if (data) {
          setUnacceptedOrders(
            data.map((o) => ({
              id: o.id,
              order_number: o.order_number,
              customer_name: o.customer_name || "Pelanggan",
              table_number: o.notes || "Meja",
              total: o.total,
            }))
          );
        }
      } catch (err) {
        if (isSubscribed) {
          console.error("Error fetch unaccepted:", err);
        }
      }
    }

    fetchUnacceptedInitial();

    // Subscribe ke Realtime Channel untuk pesanan baru
    const channel = supabase
      .channel(`restaurant-${restaurantId}`)
      .on("broadcast", { event: "new_order" }, (payload) => {
        // Bunyikan bel dapur 3 kali!
        playKitchenChimeTriple();

        const incoming = payload.payload;
        if (incoming) {
          setUnacceptedOrders((prev) => [
            {
              id: incoming.id,
              order_number: incoming.order_number,
              customer_name: incoming.customer_name || "Pelanggan",
              table_number: incoming.table_number || "Meja",
              total: incoming.total,
            },
            ...prev.filter((p) => p.id !== incoming.id),
          ]);
        }
      })
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  // Handler saat kasir menerima pesanan (hilangkan dari notifikasi mengambang)
  async function handleAcceptOrder(orderId: string) {
    try {
      // 1. Update status pesanan di database ke preparing (Sedang Dimasak)
      await supabase
        .from("orders")
        .update({ order_status: "preparing", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      // 2. Hilangkan dari notif mengambang
      setUnacceptedOrders((prev) => prev.filter((o) => o.id !== orderId));

      // 3. Broadcast status update
      const channel = supabase.channel(`restaurant-${restaurantId}`);
      await channel.send({
        type: "broadcast",
        event: "order_status_updated",
        payload: { order_id: orderId, status: "preparing" },
      });
    } catch (err) {
      console.error("Gagal menerima pesanan:", err);
      setUnacceptedOrders((prev) => prev.filter((o) => o.id !== orderId));
    }
  }

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Determine Quick Action button on Header
  let quickActionLabel: string | undefined;
  let onQuickAction: (() => void) | undefined;

  if (active === "Dashboard" || active === "Daftar Menu") {
    quickActionLabel = "Menu Baru";
    onQuickAction = () => setActive("Daftar Menu");
  } else if (active === "Kategori Menu") {
    quickActionLabel = "Kategori Baru";
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#171717] font-sans antialiased">
      {/* NOTIFIKASI MENGAMBANG PESANAN BARU (Hilang jika sudah diterima kasir) */}
      <NewOrderFloatingAlert
        orders={unacceptedOrders}
        onAcceptOrder={handleAcceptOrder}
        onViewKitchen={() => setActive("Pesanan")}
      />

      {/* Desktop Sidebar */}
      <Sidebar
        active={active}
        setActive={setActive}
        restaurantName={restaurantName}
        dbConnected={dbConnected}
      />

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E87532] text-lg font-black text-white">
                    M
                  </span>
                  <div>
                    <h1 className="text-xl font-black text-[#171717]">
                      MENU <span className="text-[#E87532]">BAE.</span>
                    </h1>
                    <p className="text-[11px] text-gray-400">Restaurant Management</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <nav className="space-y-1">
                {[
                  { name: "Dashboard", icon: "▦" },
                  { name: "Pesanan", icon: "▤" },
                  { name: "Kategori Menu", icon: "▧" },
                  { name: "Daftar Menu", icon: "☷" },
                  { name: "Meja", icon: "🪑" },
                  { name: "Laporan", icon: "▥" },
                  { name: "Pengaturan", icon: "⚙" },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setActive(item.name);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                      active === item.name
                        ? "bg-[#E87532] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-sm font-bold">{restaurantName}</p>
              <p className="text-xs text-gray-500">Akun Owner</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        <Header
          active={active}
          restaurantName={restaurantName}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          quickActionLabel={quickActionLabel}
          onQuickAction={onQuickAction}
        />

        <main className="flex-1 p-6 md:p-10">
          {active === "Dashboard" && (
            <DashboardView
              restaurant={restaurant}
              productCount={productCount}
              categoryCount={categoryCount}
              dbConnected={dbConnected}
              onNavigate={(section) => setActive(section)}
            />
          )}

          {active === "Kategori Menu" && (
            <CategoriesView
              restaurantId={restaurantId}
              onCategoriesUpdated={triggerRefresh}
            />
          )}

          {active === "Daftar Menu" && (
            <ProductsView
              restaurantId={restaurantId}
              onProductsUpdated={triggerRefresh}
            />
          )}

          {active === "Meja" && (
            <TablesView
              restaurantSlug={restaurant?.slug || "burjobae"}
              restaurantId={restaurantId}
            />
          )}

          {active === "Pesanan" && (
            <OrdersView
              restaurantId={restaurantId}
              onOrderAccepted={(id) => {
                setUnacceptedOrders((prev) => prev.filter((o) => o.id !== id));
              }}
            />
          )}

          {active === "Laporan" && (
            <ReportsView restaurantId={restaurantId} />
          )}

          {active === "Pengaturan" && (
            <SettingsView
              key={restaurant?.updated_at || restaurant?.id || "settings"}
              restaurant={restaurant}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
