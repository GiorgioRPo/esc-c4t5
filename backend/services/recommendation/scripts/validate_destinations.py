"""Reports which destinations are ready to seed and which still need curation.

Run before seeding. Exits non-zero if nothing is seedable.

    python -m scripts.validate_destinations
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
DERIVED = REPO_ROOT / "database" / "seed" / "destinations.json"
CURATED = REPO_ROOT / "database" / "seed" / "destination_profiles.json"

REQUIRED_CURATED = ("description", "tags", "region", "destination_type", "country_code")


def load_json(path: Path):
    if not path.exists():
        print(f"MISSING FILE: {path}")
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def main() -> int:
    derived = load_json(DERIVED)
    if derived is None:
        print("\nRun the coordinate derivation script first:")
        print("  cd backend && npx tsx scripts/derive-destination-geo.ts")
        return 1

    curated_doc = load_json(CURATED) or {"profiles": {}}
    profiles = curated_doc.get("profiles", {})
    review_status = curated_doc.get("_review_status", "UNKNOWN")

    ready, needs_work = [], []

    for record in derived:
        uid = record["uid"]
        problems = []

        if record.get("latitude") is None or record.get("longitude") is None:
            problems.append("coordinates")

        profile = profiles.get(uid)
        if profile is None:
            problems.append("no curated profile")
        else:
            for field in REQUIRED_CURATED:
                value = profile.get(field)
                if value is None or value == "" or value == []:
                    problems.append(field)

        (needs_work if problems else ready).append(
            {"uid": uid, "name": record["name"], "problems": problems}
        )

    print(f"Curation review status: {review_status}")
    if review_status == "DRAFT_UNREVIEWED":
        print("  WARNING: profiles are an unreviewed draft. A human must review")
        print("  descriptions and tags before these explanations reach users.")
    print()
    print(f"Total destinations:  {len(derived)}")
    print(f"Ready to seed:       {len(ready)}")
    print(f"Needs curation:      {len(needs_work)}")

    if needs_work:
        print()
        for item in needs_work:
            print(
                f"  {item['uid']:8} {item['name']:24} "
                f"missing: {', '.join(item['problems'])}"
            )

    if not ready:
        print("\nNothing is seedable yet.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
