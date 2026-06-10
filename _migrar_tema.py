"""
Migracao one-time: forca theme=light no localStorage de quem ainda nao migrou
para a v3.0 do design. Atualiza o anti-flash script em todos os HTMLs.
"""
import re
from pathlib import Path

BASE = Path(r"C:\Users\Thiago Morais\Desktop\Automações\compras")
MODULOS = BASE / "modulos"

OLD_SCRIPT_PATTERN = re.compile(
    r"<script>\s*\(function\(\)\{try\{var t=localStorage\.getItem\('theme'\)\|\|'light';document\.documentElement\.setAttribute\('data-theme',t\);\}catch\(e\)\{\}\}\)\(\);\s*</script>",
    re.IGNORECASE | re.DOTALL
)

NEW_SCRIPT = """<script>
(function(){try{
  if(localStorage.getItem('rompex_v3')!=='1'){localStorage.setItem('theme','light');localStorage.setItem('rompex_v3','1');}
  var t=localStorage.getItem('theme')||'light';
  document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();
</script>"""

files = [BASE / "index.html", BASE / "dashboard.html"] + sorted(MODULOS.glob("*.html"))

count = 0
for f in files:
    if not f.exists():
        continue
    text = f.read_text(encoding="utf-8")
    new_text, n = OLD_SCRIPT_PATTERN.subn(NEW_SCRIPT, text, count=1)
    if n > 0:
        f.write_text(new_text, encoding="utf-8")
        count += 1
        print(f"OK: {f.relative_to(BASE)}")
    else:
        print(f"PULOU (sem padrao): {f.relative_to(BASE)}")

print(f"\nTotal migrado: {count}/{len(files)}")
