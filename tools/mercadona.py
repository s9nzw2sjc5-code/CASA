"""Genera casa/mercadona.json: catálogo de precios públicos de Mercadona.

La web de Mercadona no deja leer sus precios desde otra página, así que este
script los descarga (lo ejecuta GitHub Actions cada día) y la app lee el archivo.
Los precios dependen del almacén que sirve cada código postal.

Uso: python3 tools/mercadona.py [código postal]
Sin código postal usa el de tools/mercadona-cp.txt.
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(__file__)
API = 'https://tienda.mercadona.es/api/'
OUT = os.path.join(HERE, '..', 'casa', 'mercadona.json')
CP_FILE = os.path.join(HERE, 'mercadona-cp.txt')
# Secciones que no se compran en casa: no se descargan
SKIP = ('Mascotas', 'Maquillaje', 'Bebé')
HEADERS = {'User-Agent': 'casa-app (uso personal)', 'Accept': 'application/json'}


def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError('No se pudo leer ' + url)


def warehouse(cp):
    # Mercadona dice qué almacén sirve un código postal en la cabecera x-customer-wh
    req = urllib.request.Request(API + 'postal-codes/actions/change-pc/', method='PUT',
                                 data=json.dumps({'new_postal_code': cp}).encode(),
                                 headers=dict(HEADERS, **{'Content-Type': 'application/json'}))
    with urllib.request.urlopen(req, timeout=30) as r:
        wh = r.headers.get('x-customer-wh')
    if not wh:
        raise RuntimeError('Mercadona no reparte en el código postal ' + cp)
    return wh


def prev(pi):
    # Precio anterior si Mercadona lo muestra tachado (bajada de precio)
    try:
        before, now = float(pi.get('previous_unit_price') or 0), float(pi.get('unit_price') or 0)
    except ValueError:
        return 0
    return before if before > now else 0


def walk(node, top, sub, out):
    for p in node.get('products') or []:
        pi = p.get('price_instructions') or {}
        try:
            price = float(pi.get('unit_price') or 0)
        except ValueError:
            continue
        if not price:
            continue
        if p['id'] in out:
            # El mismo producto puede estar en varias secciones (p. ej. pescado y congelados)
            if sub not in out[p['id']][12]:
                out[p['id']][12].append(sub)
            if p.get('is_new_arrival'):
                out[p['id']][13] = 1
            continue
        thumb = (p.get('thumbnail') or '').split('/images/')[-1].split('?')[0]
        out[p['id']] = [
            p['id'], p.get('display_name', ''), p.get('packaging') or '', price,
            pi.get('unit_size') or 0, pi.get('size_format') or '',
            float(pi.get('reference_price') or 0), pi.get('reference_format') or '',
            top, thumb, 1 if pi.get('approx_size') else 0, prev(pi), [sub],
            1 if p.get('is_new_arrival') else 0,  # novedad según Mercadona
        ]
    for c in node.get('categories') or []:
        walk(c, top, sub, out)


def main():
    cp = (sys.argv[1] if len(sys.argv) > 1 else open(CP_FILE).read()).strip()
    if not (cp.isdigit() and len(cp) == 5):
        raise SystemExit('Código postal no válido: ' + cp)
    wh = warehouse(cp)
    root = get(API + 'categories/?lang=es&wh=' + wh)
    out, tops, subs = {}, [], []
    for t in root['results']:
        if t['name'] in SKIP:
            continue
        tops.append(t['name'])
        for c in t['categories']:
            subs.append([len(tops) - 1, c['name']])
            walk(get(f"{API}categories/{c['id']}/?lang=es&wh={wh}"), len(tops) - 1, len(subs) - 1, out)
            time.sleep(0.3)
    if len(out) < 1000:
        raise SystemExit('Muy pocos productos (%d): no se sobrescribe el catálogo' % len(out))
    data = {'cp': cp, 'wh': wh, 'at': time.strftime('%Y-%m-%dT%H:%M', time.gmtime()), 'cats': tops, 'subs': subs,
            'cols': ['id', 'nombre', 'envase', 'precio', 'tamano', 'unidad', 'precio_ref', 'unidad_ref', 'cat', 'img', 'aprox', 'antes', 'subcats', 'nuevo'],
            'p': sorted(out.values(), key=lambda x: (x[8], x[12][0], x[1]))}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    with open(CP_FILE, 'w') as f:
        f.write(cp + '\n')
    print(len(out), 'productos, CP', cp, 'almacén', wh)


if __name__ == '__main__':
    main()
