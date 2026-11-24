"""Take a consistent SQLite backup, including committed WAL transactions."""
from contextlib import closing
from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
import sys
import tempfile


def backup(database, directory):
    os.umask(0o077)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = directory / f'worker-{stamp}.sqlite'
    fd, name = tempfile.mkstemp(dir=directory, suffix='.pending')
    os.close(fd)
    pending = Path(name)
    try:
        with closing(sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)) as source:
            with closing(sqlite3.connect(pending)) as copy:
                source.backup(copy, pages=128)
                if copy.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
                    raise RuntimeError('Backup failed SQLite integrity check')
        with pending.open('rb') as stream:
            os.fsync(stream.fileno())
        pending.replace(destination)
        directory_fd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        for old in sorted(directory.glob('worker-*.sqlite'), reverse=True)[7:]:
            old.unlink()
        print('Private SQLite backup verified')
    finally:
        pending.unlink(missing_ok=True)


if __name__ == '__main__':
    backup(Path(sys.argv[1]), Path(sys.argv[2]))
