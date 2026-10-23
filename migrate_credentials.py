"""Encrypt or rotate stored platform credentials; defaults to a read-only preview.

Set CREDENTIAL_ENCRYPTION_KEY to the new key. For rotation, also provide
PREVIOUS_CREDENTIAL_ENCRYPTION_KEY. Stop writers and back up the database
before using --apply; no credential values are printed.
"""

import argparse
import base64
import binascii
from contextlib import closing
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from deployment_config import database_options, required_env

PREFIX = "enc:v1:"


def decode_key(value):
    try:
        key = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("Credential keys must use valid Base64") from None
    if len(key) != 32:
        raise ValueError("Credential keys must decode to exactly 32 bytes")
    return key


def encrypt_value(value, key):
    iv = os.urandom(12)
    payload = iv + AESGCM(key).encrypt(iv, value.encode("utf-8"), None)
    return PREFIX + base64.b64encode(payload).decode("ascii")


def transform_credential(value, current_key, previous_key=None):
    if not value:
        return value
    if not value.startswith(PREFIX):
        return encrypt_value(value, current_key)
    try:
        payload = base64.b64decode(value[len(PREFIX):], validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("A stored credential has an invalid encrypted payload") from None
    if len(payload) < 28:
        raise ValueError("A stored credential has a truncated encrypted payload")
    iv, encrypted = payload[:12], payload[12:]
    try:
        AESGCM(current_key).decrypt(iv, encrypted, None)
        return value  # Already uses the destination key.
    except InvalidTag:
        if previous_key is None:
            raise ValueError("Set PREVIOUS_CREDENTIAL_ENCRYPTION_KEY to rotate existing credentials") from None
    try:
        plaintext = AESGCM(previous_key).decrypt(iv, encrypted, None).decode("utf-8")
    except (InvalidTag, UnicodeDecodeError):
        raise ValueError("A stored credential cannot be decrypted with the supplied keys") from None
    return encrypt_value(plaintext, current_key)


def plan_migrations(records, current_key, previous_key=None):
    updates = []
    for row_id, value in records:
        transformed = transform_credential(value, current_key, previous_key)
        if transformed != value:
            updates.append((transformed, row_id))
    return updates


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply the validated migration in one transaction")
    args = parser.parse_args(argv)
    try:
        key = decode_key(required_env("CREDENTIAL_ENCRYPTION_KEY"))
        previous_value = os.environ.get("PREVIOUS_CREDENTIAL_ENCRYPTION_KEY", "").strip()
        previous_key = decode_key(previous_value) if previous_value else None
        options = database_options()
    except ValueError as exc:
        parser.error(str(exc))

    import mysql.connector

    with closing(mysql.connector.connect(**options)) as conn:
        try:
            with closing(conn.cursor()) as cursor:
                query = "SELECT id, credential FROM user_platforms"
                if args.apply:
                    query += " FOR UPDATE"
                cursor.execute(query)
                records = cursor.fetchall()
                updates = plan_migrations(records, key, previous_key)
                print(f"Checked {len(records)} records; {len(updates)} require migration.")
                if args.apply:
                    cursor.executemany(
                        "UPDATE user_platforms SET credential = %s WHERE id = %s", updates
                    )
                    conn.commit()
                    print("Migration committed. Configure the backend with the destination key before restarting writers.")
                else:
                    conn.rollback()
                    print("Preview only; no rows changed. Back up the database and stop writers before using --apply.")
        except Exception:
            conn.rollback()
            raise


if __name__ == "__main__":
    main()
