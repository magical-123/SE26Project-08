"""Check versioned release files without printing any matched secret values.

This deliberately small, offline check supplements review and credential rotation.
It does not prove that a repository or its GitHub attachments are safe to publish.
"""

import argparse
import ast
from dataclasses import dataclass
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    rule: str


def placeholder(value):
    value = str(value).strip()
    return not value or bool(re.search(
        r"(?i)(change_me|replace_me|your[_ -]|example|placeholder|<[^>]+>|xxx)", value
    ))


def scan_text(text, path):
    findings = []
    test_file = "/src/test/" in "/" + path or "/tests/" in "/" + path

    def add(line, rule):
        finding = Finding(path, line, rule)
        if finding not in findings:
            findings.append(finding)

    for line_no, line in enumerate(text.splitlines(), 1):
        for pattern, rule in [
            (r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b", "token-literal"),
            (r"\bsk-[A-Za-z0-9_-]{20,}\b", "api-key-literal"),
            (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "private-key"),
            (r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{15,}\b", "jwt-literal"),
        ]:
            for match in re.finditer(pattern, line):
                if not placeholder(match.group()):
                    add(line_no, rule)
        if not test_file:
            for match in re.finditer(r"\$\{(?:DB_PASSWORD|JWT_SECRET|CREDENTIAL_ENCRYPTION_KEY):([^}]*)\}", line):
                fallback = match.group(1)
                if fallback not in ("", "-") and not fallback.startswith("?"):
                    add(line_no, "secret-fallback")
            match = re.match(r"\s*(?:DB_PASSWORD|JWT_SECRET|CREDENTIAL_ENCRYPTION_KEY|DEEPSEEK_API_KEY)\s*=\s*(.*?)\s*$", line)
            if match and not placeholder(match.group(1)) and not match.group(1).startswith("${"):
                add(line_no, "environment-secret-literal")
            match = re.match(r"\s*(?:password|secret|encryption-key|api-key):\s*([^#]+)", line)
            if path.endswith((".yml", ".yaml")) and match:
                value = match.group(1).strip().strip("\"'")
                if not placeholder(value) and not value.startswith("${"):
                    add(line_no, "configuration-secret-literal")
            if path.endswith((".md", ".txt")):
                match = re.search(r"(?i)(?:^|#|\s)password\s*[:=]\s*([^\s`]+)", line)
                if match and not placeholder(match.group(1)) and not match.group(1).startswith("${"):
                    add(line_no, "document-password")

    if path.endswith(".json"):
        try:
            value = json.loads(text)
            if isinstance(value, dict) and isinstance(value.get("password"), str):
                if not placeholder(value["password"]) and not test_file:
                    add(1, "json-password-literal")
        except ValueError:
            pass

    if path.endswith(".py"):
        try:
            tree = ast.parse(text)
        except SyntaxError:
            add(1, "python-syntax-error")
            return findings
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
                if isinstance(node.value.value, str) and not placeholder(node.value.value) and not test_file:
                    for target in node.targets:
                        if isinstance(target, ast.Name) and re.fullmatch(
                            r"(?i)(password|passwd|db_pass|db_password|encoded_key|jwt_secret|credential_encryption_key)", target.id
                        ):
                            add(node.lineno, "python-secret-literal")
            if isinstance(node, ast.Call) and not test_file:
                for keyword in node.keywords:
                    if keyword.arg in ("password", "passwd") and isinstance(keyword.value, ast.Constant):
                        if isinstance(keyword.value.value, str) and not placeholder(keyword.value.value):
                            add(node.lineno, "python-password-argument")
    return findings


def scan_bytes(data, path):
    if path.startswith(".reasonix/") or Path(path).suffix.lower() in (".pem", ".key", ".p12", ".pfx", ".cookie"):
        return [Finding(path, 1, "private-file-in-release")]
    if Path(path).name.startswith(".env") and not path.endswith(".env.example"):
        return [Finding(path, 1, "private-environment-file")]
    if path.lower().endswith((".docx", ".xlsx", ".pptx", ".zip")) and data.startswith(b"PK"):
        findings = []
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for entry in archive.infolist():
                    if entry.file_size > 8_000_000:
                        continue
                    nested = archive.read(entry)
                    nested_path = path + "!" + entry.filename
                    if entry.filename == "docProps/core.xml":
                        for item in ET.fromstring(nested):
                            if item.tag.rpartition("}")[2] in ("creator", "lastModifiedBy") and (item.text or "").strip():
                                findings.append(Finding(nested_path, 1, "office-author-metadata"))
                    if entry.filename.endswith(".xml"):
                        text = "\n".join(ET.fromstring(nested).itertext())
                        if path.lower().endswith((".docx", ".xlsx", ".pptx")) and re.search(r"(?<!\d)\d{12}(?!\d)", text):
                            findings.append(Finding(nested_path, 1, "possible-student-id"))
                        findings.extend(scan_text(text, nested_path))
                    elif path.endswith(".zip"):
                        findings.extend(scan_bytes(nested, nested_path))
        except (zipfile.BadZipFile, ET.ParseError, RuntimeError):
            findings.append(Finding(path, 1, "unreadable-archive"))
        return findings
    if b"\0" in data[:8192]:
        return []
    try:
        return scan_text(data.decode("utf-8-sig"), path)
    except UnicodeDecodeError:
        return []


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--include-untracked", action="store_true")
    args = parser.parse_args(argv)
    command = ["git", "-c", "core.fsmonitor=false", "-C", str(args.root), "ls-files", "-z", "--cached"]
    if args.include_untracked:
        command += ["--others", "--exclude-standard"]
    names = sorted(set(x for x in subprocess.check_output(command).decode("utf-8").split("\0") if x))
    findings = []
    for name in names:
        path = args.root / name
        if path.is_file():
            findings.extend(scan_bytes(path.read_bytes(), name))
    for finding in findings:
        print(f"{finding.path}:{finding.line}: {finding.rule}")
    print(f"Checked {len(names)} release paths; {len(findings)} findings. No matched values were printed.")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
