# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    s = f.read()

# Replace line by line approach
old = '        const destino = rolActual.destino;\n        navigate(destino, { replace: true });'
new = '        const destino = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";\n        navigate(destino, { replace: true });'

if old in s:
    s = s.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(s)
    print('done')
else:
    print('no')
