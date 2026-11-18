"""Genera casa/lidl.json: ofertas y productos de tienda de Lidl España.

La web de Lidl no deja leer sus datos desde otra página, así que este script
los descarga (lo ejecuta GitHub Actions cada día) y la app lee el archivo.
Lidl publica los mismos precios para toda España: no hay precios por código postal.

Uso: python3 tools/lidl.py
"""
import json, os, sys, time, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'casa', 'lidl.json')
# store=1: lo que se vende en las tiendas (súper, fruta, droguería y el bazar de la semana)
API = 'https://www.lidl.es/q/api/search?locale=es_ES&assortment=ES&version=v2.0.0&q=*&store=1&fetchsize=60&offset='
# Sin «Accept: application/json»: con esa cabecera la API responde 401
HEADERS = {'User-Agent': 'casa-app (uso personal)'}
MIN_ITEMS = 50  # menos que esto es un fallo de la web: no se sobrescribe el archivo


def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError('No se pudo leer ' + url)


def day(value):
    return value[:10] if isinstance(value, str) and len(value) >= 10 else ''


def group(category):
    if category == 'Food':
        return 'super', 'Alimentación'
    if category == 'F+V':
        return 'fruta', 'Fruta y verdura'
    if category == 'NonFood':
        return 'casa', 'Droguería y hogar'
    parts = [p for p in (category or '').split('/') if p and p != 'Categorías']
    return 'bazar', parts[0] if parts else 'Bazar'


def item(raw):
    g = (raw.get('gridbox') or {}).get('data') or {}
    name = (g.get('fullTitle') or g.get('title') or '').strip()
    if not name:
        return None
    price = g.get('price') or {}
    discount = price.get('discount') or {}
    kind, section = group(g.get('category'))
    badges = [b.get('text') for b in ((g.get('stockAvailability') or {}).get('badgeInfo') or {}).get('badges', []) if b.get('text')]
    store = next((b for b in badges if 'tienda' in b.lower()), '')
    out = {
        'c': str(raw.get('code') or g.get('productId') or name),
        'n': name,
        'g': kind,
        's': section,
        'p': price.get('price'),
        'o': price.get('oldPrice') or discount.get('deletedPrice'),
        'd': discount.get('percentageDiscount') if discount.get('showDiscount') else None,
        'k': (price.get('packaging') or {}).get('text') or '',
        'i': g.get('image') or '',
        'u': g.get('canonicalUrl') or '',
        'b': store,
        'f': day(price.get('startDate')),
        'e': day(price.get('endDate')),
    }
    return {k: v for k, v in out.items() if v not in (None, '', [])}


def main():
    raw, offset = [], 0
    while offset < 3000:
        page = get(API + str(offset)).get('items') or []
        raw += page
        if len(page) < 60:
            break
        offset += 60
        time.sleep(0.5)
    seen, items = set(), []
    for r in raw:
        x = item(r)
        if x and x['c'] not in seen:
            seen.add(x['c'])
            items.append(x)
    if len(items) < MIN_ITEMS:
        sys.exit('Lidl ha devuelto solo %d productos: se conserva el archivo anterior.' % len(items))
    data = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'items': items}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('%d productos de Lidl guardados' % len(items))


if __name__ == '__main__':
    main()
