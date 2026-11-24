#!/usr/bin/env python3
"""Private CFBD ingestion worker. Run from a credentialed, persistent host."""
import argparse
import hashlib
import json
import os
import sqlite3
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

BASE = 'https://api.collegefootballdata.com'
LIMIT = 12 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def datasets(season, class_year, week, team, probe):
    playing = {'year': season}
    recruiting = {'year': class_year}
    scope = {'team': team} if probe else {}
    return {
        '/info': {},
        '/teams/fbs': playing,
        '/conferences': playing,
        '/roster': {**playing, **scope, 'classification': 'fbs'},
        '/recruiting/players': {**recruiting, **scope},
        '/recruiting/teams': {**recruiting, **scope},
        '/player/portal': playing,
        '/stats/player/season': {**playing, **scope},
        '/stats/season': {**playing, **scope, 'classification': 'fbs'},
        '/stats/season/advanced': {**playing, **scope, 'classification': 'fbs'},
        '/rankings': {**playing, 'week': week, 'seasonType': 'regular'},
        '/games': {**playing, 'week': week, 'seasonType': 'regular', **scope},
    }


def fetch_json(path, params, secret):
    url = BASE + path + ('?' + urlencode(params) if params else '')
    request = Request(url, headers={'Authorization': 'Bearer ' + secret, 'Accept': 'application/json', 'User-Agent': 'FourthDownPulseWorker/1.0'})
    with build_opener(NoRedirect()).open(request, timeout=45 if path=='/stats/player/season' else 15) as response:
        data = response.read(LIMIT + 1)
        if len(data) > LIMIT:
            raise ValueError('response exceeded size limit')
        value = json.loads(data)
        if not isinstance(value, dict if path == '/info' else list):
            raise ValueError('unexpected response shape')
        return value


def intelligence(path, rows):
    """Provider observations remain separate from official ledger events."""
    projected = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if path == '/recruiting/players' and row.get('id') and row.get('name'):
            projected.append({
                'kind': 'recruiting-observation', 'provider': 'CollegeFootballData',
                'id': row['id'], 'athleteId': row.get('athleteId'), 'name': row['name'],
                'classYear': row.get('year'), 'position': row.get('position'),
                'reportedCommitment': row.get('committedTo'), 'ranking': row.get('ranking'),
                'eventDate': None,
            })
        elif path == '/player/portal' and row.get('firstName') and row.get('lastName'):
            projected.append({
                'kind': 'transfer-dataset-observation', 'provider': 'CollegeFootballData',
                'name': row['firstName'] + ' ' + row['lastName'], 'season': row.get('season'),
                'position': row.get('position'), 'origin': row.get('origin'),
                'reportedDestination': row.get('destination'),
                'providerTransferDate': row.get('transferDate'),
            })
    return sorted(projected, key=lambda row: json.dumps(row, sort_keys=True))



def record(db, key, rows, now):
    payload = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(payload.encode()).hexdigest()
    previous = db.execute('SELECT digest FROM snapshots WHERE dataset=? ORDER BY id DESC LIMIT 1', (key,)).fetchone()
    changed = previous is None or previous[0] != digest
    if changed:
        db.execute('INSERT INTO snapshots(dataset,digest,fetched_at,payload) VALUES(?,?,?,?)', (key,digest,now,payload))
    return changed


def initialize(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY, dataset TEXT NOT NULL, digest TEXT NOT NULL,
            fetched_at INTEGER NOT NULL, payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS snapshots_lookup ON snapshots(dataset,id);
        CREATE TABLE IF NOT EXISTS checks (dataset TEXT PRIMARY KEY, checked_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts (requested_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS quota (slot INTEGER PRIMARY KEY CHECK(slot=1), resume_at INTEGER NOT NULL);
    ''')


def run(db, jobs, secret, probe, read=fetch_json):
    for path, params in jobs.items():
        key = path + '?' + urlencode(sorted(params.items()))
        if probe:
            key = 'probe:' + key
        now = int(time.time())
        # Serialize quota reservations before making
        # a request so an interrupted process cannot immediately retry it.
        db.execute('BEGIN IMMEDIATE')
        throttle = db.execute('SELECT resume_at FROM quota WHERE slot=1').fetchone()
        if throttle and throttle[0] > now:
            db.rollback()
            print('CFBD cooldown active')
            break
        prior = db.execute('SELECT checked_at FROM checks WHERE dataset=?', (key,)).fetchone()
        if prior and now - prior[0] < (3600 if probe else 86400):
            db.rollback()
            continue
        db.execute('DELETE FROM attempts WHERE requested_at<=?', (now-86400,))
        if db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0]>=12:
            db.rollback()
            print('CFBD daily request budget reached')
            break
        db.execute('INSERT INTO attempts VALUES(?)', (now,))
        db.execute('INSERT OR REPLACE INTO checks VALUES(?,?)', (key,now))
        db.commit()
        try:
            rows = read(path, params, secret)
        except HTTPError as error:
            error.close()
            print(f'{path}: HTTP {error.code}')
            if error.code in (401,429):
                retry = error.headers.get('Retry-After','') if error.headers else ''
                delay = max(86400,int(retry)) if retry.isdecimal() and len(retry)<10 else 86400
                with db:
                    db.execute('INSERT OR REPLACE INTO quota VALUES(1,?)', (now + delay,))
                break
        except (OSError, ValueError):
            print(f'{path}: request or validation failed')
        else:
            if path == '/info':
                counters = {name: rows[name] for name in ('monthlyLimit','usedCalls','remainingCalls')
                            if type(rows.get(name)) is int and rows[name] >= 0}
                print(f'{path}: OK; quota counters {json.dumps(counters)}')
                if probe and counters.get('remainingCalls',0) < len(jobs)-1:
                    print('Probe stopped: insufficient or unknown remaining quota')
                    break
                continue
            if probe:
                print(f'{path}: OK; {len(rows)} rows')
                continue
            with db:
                changed = record(db, key, rows, now)
                if path in ('/player/portal','/recruiting/players'):
                    record(db, 'observations:' + key, intelligence(path,rows), now)
            print(f'{path}: OK; {len(rows)} rows; '+('new snapshot' if changed else 'unchanged'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', required=True, help='Private SQLite path outside the repository')
    parser.add_argument('--season', type=int, required=True)
    parser.add_argument('--class-year', type=int, required=True)
    parser.add_argument('--week', type=int, required=True)
    parser.add_argument('--team', default='Tennessee')
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--controlled-second-run', action='store_true', help='Single-use 12-hour commissioning exception; normal schedules unchanged')
    args = parser.parse_args()
    secret = os.environ.get('CFBD_API_KEY')
    if not secret:
        parser.exit(2, 'CFBD_API_KEY is unavailable in this process.\n')
    os.umask(0o077)
    if not args.probe:
        from pulse_cfbd_schedule import run_on_volume
        jobs = datasets(args.season,args.class_year,args.week,args.team,False)
        run_on_volume(args.db,jobs,secret,fetch_json,controlled=args.controlled_second_run)
        return
    with sqlite3.connect(args.db) as db:
        initialize(db)
        run(db, datasets(args.season,args.class_year,args.week,args.team,args.probe),secret,args.probe)


if __name__ == '__main__':
    main()
