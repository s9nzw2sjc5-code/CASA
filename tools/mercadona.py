"""Genera casa/mercadona.json: catálogo de precios públicos de Mercadona.

La web de Mercadona no deja leer sus precios desde otra página, así que este
script los descarga (lo ejecuta GitHub Actions cada día) y la app lee el archivo.
Uso: python3 tools/mercadona.py [almacén; 3968 = Granada]
"""
import json, sys, time, urllib.request, os

WH = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('MERCADONA_WH', '3968')
API = 'https://tienda.mercadona.es/api/categories/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'casa', 'mercadona.json')


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'casa-app (uso personal)', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError('No se pudo leer ' + url)


def walk(node, top, out):
    for p in node.get('products') or []:
        pi = p.get('price_instructions') or {}
        try:
            price = float(pi.get('unit_price') or 0)
        except ValueError:
            continue
        if not price:
            continue
        thumb = (p.get('thumbnail') or '').split('/images/')[-1].split('?')[0]
        out[p['id']] = [
            p['id'], p.get('display_name', ''), p.get('packaging') or '', price,
            pi.get('unit_size') or 0, pi.get('size_format') or '',
            float(pi.get('reference_price') or 0), pi.get('reference_format') or '',
            top, thumb, 1 if pi.get('approx_size') else 0,
        ]
    for c in node.get('categories') or []:
        walk(c, top, out)


def main():
    root = get(API + '?lang=es&wh=' + WH)
    out, tops = {}, []
    for t in root['results']:
        tops.append(t['name'])
        for c in t['categories']:
            walk(get(f"{API}{c['id']}/?lang=es&wh={WH}"), len(tops) - 1, out)
            time.sleep(0.3)
    data = {'wh': WH, 'at': time.strftime('%Y-%m-%d'), 'cats': tops,
            'cols': ['id', 'nombre', 'envase', 'precio', 'tamano', 'unidad', 'precio_ref', 'unidad_ref', 'cat', 'img', 'aprox'],
            'p': sorted(out.values(), key=lambda x: (x[8], x[1]))}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'productos')


if __name__ == '__main__':
    main()
