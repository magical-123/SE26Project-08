import base64
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from deployment_config import database_options, ssh_connect_kwargs
from migrate_credentials import decode_key, encrypt_value, plan_migrations, transform_credential
from scripts.check_public_release import scan_bytes, scan_text
from scripts.generate_secrets import generate
from scripts.release_documents import sanitize_office


class CredentialMigrationTests(unittest.TestCase):
    def setUp(self):
        self.old_key = os.urandom(32)
        self.new_key = os.urandom(32)

    def test_rotation_preserves_plaintext_and_is_idempotent(self):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        original = encrypt_value("synthetic-platform-cookie", self.old_key)
        rotated = transform_credential(original, self.new_key, self.old_key)
        payload = base64.b64decode(rotated.split(":", 2)[2])
        self.assertEqual(AESGCM(self.new_key).decrypt(payload[:12], payload[12:], None), b"synthetic-platform-cookie")
        self.assertEqual(transform_credential(rotated, self.new_key, self.old_key), rotated)

    def test_missing_or_wrong_old_key_aborts_before_update_plan(self):
        records = [(1, "plaintext"), (2, encrypt_value("private", self.old_key))]
        with self.assertRaises(ValueError):
            plan_migrations(records, self.new_key)
        with self.assertRaises(ValueError):
            plan_migrations(records, self.new_key, os.urandom(32))

    def test_empty_values_and_destination_ciphertexts_are_unchanged(self):
        value = encrypt_value("already-current", self.new_key)
        self.assertEqual(plan_migrations([(1, None), (2, ""), (3, value)], self.new_key), [])

    def test_malformed_payload_and_wrong_key_size_are_rejected(self):
        for value in ["enc:v1:invalid!", "enc:v1:AA=="]:
            with self.assertRaises(ValueError):
                transform_credential(value, self.new_key)
        for value in ["not-base64", base64.b64encode(os.urandom(16)).decode()]:
            with self.assertRaises(ValueError):
                decode_key(value)


class ConfigurationTests(unittest.TestCase):
    def test_admin_scripts_have_no_default_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                database_options()
            with self.assertRaises(ValueError):
                ssh_connect_kwargs()

    def test_ssh_agent_can_be_used_without_a_password(self):
        with patch.dict(os.environ, {"DEPLOY_HOST": "example.invalid", "DEPLOY_USER": "deployer"}, clear=True):
            options = ssh_connect_kwargs()
            self.assertNotIn("password", options)
            self.assertEqual(options["hostname"], "example.invalid")

    def test_generated_keys_are_independent_and_have_valid_lengths(self):
        first, second = generate(), generate()
        self.assertNotEqual(first, second)
        self.assertGreaterEqual(len(first["JWT_SECRET"].encode()), 32)
        self.assertEqual(len(decode_key(first["CREDENTIAL_ENCRYPTION_KEY"])), 32)


class ReleaseScannerTests(unittest.TestCase):
    def test_detects_passwords_without_reporting_the_value(self):
        value = "synthetic-credential-for-test"
        findings = scan_text("password = " + repr(value), "deploy.py")
        self.assertTrue(findings)
        self.assertNotIn(value, str(findings))

    def test_rejects_secret_fallback_and_accepts_required_binding(self):
        self.assertTrue(scan_text("secret: ${JWT_SECRET:-synthetic}", "application.yml"))
        self.assertFalse(scan_text("secret: ${JWT_SECRET}", "application.yml"))
        self.assertFalse(scan_text("secret: ${JWT_SECRET:?Set JWT_SECRET}", "compose.yml"))
        self.assertFalse(scan_text("JWT_SECRET=\n", ".env.example"))
        self.assertFalse(scan_text('{"password":"CHANGE_ME_DEMO_PASSWORD"}', "login_payload.json"))

    def test_checks_office_metadata_and_identifiers_inside_archives(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("docProps/core.xml", '<core><creator>synthetic author</creator></core>')
            archive.writestr("ppt/slides/slide1.xml", '<slide><t>' + "123456" + "789012" + '</t></slide>')
        rules = {finding.rule for finding in scan_bytes(data.getvalue(), "demo.pptx")}
        self.assertEqual(rules, {"office-author-metadata", "possible-student-id"})
        sanitized = sanitize_office(data.getvalue())
        self.assertEqual(scan_bytes(sanitized, "demo.pptx"), [])
        self.assertEqual(sanitize_office(sanitized), sanitized)

    def test_rejects_private_files(self):
        self.assertTrue(scan_bytes(b"", ".env.local"))
        self.assertTrue(scan_bytes(b"", ".reasonix/debug.txt"))


if __name__ == "__main__":
    unittest.main()
