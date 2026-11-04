"""Extract venue flags from the same version-pinned archives used for backtesting."""
import csv
import hashlib
import io
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
venues = {}
for entry in json.loads((root / "historical-manifest.json").read_text()):
    sha = entry["sha"]
    raw = (root / f"{sha}.csv").read_bytes()
    blob = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
    if blob != entry["blob"]:
        raise ValueError(f"Archive hash mismatch: {sha}")
    if not (root / f"inputs-{sha}.json").exists():
        continue
    rows = csv.DictReader(io.StringIO(raw.decode()))
    venues[entry["date"]] = {
        row["game_id"]: {
            "home": row["home_id"],
            "away": row["away_id"],
            "date": row["start_date"],
            "neutral": row["neutral_site"] == "TRUE",
        }
        for row in rows
        if row["neutral_site"] in ("TRUE", "FALSE")
        and row["home_division"] == row["away_division"] == "fbs"
    }
print(json.dumps(venues))
