// Compression d'une photo d'identité côté client : redimensionne et encode en
// data-URL JPEG (~20-60 Ko). Stockée telle quelle en base (colonne TEXT), elle
// s'affiche partout sans infrastructure d'upload — indispensable pour le
// formulaire public qui n'a pas de JWT.

// Convertit une pièce justificative en data-URL :
// - images → compressées via canvas (max 1400px, JPEG qualité 0.8)
// - PDF   → lu tel quel, refusé au-delà de 3 Mo
export async function fileToDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  if (!file || file.size === 0) {
    throw new Error('Le fichier est vide ou introuvable.');
  }

  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error(`« ${file.name} » dépasse 3 Mo. Compressez le PDF ou scannez en qualité réduite.`);
    }
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, mimeType: 'application/pdf' };
  }
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) {
    const dataUrl = await compressImageToDataUrl(file, 1400, 0.8);
    return { dataUrl, mimeType: 'image/jpeg' };
  }
  throw new Error('Format non pris en charge — utilisez une image (JPG, PNG) ou un PDF.');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => {
      reader.abort();
      reject(new Error('Lecture du fichier trop lente. Réessayez.'));
    }, 30000);
    reader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Impossible de lire « ${file.name} ».`));
    };
    reader.onload = () => {
      clearTimeout(timeout);
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Erreur de lecture du fichier.'));
      }
    };
    reader.readAsDataURL(file);
  });
}

export function compressImageToDataUrl(
  file: File,
  maxDim = 480,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) {
      reject(new Error('Le fichier doit être une image (JPG, PNG…).'));
      return;
    }
    const reader = new FileReader();
    const timeout = setTimeout(() => {
      reader.abort();
      reject(new Error('Lecture de l\'image trop lente. Réessayez avec une image plus petite.'));
    }, 30000);
    reader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Impossible de lire « ${file.name} ».`));
    };
    reader.onload = () => {
      clearTimeout(timeout);
      const img = new Image();
      img.onerror = () => reject(new Error(`Image illisible ou corrompue : « ${file.name} ».`));
      img.onload = () => {
        try {
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
        } catch (e: any) {
          reject(new Error(`Compression échouée : ${e?.message || 'erreur interne'}`));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
