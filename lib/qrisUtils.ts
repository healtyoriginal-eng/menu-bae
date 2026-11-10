"use client";

// Default base QRIS template for Burjobae (EMVCo / ASPI QRIS standard)
export const DEFAULT_BURJOBAE_QRIS =
  "00020101021126580016ID.CO.GOPAY.WWW011893600911002233445502081234567851440014ID.LINKAJA.WWW01189360091100223344550208123456785204581253033605802ID5908BURJOBAE6006YOGYAK6304";

/**
 * Calculates CRC16-CCITT (polynomial 0x1021, init 0xFFFF) for standard QRIS.
 */
export function calculateCrc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Converts any static QRIS string into a Dynamic QRIS string with the exact transaction amount
 * embedded in Tag 54, so mobile banking & e-wallet apps auto-fill the nominal without customer manual typing.
 */
export function generateDynamicQris(baseQris: string, amount: number): string {
  let qris = (baseQris || DEFAULT_BURJOBAE_QRIS).trim();

  // Strip existing CRC if present (e.g. 6304XXXX)
  if (qris.includes("6304")) {
    qris = qris.substring(0, qris.lastIndexOf("6304"));
  }

  // Change static 010211 to dynamic 010212
  qris = qris.replace("010211", "010212");

  // Format amount tag: Tag 54 + length + amount
  const roundedAmount = Math.max(1, Math.round(amount));
  const amountStr = roundedAmount.toString();
  const amountTag = "54" + amountStr.length.toString().padStart(2, "0") + amountStr;

  // Insert Tag 54 before Tag 58 (Country code) if exists, otherwise append
  if (qris.includes("5802ID")) {
    const parts = qris.split("5802ID");
    // Strip existing Tag 54 if present in parts[0]
    parts[0] = parts[0].replace(/54\d{2}\d+/, "");
    qris = parts[0] + amountTag + "5802ID" + parts[1];
  } else {
    qris = qris + amountTag;
  }

  // Append 6304 and compute final CRC16 checksum
  qris = qris + "6304";
  const checksum = calculateCrc16(qris);

  return qris + checksum;
}

/**
 * Returns QR code image URL for the generated Dynamic QRIS payload.
 */
export function getQrisImageUrl(qrisPayload: string, size: number = 320): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    qrisPayload
  )}`;
}

