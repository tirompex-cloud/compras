"""
Injeta o CSS de overrides (rompex-modules.css) + script anti-flash de tema
em cada modulo da intranet.

- Adiciona o script anti-flash logo apos <meta name="viewport">
- Adiciona o <link rel="stylesheet" href="../rompex-modules.css"> antes de </head>

Idempotente: nao duplica se ja inseridos.
"""
import re
from pathlib import Path

BASE = Path(r"C:\Users\Thiago Morais\Desktop\Automações\compras\modulos")

ANTI_FLASH = '''
<script>
(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
</script>'''

OVERRIDES_LINK = '<link rel="stylesheet" href="../rompex-modules.css">'

# Padrao do meta viewport (gancho pro anti-flash)
META_VIEWPORT = re.compile(r'(<meta name="viewport"[^>]*>)', re.IGNORECASE)
HEAD_CLOSE = re.compile(r'(\s*)</head>', re.IGNORECASE)

count_anti = 0
count_link = 0
files_changed = []

for html_file in sorted(BASE.glob("*.html")):
    text = html_file.read_text(encoding="utf-8")
    original = text
    changed = False

    # 1. Anti-flash apos meta viewport (idempotente)
    if "data-theme" not in text[:text.find('<style>')] if '<style>' in text else 'data-theme' not in text[:2000]:
        m = META_VIEWPORT.search(text)
        if m and ANTI_FLASH.strip() not in text:
            text = text[:m.end()] + ANTI_FLASH + text[m.end():]
            count_anti += 1
            changed = True

    # 2. Link overrides antes de </head> (idempotente)
    if OVERRIDES_LINK not in text:
        m = HEAD_CLOSE.search(text)
        if m:
            indent = m.group(1)
            text = text[:m.start()] + indent + OVERRIDES_LINK + m.group(0) + text[m.end():]
            count_link += 1
            changed = True

    if changed and text != original:
        html_file.write_text(text, encoding="utf-8")
        files_changed.append(html_file.name)

print(f"Anti-flash script: +{count_anti} arquivos")
print(f"Overrides link:    +{count_link} arquivos")
print(f"Total alterados:   {len(files_changed)}")
for f in files_changed:
    print(f"  - {f}")
