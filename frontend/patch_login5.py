# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''                if (pidePassword && password !== PASSWORD_DEMO) {
                  setError("Contraseña incorrecta. Inténtelo nuevamente.");
                  return;
                }
                guardarSesionDemo("demo-jwt-" + Date.now(), rol);
                navigate(rolActual.destino, { replace: true });'''

new = '''                guardarSesionDemo("demo-jwt-" + Date.now(), rol);
                const destinoFallback = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
                navigate(destinoFallback, { replace: true });'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
