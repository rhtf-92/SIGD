/**
 * MAIN APP CONTROLLER - MÓDULO DE GESTIÓN DE EXPEDIENTES
 * Control reactivo de filtros avanzados, contadores dinámicos, renderizado de tabla y KPIs
 */

const App = {
  // Estado de la aplicación
  activeTab: 'Pendiente', // 'Pendiente' | 'En Proceso' | 'Observado' | 'Derivado' | 'Notificado' | 'Archivado' | 'Todos'
  selectedArea: 'ALL',   // 'ALL' | 'MESA_PARTES' | 'GDU' | 'SGOP' | 'GAJ' | 'SG' | 'GAT' | 'SGCAT' | 'GSPMA'
  searchQuery: '',
  dateFrom: '',
  dateTo: '',
  priorityFilter: 'ALL',
  tipoDocFilter: 'ALL',
  currentPage: 1,
  pageSize: 8,
  currentUserName: 'Ing. Renato Tarazona (Especialista)',

  init() {
    // Inicializar componentes
    this.populateAreaSelectors();
    this.populateFilterDropdowns();
    this.setupEventListeners();
    ModalController.init();

    // Renderizar datos iniciales
    this.refreshData();

    // Inicializar Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  populateAreaSelectors() {
    const areaSelect = document.getElementById('header-area-select');
    if (areaSelect) {
      areaSelect.innerHTML = `
        <option value="ALL">🏛️ Todas las Áreas / Vista Global</option>
        ${AREAS_INSTITUCIONALES.map(a => `<option value="${a.id}">📍 ${a.nombre}</option>`).join('')}
      `;
      areaSelect.value = this.selectedArea;
    }
  },

  populateFilterDropdowns() {
    const tipoDocSelect = document.getElementById('filter-tipo-doc');
    if (tipoDocSelect) {
      const tipos = ['ALL', 'Solicitud', 'Oficio', 'Carta', 'Informe'];
      tipoDocSelect.innerHTML = tipos.map(t => `<option value="${t}">${t === 'ALL' ? 'Todos los Documentos' : t}</option>`).join('');
    }
  },

  setupEventListeners() {
    // Selector de Área en cabecera
    const areaSelect = document.getElementById('header-area-select');
    areaSelect?.addEventListener('change', (e) => {
      this.selectedArea = e.target.value;
      this.currentPage = 1;
      this.refreshData();
      const areaName = e.target.value === 'ALL' ? 'Todas las Áreas' : AREAS_INSTITUCIONALES.find(a => a.id === e.target.value)?.nombre;
      this.showToast(`Bandeja cambiada a: ${areaName}`, 'info');
    });

    // Pestañas de estado de flujo
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.setActiveTab(tab);
      });
    });

    // Buscador general (con debounce sutil)
    const searchInput = document.getElementById('input-busqueda-general');
    let debounceTimer;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.currentPage = 1;
        this.refreshData();
      }, 200);
    });

    // Filtros de fecha
    const inputFechaInicio = document.getElementById('filter-fecha-inicio');
    const inputFechaFin = document.getElementById('filter-fecha-fin');

    inputFechaInicio?.addEventListener('change', (e) => {
      this.dateFrom = e.target.value;
      this.currentPage = 1;
      this.refreshData();
    });

    inputFechaFin?.addEventListener('change', (e) => {
      this.dateTo = e.target.value;
      this.currentPage = 1;
      this.refreshData();
    });

    // Presets rápidos de fecha
    document.getElementById('preset-hoy')?.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      this.setDateRange(today, today);
    });

    document.getElementById('preset-semana')?.addEventListener('click', () => {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      this.setDateRange(lastWeek.toISOString().split('T')[0], today.toISOString().split('T')[0]);
    });

    document.getElementById('preset-mes')?.addEventListener('click', () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      this.setDateRange(firstDay.toISOString().split('T')[0], today.toISOString().split('T')[0]);
    });

    document.getElementById('preset-limpiar')?.addEventListener('click', () => {
      this.setDateRange('', '');
    });

    // Filtro de Prioridad
    const prioritySelect = document.getElementById('filter-prioridad');
    prioritySelect?.addEventListener('change', (e) => {
      this.priorityFilter = e.target.value;
      this.currentPage = 1;
      this.refreshData();
    });

    // Filtro de Tipo de Documento
    const tipoDocSelect = document.getElementById('filter-tipo-doc');
    tipoDocSelect?.addEventListener('change', (e) => {
      this.tipoDocFilter = e.target.value;
      this.currentPage = 1;
      this.refreshData();
    });

    // Botón Limpiar Todos los Filtros
    document.getElementById('btn-reset-filtros')?.addEventListener('click', () => {
      this.resetAllFilters();
    });

    // Botón Exportar CSV / Excel
    document.getElementById('btn-exportar-csv')?.addEventListener('click', () => {
      this.exportToCSV();
    });

    // Botón Imprimir Reporte
    document.getElementById('btn-imprimir-bandeja')?.addEventListener('click', () => {
      window.print();
    });

    // Botón Recargar / Refrescar Datos
    document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
      this.refreshData();
      this.showToast('Bandeja actualizada.', 'info');
    });

    // Botón Reset a Semilla (en caso de pruebas)
    document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
      if (confirm('¿Deseas restaurar los expedientes iniciales de demostración?')) {
        ExpedientesDB.resetToDefault();
        this.refreshData();
        this.showToast('Datos de demostración restaurados.', 'success');
      }
    });
  },

  setDateRange(from, to) {
    this.dateFrom = from;
    this.dateTo = to;
    const inputFechaInicio = document.getElementById('filter-fecha-inicio');
    const inputFechaFin = document.getElementById('filter-fecha-fin');
    if (inputFechaInicio) inputFechaInicio.value = from;
    if (inputFechaFin) inputFechaFin.value = to;
    this.currentPage = 1;
    this.refreshData();
  },

  resetAllFilters() {
    this.searchQuery = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.priorityFilter = 'ALL';
    this.tipoDocFilter = 'ALL';
    this.currentPage = 1;

    const searchInput = document.getElementById('input-busqueda-general');
    if (searchInput) searchInput.value = '';

    const inputFechaInicio = document.getElementById('filter-fecha-inicio');
    const inputFechaFin = document.getElementById('filter-fecha-fin');
    if (inputFechaInicio) inputFechaInicio.value = '';
    if (inputFechaFin) inputFechaFin.value = '';

    const prioritySelect = document.getElementById('filter-prioridad');
    if (prioritySelect) prioritySelect.value = 'ALL';

    const tipoDocSelect = document.getElementById('filter-tipo-doc');
    if (tipoDocSelect) tipoDocSelect.value = 'ALL';

    this.refreshData();
    this.showToast('Filtros restablecidos.', 'info');
  },

  setActiveTab(tabName) {
    this.activeTab = tabName;
    this.currentPage = 1;

    // Actualizar estilo visual de las pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const t = btn.getAttribute('data-tab');
      if (t === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.refreshData();
  },

  /**
   * Obtiene la lista filtrada de expedientes según pestaña, área, búsqueda y filtros
   */
  getFilteredExpedientes() {
    const all = ExpedientesDB.getExpedientes();

    return all.filter(exp => {
      // 1. Filtro por Área
      if (this.selectedArea !== 'ALL' && exp.areaActualId !== this.selectedArea) {
        return false;
      }

      // 2. Filtro por Pestaña de Estado de Flujo
      if (this.activeTab !== 'Todos' && exp.estado !== this.activeTab) {
        return false;
      }

      // 3. Filtro por Búsqueda General (Código EXP-YYYY-XXXXXX, DNI/RUC, Nombres, Asunto)
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchId = exp.id.toLowerCase().includes(q);
        const matchNumDoc = exp.solicitante.numDoc.toLowerCase().includes(q);
        const matchNombre = exp.solicitante.nombre.toLowerCase().includes(q);
        const matchRepresentante = exp.solicitante.representante ? exp.solicitante.representante.toLowerCase().includes(q) : false;
        const matchAsunto = exp.asunto.toLowerCase().includes(q);
        const matchTramite = exp.tipoTramite.toLowerCase().includes(q);

        if (!matchId && !matchNumDoc && !matchNombre && !matchRepresentante && !matchAsunto && !matchTramite) {
          return false;
        }
      }

      // 4. Filtro por Rango de Fechas (Fecha Inicio - Fecha Fin)
      if (this.dateFrom) {
        const expDate = exp.fechaIngreso.split('T')[0];
        if (expDate < this.dateFrom) return false;
      }
      if (this.dateTo) {
        const expDate = exp.fechaIngreso.split('T')[0];
        if (expDate > this.dateTo) return false;
      }

      // 5. Filtro por Prioridad
      if (this.priorityFilter !== 'ALL' && exp.prioridad !== this.priorityFilter) {
        return false;
      }

      // 6. Filtro por Tipo de Documento
      if (this.tipoDocFilter !== 'ALL' && exp.tipoDocumento !== this.tipoDocFilter) {
        return false;
      }

      return true;
    });
  },

  /**
   * Actualiza los contadores dinámicos de cada pestaña según el contexto del área seleccionada
   */
  updateDynamicTabCounters() {
    const all = ExpedientesDB.getExpedientes();

    // Filtramos por el área activa si no es ALL para que los contadores reflejen la bandeja del área
    const areaFiltered = this.selectedArea === 'ALL' 
      ? all 
      : all.filter(e => e.areaActualId === this.selectedArea);

    const counts = {
      'Pendiente': 0,
      'En Proceso': 0,
      'Observado': 0,
      'Derivado': 0,
      'Notificado': 0,
      'Archivado': 0,
      'Todos': areaFiltered.length
    };

    areaFiltered.forEach(exp => {
      if (counts[exp.estado] !== undefined) {
        counts[exp.estado]++;
      }
    });

    // Actualizar badges en DOM
    for (const [key, count] of Object.entries(counts)) {
      const badgeElem = document.getElementById(`tab-count-${key.toLowerCase().replace(/\s+/g, '-')}`);
      if (badgeElem) {
        badgeElem.textContent = count;
      }
    }
  },

  /**
   * Actualiza las tarjetas KPI superiores
   */
  updateKPICards() {
    const all = ExpedientesDB.getExpedientes();
    const areaFiltered = this.selectedArea === 'ALL' 
      ? all 
      : all.filter(e => e.areaActualId === this.selectedArea);

    let total = areaFiltered.length;
    let enPlazo = 0;
    let proximosVencer = 0;
    let vencidos = 0;

    areaFiltered.forEach(exp => {
      if (exp.estado === 'Archivado' || exp.estado === 'Notificado') {
        enPlazo++;
        return;
      }

      const sla = this.calculateSLA(exp.fechaLimite);
      if (sla.tipo === 'danger') {
        vencidos++;
      } else if (sla.tipo === 'warning') {
        proximosVencer++;
      } else {
        enPlazo++;
      }
    });

    const elemTotal = document.getElementById('kpi-total');
    const elemEnPlazo = document.getElementById('kpi-en-plazo');
    const elemProximos = document.getElementById('kpi-proximos');
    const elemVencidos = document.getElementById('kpi-vencidos');

    if (elemTotal) elemTotal.textContent = total;
    if (elemEnPlazo) elemEnPlazo.textContent = enPlazo;
    if (elemProximos) elemProximos.textContent = proximosVencer;
    if (elemVencidos) elemVencidos.textContent = vencidos;
  },

  /**
   * Refresca la tabla, los contadores de pestañas y las tarjetas KPI
   */
  refreshData() {
    this.updateDynamicTabCounters();
    this.updateKPICards();

    const filtered = this.getFilteredExpedientes();
    this.renderTable(filtered);
    this.renderPagination(filtered.length);

    // Actualizar contador de resultados
    const resultsCountElem = document.getElementById('results-count-text');
    if (resultsCountElem) {
      resultsCountElem.innerHTML = `Mostrando <strong>${Math.min(filtered.length, (this.currentPage - 1) * this.pageSize + 1)} - ${Math.min(filtered.length, this.currentPage * this.pageSize)}</strong> de <strong>${filtered.length}</strong> expedientes`;
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * Renderiza las filas de la tabla de expedientes
   */
  renderTable(data) {
    const tbody = document.getElementById('expedientes-table-body');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 px-4">
            <div class="max-w-sm mx-auto flex flex-col items-center">
              <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <i data-lucide="folder-search" class="w-7 h-7"></i>
              </div>
              <h3 class="text-base font-bold text-slate-800 mb-1">No se encontraron expedientes</h3>
              <p class="text-xs text-slate-500 text-center mb-4">No hay registros que coincidan con la pestaña actual o los filtros de búsqueda aplicados.</p>
              <button onclick="App.resetAllFilters()" class="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1.5">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                Restablecer Filtros
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Paginación
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paginatedData = data.slice(startIndex, startIndex + this.pageSize);

    tbody.innerHTML = paginatedData.map(exp => {
      const sla = this.calculateSLA(exp.fechaLimite);
      const isJuridica = exp.solicitante.tipo === 'Persona Jurídica';

      return `
        <tr class="expediente-row border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
          <!-- 1. Código de Expediente -->
          <td class="py-3.5 px-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/50 transition-colors">
                ${exp.id}
              </span>
              <button onclick="App.copyToClipboard('${exp.id}', this)" class="copy-btn relative text-slate-400 hover:text-blue-600 p-1 rounded transition-colors" title="Copiar código">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span class="copy-tooltip absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                  ¡Copiado!
                </span>
              </button>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3"></i>
              ${this.formatDateTime(exp.fechaIngreso)}
            </div>
          </td>

          <!-- 2. Solicitante -->
          <td class="py-3.5 px-4">
            <div class="flex items-start gap-2.5">
              <div class="w-8 h-8 rounded-lg ${isJuridica ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                <i data-lucide="${isJuridica ? 'building-2' : 'user'}" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <div class="font-semibold text-xs text-slate-800 truncate max-w-[200px]" title="${exp.solicitante.nombre}">
                  ${exp.solicitante.nombre}
                </div>
                <div class="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                  <span class="font-medium text-slate-600">${exp.solicitante.tipoDoc}:</span> ${exp.solicitante.numDoc}
                </div>
              </div>
            </div>
          </td>

          <!-- 3. Asunto y Trámite -->
          <td class="py-3.5 px-4">
            <div class="font-medium text-xs text-slate-800 line-clamp-2 max-w-[280px]" title="${exp.asunto}">
              ${exp.asunto}
            </div>
            <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span class="text-blue-600 font-medium">${exp.tipoTramite}</span>
              <span class="text-slate-300">&bull;</span>
              <span class="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">${exp.folios} fls.</span>
            </div>
          </td>

          <!-- 4. Área Actual -->
          <td class="py-3.5 px-4 whitespace-nowrap">
            <div class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i>
              ${exp.areaActualNombre}
            </div>
            <div class="text-[11px] text-slate-500 truncate max-w-[150px]" title="${exp.tecnicoAsignado}">
              ${exp.tecnicoAsignado}
            </div>
          </td>

          <!-- 5. Prioridad -->
          <td class="py-3.5 px-4 whitespace-nowrap">
            ${this.getPrioridadBadgeHTML(exp.prioridad)}
          </td>

          <!-- 6. Estado del Flujo -->
          <td class="py-3.5 px-4 whitespace-nowrap">
            ${this.getEstadoBadgeHTML(exp.estado)}
          </td>

          <!-- 7. Semáforo / SLA -->
          <td class="py-3.5 px-4 whitespace-nowrap">
            <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${sla.badgeClass}">
              <span class="w-1.5 h-1.5 rounded-full ${sla.dotClass}"></span>
              ${sla.texto}
            </span>
          </td>

          <!-- 8. Acciones Rápidas -->
          <td class="py-3.5 px-4 whitespace-nowrap text-right">
            <div class="flex items-center justify-end gap-1.5">
              <!-- Ver Detalle -->
              <button onclick="ModalController.openDetalle('${exp.id}')" class="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Detalle y Trazabilidad">
                <i data-lucide="eye" class="w-4 h-4"></i>
              </button>

              <!-- Derivar -->
              <button onclick="ModalController.openDerivar('${exp.id}')" class="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors" title="Derivar Expediente">
                <i data-lucide="send" class="w-4 h-4"></i>
              </button>

              <!-- Observar -->
              <button onclick="ModalController.openObservar('${exp.id}')" class="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors" title="Formular Observación">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i>
              </button>

              <!-- Menú Extra Contextual -->
              <div class="relative inline-block text-left dropdown-container">
                <button onclick="App.toggleRowMenu('${exp.id}')" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>
                <div id="row-menu-${exp.id}" class="hidden absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 z-30 py-1 text-left">
                  <button onclick="ModalController.openNotificar('${exp.id}'); App.hideAllRowMenus();" class="w-full px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                    <i data-lucide="mail-check" class="w-3.5 h-3.5 text-emerald-600"></i> Notificar
                  </button>
                  <button onclick="ModalController.openArchivar('${exp.id}'); App.hideAllRowMenus();" class="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2">
                    <i data-lucide="archive" class="w-3.5 h-3.5 text-slate-500"></i> Archivar
                  </button>
                  <div class="border-t border-slate-100 my-1"></div>
                  <button onclick="App.copyToClipboard('${exp.id}', this); App.hideAllRowMenus();" class="w-full px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                    <i data-lucide="copy" class="w-3.5 h-3.5 text-blue-600"></i> Copiar Código
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  toggleRowMenu(expId) {
    const targetMenu = document.getElementById(`row-menu-${expId}`);
    const isCurrentlyOpen = targetMenu && !targetMenu.classList.contains('hidden');
    this.hideAllRowMenus();
    if (!isCurrentlyOpen && targetMenu) {
      targetMenu.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    }
  },

  hideAllRowMenus() {
    document.querySelectorAll('[id^="row-menu-"]').forEach(m => m.classList.add('hidden'));
  },

  /**
   * Paginación dinámica
   */
  renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let buttonsHTML = `
      <div class="flex items-center gap-1">
        <button onclick="App.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : ''} class="p-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          <i data-lucide="chevron-left" class="w-4 h-4"></i>
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      const isActive = i === this.currentPage;
      buttonsHTML += `
        <button onclick="App.goToPage(${i})" class="px-3 py-1.5 text-xs rounded-lg font-semibold border ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}">
          ${i}
        </button>
      `;
    }

    buttonsHTML += `
        <button onclick="App.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : ''} class="p-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    paginationContainer.innerHTML = buttonsHTML;
  },

  goToPage(page) {
    const totalItems = this.getFilteredExpedientes().length;
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.refreshData();
    }
  },

  /**
   * Cálculo de SLA de acuerdo a la fecha límite
   */
  calculateSLA(fechaLimiteStr) {
    if (!fechaLimiteStr) return { tipo: 'safe', texto: 'En Plazo', badgeClass: 'sla-badge-safe', dotClass: 'bg-emerald-500' };

    const now = new Date();
    const limit = new Date(fechaLimiteStr);
    const diffMs = limit - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        tipo: 'danger',
        texto: `Vencido (${Math.abs(diffDays)}d)`,
        badgeClass: 'sla-badge-danger',
        dotClass: 'bg-rose-500'
      };
    } else if (diffDays <= 3) {
      return {
        tipo: 'warning',
        texto: `Vence en ${diffDays}d`,
        badgeClass: 'sla-badge-warning',
        dotClass: 'bg-amber-500'
      };
    } else {
      return {
        tipo: 'safe',
        texto: `${diffDays} días restantes`,
        badgeClass: 'sla-badge-safe',
        dotClass: 'bg-emerald-500'
      };
    }
  },

  /**
   * Helpers de badges HTML
   */
  getEstadoBadgeHTML(estado) {
    const config = {
      'Pendiente': { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'clock' },
      'En Proceso': { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'loader' },
      'Observado': { bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'alert-triangle' },
      'Derivado': { bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'send' },
      'Notificado': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check-circle' },
      'Archivado': { bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'archive' }
    };

    const c = config[estado] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'file' };

    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg}">
        <i data-lucide="${c.icon}" class="w-3.5 h-3.5"></i>
        ${estado}
      </span>
    `;
  },

  getPrioridadBadgeHTML(prioridad) {
    const config = {
      'Muy Urgente': 'bg-rose-100 text-rose-800 border-rose-200 font-bold',
      'Urgente': 'bg-amber-100 text-amber-800 border-amber-200 font-semibold',
      'Normal': 'bg-slate-100 text-slate-700 border-slate-200'
    };

    const cls = config[prioridad] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="inline-block px-2 py-0.5 rounded text-[11px] border ${cls}">${prioridad}</span>`;
  },

  formatDateTime(isoStr) {
    if (!isoStr) return '-';
    const date = new Date(isoStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(`Código ${text} copiado al portapapeles.`, 'info');
    }).catch(err => {
      console.error('Error al copiar:', err);
    });
  },

  exportToCSV() {
    const data = this.getFilteredExpedientes();
    if (data.length === 0) {
      this.showToast('No hay datos para exportar.', 'warning');
      return;
    }

    const headers = ['Codigo Expediente', 'Fecha Ingreso', 'Tipo Doc', 'Num Doc', 'Solicitante', 'Tipo Tramite', 'Asunto', 'Folios', 'Area Actual', 'Tecnico Asignado', 'Prioridad', 'Estado', 'Fecha Limite'];
    const rows = data.map(e => [
      `"${e.id}"`,
      `"${this.formatDateTime(e.fechaIngreso)}"`,
      `"${e.solicitante.tipoDoc}"`,
      `"${e.solicitante.numDoc}"`,
      `"${e.solicitante.nombre.replace(/"/g, '""')}"`,
      `"${e.tipoTramite}"`,
      `"${e.asunto.replace(/"/g, '""')}"`,
      e.folios,
      `"${e.areaActualNombre}"`,
      `"${e.tecnicoAsignado}"`,
      `"${e.prioridad}"`,
      `"${e.estado}"`,
      `"${this.formatDateTime(e.fechaLimite)}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expedientes_${this.selectedArea}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('Archivo CSV exportado exitosamente.', 'success');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const icons = {
      success: 'check-circle-2',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const colors = {
      success: 'bg-emerald-900 text-white border border-emerald-700',
      error: 'bg-rose-900 text-white border border-rose-700',
      warning: 'bg-amber-900 text-white border border-amber-700',
      info: 'bg-slate-900 text-white border border-slate-700'
    };

    toast.className = `toast ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 shrink-0 mt-0.5"></i>
      <div class="text-xs font-medium leading-relaxed">${message}</div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    // Trigger animacion entrada
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto eliminar tras 3.5 segundos
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }
};

// Cerrar dropdowns de filas al hacer clic afuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-container')) {
    App.hideAllRowMenus();
  }
});

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
