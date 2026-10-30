# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

# Look for the catch block
if 'if (pidePassword' in content:
    # Try to replace differently
    old = '''                if (pidePassword && password !== PASSWORD_DEMO) {
                  setError("Contrase\u00f1a incorrecta. Int\u00e9ntelo nuevamente.");
                  return;
                }
                guardarSesionDemo("demo-jwt-" + Date.now(), rol);
                navigate(rolActual.destino, { replace: true });'''
    new = '''                guardarSesionDemo("demo-jwt-" + Date.now(), rol);
                const destinoFallback = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
                navigate(destinoFallback, { replace: true });'''
    if old in content:
        content = content.replace(old, new)
        with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
            f.write(content)
        print('done1')
    else:
        print('no1')
else:
    print('no')
