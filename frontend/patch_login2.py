# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''  const [rol, setRol] = useState("SUPER_ADMIN");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);'''

new = '''  const [rol, setRol] = useState("ESTUDIANTE");
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
