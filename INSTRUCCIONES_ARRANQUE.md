# Guía de Arranque del SIGD (Rama B_TAPULLIMA)

Esta rama contiene el 100% de las funcionalidades, migraciones y módulos actualizados desde `B_JACOBO`.

---

## 0. Arranque Rápido en 1 Clic (Recomendado para Windows)

Simplemente haz **doble clic** en el archivo:
📁 **`iniciar.bat`**

Este archivo se encarga automáticamente de:
1. Crear tus archivos `.env` y `.env.local` si no existen.
2. Instalar dependencias `npm install` si hacen falta.
3. Iniciar los contenedores Docker (`postgres`, `redis`, `minio`).
4. Abrir las ventanas de ejecución para el Backend y el Frontend.
5. Abrir el navegador en `http://localhost:5178/`.

Para detener todo, simplemente haz doble clic en **`detener.bat`**.

---

## 1. Requisitos Previos

* **Node.js** v20 o v24
* **Docker Desktop** (para contenedores de PostgreSQL, Redis y MinIO)

---

## 2. Configuración Manual (Si prefieres usar la consola)

### Backend
1. Ir a la carpeta `backend/`:
   ```bash
   cd backend
   ```
2. Crear el archivo `.env` a partir de la plantilla:
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.example .env

   # En Linux / Mac / Git Bash:
   cp .env.example .env
   ```

### Frontend
1. Ir a la carpeta `frontend/`:
   ```bash
   cd frontend
   ```
2. Crear el archivo `.env.local` a partir de la plantilla:
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.example .env.local

   # En Linux / Mac / Git Bash:
   cp .env.example .env.local
   ```

---

## 3. Instalación de Dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## 4. Iniciar Servicios Base (Docker)

En la raíz del proyecto:
```bash
docker compose up -d postgres redis minio
```

---

## 5. Levantar el Proyecto en Consola

### Terminal 1 — Backend:
```bash
cd backend
npm run dev
```
* Backend corriendo en: `http://localhost:3008`
* Health check: `http://localhost:3008/health`

### Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```
* Frontend corriendo en: `http://localhost:5178`

---

## 6. Ejecución de Migraciones de Base de Datos (Si es requerida)

```bash
cd backend
npm run migrate
```
