# Usar imagen ligera de Node
FROM node:24.19-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar solo archivos de dependencias primero (optimiza caché de Docker)
COPY package*.json ./

# Instalar dependencias exactas para producción
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Construir el proyecto (compilar TypeScript a JavaScript)
RUN npm run build

# Exponer el puerto en el que escucha el backend
EXPOSE 3000

# Cambiar al usuario "node" (sin privilegios root) por seguridad
USER node

# Iniciar la aplicación
CMD ["npm", "start"]