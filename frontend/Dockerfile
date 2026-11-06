# Etapa 1: Desarrollo (Vite para entorno local)
FROM node:24.19-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Etapa 2: Construcción (Build para producción)
FROM node:24.19-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 3: Producción (Servidor estático Nginx no-root)
FROM nginxinc/nginx-unprivileged:alpine
# Copiar el build generado en la etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html
# Copiar la configuración SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]