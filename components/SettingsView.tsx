"use client";

import { useState } from "react";
import { Restaurant, getRestaurantPaymentInfo } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface SettingsViewProps {
  restaurant: Restaurant | null;
  onRestaurantUpdated?: (updated: Restaurant) => void;
}

function maskEmail(email: string) {
  if (!email || !email.includes("@")) return "ow***@email.com";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `${user}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export function SettingsView({
  restaurant,
  onRestaurantUpdated,
}: SettingsViewProps) {
  const initialPayment = getRestaurantPaymentInfo(restaurant);

  // Security Lock State (Owner PIN Gate)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [ownerPin, setOwnerPin] = useState(initialPayment.ownerPin || "123456");
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Forgot PIN & Email Recovery State
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [newPinAfterOtp, setNewPinAfterOtp] = useState("");
  const [confirmPinAfterOtp, setConfirmPinAfterOtp] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  // Change PIN inside Settings Form
  const [changePinInput, setChangePinInput] = useState("");
  const [changePinConfirm, setChangePinConfirm] = useState("");

  const [formData, setFormData] = useState({
    name: restaurant?.name || "Burjobae",
    slug: restaurant?.slug || "burjobae",
    phone: restaurant?.phone || "0812-3456-7890",
    address: restaurant?.address || "Jl. Cemara Raya",
    description: restaurant?.description || "Burjo modern dengan menu khas andalan dan suasana nyaman.",
    primary_color: restaurant?.primary_color || "#E87532",
    is_active: restaurant?.is_active ?? true,
    bank_name: initialPayment.bankName || "BCA",
    bank_account_number: initialPayment.accountNumber || "8830-1234-5678",
    bank_account_holder: initialPayment.accountHolder || "Burjobae Official",
    qris_payload: initialPayment.qrisPayload || "",
    owner_email: initialPayment.ownerEmail || "owner.burjobae@gmail.com",
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verifikasi PIN
  function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    if (enteredPin.trim() === ownerPin.trim()) {
      setIsUnlocked(true);
      setEnteredPin("");
      setPinError(null);
    } else {
      setPinError("PIN Pemilik salah! Silakan coba lagi atau gunakan opsi Lupa PIN.");
    }
  }

  // Kirim Kode OTP ke Email Pemilik
  function handleSendOtp() {
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(generated);
    setRecoveryMessage(
      `Kode verifikasi reset telah dikirim ke ${maskEmail(formData.owner_email)}! (Simulasi Kode OTP: ${generated})`
    );
  }

  // Reset PIN dengan OTP
  function handleResetPinWithOtp(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);

    if (!otpCode || enteredOtp.trim() !== otpCode) {
      setPinError("Kode OTP salah atau belum cocok! Periksa kembali email Anda.");
      return;
    }

    if (newPinAfterOtp.trim().length < 4 || newPinAfterOtp.trim().length > 8) {
      setPinError("PIN baru minimal 4 hingga 8 digit angka.");
      return;
    }

    if (newPinAfterOtp.trim() !== confirmPinAfterOtp.trim()) {
      setPinError("Konfirmasi PIN baru tidak sesuai!");
      return;
    }

    const updatedPin = newPinAfterOtp.trim();
    setOwnerPin(updatedPin);
    setIsForgotMode(false);
    setIsUnlocked(true);
    setSuccessMsg("PIN Pemilik berhasil di-reset dan Anda telah masuk ke Pengaturan!");
  }

  // Simpan Pengaturan
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const targetId = restaurant?.id || "9435081d-0f91-4ae5-97aa-30df127d569d";

    // Validasi jika owner ingin ganti PIN
    let activePin = ownerPin;
    if (changePinInput.trim()) {
      if (changePinInput.trim() !== changePinConfirm.trim()) {
        setErrorMsg("Konfirmasi PIN baru tidak cocok!");
        return;
      }
      if (changePinInput.trim().length < 4) {
        setErrorMsg("PIN baru minimal 4 digit.");
        return;
      }
      activePin = changePinInput.trim();
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const paymentPayload = {
        bank_name: formData.bank_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_account_holder: formData.bank_account_holder.trim(),
        qris_payload: formData.qris_payload.trim(),
        owner_pin: activePin,
        owner_email: formData.owner_email.trim(),
      };

      const updateData: Record<string, unknown> = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        description: formData.description.trim() || null,
        primary_color: formData.primary_color,
        is_active: formData.is_active,
        banner_url: JSON.stringify(paymentPayload),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("restaurants")
        .update(updateData)
        .eq("id", targetId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setOwnerPin(activePin);
      setChangePinInput("");
      setChangePinConfirm("");
      setSuccessMsg("Pengaturan profil, rekening bank & PIN pemilik berhasil disimpan!");

      if (onRestaurantUpdated && data) {
        onRestaurantUpdated({
          ...data,
          ...paymentPayload,
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal menyimpan pengaturan";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  // TAMPILAN 1: JIKA TERKUNCI (PIN LOCK SCREEN)
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="rounded-3xl border border-gray-200 bg-white p-7 shadow-xl text-center">
          {/* Lock Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-3xl text-amber-600 ring-8 ring-amber-50">
            🔒
          </div>

          <div className="mt-4">
            <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-700">
              Akses Khusus Pemilik Resto
            </span>
            <h3 className="mt-2 text-xl font-black text-gray-900 tracking-tight">
              Verifikasi PIN Keamanan
            </h3>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              Menu Pengaturan memuat informasi sensitif (No. Rekening Bank, QRIS, & Data Restoran). Masukkan PIN Pemilik untuk mengakses.
            </p>
          </div>

          {pinError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
              ✕ {pinError}
            </div>
          )}

          {!isForgotMode ? (
            /* Form Input PIN */
            <form onSubmit={handleVerifyPin} className="mt-5 space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={8}
                  autoFocus
                  required
                  placeholder="Masukkan 6-Digit PIN"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full text-center text-2xl tracking-[0.35em] font-mono font-bold rounded-2xl border border-gray-300 bg-gray-50 py-3 text-gray-900 focus:border-[#E87532] focus:bg-white focus:outline-none transition shadow-inner"
                />
              </div>

              {ownerPin === "123456" && (
                <div className="rounded-xl bg-amber-50/80 p-2.5 text-[11px] text-amber-800 border border-amber-200 text-left">
                  💡 <strong>PIN Bawaan Awal:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded font-bold font-mono">123456</code>. <em>(Dapat Anda ganti setelah berhasil membuka pengaturan).</em>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#E87532] py-3 text-xs font-bold text-white shadow-md hover:bg-[#d46525] active:scale-95 transition"
              >
                🔓 Buka Pengaturan
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(true);
                    setPinError(null);
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-[#E87532] transition underline underline-offset-2"
                >
                  Lupa PIN Pemilik? Kirim kode reset ke Email
                </button>
              </div>
            </form>
          ) : (
            /* Form Pemulihan PIN via Email */
            <div className="mt-5 space-y-4 text-left">
              <div className="rounded-2xl bg-orange-50/70 p-3.5 border border-orange-100 text-xs text-orange-950 space-y-1">
                <p className="font-bold">Pemulihan PIN via Email Pemilik:</p>
                <p className="text-[11px] text-orange-800">
                  Kode verifikasi akan dikirimkan ke email pemilik terdaftar:
                </p>
                <p className="font-mono font-bold text-gray-900 text-xs">
                  📧 {maskEmail(formData.owner_email)}
                </p>
              </div>

              {recoveryMessage && (
                <div className="rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200 font-semibold">
                  ✓ {recoveryMessage}
                </div>
              )}

              {!otpCode ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="w-full rounded-2xl bg-[#171717] py-3 text-xs font-bold text-white hover:bg-gray-800 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <span>📧</span>
                  <span>Kirim Kode OTP ke Email Pemilik</span>
                </button>
              ) : (
                <form onSubmit={handleResetPinWithOtp} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700">
                      Kode OTP dari Email
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 123456"
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono font-bold text-center tracking-widest focus:border-[#E87532] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700">
                        PIN Baru
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="PIN Baru"
                        value={newPinAfterOtp}
                        onChange={(e) => setNewPinAfterOtp(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-center focus:border-[#E87532] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700">
                        Konfirmasi PIN
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Ulangi PIN"
                        value={confirmPinAfterOtp}
                        onChange={(e) => setConfirmPinAfterOtp(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-center focus:border-[#E87532] focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition"
                  >
                    ✓ Simpan PIN Baru & Masuk
                  </button>
                </form>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setPinError(null);
                  }}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition"
                >
                  ← Kembali ke Masukkan PIN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // TAMPILAN 2: JIKA SUDAH TERVERIFIKASI PIN (SETTINGS UNLOCKED)
  return (
    <div className="max-w-3xl space-y-6">
      {/* Top Banner Status Unlocked */}
      <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base text-emerald-800">
            ✓
          </span>
          <div>
            <h4 className="text-xs font-bold text-emerald-900">
              Terverifikasi Sebagai Pemilik Restoran (Owner Mode)
            </h4>
            <p className="text-[11px] text-emerald-700">
              Anda memiliki izin penuh untuk mengubah nomor rekening, QRIS, dan profil toko.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsUnlocked(false);
            setSuccessMsg(null);
          }}
          className="rounded-xl border border-emerald-300 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-95 flex items-center gap-1.5 shadow-2xs"
          title="Kunci kembali menu pengaturan agar kasir tidak dapat mengubah data"
        >
          <span>🔒</span>
          <span>Kunci Kembali</span>
        </button>
      </div>

      <div>
        <h3 className="text-xl font-bold text-[#171717]">Pengaturan Profil & Rekening Restoran</h3>
        <p className="mt-1 text-sm text-gray-500">
          Atur informasi resto, rekening bank penampung, QRIS, serta keamanan PIN pemilik.
        </p>
      </div>

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

      <form
        onSubmit={handleSaveSettings}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-5"
      >
        {/* Identitas Resto */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-gray-700">
              Nama Restoran
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700">
              Slug URL Restoran (Permanen)
            </label>
            <input
              type="text"
              disabled
              value={formData.slug}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 font-mono text-xs text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Alamat web menu: menu-bae.com/{formData.slug}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700">
            Deskripsi Singkat Restoran
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-gray-700">
              Nomor WhatsApp / Telepon Resto
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700">
              Warna Tema Branding (Primary Color)
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                type="color"
                value={formData.primary_color}
                onChange={(e) =>
                  setFormData({ ...formData, primary_color: e.target.value })
                }
                className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 p-1"
              />
              <span className="font-mono text-xs text-gray-600 uppercase">
                {formData.primary_color}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700">
            Alamat Restoran
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-[#E87532] focus:outline-none"
          />
        </div>

        {/* Pengaturan Rekening Bank & QRIS Restoran */}
        <div className="rounded-2xl border border-orange-200/90 bg-orange-50/40 p-5 space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-orange-200/60">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-lg text-[#E87532]">
              🏦
            </span>
            <div>
              <h4 className="text-xs font-bold text-gray-900">
                Informasi Rekening Bank & QRIS Toko (Dilindungi PIN)
              </h4>
              <p className="text-[11px] text-gray-500">
                Rekening dan QRIS ini langsung tampil saat pelanggan membayar pesanan secara online di meja.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-gray-700">
                Nama Bank Resto
              </label>
              <select
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-[#E87532] focus:outline-none"
              >
                <option value="BCA">BCA (Bank Central Asia)</option>
                <option value="Mandiri">Bank Mandiri</option>
                <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                <option value="BNI">BNI (Bank Negara Indonesia)</option>
                <option value="BSI">BSI (Bank Syariah Indonesia)</option>
                <option value="CIMB Niaga">CIMB Niaga</option>
                <option value="Bank Jago">Bank Jago</option>
                <option value="SeaBank">SeaBank</option>
                <option value="Permata">Bank Permata</option>
                <option value="Lainnya">Bank Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">
                Nomor Rekening
              </label>
              <input
                type="text"
                placeholder="Contoh: 8830123456"
                value={formData.bank_account_number}
                onChange={(e) =>
                  setFormData({ ...formData, bank_account_number: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-xs font-bold text-gray-900 focus:border-[#E87532] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">
                Atas Nama (A.N. Pemilik Rekening)
              </label>
              <input
                type="text"
                placeholder="Contoh: Burjobae Official"
                value={formData.bank_account_holder}
                onChange={(e) =>
                  setFormData({ ...formData, bank_account_holder: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-900 focus:border-[#E87532] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700">
                String / Teks QRIS Merchant Milik Resto (Opsional)
              </label>
              <span className="text-[10px] text-[#E87532] font-semibold bg-orange-100/70 px-2 py-0.5 rounded-full">
                QRIS Bank / E-Wallet
              </span>
            </div>
            <textarea
              rows={2}
              placeholder="Contoh: 00020101021126590014ID.LINKAJA.WWW... (Tempelkan teks QRIS toko Anda di sini)"
              value={formData.qris_payload}
              onChange={(e) =>
                setFormData({ ...formData, qris_payload: e.target.value })
              }
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-[11px] text-gray-700 focus:border-[#E87532] focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              💡 <em>Jika dikosongkan, sistem akan otomatis menggunakan QRIS default Burjobae. Jika diisi kode QRIS toko Anda, nominal pesanan pelanggan akan otomatis terkunci langsung masuk ke rekening QRIS toko Anda!</em>
            </p>
          </div>
        </div>

        {/* Bagian Keamanan Akun & PIN Pemilik */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200 text-lg text-gray-700">
              🔐
            </span>
            <div>
              <h4 className="text-xs font-bold text-gray-900">
                Keamanan Akun & PIN Pemilik (Owner Security)
              </h4>
              <p className="text-[11px] text-gray-500">
                Lindungi akses menu Pengaturan & Rekening dengan PIN dan email pemulihan terverifikasi.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-gray-700">
                Email Pemilik untuk Pemulihan PIN
              </label>
              <input
                type="email"
                required
                placeholder="Contoh: owner.burjobae@gmail.com"
                value={formData.owner_email}
                onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs focus:border-[#E87532] focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Digunakan untuk mengirim kode OTP jika Anda lupa PIN.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">
                PIN Pemilik Saat Ini
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono font-bold text-sm bg-gray-100 px-3 py-2 rounded-xl text-gray-700">
                  ••••••
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  ✓ PIN Aktif
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs font-bold text-gray-800 mb-2">
              Ingin Mengubah PIN Pemilik? (Opsional)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                placeholder="PIN Baru (4-8 Digit Angka)"
                value={changePinInput}
                onChange={(e) => setChangePinInput(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono focus:border-[#E87532] focus:outline-none"
              />
              <input
                type="password"
                placeholder="Konfirmasi PIN Baru"
                value={changePinConfirm}
                onChange={(e) => setChangePinConfirm(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono focus:border-[#E87532] focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Kosongkan kedua kolom di atas jika tidak ingin mengubah PIN saat ini.
            </p>
          </div>
        </div>

        {/* Status Buka / Tutup */}
        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-4 w-4 rounded text-[#E87532] focus:ring-[#E87532]"
            />
            <div>
              <span className="text-xs font-bold text-gray-800">
                Restoran Buka & Menerima Pesanan
              </span>
              <p className="text-[11px] text-gray-400">
                Jika dinonaktifkan, menu pelanggan akan menampilkan keterangan toko sedang tutup.
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#E87532] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#d46525] disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}
