# -*- coding: utf-8 -*-
with open(r'src\components\landing\HeroInstitucional.tsx', encoding='utf-8') as f:
    content = f.read()

# Remove the aside (Acceso rápido + Escríbenos)
start = content.find('<aside')
if start >= 0:
    # Find the end of aside tag
    # Look for </aside>
    end = content.find('</aside>', start)
    if end >= 0:
        end_tag = end + len('</aside>')
        # Also remove trailing whitespace/newline
        # Remove from start to end_tag
        new_content = content[:start] + content[end_tag:]
        with open(r'src\components\landing\HeroInstitucional.tsx', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('done')
    else:
        print('no end')
else:
    print('no start')
