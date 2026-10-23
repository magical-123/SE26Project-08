"""Surgically strip personal metadata from Office ZIP packages.

Only metadata fields and text identifiers are changed. Media, layout, styles,
relationships and other ZIP entries are preserved byte-for-byte.
"""

import io
import re
import zipfile


def sanitize_office(data):
    source = io.BytesIO(data)
    result = io.BytesIO()
    changed = False
    with zipfile.ZipFile(source) as archive, zipfile.ZipFile(result, "w") as output:
        for entry in archive.infolist():
            original = archive.read(entry)
            updated = original
            if entry.filename.endswith(".xml"):
                text = original.decode("utf-8")
                if entry.filename == "docProps/core.xml":
                    text = re.sub(
                        r"(<(?:[\w.-]+:)?(?:creator|lastModifiedBy)\b[^>]*>).*?(</(?:[\w.-]+:)?(?:creator|lastModifiedBy)>)",
                        r"\1\2", text, flags=re.DOTALL,
                    )
                if entry.filename == "docProps/custom.xml":
                    text = re.sub(r"<(?:[\w.-]+:)?property\b[^>]*>.*?</(?:[\w.-]+:)?property>", "", text, flags=re.DOTALL)
                # Course submissions use 12-digit student numbers in slide text/notes.
                text = re.sub(
                    r"(?<=>)([^<]+)(?=<)",
                    lambda match: re.sub(r"(?<!\d)\d{12}(?!\d)", "XXXXXXXXXXXX", match.group(1)),
                    text,
                )
                updated = text.encode("utf-8")
            changed |= updated != original
            output.writestr(entry, updated)
    return result.getvalue() if changed else data
