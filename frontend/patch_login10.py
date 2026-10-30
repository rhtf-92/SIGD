# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''        await loginStore({ identificador, password: clave });
        const destino = rolActual.destino;
        navigate(destino, { replace: true });'''

new = '''        await loginStore({ identificador, password: clave });
        const destino = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
        navigate(destino, { replace: true });'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
