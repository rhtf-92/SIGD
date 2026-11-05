# ==============================================================================
# Dockerfile para Frontend Web SIGD (React 19 + TypeScript + Vite 6 + Tailwind 4)
# ------------------------------------------------------------------------------
# Node.js 24 es obligatorio: frontend/package.json declara
#   "engines": { "node": ">=24.19.0 <25" }
# Se usa la variante bookworm-slim (glibc) para que los binarios opcionales de
# Rollup/Tailwind se resuelvan sin incompatibilidades de plataforma.
# ==============================================================================

FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development \
    PORT=5173

# Instalar dependencias primero para aprovechar la cache de capas de Docker.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copiar solo lo necesario para ejecutar el servidor de desarrollo de Vite.
COPY tsconfig*.json vite*.config.ts eslint.config.js tailwind.config.ts ./
COPY *.html ./
COPY public/ ./public/
COPY src/ ./src/

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:5173/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Se invoca Vite directamente para evitar el flag --open del script "dev"
# (no hay navegador dentro del contenedor).
CMD ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
