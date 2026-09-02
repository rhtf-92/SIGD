# Documentación de Tablas Maestras

**Módulo:** Administración, Seguridad y Auditoría  
**Grupo:** 4  
**Líder de Grupo:** Jhonatan  
**Integrantes:** Gato, Maxin, Jhonatan  

---

## 1. Introducción
Las Tablas Maestras son la columna vertebral del sistema. Almacenan los datos de referencia indispensables para la operación diaria, garantizando la consistencia, integridad e interconexión del flujo documental y funcional de la institución.

---

## 2. Descripción de Componentes

### 2.1. Configuración de Sedes
Permite gestionar la infraestructura física o filiales organizacionales de la institución.

* **Propósito:** Centralizar las direcciones y registros de cada campus o local institucional.
* **Información almacenada:** Nombre o denominación de la sede, ubicación o dirección física y el estado de la sede (activa o inactiva).

---

### 2.2. Organigrama Institucional (Áreas y Departamentos)
Representa la jerarquía y estructura organizativa donde labora el personal y por donde transitarán los expedientes.

* **Propósito:** Mapear las unidades orgánicas, despachos y jefaturas para el correcto enrutamiento de los documentos.
* **Información almacenada:** Nombre de la dependencia o área, relación con la sede correspondiente y estado operativo.

---

### 2.3. Catálogo de Tipos Documentales
Define la tipología de documentos permitidos y procesados en la plataforma.

* **Propósito:** Estandarizar el registro de documentos y establecer nomenclaturas formales.
* **Información almacenada:** Código o sigla abreviada (por ejemplo: OFI, MEMO, SOL), nombre descriptivo del documento y disponibilidad en el catálogo.

---

### 2.4. Directorio de Usuarios
Contiene el registro de todo el personal que interactúa con la plataforma.

* **Propósito:** Identificar formalmente a los usuarios para la asignación de responsabilidades y permisos.
* **Información almacenada:** Documento Nacional de Identidad (DNI), nombres completados, apellidos completos, correo electrónico institucional, área de adscripción a la que pertenece y estado de la cuenta.

---

## 3. Matriz de Relaciones Funcionales

| Entidad | Relación con otros módulos | Impacto en el Sistema |
| :--- | :--- | :--- |cd SIGD
| **Sedes** | Módulo de Expedientes y Mesa de Partes | Define la ubicación física de recepción y despacho de documentos. |
| **Áreas** | Módulo de Trámite y Trabajo Diario | Asigna la bandeja de entrada y destino de cada expediente enviado. |
| **Tipos Documentales** | Registro y Formulación | Normaliza los requisitos y la clasificación de los trámites. |
| **Usuarios** | Seguridad, Roles y Auditoría | Determina quién realiza, firma o aprueba cada acción registrada en los logs. |