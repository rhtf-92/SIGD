import type { GuidedNode } from './types';

/**
 * Árbol canónico de navegación guiada para el Asistente Público del SIGD 2026.
 * Flujo estructurado sin callejones sin salida.
 */
export const GUIDED_NODES: Record<string, GuidedNode> = {
  ROOT: {
    id: 'ROOT',
    title: 'Asistente SIGD',
    subtitle: 'Orientación sobre trámites y servicios',
    message:
      'Hola. Puedo ayudarte a encontrar trámites y utilizar los servicios disponibles en el SIGD.\n\n¿Qué necesitas hacer?',
    options: [
      { id: 'opt_root_realizar', label: 'Realizar un trámite', nextNode: 'REALIZAR_TRAMITE' },
      { id: 'opt_root_buscar_tupa', label: 'Buscar un trámite TUPA', nextNode: 'BUSCAR_TUPA' },
      { id: 'opt_root_consultar', label: 'Consultar mi trámite', nextNode: 'CONSULTAR_TRAMITE' },
      { id: 'opt_root_registro', label: 'Registrarme', nextNode: 'REGISTRO' },
      { id: 'opt_root_login', label: 'Iniciar sesión', nextNode: 'INICIAR_SESION' },
      { id: 'opt_root_casilla', label: 'Casilla Electrónica', nextNode: 'CASILLA_ELECTRONICA' },
    ],
  },

  REALIZAR_TRAMITE: {
    id: 'REALIZAR_TRAMITE',
    title: 'Realizar un trámite',
    subtitle: 'Mesa de Partes Virtual y Catálogo',
    message:
      'Puedes iniciar trámites de manera virtual las 24 horas del día o consultar los aranceles y requisitos vigentes en el Catálogo TUPA.',
    options: [
      { id: 'opt_rt_ver_tupa', label: 'Ver trámites disponibles', nextNode: 'BUSCAR_TUPA' },
      { id: 'opt_rt_iniciar', label: 'Iniciar trámite', route: '/tramite', requiresAuth: true },
      { id: 'opt_rt_reqs', label: 'Consultar requisitos', nextNode: 'BUSCAR_TUPA' },
      { id: 'opt_rt_sol_tupa', label: 'Solicitar acceso TUPA', route: '/solicitud-acceso-tupa' },
      { id: 'opt_rt_back', label: '← Volver', isBack: true },
    ],
  },

  CONSULTAR_TRAMITE: {
    id: 'CONSULTAR_TRAMITE',
    title: 'Consultar mi trámite',
    subtitle: 'Seguimiento procesal de expedientes',
    message:
      'Puedes consultar el estado actual de tu trámite usando el Código Único de Trámite (CUT) o acceder a la bandeja de tus trámites si tienes sesión iniciada.',
    options: [
      { id: 'opt_ct_cut', label: 'Consultar por CUT', route: '/consulta' },
      { id: 'opt_ct_mis_exp', label: 'Mis Expedientes', route: '/mis-expedientes', requiresAuth: true },
      { id: 'opt_ct_estados', label: '¿Qué significa el estado de mi trámite?', nextNode: 'ESTADOS_TRAMITE' },
      { id: 'opt_ct_back', label: '← Volver', isBack: true },
    ],
  },

  ESTADOS_TRAMITE: {
    id: 'ESTADOS_TRAMITE',
    title: 'Estados de un expediente',
    subtitle: 'Significado de los estados en el SIGD',
    message:
      'Un expediente documentario pasa por los siguientes estados procesales:\n\n• REGISTRADO: Recibido formalmente en Mesa de Partes.\n• DERIVADO: Enviado al área o especialista competente.\n• EN_TRAMITE: En proceso de evaluación y preparación del documento de respuesta.\n• ATENDIDO: Procedimiento concluido con emisión de resolución o acto administrativo.\n• ARCHIVADO: Trámite finalizado y resguardado en archivo institucional.',
    options: [
      { id: 'opt_et_cut', label: 'Consultar por CUT', route: '/consulta' },
      { id: 'opt_et_back', label: '← Volver', isBack: true },
      { id: 'opt_et_home', label: 'Volver al inicio', isHome: true },
    ],
  },

  REGISTRO: {
    id: 'REGISTRO',
    title: 'Registro de Ciudadano',
    subtitle: 'Afiliación al domicilio digital',
    message:
      'Para registrarte en el SIGD requieres tu Documento Nacional de Identidad (DNI) o Carné de Extranjería y una dirección de correo electrónico activa. Al registrarte se te creará de inmediato tu Casilla Electrónica oficial.',
    options: [
      { id: 'opt_reg_ir', label: 'Ir a Registro Ciudadano', route: '/registro' },
      { id: 'opt_reg_login', label: 'Ya tengo cuenta (Iniciar sesión)', route: '/login' },
      { id: 'opt_reg_back', label: '← Volver', isBack: true },
    ],
  },

  INICIAR_SESION: {
    id: 'INICIAR_SESION',
    title: 'Iniciar sesión',
    subtitle: 'Acceso seguro al sistema',
    message:
      'Ingresa a tu cuenta con tu número de documento y contraseña para radicar expedientes en la Mesa de Partes Virtual, revisar Mis Expedientes y consultar notificaciones en tu Casilla.',
    options: [
      { id: 'opt_is_login', label: 'Ir a Iniciar Sesión', route: '/login' },
      { id: 'opt_is_problemas', label: 'Problemas para ingresar', nextNode: 'PROBLEMAS_INGRESO' },
      { id: 'opt_is_reg', label: 'Registrarme', route: '/registro' },
      { id: 'opt_is_back', label: '← Volver', isBack: true },
    ],
  },

  PROBLEMAS_INGRESO: {
    id: 'PROBLEMAS_INGRESO',
    title: 'Problemas para ingresar',
    subtitle: 'Recuperación de acceso',
    message:
      'Si olvidaste tu contraseña o tienes dificultades para iniciar sesión, puedes solicitar la recuperación de clave desde la pantalla de login o acudir a la Secretaría General del IESTP "Suiza" portando tu documento de identidad.',
    options: [
      { id: 'opt_pi_login', label: 'Ir a Iniciar Sesión', route: '/login' },
      { id: 'opt_pi_back', label: '← Volver', isBack: true },
      { id: 'opt_pi_home', label: 'Volver al inicio', isHome: true },
    ],
  },

  CASILLA_ELECTRONICA: {
    id: 'CASILLA_ELECTRONICA',
    title: 'Casilla Electrónica',
    subtitle: 'Domicilio digital legal (Ley N° 27444)',
    message:
      'La Casilla Electrónica es tu domicilio digital legal oficial. En ella recibes formalmente las notificaciones de actos administrativos, resoluciones y observaciones con acuse de recibo de validez legal.',
    options: [
      { id: 'opt_ce_que_es', label: '¿Qué es?', nextNode: 'CASILLA_QUE_ES' },
      { id: 'opt_ce_donde', label: '¿Dónde la encuentro?', nextNode: 'CASILLA_DONDE' },
      { id: 'opt_ce_sirve', label: '¿Para qué sirve?', nextNode: 'CASILLA_SIRVE' },
      { id: 'opt_ce_ir', label: 'Ir a mi Casilla', route: '/casilla', requiresAuth: true },
      { id: 'opt_ce_back', label: '← Volver', isBack: true },
    ],
  },

  CASILLA_QUE_ES: {
    id: 'CASILLA_QUE_ES',
    title: '¿Qué es la Casilla Electrónica?',
    subtitle: 'Definición jurídica y operativa',
    message:
      'Es un buzón telemático asignado a cada administrado al registrarse en el SIGD. Constituye un domicilio digital con plena validez legal para comunicaciones oficiales del instituto conforme a la Ley N° 27444.',
    options: [
      { id: 'opt_cq_sirve', label: '¿Para qué sirve?', nextNode: 'CASILLA_SIRVE' },
      { id: 'opt_cq_ir', label: 'Ir a mi Casilla', route: '/casilla', requiresAuth: true },
      { id: 'opt_cq_back', label: '← Volver', isBack: true },
      { id: 'opt_cq_home', label: 'Volver al inicio', isHome: true },
    ],
  },

  CASILLA_DONDE: {
    id: 'CASILLA_DONDE',
    title: '¿Dónde encuentro mi Casilla?',
    subtitle: 'Ubicación en la plataforma',
    message:
      'Puedes acceder a tu Casilla Electrónica desde la barra superior de navegación o ingresando directamente a la ruta /casilla una vez que hayas iniciado sesión con tu cuenta de ciudadano.',
    options: [
      { id: 'opt_cd_ir', label: 'Ir a mi Casilla', route: '/casilla', requiresAuth: true },
      { id: 'opt_cd_login', label: 'Iniciar sesión', route: '/login' },
      { id: 'opt_cd_back', label: '← Volver', isBack: true },
      { id: 'opt_cd_home', label: 'Volver al inicio', isHome: true },
    ],
  },

  CASILLA_SIRVE: {
    id: 'CASILLA_SIRVE',
    title: '¿Para qué sirve la Casilla?',
    subtitle: 'Funcionalidad de notificación',
    message:
      'Permite recibir las notificaciones oficiales de tus trámites en tiempo real, descargar copias auténticas con Código de Verificación Digital (CVD) y firmar el acuse legal de recepción sin tener que acercarte a la institución.',
    options: [
      { id: 'opt_cs_ir', label: 'Ir a mi Casilla', route: '/casilla', requiresAuth: true },
      { id: 'opt_cs_back', label: '← Volver', isBack: true },
      { id: 'opt_cs_home', label: 'Volver al inicio', isHome: true },
    ],
  },

  BUSCAR_TUPA: {
    id: 'BUSCAR_TUPA',
    title: 'Buscar procedimiento TUPA',
    subtitle: 'Catálogo Oficial TUPA 2026',
    message:
      'Utiliza el buscador a continuación para filtrar el catálogo oficial por nombre, código o palabra clave:',
    isTupaSearch: true,
    options: [
      { id: 'opt_bt_completo', label: 'Ver Catálogo TUPA completo', route: '/tupa' },
      { id: 'opt_bt_back', label: '← Volver', isBack: true },
      { id: 'opt_bt_home', label: 'Volver al inicio', isHome: true },
    ],
  },

  AUTH_REQUERIDA: {
    id: 'AUTH_REQUERIDA',
    title: 'Inicio de sesión requerido',
    subtitle: 'Acceso exclusivo para usuarios autenticados',
    message:
      'Para utilizar esta opción necesitas iniciar sesión con tu cuenta de ciudadano administrado.',
    options: [
      { id: 'opt_ar_login', label: 'Iniciar sesión', route: '/login' },
      { id: 'opt_ar_reg', label: 'Registrarme', route: '/registro' },
      { id: 'opt_ar_back', label: '← Volver', isBack: true },
      { id: 'opt_ar_home', label: 'Volver al inicio', isHome: true },
    ],
  },
};
