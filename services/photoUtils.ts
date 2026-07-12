// Compression d'une photo d'identité côté client : redimensionne et encode en
// data-URL JPEG (~20-60 Ko). Stockée telle quelle en base (colonne TEXT), elle
// s'affiche partout sans infrastructure d'upload — indispensable pour le
// formulaire public qui n'a pas de JWT.

// Convertit une pièce justificative en data-URL :
// - images → compressées via canvas (max 1400px, JPEG qualité 0.8)
// - PDF   → lu tel quel, refusé au-delà de 3 Mo
export async function fileToDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error(`« ${file.name} » dépasse 3 Mo. Compressez le PDF ou scannez en qualité réduite.`);
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    return { dataUrl, mimeType: 'application/pdf' };
  }
  if (file.type.startsWith('image/')) {
    // 1400px suffit pour lire un document scanné, et reste léger
    const dataUrl = await compressImageToDataUrl(file, 1400, 0.8);
    return { dataUrl, mimeType: 'image/jpeg' };
  }
  throw new Error('Format non pris en charge — utilisez une image (JPG, PNG) ou un PDF.');
}

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
