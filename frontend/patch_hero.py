# -*- coding: utf-8 -*-
with open(r'src\components\landing\HeroInstitucional.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''  const accesosRapidos = filtrarModulosPorRol(rol, autenticado).filter((modulo) =>
    ICONOS_ACCESO[modulo.id],
  );'''

new = '''  const accesosRapidos = filtrarModulosPorRol(rol, autenticado).filter((modulo) =>
    ICONOS_ACCESO[modulo.id],
  );'''

# For external/students only - but let's check auth context; user says hide images for internal/admin roles
# Also remove Acceso rápido sidebar

old2 = '''        <div className=\"grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch\">'''

new2 = '''        <div className=\"grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch\">'''

if old2 in content:
    content = content.replace(old2, new2)
    with open(r'src\components\landing\HeroInstitucional.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
else:
    print('no')
