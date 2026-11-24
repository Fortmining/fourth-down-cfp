import hashlib
import http.client
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest

from team_views_http import LIMIT, Server, registry


class Publisher(unittest.TestCase):
    def setUp(self):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        self.path = Path(root.name)
        self.body = b'{"version":1,"team":"61","datasets":{}}'
        (self.path/'61.json').write_bytes(self.body)
        directory = os.open(self.path, os.O_DIRECTORY)
        self.addCleanup(os.close, directory)
        self.auth = {'Authorization': 'Bearer ' + 'e'*64}
        self.origin = self.start(directory=directory, auth=self.auth['Authorization'].encode(),
                                 teams={'61', '2633'})
        self.health = self.start(health=True)

    def start(self, **settings):
        server = Server(0, **settings)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return server

    def request(self, path, headers=None, method='GET', server=None):
        conn = http.client.HTTPConnection(*(server or self.origin).server_address, timeout=5)
        try:
            conn.request(method, path, headers=headers or {})
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def test_auth_and_etag(self):
        target = '/v1/teams/61'
        status, headers, body = self.request(target, self.auth)
        self.assertEqual((status, body), (200, self.body))
        etag = '"' + hashlib.sha256(body).hexdigest() + '"'
        self.assertEqual(headers['ETag'], etag)
        self.assertEqual(headers['Cache-Control'], 'private, no-cache')
        self.assertEqual(self.request(target, {'If-None-Match':etag})[0], 401)
        status, headers, body = self.request(target, self.auth | {'If-None-Match':'"other", W/'+etag})
        self.assertEqual((status, headers['ETag'], body), (304, etag, b''))

    def test_origin_route_and_method_boundary(self):
        for path in ('/healthz','/v1/teams','/v1/teams/61?x=1','/v1/teams/../worker.sqlite',
                     '/v1/teams/%36%31','//v1/teams/61','/v1/teams/99999','/v1/teams/2633'):
            self.assertEqual(self.request(path, self.auth)[0], 404, path)
        for method in ('HEAD','POST','OPTIONS','PUT','DELETE'):
            self.assertEqual(self.request('/v1/teams/61', self.auth, method)[0], 405)
        self.assertEqual(self.request('/healthz', server=self.health)[0], 200)
        self.assertEqual(self.request('/v1/teams/61', self.auth, server=self.health)[0], 404)

    def test_fail_closed_without_reading_private_files(self):
        path = self.path/'61.json'
        for body in (b'x'*(LIMIT+1), b'{"team":"61","team":"61","version":1,"datasets":{}}',
                     json.dumps({'version':1,'team':'61','datasets':{'private':{}}}).encode()):
            path.write_bytes(body)
            self.assertEqual(self.request('/v1/teams/61', self.auth)[0], 503)
        path.unlink()
        path.symlink_to('/etc/passwd')
        self.assertEqual(self.request('/v1/teams/61', self.auth)[0], 503)

    def test_registry(self):
        path = Path(__file__).resolve().parents[2]/'app/data/pulse-teams-2026.json'
        self.assertEqual(len(registry(path)), 138)


if __name__ == '__main__':
    unittest.main()
