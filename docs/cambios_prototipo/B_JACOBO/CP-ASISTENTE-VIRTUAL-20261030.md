# Asistente virtual de orientación ciudadana — 30/10/2026

## Alcance y estado inicial

- Rama comprobada: `B_JACOBO`.
- HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`, conservado.
- Inventario inicial: **245 entradas** en `git status --porcelain=v1`: 164 modificaciones y 81 entradas sin seguimiento (algunas agrupan directorios completos). Staging vacío.
- Inventario conservado en `scratch/asistente-validacion/git-inicial.txt`.
- Se reutilizaron las instancias disponibles en frontend `127.0.0.1:5178` y backend `127.0.0.1:3008`. No se iniciaron, detuvieron ni reiniciaron servicios.
- Esta intervención sustituye el trabajo anterior de zoom como tarea activa. No modifica ni revierte esos avances.

## Inspección y fuentes

Se recorrió el árbol de `frontend/src` y se buscaron componentes de asistente/chat: no existía una implementación reutilizable. Se inspeccionaron:

- `frontend/src/pages/HomePage.tsx`: portada pública y cuatro tarjetas.
- `frontend/src/layouts/MainLayout.tsx`, `frontend/src/components/HeaderInstitucional.tsx`, `frontend/src/routes/AppRouter.tsx`: estructura y rutas existentes, sin modificarlos.
- `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`, `StepIdentificacion.tsx`: catálogo, documentos PDF, límite de 20 MB y clasificación documental.
- `frontend/src/pages/tramite/ConsultaPublicaPage.tsx`: consulta por CUT y límites de la información pública.
- `frontend/src/pages/casilla/CasillaElectronicaPage.tsx`: consulta de notificaciones, documentos y referencia necesaria para acuses.
- `frontend/src/pages/validador/ValidadorPublicoCvdPage.tsx`, `frontend/src/hooks/useCvdPublicVerification.ts` y componentes de resultados: verificación pública, errores y evidencia documental.
- `frontend/src/config/env.ts`, `frontend/src/api/client.ts`: configuración API e interceptores de autenticación.
- `backend/src/domains/tramicore/tramites.controller.ts`: GET público de catálogo; únicamente lectura del código.
- `backend/carga_tupa_suiza_2026.sql`, `frontend/src/data/tupaSuiza2026.ts`: contraste de procedencia. No se ejecutó SQL ni se copió el catálogo estático de 75 conceptos al asistente.
- Configuraciones existentes de TypeScript, ESLint, Vitest y dependencias de frontend.

El catálogo real obtenido por HTTP informa como fuente `TUPA_2026_IESTP_Suiza.pdf` con página. No se hizo una certificación externa de su aprobación administrativa: se conserva expresamente la advertencia de validación institucional pendiente presente en los registros.

## Archivos de esta intervención

Único archivo funcional existente modificado:

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/HomePage.tsx` | Una importación y una instancia de `<AsistenteVirtual />`, solo en la portada pública no autenticada. Ninguna clase, texto o estructura visual anterior fue modificada. |

Archivos creados:

| Archivo | Responsabilidad |
|---|---|
| `frontend/src/components/asistente/AsistenteVirtual.tsx` | Lanzador, panel, encabezado, mensajes, opciones, compositor y navegación. |
| `frontend/src/components/asistente/CatalogoOrientacion.tsx` | Catálogo remoto, búsqueda, selección, ficha, carga, vacío, error y reintento. |
| `frontend/src/components/asistente/asistente.css` | Estilos aislados, posición fija, límites de viewport y accesibilidad visual. |
| `frontend/src/features/asistente/conocimiento.ts` | Guías autorizadas, menú, respuestas y enlaces tipados a cuatro rutas. |
| `frontend/src/features/asistente/intenciones.ts` | Normalización, política cerrada, intenciones, privacidad y rechazo. |
| `frontend/src/features/asistente/catalogo.ts` | GET público, validación Zod y extracción conservadora de la información publicada. |
| `frontend/src/features/asistente/sesion.ts` | Historial efímero y acotado en memoria de la pestaña, sin persistencia remota. |
| `frontend/tests/unit/asistente/intenciones.test.ts` | Intenciones, preguntas externas, manipulación, ambigüedad y privacidad. |
| `frontend/tests/unit/asistente/catalogo.test.ts` | Validación del catálogo, vigencia, ausencia de datos, timeout y GET sin credenciales. |
| `frontend/tests/unit/asistente/AsistenteVirtual.test.tsx` | Interacción React, rutas, catálogo, historial, teclado, errores y seguridad. |
| `frontend/public/images/asistente-virtual-suiza.png` | Copia exacta de la imagen oficial. |
| `scratch/asistente-validacion/verificar-asistente.cjs` | Validación reproducible sobre Chrome y servicios existentes. |

También se generaron capturas, inventarios Git, diagnóstico de lint y resultado JSON dentro de `scratch/asistente-validacion/`, además de este informe.

## Recurso gráfico original

- Origen: `C:\Users\Liz\Desktop\SIGD\FOTOS\Asistente virtual sonriente y botón de chat.png`.
- Destino: `frontend/public/images/asistente-virtual-suiza.png`.
- PNG RGBA, **1169 × 1345**, con canal alfa entre 0 y 255, 978933 bytes.
- SHA-256 idéntico en origen y destino: `14D10D9C02C005199824CFB7DA1CAACF1CE398434E33C2969E9FCB5ACD175D71`.
- No se editó, recortó, redibujó ni generó otra imagen. Las dimensiones CSS conservan su proporción. El botón completo original es un botón HTML accesible y el diálogo es React interactivo.

## Funcionamiento

El asistente se monta mediante un portal en `document.body`. Su contenedor usa `position: fixed`, esquina inferior derecha y `z-index: 60`, independiente del ancho mínimo o del desplazamiento de la portada existente. El lanzador deja separación respecto de los botones inferiores. El panel no es modal, no bloquea el scroll y no redirige al abrirse.

Tiene apertura, minimización, cierre, reapertura, foco sin desplazamiento, tecla Escape, historial, borrado explícito, menú principal y prevención de envíos duplicados. Enter envía; Shift+Enter conserva saltos de línea. El envío vacío está deshabilitado. El panel limita su tamaño a `100vw`/`100dvh` con margen de 16 px, scroll interno y respeto a movimiento reducido.

| Opción real | Ámbito | Ruta de navegación |
|---|---|---|
| Información de trámites y requisitos | Mesa de Partes Virtual | Catálogo en el chat y enlace `/tramite` |
| Presentar una solicitud | Mesa de Partes Virtual | `/tramite` |
| Consultar mi expediente | Consulta pública | `/consulta` |
| Casilla electrónica | Casilla ciudadana | `/casilla` |
| Validar mi documento (CVD) | Validador público | `/validador-cvd` |

Las cinco opciones pertenecen a cuatro módulos. Los botones son React; los enlaces usan React Router y no inventan rutas.

### Preguntas escritas y seguridad

No existe integración con un modelo generativo. Es una clasificación determinista de intenciones y respuestas autorizadas. No se presenta como IA externa ni se agregaron dependencias o claves API.

El procesamiento normaliza acentos y caracteres invisibles, detecta datos sensibles reconocibles, bloquea temas externos e instrucciones manipuladas, identifica combinaciones de intención/recurso y selecciona una respuesta cerrada. Una palabra como «documento» no basta para generar una explicación. Las consultas ambiguas piden aclaración; las institucionales sin información conocida explican la limitación. Ambas vuelven al menú.

- Las preguntas nunca salen de la pestaña.
- El contenido sensible reconocido no se copia al historial: se muestra «Consulta omitida por privacidad». No es un detector universal de todos los datos personales; también se advierte al ciudadano que no los introduzca.
- El historial usa memoria acotada de la pestaña, se conserva al minimizar o volver a la portada y se pierde al recargar; no usa localStorage, cookies, PostgreSQL ni analítica.
- No se renderiza HTML del usuario: React muestra texto escapado.
- No hay herramientas de escritura, ejecución SQL, búsqueda web, bandejas privadas ni funciones administrativas.
- Los enlaces llevan a los módulos originales; su autenticación y RBAC siguen siendo los existentes.
- CVD orienta sobre integridad y evidencia criptográfica diferenciadas; no declara firmado ningún documento.

### Catálogo y límites de la información

Única petición de datos del asistente: `GET ${env.apiBaseUrl}/api/v1/tramites/tipos`, con origen configurado existente, sin JWT, cookies ni interceptor de refresh; timeout de 10 s y cancelación al desmontar. No requiere cambios backend.

Se valida la respuesta antes de usarla: UUID, código, nombre, vigencia y tipos documentales. Se rechazan duplicados o respuestas inconsistentes. Solo se ofrecen códigos `SUZ26-*` vigentes devueltos por el endpoint; nunca se usa un fallback de conceptos informativos.

Los costos provienen de la línea publicada «Derecho de pago». Los plazos provienen exclusivamente de «Plazo de atención». **No se presenta `plazo_dias = 30` ni el silencio administrativo como un dato oficial**, porque la propia descripción avisa que son defaults técnicos. Se conserva obligatoriedad `true`, `false` o no informada; el pago de una tasa no vuelve obligatorio su comprobante digital por inferencia. La ausencia de clasificación no se interpreta como ausencia de requisitos.

## Evidencia de aplicación real

Validación con Playwright + Chrome instalado, sobre la aplicación real existente. No se levantó un servidor alternativo.

- GET real: `http://127.0.0.1:3008/api/v1/tramites/tipos`, **HTTP 200**, **19 procedimientos** medidos.
- Selección de `SUZ26-035`: Certificado de Estudios Superiores (6 semestres); costo publicado S/ 124.00 (2.24 % UIT vigente); comprobante digital clasificado como opcional; plazo no especificado; advertencia de validación institucional pendiente. No se radicó.
- Lanzador antes y después de desplazar hasta el final: x=1264, y=820.71875, ancho=168, alto=193.28125, en ventana 1448 × 1086. Posición fija comprobada.
- Apertura/cierre/minimización/reapertura e historial comprobados; abrir/cerrar no cambió `scrollY`.
- Navegación real mediante enlaces a `/tramite`, `/consulta`, `/casilla` y `/validador-cvd` comprobada. Esto no equivale a una radicación o a lectura privada autenticada.
- Preguntas válidas, externas, manipuladas, ambiguas, sin información, datos sensibles y Shift+Enter/Enter comprobados en navegador.
- Panel dentro del viewport en 390 × 844, 320 × 640 y 844 × 390; no se cambió el ancho mínimo previo de la aplicación.
- Cero excepciones JavaScript y cero solicitudes de escritura observadas. El arnés bloquea cualquier método de escritura y exige que no haya intentos.
- GET de catálogo sin cabecera Authorization confirmado.
- Geometría de encabezado/secciones idéntica a la inicial. Comparación píxel por píxel de la portada inicial y final, ocultando solamente el widget para compararlas: **sin diferencias**.

Evidencia en `scratch/asistente-validacion/`:

- `asistente-cerrado-1448x1086.png`.
- `asistente-menu-1448x1086.png`.
- `asistente-catalogo-real.png`.
- `asistente-fijo-al-final.png`.
- `asistente-seguridad.png`.
- `asistente-responsive-390x844.png`, `asistente-responsive-320x640.png`, `asistente-responsive-844x390.png`.
- `portada-antes.png`, `portada-sin-overlay-despues.png`.
- `resultado-browser.json`, `lint-global.json`.

Para repetir solo la comprobación real con los servicios ya activos:

```powershell
node scratch/asistente-validacion/verificar-asistente.cjs
```

## Pruebas y limitaciones

Las pruebas automatizadas de lógica y componentes usan dobles controlados. La consulta HTTP y las interacciones de Chrome indicadas arriba son reales, sin mocks del catálogo ni sesiones autenticadas. No se declara un E2E de presentación de solicitudes, lectura privada de Casilla ni validación de un documento concreto.

| Validación | Resultado |
|---|---|
| TypeScript `npm run typecheck --prefix frontend` | Aprobado, exit 0. |
| Build `npm run build --prefix frontend` | Aprobado, exit 0. Advertencias de bundle grande, imports mixtos y comentarios de Zod; no se modificó el empaquetado ajeno. |
| ESLint de `src/components/asistente` y `src/features/asistente` | Aprobado, cero errores y cero advertencias. |
| ESLint global `npm run lint` | Fallido: 31 errores y 6 advertencias en archivos ajenos a la incorporación; ninguno en los seis archivos del asistente. El `any` señalado en HomePage ya estaba antes de su importación/montaje. |
| Regresión ampliada del frontend | **199 aprobadas, 1 omitida, 9 archivos aprobados**, exit 0, 65.56 s. Incluye intenciones, catálogo, conversación, HomePage, encabezado, consulta pública, CVD, Casilla y Wizard. |
| Chrome con API pública real | Aprobado, exit 0. |
| `git diff --check` sobre HomePage | Aprobado. |
| `git diff --check` global | Fallido por espacios finales en `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`, líneas 878 y 898 observadas en esta ejecución. No se tocó ese archivo. |

No se exige una integración de IA externa para este alcance. El clasificador es deliberadamente limitado: puede pedir aclaración ante expresiones no contempladas. La fuente institucional sigue siendo responsable de completar requisitos, plazos y validación administrativa ausentes. No se inventaron canales de atención, correos ni teléfonos.

La prueba omitida ya pertenece al Wizard: `it.skipIf(!process.env.SIGD_TUPA_LIVE_URL)`, condicionada a una URL de prueba en `localhost:3000`. No se alteró esa configuración ni se habilitó su servidor. La consulta real al catálogo de `3008` fue comprobada de manera independiente por Chrome.

Comando reproducible de la regresión ejecutada:

```powershell
npm.cmd test --prefix frontend -- tests/unit/asistente tests/unit/pages/HomePage.test.tsx tests/unit/components/HeaderInstitucional.test.tsx tests/unit/pages/ConsultaPublicaPage.test.tsx tests/unit/pages/ValidadorCvdBackend.test.tsx tests/integration/m1/casillaElectronica.test.tsx tests/unit/components/TramiteWizard.test.tsx
```

La primera ejecución focalizada detectó un error en el reconocimiento de documentos numéricos, corregido antes de la validación final. También se aisló el historial en las pruebas para no confundir una petición legítima del caso anterior con una petición del caso siguiente. La ejecución final no tuvo fallos; no se eliminaron pruebas ni se rebajaron aserciones.

| Capacidad | Clasificación final |
|---|---|
| Robot original, posición fija, abrir/cerrar/minimizar, teclado y panel adaptable | IMPLEMENTADO Y PROBADO en React y Chrome real. |
| Cinco opciones y enlaces a los cuatro módulos | IMPLEMENTADO Y PROBADO en React y navegación real. |
| Preguntas permitidas, externas, manipuladas y ambiguas; ausencia de información | IMPLEMENTADO Y PROBADO con política determinista, sin generación libre. |
| Catálogo vigente, búsqueda, selección, fuente, costo y requisitos | IMPLEMENTADO Y PROBADO con GET real HTTP 200 y 19 procedimientos. |
| Datos institucionales no publicados o pendientes de validación | NO DISPONIBLES; se informa esa condición y no se inventan. |
| Operaciones privadas de Casilla, radicación o verificación de un CVD concreto | FUERA DEL ALCANCE del asistente; solo orientación y navegación. |
| IA generativa externa | NO IMPLEMENTADA NI NECESARIA; no existe infraestructura aprobada utilizada. |
| Lint y espacios finales de otros módulos | PENDIENTES AJENOS A ESTA INTERVENCIÓN. |

## Integridad y Git

No se tocaron backend, contratos, DTO, autenticación, RBAC, esquemas, migraciones, Docker, secretos ni configuraciones de servicios. No se realizaron consultas SQL directas, DDL, DML ni escrituras en ninguna base, y no se conectó a `sigd_prueba`. No se crearon sesiones, expedientes, correlativos, documentos o notificaciones.

No se hicieron commit, push, cambio de rama, reset, restore, stash, clean ni eliminación de cambios. No desapareció ninguna entrada del inventario inicial. Staging vacío. Los procesos temporales de Chrome se cerraron mediante `finally`; los servicios existentes se conservaron.

Estado antes del informe: 248 entradas de Git; las tres nuevas entradas agrupadas son componentes, lógica y pruebas del asistente. Imagen, documentación y evidencias están dentro de directorios que ya eran entradas sin seguimiento; por ello no aumentan individualmente ese contador. Solo HomePage recibe dos líneas sobre su contenido inicial.
