"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Category } from "@/lib/types";

interface CategoriesViewProps {
  restaurantId: string;
  onCategoriesUpdated?: () => void;
}

export function CategoriesView({
  restaurantId,
  onCategoriesUpdated,
}: CategoriesViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sort_order: 1,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      if (onCategoriesUpdated) onCategoriesUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat kategori";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, onCategoriesUpdated]);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: true });

        if (!active) return;
        if (error) throw error;
        setCategories(data || []);
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : "Gagal memuat kategori";
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
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      sort_order: categories.length + 1,
      is_active: true,
    });
    setIsModalOpen(true);
  }

  function handleOpenEditModal(cat: Category) {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setIsModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingCategory) {
        // UPDATE
        const { error } = await supabase
          .from("categories")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            sort_order: Number(formData.sort_order),
            is_active: formData.is_active,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        setSuccessMsg(`Kategori "${formData.name}" berhasil diperbarui.`);
      } else {
        // INSERT
        const { error } = await supabase.from("categories").insert([
          {
            restaurant_id: restaurantId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            sort_order: Number(formData.sort_order),
            is_active: formData.is_active,
          },
        ]);

        if (error) throw error;
        setSuccessMsg(`Kategori "${formData.name}" berhasil ditambahkan.`);
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan kategori";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(category: Category) {
    try {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;
      setCategories((prev) =>
        prev.map((c) =>
          c.id === category.id ? { ...c, is_active: !c.is_active } : c
        )
      );
      if (onCategoriesUpdated) onCategoriesUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengubah status";
      setErrorMsg(message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold text-[#171717]">Kategori Menu</h3>
          <p className="mt-1 text-sm text-gray-500">
            Kelola kategori untuk mengelompokkan produk makanan dan minuman.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E87532] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d46525]"
        >
          <span>+</span>
          <span>Tambah Kategori</span>
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

      {/* Category List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-white p-5"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <span className="text-4xl">📂</span>
          <p className="mt-3 text-base font-bold text-gray-800">
            Belum ada kategori menu
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Buat kategori pertama Anda untuk memudahkan pelanggan memilih makanan.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-5 rounded-xl bg-[#E87532] px-4 py-2 text-sm font-semibold text-white"
          >
            + Buat Kategori Baru
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition hover:border-[#E87532]/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 font-bold text-[#E87532]">
                      #{cat.sort_order}
                    </span>
                    <h4 className="font-bold text-gray-900">{cat.name}</h4>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(cat)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      cat.is_active
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {cat.is_active ? "● Aktif" : "○ Nonaktif"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-500 line-clamp-2">
                  {cat.description || "Tidak ada deskripsi"}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                <span className="text-gray-400">Urutan: {cat.sort_order}</span>
                <button
                  onClick={() => handleOpenEditModal(cat)}
                  className="font-semibold text-[#E87532] hover:underline"
                >
                  Edit Kategori →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Tambah/Edit Kategori */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Makanan Berat, Minuman Segar"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600">
                  Deskripsi Kategori (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Aneka sajian olahan nasi dan mie..."
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
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sort_order: parseInt(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600">
                    Status
                  </label>
                  <select
                    value={formData.is_active ? "active" : "inactive"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_active: e.target.value === "active",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#E87532] focus:outline-none focus:ring-1 focus:ring-[#E87532]"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
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
                  {saving ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
