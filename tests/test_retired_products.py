import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('mercadona',Path(__file__).resolve().parents[1]/'tools/mercadona.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def product(key,name='Nombre',img='photo.jpg'):
    return [key,name,'Botella',2.5,1.5,'l',1.667,'L',0,img]
class RetiredProducts(unittest.TestCase):
    def test_preserves_removed_labels_but_not_prices(self):
        old={'p':[product('old')],'retired':{'older':{'name':'Anterior','img':'old.jpg'}}}
        result=module.retired_products(old,[product('new')])
        self.assertEqual(result['old'],{'name':'Nombre','img':'photo.jpg','pack':'Botella'})
        self.assertIn('older',result)
        self.assertNotIn('old',old['retired'])
    def test_returning_products_are_not_marked_as_retired(self):
        self.assertEqual(module.retired_products({'p':[],'retired':{'a':{'name':'Anterior'}}},[product('a')]),{})
    def test_numeric_and_string_ids_are_the_same_product(self):
        self.assertEqual(module.retired_products({'p':[product(42)]},[product('42')]),{})
