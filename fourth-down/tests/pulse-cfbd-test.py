import runpy
import sqlite3
import unittest
from urllib.error import HTTPError
from pathlib import Path

worker = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/pulse-cfbd.py'))


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        worker['initialize'](self.db)

    def tearDown(self):
        self.db.close()

    def test_idempotent_revision_history(self):
        record = worker['record']
        self.assertTrue(record(self.db, 'recruits', [{'id': 'a', 'committedTo': 'A'}], 1))
        self.assertFalse(record(self.db, 'recruits', [{'committedTo': 'A', 'id': 'a'}], 2))
        self.assertTrue(record(self.db, 'recruits', [{'id': 'a', 'committedTo': 'B'}], 3))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0], 2)

    def test_rate_limit_halts_workers(self):
        requests = []

        def read(path, params, secret):
            requests.append(path)
            raise HTTPError(path, 429, 'limited', {'Retry-After':'60'}, None)

        for _ in range(2):
            worker['run'](self.db, {'/info':{}, '/roster':{}}, 'test-only', False, read)
        self.assertEqual(requests, ['/info'])

    def test_daily_budget_spans_scopes(self):
        requests = []

        def read(path, params, secret):
            requests.append(path)
            return []

        worker['run'](self.db, {f'/test-{i}':{} for i in range(20)}, 'test-only', False, read)
        worker['run'](self.db, {'/roster':{}}, 'test-only', True, read)
        self.assertEqual(len(requests), 12)


if __name__ == '__main__':
    unittest.main()
