"""Private smoke test. Credentials come from a mode-0600 JSON file, never argv values."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--credentials-file', type=Path, required=True)
    args = parser.parse_args()
    phase = 'credentials file'
    status = None
    try:
        fd = os.open(args.credentials_file, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd) as stream:
            meta = os.fstat(stream.fileno())
            if not stat.S_ISREG(meta.st_mode) or meta.st_mode & 0o077 or meta.st_uid != os.getuid() or meta.st_size > 8192:
                raise ValueError('Private file required')
            cfg = json.load(stream)
        headers = {'CF-Access-Client-Id': cfg['PULSE_CFBD_ACCESS_CLIENT_ID'],
                   'CF-Access-Client-Secret': cfg['PULSE_CFBD_ACCESS_CLIENT_SECRET']}
        bearer = cfg['PULSE_CFBD_ORIGIN_BEARER']
        if not all(isinstance(v, str) and 0 < len(v) <= 1024 and all(33 <= ord(c) <= 126 for c in v)
                   for v in [*headers.values(), bearer]):
            raise ValueError('Invalid credentials')
        opener = urllib.request.build_opener(NoRedirect)
        def get(values):
            req = urllib.request.Request('https://cfbd.fortmedia.cc/v1/teams/2633', headers={'User-Agent':'FourthDownPulseReader/1.0',**values})
            try:
                response = opener.open(req, timeout=8)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                body = response.read(24577)
                if response.status == 200 and len(body) > 24576:
                    raise ValueError('Response limit')
                return response.status, response.headers, body
        phase = 'Access denial'
        status, _, _ = get({})
        assert status in (401, 403), 'Unauthenticated denial'
        print('Unauthenticated denial: passed')
        phase = 'origin bearer denial'
        status, _, _ = get(headers)
        assert status == 401, 'Origin bearer denial'
        print('Origin bearer denial: passed')
        auth = {**headers, 'Authorization': 'Bearer ' + bearer}
        phase = 'authenticated team view'
        status, response_headers, body = get(auth)
        assert status == 200, 'Authenticated response'
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'ops/proxmox'))
        from team_views_http import validate
        validate(body, '2633')
        packet = json.loads(body)
        assert packet.get('version') == 1 and packet.get('team') == '2633' and isinstance(packet.get('datasets'), dict)
        tag = response_headers.get('ETag')
        assert tag == '"' + hashlib.sha256(body).hexdigest() + '"', 'ETag digest'
        print('Authenticated bounded team response and ETag: passed')
        phase = 'conditional GET'
        status, _, body = get({**auth, 'If-None-Match': tag})
        assert status == 304 and not body, 'Conditional response'
        print('Conditional GET: passed')
    except Exception:
        # urllib errors can carry request or provider details. Do not print them.
        parser.exit(1, f'Private reader check failed at {phase}; last HTTP status: {status}. No credentials or bodies printed.\n')


if __name__ == '__main__':
    main()
