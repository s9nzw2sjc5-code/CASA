"""Genera casa/lidl.json: ofertas y productos de tienda de Lidl con los precios de una provincia.

La web de Lidl no deja leer sus datos desde otra página, así que este script
los descarga (lo ejecuta GitHub Actions cada día) y la app lee el archivo.

- Ofertas: páginas públicas de Lidl (esta semana, fin de semana, próxima semana,
  y fin de semana que viene). Cada producto trae los precios
  de cada provincia, también el de Lidl Plus y las fechas.
- Resto del surtido de tienda: buscador público de la web.
La provincia se guarda en tools/lidl-region.txt (las tiendas de una provincia
comparten precios).

Uso: python3 tools/lidl.py [provincia]
"""
import html, json, os, re, sys, time, urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'casa', 'lidl.json')
REGION_FILE = os.path.join(HERE, 'lidl-region.txt')
BASE = 'https://www.lidl.es'
SEARCH = BASE + '/q/api/search?locale=es_ES&assortment=ES&version=v2.0.0&q=*&store=1&fetchsize=60&offset='
# Sin «Accept: application/json»: con esa cabecera la API responde 401
HEADERS = {'User-Agent': 'casa-app (uso personal)'}
MADRID = ZoneInfo('Europe/Madrid')
MIN_ITEMS = 50  # menos que esto es un fallo de la web: no se sobrescribe el archivo
# Páginas de ofertas (por orden de prioridad si un producto sale en varias) y su id conocido
PAGES = [
    ('finde', 'super-finde', '10089450'),
    ('semana', 'ofertas-semanales', '10089449'),
    ('finde-proxima', 'super-finde-proxima-semana', '10089609'),
    ('proxima', 'ofertas-proxima-semana', '10088432'),
]


def fetch(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError('No se pudo leer ' + url)


def local_day(value):
    """Fecha de Lidl (UTC, p. ej. 2026-11-19T23:00Z) → día en España (2026-11-20)."""
    if not isinstance(value, str) or len(value) < 10:
        return ''
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(MADRID).date().isoformat()
    except ValueError:
        return value[:10]


def group(category):
    if category == 'Food':
        return 'super', 'Alimentación'
    if category == 'F+V':
        return 'fruta', 'Fruta y verdura'
    if category == 'NonFood':
        return 'casa', 'Droguería y hogar'
    parts = [p for p in (category or '').split('/') if p and p != 'Categorías']
    return 'bazar', parts[0] if parts else 'Bazar'


def code_of(g, fallback=''):
    m = re.search(r'/p(\d+)$', g.get('canonicalUrl') or '')
    return m.group(1) if m else str(g.get('productId') or fallback)


def unwrap(p):
    """Lidl anida el precio a veces una vez y a veces dos ({'price': {'price': {'price': 1.29, ...}}})."""
    while isinstance(p, dict) and isinstance(p.get('price'), dict):
        p = p['price']
    return p if isinstance(p, dict) and isinstance(p.get('price'), (int, float)) else None


def first(prices):
    """El precio vigente o, si no hay, el próximo que empieza antes."""
    prices = [x for x in (unwrap(p) for p in (prices or [])) if x]
    return sorted(prices, key=lambda p: p.get('startDate') or '')[0] if prices else None


def region_prices(g, region):
    """Precios de la provincia: (normal, Lidl Plus) o None si el producto no se vende allí.
    Devuelve False si el producto no trae precios por provincia (se usa el general)."""
    regions = g.get('regionsV2') or {}
    if not regions:
        return False
    match = next((v for v in regions.values() if (v.get('regionName') or '').strip().lower() == region.lower()), None)
    if not match or not match.get('regionPriceId'):
        return None
    v = (g.get('regionsPrices') or {}).get(str(match['regionPriceId'])) or {}
    normal = first([v['currentPrice']] if v.get('currentPrice') else v.get('futurePrices'))
    plus = first([v['currentLidlPlusPrice']] if v.get('currentLidlPlusPrice') else v.get('futureLidlPlusPrices'))
    return normal, plus


def item(g, region, when='', badge_default=''):
    name = (g.get('fullTitle') or g.get('title') or '').strip()
    if not name:
        return None
    regional = region_prices(g, region)
    if regional is None:
        return None  # no se vende en esta provincia
    normal, plus = regional if regional else (g.get('price') or {}, None)
    normal = normal or {}
    if not normal.get('price') and plus:
        normal = plus  # solo hay precio con Lidl Plus
        plus = None
    discount = normal.get('discount') or {}
    kind, section = group(g.get('category'))
    badges = [b.get('text') for b in ((g.get('stockAvailability') or {}).get('badgeInfo') or {}).get('badges', []) if b.get('text')]
    out = {
        'c': code_of(g, name),
        'n': name,
        'g': kind,
        's': section,
        'w': when,
        'p': normal.get('price'),
        'o': normal.get('oldPrice') or discount.get('deletedPrice'),
        'd': discount.get('percentageDiscount') if discount.get('showDiscount') else None,
        'l': plus.get('price') if plus and plus.get('price') != normal.get('price') else None,
        'k': (normal.get('packaging') or (g.get('price') or {}).get('packaging') or {}).get('text') or '',
        'i': g.get('image') or '',
        'u': g.get('canonicalUrl') or '',
        'b': next((b for b in badges if 'tienda' in b.lower()), badge_default),
        'f': local_day(normal.get('startDate') or (plus or {}).get('startDate')),
        'e': local_day(normal.get('endDate') or (plus or {}).get('endDate')),
    }
    return {k: v for k, v in out.items() if v not in (None, '', [])}


def page_ids():
    """Ids actuales de las páginas de ofertas (cambian de vez en cuando); si no, los conocidos."""
    ids = {slug: pid for _, slug, pid in PAGES}
    try:
        for slug, pid in re.findall(r'/c/store/([a-z0-9-]+)/a(\d+)', fetch(BASE + '/')):
            if slug in ids:
                ids[slug] = pid
    except RuntimeError:
        pass
    return ids


def grid_items(page_html):
    for raw in re.findall(r'data-grid-data="([^"]*)"', page_html):
        try:
            yield json.loads(html.unescape(raw))
        except ValueError:
            continue


def main():
    region = (sys.argv[1] if len(sys.argv) > 1 else '').strip()
    if not region and os.path.exists(REGION_FILE):
        region = open(REGION_FILE, encoding='utf-8').read().strip()
    region = region or 'Granada'
    items, seen = [], set()
    ids = page_ids()
    for when, slug, _ in PAGES:
        try:
            page = fetch('%s/c/store/%s/a%s' % (BASE, slug, ids[slug]))
        except RuntimeError as e:
            print(e)
            continue
        for g in grid_items(page):
            x = item(g, region, when, 'En tienda')
            if x and x['c'] not in seen:
                seen.add(x['c'])
                items.append(x)
    offers = len(items)
    offset = 0
    while offset < 3000:
        page = json.loads(fetch(SEARCH + str(offset))).get('items') or []
        for raw in page:
            g = (raw.get('gridbox') or {}).get('data') or {}
            x = item(g, region)
            if x and x['c'] not in seen:
                seen.add(x['c'])
                items.append(x)
        if len(page) < 60:
            break
        offset += 60
        time.sleep(0.5)
    if len(items) < MIN_ITEMS:
        sys.exit('Lidl ha devuelto solo %d productos: se conserva el archivo anterior.' % len(items))
    data = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'region': region, 'items': items}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    with open(REGION_FILE, 'w', encoding='utf-8') as f:
        f.write(region + '\n')
    print('%d productos de Lidl (%d ofertas) con precios de %s' % (len(items), offers, region))


if __name__ == '__main__':
    main()
