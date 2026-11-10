/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Product, Category } from "@/lib/types";
import { resizeImage, formatFileSize } from "@/lib/imageUtils";

interface ProductsViewProps {
  restaurantId: string;
  onProductsUpdated?: () => void;
}

export function ProductsView({
  restaurantId,
  onProductsUpdated,
}: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    price: 15000,
    description: "",
    image_url: "",
    stock: 50,
    is_available: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const loadData = useCallback(async () => {
    setErrorMsg(null);
    try {
      // 1. Load Categories
      const { data: catData, error: catError } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      // 2. Load Products
      const { data: prodData, error: prodError } = await supabase
        .from("products")
        .select("*, category:categories(id, name)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (prodError) throw prodError;
      setProducts(prodData || []);
      if (onProductsUpdated) onProductsUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat produk";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, onProductsUpdated]);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      try {
        const { data: catData, error: catError } = await supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: true });

        if (!active) return;
        if (catError) throw catError;
        setCategories(catData || []);

        const { data: prodData, error: prodError } = await supabase
          .from("products")
          .select("*, category:categories(id, name)")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (prodError) throw prodError;
        setProducts(prodData || []);
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : "Gagal memuat produk";
          setErrorMsg(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (restaurantId) {
      initialLoad();
    }

    return () => {
      active = false;
    };
  }, [restaurantId]);

  function handleOpenCreateModal() {
    setEditingProduct(null);
    setSelectedFile(null);
    setImagePreview("");
    setCompressionInfo("");
    setFormData({
      name: "",
      category_id: categories[0]?.id || "",
      price: 15000,
      description: "",
      image_url: "",
      stock: 50,
      is_available: true,
    });
    setIsModalOpen(true);
  }

  function handleOpenEditModal(p: Product) {
    setEditingProduct(p);
    setSelectedFile(null);
    setImagePreview(p.image_url || "");
    setCompressionInfo(p.image_url ? "Foto produk saat ini" : "");
    setFormData({
      name: p.name,
      category_id: p.category_id || "",
      price: p.price,
      description: p.description || "",
      image_url: p.image_url || "",
      stock: p.stock ?? 50,
      is_available: p.is_available,
    });
    setIsModalOpen(true);
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    try {
      setCompressing(true);
      setCompressionInfo("Sedang mengoptimalkan & resize gambar...");

      // Resize ke maksimal 800x800px dan ubah ke format WebP berkualitas tinggi
      const resized = await resizeImage(originalFile, 800, 800, 0.85);
      setSelectedFile(resized);
      setImagePreview(URL.createObjectURL(resized));

      const origSize = formatFileSize(originalFile.size);
      const newSize = formatFileSize(resized.size);
      const savedPercent = Math.max(
        0,
        Math.round(((originalFile.size - resized.size) / originalFile.size) * 100)
      );

      setCompressionInfo(`Diresize & hemat ${savedPercent}% (${origSize} → ${newSize})`);
    } catch (err) {
      console.error("Gagal resize gambar:", err);
      // Fallback gunakan file asli jika canvas gagal
      setSelectedFile(originalFile);
      setImagePreview(URL.createObjectURL(originalFile));
      setCompressionInfo(`Ukuran asli: ${formatFileSize(originalFile.size)}`);
    } finally {
      setCompressing(false);
    }
  };

  async function uploadImageToSupabase(file: File): Promise<string> {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      throw new Error(
        `Upload gambar gagal: ${uploadError.message}. Pastikan bucket 'menu-images' berstatus Public di Supabase Storage.`
      );
    }

    const { data } = supabase.storage
      .from("menu-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let finalImageUrl = formData.image_url.trim() || null;

      // Jika user memilih file gambar lokal, upload ke bucket Supabase
      if (selectedFile) {
        finalImageUrl = await uploadImageToSupabase(selectedFile);
      }

      if (editingProduct) {
        // UPDATE
        const { error } = await supabase
          .from("products")
          .update({
            name: formData.name.trim(),
            category_id: formData.category_id || null,
            price: Number(formData.price),
            description: formData.description.trim() || null,
            image_url: finalImageUrl,
            stock: Number(formData.stock),
            is_available: formData.is_available,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingProduct.id);

        if (error) throw new Error(error.message);
        setSuccessMsg(`Menu "${formData.name}" berhasil diperbarui.`);
      } else {
        // INSERT
        const { error } = await supabase.from("products").insert([
          {
            restaurant_id: restaurantId,
            category_id: formData.category_id || null,
            name: formData.name.trim(),
            price: Number(formData.price),
            description: formData.description.trim() || null,
            image_url: finalImageUrl,
            stock: Number(formData.stock),
            is_available: formData.is_available,
          },
        ]);

        if (error) throw new Error(error.message);
        setSuccessMsg(`Menu "${formData.name}" berhasil ditambahkan.`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan menu";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAvailability(product: Product) {
    try {
      const newStatus = !product.is_available;
      const { error } = await supabase
        .from("products")
        .update({ is_available: newStatus })
        .eq("id", product.id);

      if (error) throw new Error(error.message);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_available: newStatus } : p
        )
      );
      if (onProductsUpdated) onProductsUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengubah status ketersediaan";
      setErrorMsg(message);
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSuccessMsg(`Menu "${name}" telah dihapus.`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (onProductsUpdated) onProductsUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menghapus menu";
      setErrorMsg(message);
    } finally {
      setDeletingId(null);
    }
  }

  // Filter items
  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === "all" || p.category_id === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description &&
        p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold text-[#171717]">Daftar Menu Makanan & Minuman</h3>
          <p className="mt-1 text-sm text-gray-500">
            Kelola nama menu, harga, ketersediaan porsi, dan deskripsi produk.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E87532] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d46525]"
        >
          <span>+</span>
          <span>Tambah Menu Baru</span>
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ✕ {errorMsg}
        </div>
      )}

      {/* Controls: Search & Category Pills */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Cari menu makanan atau minuman..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition ${
              selectedCategory === "all"
                ? "bg-[#171717] text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Semua ({products.length})
          </button>
          {categories.map((c) => {
            const count = products.filter((p) => p.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition ${
                  selectedCategory === c.id
                    ? "bg-[#E87532] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white"
            />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <span className="text-5xl">🍜</span>
          <p className="mt-3 text-base font-bold text-gray-800">
            {searchQuery
              ? `Tidak ada menu yang cocok dengan "${searchQuery}"`
              : "Belum ada menu di kategori ini"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Tambahkan produk makanan atau minuman pertama Anda sekarang.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-5 rounded-xl bg-[#E87532] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d46525]"
          >
            + Tambah Menu Baru
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-[#E87532]/40 hover:shadow-md"
            >
              <div>
                {/* Photo / Thumbnail */}
                <div className="relative flex h-36 w-full items-center justify-center bg-linear-to-br from-orange-50 to-amber-50">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">🍽️</span>
                  )}
                  {/* Category Pill Tag */}
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 backdrop-blur-xs shadow-xs">
                    {p.category?.name || "Menu"}
                  </span>
                  {/* Availability Badge */}
                  <button
                    onClick={() => handleToggleAvailability(p)}
                    className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-xs transition ${
                      p.is_available
                        ? "bg-emerald-500 text-white"
                        : "bg-rose-500 text-white"
                    }`}
                    title="Klik untuk ubah ketersediaan"
                  >
                    {p.is_available ? "Tersedia" : "Habis"}
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h4 className="font-bold text-gray-900 group-hover:text-[#E87532] transition">
                    {p.name}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                    {p.description || "Tidak ada deskripsi produk."}
                  </p>
                  <p className="mt-3 text-base font-black text-[#E87532]">
                    {formatRupiah(p.price)}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-xs">
                <span className="text-gray-400">
                  Stok: {p.stock !== null ? p.stock : "∞"}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    className="font-medium text-gray-600 hover:text-[#E87532]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setProductToDelete(p)}
                    disabled={deletingId === p.id}
                    className="font-medium text-rose-600 hover:underline disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Tambah/Edit Menu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingProduct ? "Edit Menu Makanan" : "Tambah Menu Makanan Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600">
                  Nama Menu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nasi Goreng Magelangan, Es Teh Tarik"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600">
                    Kategori Menu <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData({ ...formData, category_id: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                  >
                    <option value="">Pilih Kategori...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600">
                    Harga (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600">
                  Deskripsi Menu (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Nasi goreng khas dengan bumbu racikan, telur, dan kerupuk..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600">
                    Perkiraan Stok
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock: parseInt(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600">
                    Status Ketersediaan
                  </label>
                  <select
                    value={formData.is_available ? "available" : "out"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_available: e.target.value === "available",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                  >
                    <option value="available">Tersedia (Bisa dipesan)</option>
                    <option value="out">Habis (Sold Out)</option>
                  </select>
                </div>
              </div>

              {/* Upload Foto / URL */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Foto Makanan / Minuman (Opsional)
                </label>
                
                {/* Preview Thumbnail & Compression Stats */}
                {imagePreview ? (
                  <div className="relative mb-3 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50/50 p-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-16 w-16 rounded-xl object-cover border border-orange-200 bg-white"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-gray-800 truncate">
                        {selectedFile ? selectedFile.name : "Foto produk terpilih"}
                      </p>
                      {compressionInfo && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ⚡ {compressionInfo}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setImagePreview("");
                        setCompressionInfo("");
                        setFormData({ ...formData, image_url: "" });
                      }}
                      className="rounded-lg bg-white border border-gray-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-4 cursor-pointer hover:border-[#E87532] hover:bg-orange-50/30 transition">
                      <span className="text-2xl">📸</span>
                      <span className="mt-1 text-xs font-bold text-gray-700">
                        {compressing
                          ? "Sedang mengompresi gambar..."
                          : "Pilih Foto dari HP / Komputer"}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Otomatis di-resize (Maks. 800px) & dioptimalkan ke WebP
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={compressing}
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="text-[11px] text-gray-400 flex items-center gap-2 mb-1">
                  <span>Atau tempel URL gambar eksternal:</span>
                </div>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image_url}
                  onChange={(e) => {
                    const url = e.target.value;
                    setFormData({ ...formData, image_url: url });
                    if (url.startsWith("http")) {
                      setImagePreview(url);
                    }
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs focus:border-[#E87532] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#E87532] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#d46525] disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Menu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Hapus Produk */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl text-rose-600">
              🗑️
            </div>
            <h3 className="mt-3 text-lg font-black text-gray-900">
              Hapus Menu Makanan?
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Apakah Anda yakin ingin menghapus <strong className="text-gray-900">{productToDelete.name}</strong>? Menu ini tidak akan lagi tampil di halaman pelanggan.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingId === productToDelete.id}
                onClick={async () => {
                  await handleDeleteProduct(productToDelete.id, productToDelete.name);
                  setProductToDelete(null);
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition disabled:opacity-50"
              >
                {deletingId === productToDelete.id ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
