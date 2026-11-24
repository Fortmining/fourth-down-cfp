import argparse
import json
from pathlib import Path
import tempfile
import unittest

from stage_team_views import stage
from team_views_http import read_view
import os


class Stage(unittest.TestCase):
    def test_validate_all_before_replace_and_keep_open_reads_atomic(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            source, destination = root/'source', root/'destination'
            source.mkdir()
            destination.mkdir()
            registry = root/'registry.json'
            registry.write_text(json.dumps({'teams': [{'id': x, 'division': 'fbs'} for x in ('61', '2633')]}))
            old = b'{"version":1,"team":"61","datasets":{}}'
            (destination/'61.json').write_bytes(old)
            (source/'61.json').write_bytes(old + b' ')
            (source/'2633.json').write_bytes(b'bad')
            args = argparse.Namespace(source=source, destination=destination, registry=registry)
            with self.assertRaises(ValueError):
                stage(args)
            self.assertEqual((destination/'61.json').read_bytes(), old)
            (source/'2633.json').write_text('{"version":1,"team":"2633","datasets":{}}')
            with (destination/'61.json').open('rb') as previous:
                stage(args)
                self.assertEqual(previous.read(), old)
            directory = os.open(destination, os.O_DIRECTORY)
            try:
                self.assertEqual(read_view(directory, '61'), old + b' ')
            finally:
                os.close(directory)
            self.assertEqual(list(destination.glob('*.pending')), [])


if __name__ == '__main__':
    unittest.main()
