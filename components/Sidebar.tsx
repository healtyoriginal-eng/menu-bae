"use client";

interface SidebarProps {
  active: string;
  setActive: (name: string) => void;
  restaurantName: string;
  dbConnected: boolean | null;
}

export const menuItems = [
  { name: "Dashboard", icon: "▦", desc: "Ringkasan operasional" },
  { name: "Pesanan", icon: "▤", desc: "Aktivitas pesanan live" },
  { name: "Kategori Menu", icon: "▧", desc: "Kategori makanan & minuman" },
  { name: "Daftar Menu", icon: "☷", desc: "Katalog produk & harga" },
  { name: "Meja", icon: "🪑", desc: "Manajemen meja & QR Code" },
  { name: "Laporan", icon: "▥", desc: "Laporan penjualan & omzet" },
  { name: "Pengaturan", icon: "⚙", desc: "Profil & identitas resto" },
];

export function Sidebar({ active, setActive, restaurantName, dbConnected }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col justify-between border-r border-gray-200 bg-white p-6 md:flex">
      <div>
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E87532] text-lg font-black text-white shadow-sm">
              M
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#171717]">
                MENU <span className="text-[#E87532]">BAE.</span>
              </h1>
              <p className="text-[11px] font-medium text-gray-400">Restaurant Management</p>
            </div>
          </div>
        </div>

        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Menu Utama
        </p>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = active === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActive(item.name)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? "bg-[#E87532] text-white shadow-sm shadow-[#E87532]/25"
                    : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                }`}
              >
                <span
                  className={`text-base transition ${
                    isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="rounded-2xl border border-orange-100 bg-[#fff8f4] p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#171717]">{restaurantName}</p>
            <p className="text-xs text-gray-500">Akun Owner</p>
          </div>
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              dbConnected === true
                ? "bg-emerald-500 ring-4 ring-emerald-100"
                : dbConnected === false
                ? "bg-rose-500 ring-4 ring-rose-100"
                : "bg-amber-400 ring-4 ring-amber-100 animate-pulse"
            }`}
            title={
              dbConnected === true
                ? "Database Supabase Terhubung"
                : dbConnected === false
                ? "Koneksi Database Bermasalah"
                : "Menghubungkan ke Supabase..."
            }
          />
        </div>
      </div>
    </aside>
  );
}

