// Compression d'une photo d'identité côté client : redimensionne et encode en
// data-URL JPEG (~20-60 Ko). Stockée telle quelle en base (colonne TEXT), elle
// s'affiche partout sans infrastructure d'upload — indispensable pour le
// formulaire public qui n'a pas de JWT.

export function compressImageToDataUrl(
  file: File,
  maxDim = 480,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Le fichier doit être une image (JPG, PNG…).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible ou corrompue.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas non supporté par ce navigateur.')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
