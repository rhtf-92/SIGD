# ==============================================================================
# Etapa 1: Builder (Compilación y dependencias completas)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

# ==============================================================================
# Etapa 2: Runner (Imagen productiva mínima sin compiladores ni devDependencies)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar artefactos compilados y dependencias de producción
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migraciones ./migraciones
COPY --from=builder /app/baselines ./baselines

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/src/server.js"]
