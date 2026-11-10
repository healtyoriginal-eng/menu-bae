/**
 * Kompresi dan resize gambar di sisi browser menggunakan HTML5 Canvas
 * @param file File asli dari input user (misal 5MB foto kamera)
 * @param maxWidth Lebar maksimum (default 800px)
 * @param maxHeight Tinggi maksimum (default 800px)
 * @param quality Kualitas kompresi WebP (0.1 - 1.0, default 0.85)
 * @returns File baru dalam format WebP yang sudah dikompresi (biasanya ~60KB - 150KB)
 */
export function resizeImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Jika bukan file gambar, kembalikan file asli
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung aspek rasio agar gambar tidak gepeng
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        // Haluskan render saat resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor ke WebP untuk ukuran paling hemat & tajam
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const resizedFile = new File([blob], cleanName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve(resizedFile);
          },
          "image/webp",
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

/**
 * Format ukuran byte ke KB atau MB yang mudah dibaca
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

