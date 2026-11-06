# ==============================================================================
# Dockerfile para Backend API SIGD (Node.js 20 LTS + Express 5 + TypeScript)
# Multi-stage build optimizado para seguridad, rendimiento y dependencias nativas
# ==============================================================================

# --- Etapa 1: Builder y Compilacion ---
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Herramientas requeridas por dependencias con bindings nativos (argon2/node-gyp).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

# Instalar dependencias (incluye devDependencies necesarias para compilar TS).
RUN npm install --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
COPY migraciones/ ./migraciones/

# Compilar TypeScript a JavaScript en dist/
RUN npm run build

# --- Etapa 2: Imagen Final Ligera de Ejecucion ---
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=development \
    PORT=3000

# Copiar manifiesto, dependencias ya compiladas y artefactos transpilados.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/migraciones ./migraciones

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=25s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
