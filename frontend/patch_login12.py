# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    s = f.read()

old = '        const destino = rolActual.destino;'
new = '        const destino = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || \"/casilla\";'

s2 = s.replace(old, new)
with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
    f.write(s2)
print('done')
