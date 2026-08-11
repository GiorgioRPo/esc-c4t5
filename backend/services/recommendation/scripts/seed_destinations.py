"""Builds embedding documents and upserts destinations into Postgres.

Safe to re-run: skips destinations whose profile text and embedding version are
unchanged, so a re-run does not re-embed every row.

    python -m scripts.seed_destinations
    python -m scripts.seed_destinations --force
"""

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import asyncpg
from pgvector.asyncpg import register_vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.embedding import SentenceTransformerEmbeddingProvider  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[4]
DERIVED = REPO_ROOT / "database" / "seed" / "destinations.json"
CURATED = REPO_ROOT / "database" / "seed" / "destination_profiles.json"

BATCH_SIZE = 16
REQUIRED_CURATED = ("description", "tags", "region", "destination_type", "country_code")


def build_document(record: dict, profile: dict) -> str:
    """Deterministic embedding text.

    Identical inputs must always produce an identical string, otherwise the
    profile hash cannot be used to detect real changes. Tags are sorted for
    exactly that reason.
    """
    tags = ", ".join(sorted(profile["tags"]))
    return (
        f"{record['name']}, {record['country_name']}. {profile['description']}\n"
        f"Region: {profile['region']}.\n"
        f"Destination type: {profile['destination_type']}.\n"
        f"Travel experiences and attributes: {tags}."
    )


def profile_hash(document: str, embedding_version: str) -> str:
    """Changes when either the document text or the versioning scheme changes."""
    return hashlib.sha256(f"{embedding_version}\n{document}".encode()).hexdigest()


UPSERT = """
insert into public.destinations (
    uid, name, country_code, country_name, region, destination_type,
    description, tags, latitude, longitude,
    embedding, embedding_model, embedding_version, metadata, active
) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
on conflict (uid) do update set
    name              = excluded.name,
    country_code      = excluded.country_code,
    country_name      = excluded.country_name,
    region            = excluded.region,
    destination_type  = excluded.destination_type,
    description       = excluded.description,
    tags              = excluded.tags,
    latitude          = excluded.latitude,
    longitude         = excluded.longitude,
    embedding         = excluded.embedding,
    embedding_model   = excluded.embedding_model,
    embedding_version = excluded.embedding_version,
    metadata          = excluded.metadata,
    active            = true
"""


def _as_dict(value) -> dict:
    """asyncpg returns jsonb as str; tolerate both."""
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return {}


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="re-embed everything")
    args = parser.parse_args()

    settings = get_settings()

    if not DERIVED.exists():
        print(f"Missing {DERIVED}. Run the coordinate derivation script first.")
        return 1

    derived = json.loads(DERIVED.read_text(encoding="utf-8"))
    curated = json.loads(CURATED.read_text(encoding="utf-8")) if CURATED.exists() else {}
    profiles = curated.get("profiles", {})

    pending, skipped = [], []
    for record in derived:
        profile = profiles.get(record["uid"])
        if profile is None or record.get("latitude") is None:
            skipped.append(record["uid"])
            continue
        if not all(profile.get(field) for field in REQUIRED_CURATED):
            skipped.append(record["uid"])
            continue

        document = build_document(record, profile)
        pending.append(
            {
                "record": record,
                "profile": profile,
                "document": document,
                "hash": profile_hash(document, settings.embedding_version),
            }
        )

    if not pending:
        print("No fully-specified destinations to seed.")
        print("Run: python -m scripts.validate_destinations")
        return 1

    conn = await asyncpg.connect(settings.database_url)
    await conn.execute(f"set search_path to {settings.database_search_path}")

    vector_schema = await conn.fetchval(
        "select extnamespace::regnamespace::text from pg_extension where extname='vector'"
    )
    try:
        await register_vector(conn, schema=vector_schema)
    except TypeError:
        await register_vector(conn)

    try:
        existing = {
            row["uid"]: _as_dict(row["metadata"])
            for row in await conn.fetch("select uid, metadata from public.destinations")
        }

        todo, unchanged = [], 0
        for item in pending:
            prior = existing.get(item["record"]["uid"])
            if not args.force and prior and prior.get("profile_hash") == item["hash"]:
                unchanged += 1
                continue
            todo.append(item)

        if not todo:
            print(f"All {unchanged} destinations already up to date.")
            return 0

        print(
            f"Embedding {len(todo)} destinations "
            f"({unchanged} unchanged, {len(skipped)} awaiting curation)..."
        )

        provider = SentenceTransformerEmbeddingProvider(
            settings.embedding_model, settings.embedding_dimension
        )

        for start in range(0, len(todo), BATCH_SIZE):
            batch = todo[start : start + BATCH_SIZE]
            vectors = provider.embed_documents([b["document"] for b in batch])

            async with conn.transaction():
                for item, vector in zip(batch, vectors):
                    record, profile = item["record"], item["profile"]
                    metadata = dict(record.get("metadata") or {})
                    metadata["profile_hash"] = item["hash"]
                    metadata["hotel_count"] = record.get("hotel_count")

                    await conn.execute(
                        UPSERT,
                        record["uid"],
                        record["name"],
                        profile["country_code"],
                        record["country_name"],
                        profile["region"],
                        profile["destination_type"],
                        profile["description"],
                        list(profile["tags"]),
                        record["latitude"],
                        record["longitude"],
                        vector,
                        provider.model_name,
                        settings.embedding_version,
                        json.dumps(metadata),
                    )
            print(f"  seeded {min(start + BATCH_SIZE, len(todo))}/{len(todo)}")

        total = await conn.fetchval(
            "select count(*) from public.destinations where embedding is not null"
        )
        print(f"\nDone. {total} destinations have embeddings.")
        if skipped:
            preview = ", ".join(skipped[:10]) + (" ..." if len(skipped) > 10 else "")
            print(f"{len(skipped)} skipped (missing coords or curation): {preview}")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
