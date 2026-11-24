"""Serve private, bounded team summaries over a loopback-only origin."""
import argparse
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import re
import stat
import threading

LIMIT = 24 * 1024
TEAM_PATH = re.compile(r'/v1/teams/([0-9]{1,12})', re.ASCII)
SOURCES = frozenset(('CollegeFootballData API', 'CFBD via cfbfastR annual roster export'))
WORD = lambda v: isinstance(v, str) and len(v) <= 160
NUMBER = lambda v: type(v) in (int, float) and abs(v) <= 2**53-1 and math.isfinite(v)
COUNT = lambda v: type(v) is int and 0 <= v <= 2**53-1
NULLABLE = lambda v: v is None or NUMBER(v)


def shape(fields, optional=()):
    return lambda value: (isinstance(value, dict)
        and fields.keys() - set(optional) <= value.keys() <= fields.keys()
        and all(fields[key](item) for key, item in value.items()))


def items(check, limit):
    return lambda value: isinstance(value, list) and len(value) <= limit and all(map(check, value))


def positions(value):
    return (isinstance(value, dict) and len(value) <= 64
            and all(re.fullmatch(r'[A-Za-z0-9 /-]{1,32}', key) and COUNT(count)
                    for key, count in value.items()))


TRANSFER = shape(dict(direction=lambda v: v in ('incoming', 'outgoing'), name=WORD,
                      position=WORD, origin=WORD, destination=WORD, date=WORD))
GROUP = shape(dict(count=COUNT, examples=items(TRANSFER, 12), positions=positions), ('positions',))
TEAM_STATS = dict.fromkeys(('totalYards', 'rushingYards', 'netPassingYards', 'turnovers', 'interceptions'), NUMBER)
ANALYTICS = dict.fromkeys(('offense_successRate', 'defense_successRate', 'offense_ppa', 'defense_ppa'), NUMBER)
DATASETS = {
    'transfers': shape(dict(incoming=GROUP, outgoing=GROUP)),
    'recruits': shape(dict(reported=COUNT, prospects=items(shape(dict(id=WORD, name=WORD,
        position=WORD, rank=NULLABLE, stars=NULLABLE)), 5))),
    'classRank': shape(dict(rank=COUNT, points=NULLABLE), ('rank', 'points')),
    'roster': shape(dict(listed=COUNT, positions=positions)),
    'teamStats': shape(TEAM_STATS, TEAM_STATS),
    'playerStats': shape(dict(leaders=items(shape(dict(id=WORD, name=WORD,
        category=lambda v: v in ('passing', 'rushing', 'receiving'), yards=NUMBER)), 9))),
    'analytics': shape(ANALYTICS, ANALYTICS),
}


def unique_object(pairs):
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError('Repeated JSON field')
    return result


def validate(body, team):
    if not 0 < len(body) <= LIMIT:
        raise ValueError('View size')
    packet = json.loads(body.decode('utf-8'), object_pairs_hook=unique_object)
    datasets = shape({key: shape(dict(value=check, year=COUNT, revision=COUNT,
        observedAt=COUNT, inLatest=lambda v: type(v) is bool,
        source=lambda v: isinstance(v, str) and v in SOURCES))
        for key, check in DATASETS.items()}, DATASETS)
    if not shape(dict(version=lambda v: type(v) is int and v == 1,
                      team=lambda v: v == team, datasets=datasets))(packet):
        raise ValueError('View schema')
    return body


def registry(path):
    teams = json.loads(path.read_text())['teams']
    return frozenset(row['id'] for row in teams if row.get('division') == 'fbs'
                     and re.fullmatch(r'[0-9]{1,12}', row['id']))


def read_view(directory, team):
    fd = os.open(team + '.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    with os.fdopen(fd, 'rb') as stream:
        meta = os.fstat(stream.fileno())
        if not stat.S_ISREG(meta.st_mode) or meta.st_size > LIMIT:
            raise ValueError('View size or type')
        return validate(stream.read(LIMIT + 1), team)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 16

    def __init__(self, port, **settings):
        self.settings = settings
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(('127.0.0.1', port), Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()

    def handle_error(self, request, address):
        # Request fragments must never reach the journal.
        pass


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        self.request.settimeout(3)
        super().setup()

    def log_message(self, *_):
        pass

    def reply(self, status, body=b'', etag=None, **headers):
        self.send_response(status)
        self.send_header('Cache-Control', 'private, no-cache' if etag else 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Vary', 'Authorization')
        if etag:
            self.send_header('ETag', etag)
        if status != 304:
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def send_error(self, code, message=None, explain=None):
        if code == 501:
            self.reply(405, Allow='GET')
        else:
            self.reply(code)

    def do_GET(self):
        settings = self.server.settings
        if settings.get('health'):
            self.reply(200, b'{"status":"ok"}') if self.path == '/healthz' else self.reply(404)
            return
        # Use the original request target. BaseHTTPRequestHandler normalizes leading //.
        target = self.requestline.split()[1]
        match = TEAM_PATH.fullmatch(target)
        if not match:
            self.reply(404)
            return
        credentials = self.headers.get_all('Authorization', [])
        if len(credentials) != 1 or not hmac.compare_digest(credentials[0].encode('latin1'), settings['auth']):
            self.reply(401, **{'WWW-Authenticate': 'Bearer'})
            return
        team = match[1]
        if team not in settings['teams']:
            self.reply(404)
            return
        try:
            body = read_view(settings['directory'], team)
        except FileNotFoundError:
            self.reply(404)
            return
        except (OSError, ValueError, RecursionError):
            self.reply(503)
            return
        etag = '"' + hashlib.sha256(body).hexdigest() + '"'
        candidates = {tag.strip().removeprefix('W/') for line in self.headers.get_all('If-None-Match', [])
                      for tag in line.split(',')}
        if '*' in candidates or etag in candidates:
            self.reply(304, etag=etag)
        else:
            self.reply(200, body, etag)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--health-port', type=int, default=8766)
    parser.add_argument('--views', type=Path, required=True)
    parser.add_argument('--registry', type=Path, required=True)
    parser.add_argument('--credential', type=Path, required=True)
    args = parser.parse_args()
    token = args.credential.read_bytes().strip()
    if not re.fullmatch(rb'[0-9a-f]{64}', token):
        parser.error('Expected a dedicated 32-byte hex credential')
    directory = os.open(args.views, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        with Server(args.port, directory=directory, teams=registry(args.registry), auth=b'Bearer '+token) as origin:
            with Server(args.health_port, health=True) as health:
                threading.Thread(target=health.serve_forever, daemon=True).start()
                origin.serve_forever()
    finally:
        os.close(directory)


if __name__ == '__main__':
    main()
