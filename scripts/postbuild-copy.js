import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
const dist200 = path.resolve(__dirname, '..', 'dist', '200.html');

try {
  if (fs.existsSync(distIndex)) {
    fs.copyFileSync(distIndex, dist200);
    console.log('Copied dist/index.html -> dist/200.html');
  } else {
    console.warn('dist/index.html not found; skipping 200.html copy');
  }
} catch (err) {
  console.error('Error copying 200.html fallback:', err);
  process.exitCode = 0;
}
