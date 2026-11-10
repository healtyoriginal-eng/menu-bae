export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  banner_url?: string | null;
  description?: string | null;
  primary_color?: string;
  secondary_color?: string;
  address?: string | null;
  phone?: string | null;
  is_active: boolean;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  qris_payload?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantPaymentInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrisPayload: string;
  ownerPin: string;
  ownerEmail: string;
}

export function getRestaurantPaymentInfo(
  restaurant: Restaurant | null
): RestaurantPaymentInfo {
  let bankName = restaurant?.bank_name || "";
  let accountNumber = restaurant?.bank_account_number || "";
  let accountHolder = restaurant?.bank_account_holder || "";
  let qrisPayload = restaurant?.qris_payload || "";
  let ownerPin = "";
  let ownerEmail = "";

  if (restaurant?.banner_url) {
    try {
      const parsed = JSON.parse(restaurant.banner_url);
      if (parsed && typeof parsed === "object") {
        if (!bankName && parsed.bank_name) bankName = parsed.bank_name;
        if (!accountNumber && parsed.bank_account_number)
          accountNumber = parsed.bank_account_number;
        if (!accountHolder && parsed.bank_account_holder)
          accountHolder = parsed.bank_account_holder;
        if (!qrisPayload && parsed.qris_payload)
          qrisPayload = parsed.qris_payload;
        if (parsed.owner_pin) ownerPin = String(parsed.owner_pin);
        if (parsed.owner_email) ownerEmail = String(parsed.owner_email);
      }
    } catch {
      // bukan JSON
    }
  }

  return {
    bankName: bankName || "BCA",
    accountNumber: accountNumber || "8830-1234-5678",
    accountHolder: accountHolder || restaurant?.name || "Burjobae Official",
    qrisPayload: qrisPayload || "",
    ownerPin: ownerPin || "123456",
    ownerEmail: ownerEmail || "owner.burjobae@gmail.com",
  };
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_available: boolean;
  stock?: number | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
  // Joined relation
  category?: Category | null;
}

export interface DiningTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity?: number;
  status: "available" | "occupied" | "reserved";
  qr_code?: string | null;
  qr_url?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  notes?: string | null;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_number?: string;
  customer_name?: string;
  total_amount: number;
  status: "pending" | "preparing" | "served" | "completed" | "cancelled";
  payment_status: "unpaid" | "paid";
  items?: OrderItem[];
  created_at: string;
}

