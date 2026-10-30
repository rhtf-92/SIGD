# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''  const rolActual = ROLES_CANONICOS.find((r) => r.id === rol) ?? ROLES_CANONICOS[0];
  const pidePassword = rolActual.requierePassword;

  function guardarSesionDemo(token: string, rolId: string) {
    window.localStorage.setItem(CLAVE_TOKEN, token);
    window.localStorage.setItem(CLAVE_ROL, rolId);
    window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
    notificarCambioSesion();
  }

  async function iniciarSesion(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");

    if (pidePassword && !password.trim()) {
      setError("Por favor, ingrese su contraseña.");
      return;
    }

    setCargando(true);
    const identificador = rolActual.usuario;
    const clave = pidePassword ? password : PASSWORD_DEMO;'''

new = '''  const rolActual = ROLES_CANONICOS.find((r) => r.id === rol) ?? ROLES_CANONICOS.find((r) => r.id === \"ESTUDIANTE\") ?? ROLES_CANONICOS[0];

  function guardarSesionDemo(token: string, rolId: string) {
    window.localStorage.setItem(CLAVE_TOKEN, token);
    window.localStorage.setItem(CLAVE_ROL, rolId);
    window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
    notificarCambioSesion();
  }

  async function iniciarSesion(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");

    if (!identificador.trim()) {
      setError("Por favor, ingrese su usuario, DNI o correo.");
      return;
    }

    if (!password.trim()) {
      setError("Por favor, ingrese su contraseña.");
      return;
    }

    setCargando(true);
    const clave = password;'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
