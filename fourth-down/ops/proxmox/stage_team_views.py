"""Copy validated exports across the worker/publisher permission boundary."""
import argparse
import fcntl
import os
from pathlib import Path
import tempfile

from team_views_http import read_view, registry


def stage(args):
    teams = registry(args.registry)
    if not teams:
        raise ValueError('Empty team registry')
    source = os.open(args.source, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        views = {team: read_view(source, team) for team in sorted(teams)}
    finally:
        os.close(source)
    # The collector uses the same lock for its complete export, preventing a
    # staging invocation from reading a mix of two successful export runs.
    for team, body in views.items():
        fd, path = tempfile.mkstemp(dir=args.destination, suffix='.pending')
        pending = Path(path)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(body)
                os.fchmod(stream.fileno(), 0o644)
                stream.flush()
                os.fsync(stream.fileno())
            pending.replace(args.destination / (team + '.json'))
        finally:
            pending.unlink(missing_ok=True)
    directory = os.open(args.destination, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    print(f'Staged {len(views)} validated team views')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('registry', type=Path)
    parser.add_argument('--worker-lock', type=Path, required=True)
    args = parser.parse_args()
    with args.worker_lock.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        stage(args)


if __name__ == '__main__':
    main()
