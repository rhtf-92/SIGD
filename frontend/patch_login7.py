# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

# Just fix the login call
old = '''      const identificador = rolActual.usuario;
      const clave = pidePassword ? password : PASSWORD_DEMO;

      // 2) Intento real contra la base de datos SIGD (PostgreSQL / pgAdmin).
      try {
        await loginStore({ identificador, password: clave });
        const destino = rolActual.destino;
        navigate(destino, { replace: true });
        return;'''

new = '''      const clave = password;

      // 2) Intento real contra la base de datos SIGD (PostgreSQL / pgAdmin).
      try {
        await loginStore({ identificador, password: clave });
        const destino = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
        navigate(destino, { replace: true });
        return;'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
