# 02. Arquitectura y Flujo del Dashboard

## 1. Tecnologías Propuestas del Frontend
Para la construcción de la interfaz visual y la lógica del cliente se contemplan las siguientes tecnologías:
* **HTML5:** Construcción de la estructura de las páginas.
* **CSS3:** Diseño visual, colores, diseño responsive, animaciones y modo oscuro[cite: 1, 2].
* **TypeScript:** Gestión de filtros, búsquedas, actualización de fecha/hora, notificaciones, temas y exportación[cite: 1, 2].
* **Bootstrap:** Diseño responsive, componentes, botones, formularios, tablas y sistemas de rejilla (grid)[cite: 1, 2].
* **React + Vite:** Alternativa recomendada para proyectos basados en Node.js[cite: 1, 2].

## 2. Flujo de Funcionamiento del Sistema
El ciclo de interacción de la interfaz sigue los siguientes pasos operativos[cite: 1, 2]:
1. El usuario inicia sesión en el sistema[cite: 1, 2].
2. El sistema muestra la interfaz principal del Dashboard[cite: 1, 2].
3. El frontend solicita la información necesaria al backend mediante peticiones HTTP[cite: 1, 2].
4. El backend procesa las solicitudes y consulta la base de datos en PostgreSQL[cite: 1, 2].
5. El backend devuelve los datos estructurados al frontend[cite: 1, 2].
6. El Dashboard renderiza y actualiza dinámicamente los indicadores y gráficos estadísticos[cite: 1, 2].
7. El usuario puede aplicar filtros avanzados y la tabla se actualiza de inmediato[cite: 1, 2].
8. El usuario puede exportar los resultados o recibir notificaciones en tiempo real[cite: 1, 2].

## 3. Arquitectura General
La comunicación entre capas cumple con una separación estricta de responsabilidades[cite: 1, 2]:

```text
FRONTEND
   │
   │ HTTP / REST API (Endpoints propuestos: /api/dashboard, /api/reportes, /api/usuarios, /api/estadisticas)
   ▼
BACKEND
   │
   │ Consultas SQL seguras
   ▼
POSTGRESQL