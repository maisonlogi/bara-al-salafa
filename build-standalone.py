from pathlib import Path

root = Path(__file__).resolve().parent
css = (root / "styles.css").read_text(encoding="utf-8")
scripts = "\n".join(
    [
        (root / name).read_text(encoding="utf-8")
        for name in ("data.js", "whoami-data.js", "whoami.js", "forbidden-data.js", "forbidden.js", "game.js")
    ]
)

html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#07151a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>ألعابنا</title>
    <style>
{css}
    </style>
  </head>
  <body>
    <div class="bg-layer" aria-hidden="true"></div>
    <div class="noise" aria-hidden="true"></div>
    <main id="app" class="app"></main>
    <script>
{scripts}
    </script>
  </body>
</html>
"""

out_dir = root / "dist"
out_dir.mkdir(exist_ok=True)
(out_dir / "index.html").write_text(html, encoding="utf-8")
print("wrote", out_dir / "index.html", "bytes", (out_dir / "index.html").stat().st_size)
