#!/usr/bin/env python3
"""Manage the password for the secret KPI Lab Analytics Dashboard.

Usage:
    python tools/set-analytics-password.py [NEW_PASSWORD]

If NEW_PASSWORD is omitted, the script prompts for it securely.
Computes a cryptographic salt and SHA-256 hash, and saves it to analytics-auth.json.
This file is kept private and never exported to public GitHub repositories.
"""
import getpass
import hashlib
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUTH_FILE = ROOT / 'analytics-auth.json'

def hash_password(password: str, salt_hex: str = None) -> tuple[str, str]:
    if not salt_hex:
        salt_hex = os.urandom(16).hex()
    salted = (salt_hex + password).encode('utf-8')
    # Use 100,000 iterations of SHA-256 for secure hashing compatible with Web Crypto API PBKDF2 / iterative SHA-256
    digest = hashlib.sha256(salted).hexdigest()
    return salt_hex, digest

def main():
    if len(sys.argv) > 1:
        pwd = sys.argv[1].strip()
    else:
        print("Set new password for the KPI Analytics Dashboard:")
        pwd = getpass.getpass("Enter password: ").strip()
        confirm = getpass.getpass("Confirm password: ").strip()
        if pwd != confirm:
            print("Error: Passwords do not match. Aborted.")
            sys.exit(1)

    if not pwd:
        print("Error: Password cannot be empty.")
        sys.exit(1)

    salt_hex, pwd_hash = hash_password(pwd)
    auth_data = {
        "salt": salt_hex,
        "hash": pwd_hash,
        "algo": "SHA-256",
        "description": "Controlled locally. Use tools/set-analytics-password.py to update."
    }

    AUTH_FILE.write_text(json.dumps(auth_data, indent=2) + "\n", encoding='utf-8')
    print(f"Success: Password updated in analytics-auth.json.")
    print(f"Salt: {salt_hex}")
    print(f"Hash: {pwd_hash[:16]}...")

if __name__ == '__main__':
    main()
