/**
 * MODALS & ACTIONS CONTROLLER - MÓDULO DE GESTIÓN DE EXPEDIENTES
 * Control de ventanas modales interactivas: Detalle (con trazabilidad), Derivar, Observar, Notificar, Archivar y Nuevo Expediente
 */

class ModalController {
  static init() {
    // Cerrar modal al hacer clic en backdrop o botón cerrar
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeAll();
        }
      });
    });

    // Delegación de botones de cierre
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAll();
      });
    });

    // Tecla Escape para cerrar modales
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAll();
      }
    });

    // Inicializar listeners de formularios en modales
    this.setupModalForms();
  }

  static openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.classList.add('overflow-hidden');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  static closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.classList.remove('open');
    });
    document.body.classList.remove('overflow-hidden');
  }

  /* ========================================================================
     MODAL 1: VER DETALLE DEL EXPEDIENTE
     ======================================================================== */
  static openDetalle(expedienteId) {
    const exp = ExpedientesDB.getById(expedienteId);
    if (!exp) {
      App.showToast('No se encontró el expediente solicitado.', 'error');
      return;
    }

    // Cabecera del modal
    document.getElementById('modal-detalle-codigo').textContent = exp.id;
    document.getElementById('modal-detalle-asunto-header').textContent = exp.asunto;

    // Badges de estado y prioridad
    const badgeEstado = document.getElementById('modal-detalle-estado-badge');
    badgeEstado.innerHTML = App.getEstadoBadgeHTML(exp.estado);

    const badgePrioridad = document.getElementById('modal-detalle-prioridad-badge');
    badgePrioridad.innerHTML = App.getPrioridadBadgeHTML(exp.prioridad);

    // Tab 1: Resumen General
    const resumenContainer = document.getElementById('detalle-tab-resumen-content');
    const slaStatus = App.calculateSLA(exp.fechaLimite);

    resumenContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Tarjeta Solicitante -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <i data-lucide="${exp.solicitante.tipo === 'Persona Jurídica' ? 'building-2' : 'user'}" class="w-4 h-4 text-blue-600"></i>
            Datos del Solicitante (${exp.solicitante.tipo})
          </h4>
          <div class="space-y-2 text-sm">
            <div>
              <span class="text-slate-500 block text-xs">Razón Social / Nombre:</span>
              <span class="font-bold text-slate-800">${exp.solicitante.nombre}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <span class="text-slate-500 block text-xs">${exp.solicitante.tipoDoc}:</span>
                <span class="font-semibold text-slate-700">${exp.solicitante.numDoc}</span>
              </div>
              <div>
                <span class="text-slate-500 block text-xs">Teléfono:</span>
                <span class="text-slate-700">${exp.solicitante.telefono || 'No registrado'}</span>
              </div>
            </div>
            <div>
              <span class="text-slate-500 block text-xs">Correo Electrónico:</span>
              <span class="text-blue-600 hover:underline">${exp.solicitante.correo || 'No registrado'}</span>
            </div>
            <div>
              <span class="text-slate-500 block text-xs">Dirección:</span>
              <span class="text-slate-600">${exp.solicitante.direccion || 'No especificada'}</span>
            </div>
            ${exp.solicitante.representante ? `
              <div class="pt-1 border-t border-slate-200">
                <span class="text-slate-500 block text-xs">Representante Legal / Contacto:</span>
                <span class="text-slate-700 font-medium text-xs">${exp.solicitante.representante}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Tarjeta Trámite y Ubicación Actual -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <i data-lucide="file-text" class="w-4 h-4 text-emerald-600"></i>
            Detalles de Gestión y Plazos
          </h4>
          <div class="space-y-2.5 text-sm">
            <div>
              <span class="text-slate-500 block text-xs">Tipo de Trámite / TUPA:</span>
              <span class="font-semibold text-slate-800">${exp.tipoTramite}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <span class="text-slate-500 block text-xs">Tipo Documento:</span>
                <span class="font-medium text-slate-700">${exp.tipoDocumento} (${exp.folios} folios)</span>
              </div>
              <div>
                <span class="text-slate-500 block text-xs">Fecha de Ingreso:</span>
                <span class="text-slate-700 font-medium">${App.formatDateTime(exp.fechaIngreso)}</span>
              </div>
            </div>
            <div>
              <span class="text-slate-500 block text-xs">Área / Oficina Actual:</span>
              <span class="inline-flex items-center gap-1.5 font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                <i data-lucide="building" class="w-3.5 h-3.5"></i>
                ${exp.areaActualNombre}
              </span>
            </div>
            <div>
              <span class="text-slate-500 block text-xs">Especialista / Técnico Asignado:</span>
              <span class="text-slate-800 font-medium">${exp.tecnicoAsignado || 'Pendiente de asignación'}</span>
            </div>
            <div class="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div>
                <span class="text-slate-500 block text-xs">Fecha Límite (SLA):</span>
                <span class="font-medium text-slate-700">${App.formatDateTime(exp.fechaLimite)}</span>
              </div>
              <div>
                <span class="text-xs px-2.5 py-1 rounded-full font-bold ${slaStatus.badgeClass}">
                  ${slaStatus.texto}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tab 2: Trazabilidad / Línea de Tiempo
    const trazabilidadContainer = document.getElementById('detalle-tab-trazabilidad-content');
    if (!exp.movimientos || exp.movimientos.length === 0) {
      trazabilidadContainer.innerHTML = `<p class="text-slate-500 text-sm py-4 text-center">No hay movimientos registrados.</p>`;
    } else {
      trazabilidadContainer.innerHTML = `
        <div class="space-y-4">
          ${exp.movimientos.map((mov, index) => {
            const isLast = index === exp.movimientos.length - 1;
            return `
              <div class="timeline-item">
                <div class="timeline-dot ${isLast ? 'bg-blue-600' : 'bg-slate-400'}">
                  <div class="w-2 h-2 rounded-full bg-white"></div>
                </div>
                <div class="bg-white p-3.5 rounded-xl border ${isLast ? 'border-blue-200 shadow-sm bg-blue-50/20' : 'border-slate-200'}">
                  <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <i data-lucide="arrow-right-circle" class="w-3.5 h-3.5 text-blue-600"></i>
                      ${mov.origen} &rarr; ${mov.destino}
                    </span>
                    <span class="text-xs text-slate-500 font-medium">${App.formatDateTime(mov.fecha)}</span>
                  </div>
                  <div class="text-xs font-semibold text-slate-700 mb-1">
                    Acción: <span class="text-blue-700">${mov.accion}</span>
                  </div>
                  <p class="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                    ${mov.proveido || 'Sin proveído.'}
                  </p>
                  <div class="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Responsable: <strong class="text-slate-700">${mov.usuario}</strong></span>
                    <span class="font-medium">Estado resultante: <span class="text-slate-800">${mov.estadoResultante}</span></span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Tab 3: Documentos Adjuntos
    const docsContainer = document.getElementById('detalle-tab-documentos-content');
    if (!exp.documentos || exp.documentos.length === 0) {
      docsContainer.innerHTML = `<p class="text-slate-500 text-sm py-4 text-center">No hay documentos adjuntos en este expediente.</p>`;
    } else {
      docsContainer.innerHTML = `
        <div class="divide-y divide-slate-100">
          ${exp.documentos.map(doc => `
            <div class="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <i data-lucide="file" class="w-5 h-5"></i>
                </div>
                <div>
                  <div class="text-sm font-semibold text-slate-800">${doc.nombre}</div>
                  <div class="text-xs text-slate-500 flex items-center gap-2">
                    <span>${doc.size}</span> &bull; <span>Subido el: ${doc.fecha}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="App.showToast('Descargando archivo digital: ${doc.nombre}', 'info')" class="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  Descargar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Tab 4: Observaciones
    const obsContainer = document.getElementById('detalle-tab-observaciones-content');
    if (!exp.observaciones || exp.observaciones.length === 0) {
      obsContainer.innerHTML = `
        <div class="text-center py-6 text-slate-500 text-sm">
          <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80"></i>
          Este expediente no tiene observaciones pendientes.
        </div>
      `;
    } else {
      obsContainer.innerHTML = `
        <div class="space-y-3">
          ${exp.observaciones.map(obs => `
            <div class="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i>
                  ${obs.motivo}
                </span>
                <span class="text-xs text-amber-700 font-medium">${App.formatDateTime(obs.fecha)}</span>
              </div>
              <p class="text-xs text-slate-700 mb-2 leading-relaxed">${obs.detalle}</p>
              <div class="flex items-center justify-between text-xs pt-2 border-t border-amber-200/60 text-amber-900">
                <span>Registrado por: <strong>${obs.inspector}</strong> (${obs.area})</span>
                <span class="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">Plazo: ${obs.plazoSubsanacionDias} días</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Botones de acción rápida en el pie del modal
    const actionsContainer = document.getElementById('detalle-modal-actions');
    actionsContainer.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap justify-end w-full">
        <button onclick="ModalController.closeAll(); ModalController.openDerivar('${exp.id}')" class="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
          <i data-lucide="send" class="w-3.5 h-3.5"></i>
          Derivar Expediente
        </button>
        <button onclick="ModalController.closeAll(); ModalController.openObservar('${exp.id}')" class="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
          <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
          Formular Observación
        </button>
        ${exp.estado !== 'Notificado' && exp.estado !== 'Archivado' ? `
          <button onclick="ModalController.closeAll(); ModalController.openNotificar('${exp.id}')" class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
            <i data-lucide="mail-check" class="w-3.5 h-3.5"></i>
            Notificar
          </button>
        ` : ''}
        ${exp.estado !== 'Archivado' ? `
          <button onclick="ModalController.closeAll(); ModalController.openArchivar('${exp.id}')" class="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-all flex items-center gap-1.5">
            <i data-lucide="archive" class="w-3.5 h-3.5"></i>
            Archivar
          </button>
        ` : ''}
      </div>
    `;

    // Activar primer tab del modal por defecto
    this.switchDetalleTab('resumen');

    this.openModal('modal-detalle');
  }

  static switchDetalleTab(tabName) {
    const tabs = ['resumen', 'trazabilidad', 'documentos', 'observaciones'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const content = document.getElementById(`detalle-tab-${t}`);
      if (t === tabName) {
        btn?.classList.add('border-blue-600', 'text-blue-600', 'bg-blue-50/50');
        btn?.classList.remove('border-transparent', 'text-slate-500');
        content?.classList.remove('hidden');
      } else {
        btn?.classList.remove('border-blue-600', 'text-blue-600', 'bg-blue-50/50');
        btn?.classList.add('border-transparent', 'text-slate-500');
        content?.classList.add('hidden');
      }
    });
    if (window.lucide) window.lucide.createIcons();
  }

  /* ========================================================================
     MODAL 2: DERIVAR EXPEDIENTE
     ======================================================================== */
  static openDerivar(expedienteId) {
    const exp = ExpedientesDB.getById(expedienteId);
    if (!exp) return;

    document.getElementById('derivar-expediente-id').value = exp.id;
    document.getElementById('derivar-exp-codigo-badge').textContent = exp.id;
    document.getElementById('derivar-exp-asunto').textContent = exp.asunto;
    document.getElementById('derivar-area-origen').value = exp.areaActualNombre;

    // Llenar select de áreas destino excluyendo opcionalmente el área origen si se desea
    const selectDestino = document.getElementById('derivar-area-destino');
    selectDestino.innerHTML = '<option value="">-- Seleccionar Área de Destino --</option>' + 
      AREAS_INSTITUCIONALES.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');

    // Listener para actualizar lista de personal según área destino
    selectDestino.onchange = () => {
      const areaId = selectDestino.value;
      const selectPersonal = document.getElementById('derivar-personal-asignado');
      const personal = PERSONAL_POR_AREA[areaId] || ['Especialista de Turno'];
      selectPersonal.innerHTML = personal.map(p => `<option value="${p}">${p}</option>`).join('');
    };

    // Trigger inicial
    selectDestino.value = 'GAJ';
    selectDestino.dispatchEvent(new Event('change'));

    document.getElementById('derivar-proveido').value = 'Pase para conocimiento, evaluación y emisión de informe conforme a sus competencias.';
    
    this.openModal('modal-derivar');
  }

  /* ========================================================================
     MODAL 3: OBSERVAR EXPEDIENTE
     ======================================================================== */
  static openObservar(expedienteId) {
    const exp = ExpedientesDB.getById(expedienteId);
    if (!exp) return;

    document.getElementById('observar-expediente-id').value = exp.id;
    document.getElementById('observar-exp-codigo-badge').textContent = exp.id;
    document.getElementById('observar-exp-asunto').textContent = exp.asunto;
    document.getElementById('observar-solicitante').textContent = `${exp.solicitante.nombre} (${exp.solicitante.tipoDoc}: ${exp.solicitante.numDoc})`;

    document.getElementById('observar-motivo-select').value = 'Falta de requisitos formales según TUPA';
    document.getElementById('observar-detalle').value = '';
    document.getElementById('observar-plazo-dias').value = 5;

    this.openModal('modal-observar');
  }

  /* ========================================================================
     MODAL 4: NOTIFICAR AL SOLICITANTE
     ======================================================================== */
  static openNotificar(expedienteId) {
    const exp = ExpedientesDB.getById(expedienteId);
    if (!exp) return;

    document.getElementById('notificar-expediente-id').value = exp.id;
    document.getElementById('notificar-exp-codigo-badge').textContent = exp.id;
    document.getElementById('notificar-solicitante').textContent = exp.solicitante.nombre;
    document.getElementById('notificar-correo').textContent = exp.solicitante.correo || 'Sin correo registrado';
    document.getElementById('notificar-numero-cedula').value = `NOTIF-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    this.openModal('modal-notificar');
  }

  /* ========================================================================
     MODAL 5: ARCHIVAR EXPEDIENTE
     ======================================================================== */
  static openArchivar(expedienteId) {
    const exp = ExpedientesDB.getById(expedienteId);
    if (!exp) return;

    document.getElementById('archivar-expediente-id').value = exp.id;
    document.getElementById('archivar-exp-codigo-badge').textContent = exp.id;
    document.getElementById('archivar-ubicacion-fisica').value = `ESTANTE-04 / CAJA-2026-${Math.floor(10 + Math.random() * 90)}`;

    this.openModal('modal-archivar');
  }

  /* ========================================================================
     MODAL 6: NUEVO EXPEDIENTE
     ======================================================================== */
  static openNuevoExpediente() {
    const nextCode = ExpedientesDB.generateNextCode(2026);
    document.getElementById('nuevo-exp-codigo').value = nextCode;

    // Llenar select de tipos de tramite
    const selectTramite = document.getElementById('nuevo-tipo-tramite');
    selectTramite.innerHTML = TIPOS_TRAMITE.map(t => `<option value="${t}">${t}</option>`).join('');

    // Llenar select de área destino inicial
    const selectArea = document.getElementById('nuevo-area-destino');
    selectArea.innerHTML = AREAS_INSTITUCIONALES.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
    selectArea.value = 'MESA_PARTES';

    // Limpiar campos
    document.getElementById('nuevo-tipo-solicitante').value = 'Persona Natural';
    document.getElementById('nuevo-tipo-doc').value = 'DNI';
    document.getElementById('nuevo-num-doc').value = '';
    document.getElementById('nuevo-nombre-solicitante').value = '';
    document.getElementById('nuevo-correo').value = '';
    document.getElementById('nuevo-telefono').value = '';
    document.getElementById('nuevo-direccion').value = '';
    document.getElementById('nuevo-asunto').value = '';
    document.getElementById('nuevo-folios').value = '10';
    document.getElementById('nuevo-prioridad').value = 'Normal';

    this.openModal('modal-nuevo-expediente');
  }

  /* ========================================================================
     CONFIGURACIÓN DE SUBMITS DE FORMULARIOS
     ======================================================================== */
  static setupModalForms() {
    // Formulario Derivar
    const formDerivar = document.getElementById('form-derivar');
    formDerivar?.addEventListener('submit', (e) => {
      e.preventDefault();
      const expId = document.getElementById('derivar-expediente-id').value;
      const areaDestinoId = document.getElementById('derivar-area-destino').value;
      const tecnico = document.getElementById('derivar-personal-asignado').value;
      const proveido = document.getElementById('derivar-proveido').value;
      const areaDestinoObj = AREAS_INSTITUCIONALES.find(a => a.id === areaDestinoId);

      if (!areaDestinoObj) {
        App.showToast('Por favor selecciona un área de destino válida.', 'warning');
        return;
      }

      const exp = ExpedientesDB.getById(expId);
      if (exp) {
        const origenNombre = exp.areaActualNombre;
        exp.areaActualId = areaDestinoId;
        exp.areaActualNombre = areaDestinoObj.nombre;
        exp.tecnicoAsignado = tecnico;
        exp.estado = 'Derivado';

        exp.movimientos.push({
          id: exp.movimientos.length + 1,
          fecha: new Date().toISOString(),
          origen: origenNombre,
          destino: areaDestinoObj.nombre,
          usuario: App.currentUserName || 'Usuario Activo',
          accion: 'Derivación Interina',
          proveido: proveido || 'Derivado sin proveído específico.',
          estadoResultante: 'Derivado'
        });

        ExpedientesDB.update(exp);
        this.closeAll();
        App.refreshData();
        App.showToast(`Expediente ${exp.id} derivado exitosamente a ${areaDestinoObj.nombre}.`, 'success');
      }
    });

    // Formulario Observar
    const formObservar = document.getElementById('form-observar');
    formObservar?.addEventListener('submit', (e) => {
      e.preventDefault();
      const expId = document.getElementById('observar-expediente-id').value;
      const motivo = document.getElementById('observar-motivo-select').value;
      const detalle = document.getElementById('observar-detalle').value;
      const plazo = parseInt(document.getElementById('observar-plazo-dias').value, 10) || 5;

      if (!detalle.trim()) {
        App.showToast('Debe ingresar el detalle o fundamentación de la observación.', 'warning');
        return;
      }

      const exp = ExpedientesDB.getById(expId);
      if (exp) {
        exp.estado = 'Observado';
        exp.observaciones = exp.observaciones || [];
        exp.observaciones.push({
          id: exp.observaciones.length + 1,
          fecha: new Date().toISOString(),
          area: exp.areaActualNombre,
          inspector: App.currentUserName || 'Especialista Evaluador',
          motivo: motivo,
          detalle: detalle,
          plazoSubsanacionDias: plazo,
          notificadoAlAdministrado: true
        });

        exp.movimientos.push({
          id: exp.movimientos.length + 1,
          fecha: new Date().toISOString(),
          origen: exp.areaActualNombre,
          destino: exp.areaActualNombre,
          usuario: App.currentUserName || 'Especialista Evaluador',
          accion: 'Emisión de Observación Técnica',
          proveido: `Observado: ${motivo}. Plazo de ${plazo} días para subsanar.`,
          estadoResultante: 'Observado'
        });

        ExpedientesDB.update(exp);
        this.closeAll();
        App.refreshData();
        App.showToast(`Observación registrada en expediente ${exp.id}. Estado: OBSERVADO.`, 'warning');
      }
    });

    // Formulario Notificar
    const formNotificar = document.getElementById('form-notificar');
    formNotificar?.addEventListener('submit', (e) => {
      e.preventDefault();
      const expId = document.getElementById('notificar-expediente-id').value;
      const cedula = document.getElementById('notificar-numero-cedula').value;
      const medio = document.getElementById('notificar-medio').value;

      const exp = ExpedientesDB.getById(expId);
      if (exp) {
        exp.estado = 'Notificado';
        exp.movimientos.push({
          id: exp.movimientos.length + 1,
          fecha: new Date().toISOString(),
          origen: exp.areaActualNombre,
          destino: 'Administrado / Solicitante',
          usuario: App.currentUserName || 'Notificador Oficial',
          accion: 'Notificación de Acto Administrativo',
          proveido: `Notificado mediante ${medio} con Cédula N° ${cedula}.`,
          estadoResultante: 'Notificado'
        });

        ExpedientesDB.update(exp);
        this.closeAll();
        App.refreshData();
        App.showToast(`Expediente ${exp.id} notificado formalmente al solicitante.`, 'success');
      }
    });

    // Formulario Archivar
    const formArchivar = document.getElementById('form-archivar');
    formArchivar?.addEventListener('submit', (e) => {
      e.preventDefault();
      const expId = document.getElementById('archivar-expediente-id').value;
      const ubicacion = document.getElementById('archivar-ubicacion-fisica').value;
      const motivo = document.getElementById('archivar-motivo').value;

      const exp = ExpedientesDB.getById(expId);
      if (exp) {
        exp.estado = 'Archivado';
        exp.movimientos.push({
          id: exp.movimientos.length + 1,
          fecha: new Date().toISOString(),
          origen: exp.areaActualNombre,
          destino: 'Archivo Central',
          usuario: App.currentUserName || 'Encargado de Archivo',
          accion: 'Cierre y Custodia en Archivo Central',
          proveido: `Archivado: ${motivo}. Ubicación física: ${ubicacion}`,
          estadoResultante: 'Archivado'
        });

        ExpedientesDB.update(exp);
        this.closeAll();
        App.refreshData();
        App.showToast(`Expediente ${exp.id} archivado correctamente.`, 'info');
      }
    });

    // Formulario Nuevo Expediente
    const formNuevo = document.getElementById('form-nuevo-expediente');
    formNuevo?.addEventListener('submit', (e) => {
      e.preventDefault();
      const codigo = document.getElementById('nuevo-exp-codigo').value;
      const tipoSol = document.getElementById('nuevo-tipo-solicitante').value;
      const tipoDoc = document.getElementById('nuevo-tipo-doc').value;
      const numDoc = document.getElementById('nuevo-num-doc').value;
      const nombreSol = document.getElementById('nuevo-nombre-solicitante').value;
      const correo = document.getElementById('nuevo-correo').value;
      const telefono = document.getElementById('nuevo-telefono').value;
      const direccion = document.getElementById('nuevo-direccion').value;
      const tipoDocTramite = document.getElementById('nuevo-tipo-documento').value;
      const tipoTramite = document.getElementById('nuevo-tipo-tramite').value;
      const folios = parseInt(document.getElementById('nuevo-folios').value, 10) || 1;
      const prioridad = document.getElementById('nuevo-prioridad').value;
      const asunto = document.getElementById('nuevo-asunto').value;
      const areaDestinoId = document.getElementById('nuevo-area-destino').value;
      const areaDestinoObj = AREAS_INSTITUCIONALES.find(a => a.id === areaDestinoId) || AREAS_INSTITUCIONALES[0];

      if (!numDoc || !nombreSol || !asunto) {
        App.showToast('Por favor completa todos los campos requeridos.', 'warning');
        return;
      }

      const now = new Date();
      const plazoDias = prioridad === 'Muy Urgente' ? 5 : (prioridad === 'Urgente' ? 10 : 20);
      const fechaLimite = new Date(now.getTime() + plazoDias * 24 * 60 * 60 * 1000);

      const nuevoExp = {
        id: codigo,
        tipoDocumento: tipoDocTramite,
        tipoTramite: tipoTramite,
        asunto: asunto,
        folios: folios,
        prioridad: prioridad,
        estado: 'Pendiente',
        areaActualId: areaDestinoId,
        areaActualNombre: areaDestinoObj.nombre,
        tecnicoAsignado: PERSONAL_POR_AREA[areaDestinoId]?.[0] || 'Por Asignar',
        solicitante: {
          tipo: tipoSol,
          tipoDoc: tipoDoc,
          numDoc: numDoc,
          nombre: nombreSol.toUpperCase(),
          representante: '',
          correo: correo,
          telefono: telefono,
          direccion: direccion
        },
        fechaIngreso: now.toISOString(),
        fechaLimite: fechaLimite.toISOString(),
        diasPlazoTotal: plazoDias,
        documentos: [
          { nombre: `${tipoDocTramite}_Principal.pdf`, size: '1.2 MB', fecha: now.toISOString().split('T')[0] }
        ],
        observaciones: [],
        movimientos: [
          {
            id: 1,
            fecha: now.toISOString(),
            origen: 'Mesa de Partes',
            destino: areaDestinoObj.nombre,
            usuario: App.currentUserName || 'Mesa de Partes',
            accion: 'Recepción y Registro Digital',
            proveido: `Ingreso conforme a TUPA con destino a ${areaDestinoObj.nombre}.`,
            estadoResultante: 'Pendiente'
          }
        ]
      };

      ExpedientesDB.add(nuevoExp);
      this.closeAll();
      App.refreshData();
      App.showToast(`Expediente ${nuevoExp.id} creado con éxito.`, 'success');
    });
  }
}

window.ModalController = ModalController;
