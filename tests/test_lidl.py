"""Lectura de las ofertas de Lidl: precios de la provincia, Lidl Plus y fechas en hora de España."""
import html, json, os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import lidl  # noqa: E402


def product(regions, prices, **extra):
    g = {'fullTitle': 'Naranja mesa', 'category': 'F+V', 'canonicalUrl': '/p/naranja-mesa/p11150785',
         'image': 'https://www.lidl.es/assets/x.png', 'price': {'price': 9.99},
         'regionsV2': regions, 'regionsPrices': prices,
         'stockAvailability': {'badgeInfo': {'badges': [{'text': 'Solo en tienda'}]}}}
    g.update(extra)
    return g


GRANADA = {'46': {'regionName': 'Granada', 'regionPriceId': '1'}, '1': {'regionName': 'A Coruña', 'regionPriceId': '2'}}
PRICES = {
    '1': {'futureLidlPlusPrices': [{'price': {'price': {'price': 1.19, 'startDate': '2026-11-19T23:00Z', 'endDate': '2026-11-22T22:59:59Z'}}}],
          'currentPrice': {'price': {'price': 1.29, 'oldPrice': 1.89, 'packaging': {'text': 'A granel'},
                                     'discount': {'showDiscount': True, 'percentageDiscount': 31},
                                     'startDate': '2026-11-19T23:00Z', 'endDate': '2026-11-22T22:59:59Z'}}},
    '2': {'currentPrice': {'price': {'price': 2.50}}},
}


class LidlTest(unittest.TestCase):
    def test_precio_de_la_provincia_lidl_plus_y_fechas(self):
        x = lidl.item(product(GRANADA, PRICES), 'Granada', 'finde')
        self.assertEqual((x['p'], x['o'], x['d'], x['l'], x['k']), (1.29, 1.89, 31, 1.19, 'A granel'))
        self.assertEqual((x['f'], x['e']), ('2026-11-20', '2026-11-22'), 'las 23:00 UTC ya son el día siguiente en España')
        self.assertEqual((x['c'], x['g'], x['w'], x['b']), ('11150785', 'fruta', 'finde', 'Solo en tienda'))
        self.assertEqual(lidl.item(product(GRANADA, PRICES), 'A Coruña')['p'], 2.50)

    def test_no_se_vende_en_la_provincia(self):
        self.assertIsNone(lidl.item(product({'1': {'regionName': 'A Coruña', 'regionPriceId': '2'}}, PRICES), 'Granada'))
        self.assertIsNone(lidl.item(product({'46': {'regionName': 'Granada'}}, PRICES), 'Granada'))

    def test_sin_precios_por_provincia_usa_el_general(self):
        x = lidl.item(product({}, {}, price={'price': 0.75, 'oldPrice': 0.85, 'packaging': {'text': '250 g'}}), 'Granada')
        self.assertEqual((x['p'], x['o'], x['k']), (0.75, 0.85, '250 g'))

    def test_solo_precio_lidl_plus(self):
        prices = {'1': {'currentLidlPlusPrice': {'price': {'price': {'price': 0.75, 'oldPrice': 0.99}}}}}
        x = lidl.item(product(GRANADA, prices), 'Granada')
        self.assertEqual((x['p'], x['o'], x.get('l')), (0.75, 0.99, None))

    def test_solo_comida_y_limpieza(self):
        base = lambda name, category: lidl.item(product({}, {}, fullTitle=name, category=category, price={'price': 1.0}), 'Granada')
        self.assertIsNone(base('SILVERCREST Yogurtera', 'Categorías/Hogar y cocina/Pequeños electrodomésticos'))
        self.assertIsNone(base('LIVARNO Alfombra de yute', 'NonFood'))
        self.assertIsNone(base('Cien BEAUTY Cepillo antitirones', 'NonFood'))
        self.assertEqual(base('VILEDA Estropajo', 'NonFood')['g'], 'limpieza')
        self.assertEqual(base('FORMIL Lejía densa detergente', 'Food')['g'], 'limpieza', 'Lidl la clasifica como alimentación')
        self.assertEqual(base('SCOTTEX Papel higiénico original', 'Food')['g'], 'limpieza')
        self.assertEqual(base('- Dorada limpia', 'Food')['g'], 'super', 'no se confunde con limpieza')
        self.assertEqual(base('MILBONA Yogur bífidus', 'Food')['g'], 'super')
        self.assertIsNone(base('Lupilu Pañales talla 5', 'Food'))
        self.assertIsNone(base('Toallitas faciales', 'Food'))
        self.assertEqual(base('W5 Toallitas de limpieza multiusos', 'Food')['g'], 'limpieza', 'las de limpieza se quedan')

    def test_secciones_como_mercadona(self):
        cases = [
            ('Napolitana de york y queso', 'Mundos de necesidad/Comida y cerca de la comida/Panadería/Pasteles salados', 'Panadería y pastelería'),
            ('Hamburguesa ecológica (con queso manchego)', '', 'Carne'),
            ('Realvalle Hamburguesa de vacuno café París', 'Mundos de necesidad/Comida y cerca de la comida/Café, té y cacao', 'Carne'),
            ('MILBONA Yogur de frutas', 'Mundos de necesidad/Comida y cerca de la comida/Quesos, productos lácteos y huevos/Yogur', 'Postres y yogures'),
            ('FIN CARRÉ Chocolate (Chocolate con leche)', '', 'Azúcar, caramelos y chocolate'),
            ('- Lomo curado de cerdo Duroc', '', 'Charcutería y quesos'),
            ('Realvalle Trozo de lomo de cerdo', 'Mundos de necesidad/Comida y cerca de la comida/Presupuesto/Productos de limpieza', 'Carne'),
            ('- Sepia limpia', 'Mundos de necesidad/Herramientas a batería', 'Marisco y pescado'),
            ('Deluxe Cuña de queso de oveja con orégano y miel', '', 'Charcutería y quesos'),
            ('OCEAN SEA Rabas empanadas', '', 'Congelados'),
            ('VEMONDO Bebida almendras ecológica', '', 'Huevos, leche y mantequilla'),
            ('FREEWAY Té sabor limón', '', 'Agua y refrescos'),
            ('Producto sin pistas', 'Mundos de necesidad/Comida y cerca de la comida/Alimentos congelados/Otros', 'Congelados'),
            ('Producto sin pistas', '', 'Otros'),
        ]
        for name, won, expected in cases:
            self.assertEqual(lidl.section_of(name, won), expected, name)

    def test_seccion_en_el_producto(self):
        x = lidl.item(product({}, {}, fullTitle='MILBONA Yogur bífidus', category='Food', price={'price': 1.15},
                              keyfacts={'wonCategoryPrimary': 'Mundos de necesidad/Comida y cerca de la comida/Quesos, productos lácteos y huevos/Yogur'}), 'Granada')
        self.assertEqual((x['g'], x['s']), ('super', 'Postres y yogures'))
        vit = product({}, {}, fullTitle='OPTISANA Gummies multivitaminas', category='Food', price={'price': 3.0},
                      keyfacts={'wonCategoryPrimary': 'Mundos de necesidad/Productos de droguería y cuidado personal/Vitaminas'})
        self.assertIsNone(lidl.item(vit, 'Granada'), 'vitaminas y cosmética no son comida')

    def test_lee_los_productos_de_la_pagina(self):
        page = '<div data-grid-data="%s"></div><div data-grid-data="no es json"></div>' % html.escape(json.dumps(product(GRANADA, PRICES)), quote=True)
        self.assertEqual([g['fullTitle'] for g in lidl.grid_items(page)], ['Naranja mesa'])


if __name__ == '__main__':
    unittest.main()
