FROM node:24.19-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development
COPY . .
EXPOSE 5173
CMD ["npm", "exec", "--", "vite", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

FROM dependencies AS build
COPY . .
RUN npm run build
