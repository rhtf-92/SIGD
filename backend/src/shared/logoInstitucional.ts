import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedBuffer: Buffer | null = null;

export function obtenerLogoSuizaPngBuffer(): Buffer {
  if (cachedBuffer) return cachedBuffer;

  let currentDir = '';
  try {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    currentDir = process.cwd();
  }

  const posiblesRutas = [
    path.join(currentDir, '../assets/logo-suiza.png'),
    path.resolve(process.cwd(), 'src/assets/logo-suiza.png'),
    path.resolve(process.cwd(), 'backend/src/assets/logo-suiza.png'),
    '/app/src/assets/logo-suiza.png',
    path.resolve(process.cwd(), '../frontend/src/assets/sigd/logo-suiza.png'),
    path.resolve(process.cwd(), 'frontend/src/assets/sigd/logo-suiza.png'),
  ];

  for (const ruta of posiblesRutas) {
    try {
      if (fs.existsSync(ruta)) {
        cachedBuffer = fs.readFileSync(ruta);
        return cachedBuffer;
      }
    } catch {
      // Intentar siguiente ruta
    }
  }

  return Buffer.alloc(0);
}
