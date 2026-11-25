# Guía de Arranque del SIGD (Rama F_JESUS)

Esta rama contiene el 100% de las funcionalidades, migraciones y módulos actualizados desde `B_JACOBO`.

---

## 1. Requisitos Previos

* **Node.js** v20 o v24
* **Docker Desktop** (para contenedores de PostgreSQL, Redis y MinIO)

---

## 2. Configuración de Variables de Entorno

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
3. Si utilizas puertos o credenciales diferentes de PostgreSQL, edita `DATABASE_URL` en `backend/.env`.

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

Ejecutar en la raíz o en cada subcarpeta:

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

## 5. Levantar el Proyecto

Puedes levantarlos independientemente en dos terminales:

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
* Frontend corriendo en: `http://localhost:5178` (o el puerto asignado por Vite)

---

## 6. Ejecución de Migraciones de Base de Datos (Si es requerida)

```bash
cd backend
npm run migrate
```
