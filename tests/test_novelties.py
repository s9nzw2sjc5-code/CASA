import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('mercadona', Path(__file__).resolve().parents[1] / 'tools/mercadona.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def product(key, new=True):
    return [key] + [0] * 12 + [int(new)]
class NoveltyDates(unittest.TestCase):
    def test_preserves_continuing_and_dates_newly_flagged_products(self):
        old={'cp':'18210','wh':'1','at':'2026-11-05T12:00','p':[product('a'),product('b',False)],'newSince':{'a':'2026-11-01T12:00'}}
        result=module.novelty_since(old,[product('a'),product('b'),product('c',False)],'18210','1','2026-11-06T12:00')
        self.assertEqual(result,{'a':'2026-11-01T12:00','b':'2026-11-06T12:00'})
        self.assertEqual(old['newSince'],{'a':'2026-11-01T12:00'})
    def test_changing_warehouse_starts_a_new_detection_history(self):
        old={'cp':'18210','wh':'1','p':[product('a')],'newSince':{'a':'2026-11-01T12:00'}}
        self.assertEqual(module.novelty_since(old,[product('a')],'18210','2','2026-11-06T12:00')['a'],'2026-11-06T12:00')
    def test_legacy_catalogue_uses_its_observation_date(self):
        old={'cp':'18210','wh':'1','at':'2026-11-05T12:00','p':[product('a')]}
        self.assertEqual(module.novelty_since(old,[product('a')],'18210','1','2026-11-06T12:00')['a'],'2026-11-05T12:00')
    def test_a_product_that_returns_as_new_gets_a_new_date(self):
        old={'cp':'18210','wh':'1','at':'2026-11-05T12:00','p':[product('a',False)],'newSince':{'a':'2026-11-01T12:00'}}
        self.assertEqual(module.novelty_since(old,[product('a')],'18210','1','2026-11-06T12:00')['a'],'2026-11-06T12:00')
if __name__ == '__main__': unittest.main()
