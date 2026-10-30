# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

# Fix the navigation to use role-based destination
old = '''      try {
        await loginStore({ identificador, password: clave });
        const destino = rolActual.destino;
        navigate(destino, { replace: true });
        return;
      } catch {'''

new = '''      try {
        await loginStore({ identificador, password: clave });
        const destino = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
        navigate(destino, { replace: true });
        return;
      } catch {'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
