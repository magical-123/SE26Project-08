"""Package and verify the already-built frontend; no deployment credentials required."""
import argparse
import functools
import gzip
import hashlib
import http.server
import io
import json
import re
import tarfile
import tempfile
import threading
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ('name', 'version', 'build_no', 'run_id', 'commit')


def metadata(directory):
    info = json.loads((directory / 'dist/version.json').read_text(encoding='utf-8'))
    assert set(info) == set(FIELDS), 'Unexpected version metadata fields'
    assert info['name'] == 'infodigest-frontend'
    assert re.fullmatch(r'[0-9a-f]{40}', info['commit']), 'Invalid commit'
    assert all(isinstance(v, str) and re.fullmatch(r'[A-Za-z0-9._-]+', v) for v in info.values())
    return info


def package():
    info = metadata(ROOT / 'frontend')
    name = f"{info['name']}_{info['version']}_static"
    output = ROOT / 'release'
    output.mkdir(exist_ok=True)
    archive = output / (name + '.tar.gz')
    build_info = ''.join(f'{k}={info[k]}\n' for k in FIELDS).encode()
    # Fixed metadata makes the archive reproducible for identical dist/BUILD_INFO.
    with archive.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as zipped:
        with tarfile.open(fileobj=zipped, mode='w', format=tarfile.USTAR_FORMAT) as tar:
            entries = {name + '/BUILD_INFO': build_info}
            entries[name + '/README.txt'] = b'Serve dist with: python -m http.server 4173 --directory dist\nVersion: http://127.0.0.1:4173/version.json\nBusiness APIs require the InfoDigest backend.\n'
            for path in sorted((ROOT / 'frontend/dist').rglob('*')):
                if path.is_file():
                    assert not path.is_symlink(), 'Symlinks are not allowed in release'
                    entries[name + '/dist/' + path.relative_to(ROOT / 'frontend/dist').as_posix()] = path.read_bytes()
            for path, data in sorted(entries.items()):
                member = tarfile.TarInfo(path)
                member.size, member.mode, member.mtime = len(data), 0o644, 0
                tar.addfile(member, io.BytesIO(data))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(archive.suffix + '.sha256').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
    print(json.dumps({'archive': archive.name, 'sha256': digest, **info}))
    verify(archive)


def verify(archive, smoke=False):
    recorded = archive.with_suffix(archive.suffix + '.sha256').read_text().split()
    assert len(recorded) == 2 and recorded[1] == archive.name
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == recorded[0], 'Checksum mismatch'
    with tarfile.open(archive, 'r:gz') as tar:
        names = tar.getnames()
        prefixes = {name.split('/')[0] for name in names}
        assert len(prefixes) == 1, 'Archive must have exactly one top-level directory'
        prefix = prefixes.pop()
        assert all(not p.startswith('/') and '..' not in p.split('/') for p in names)
        assert all(m.isfile() for m in tar.getmembers()), 'Only regular files are allowed'
        info = json.loads(tar.extractfile(prefix + '/dist/version.json').read())
        actual = dict(line.split('=', 1) for line in tar.extractfile(prefix + '/BUILD_INFO').read().decode().splitlines())
        assert actual == info, 'BUILD_INFO and runtime metadata differ'
        assert re.fullmatch(r'[0-9a-f]{40}', info['commit'])
        assert prefix + '/dist/index.html' in names
        for key, value in [('version', ARGS.version), ('commit', ARGS.commit), ('build_no', ARGS.build_no), ('run_id', ARGS.run_id)]:
            if value is not None:
                assert info[key] == value, f'{key} does not match expected value'
        if smoke:
            with tempfile.TemporaryDirectory(prefix='infodigest-smoke-') as temporary:
                tar.extractall(temporary, filter='data')
                directory = Path(temporary) / prefix / 'dist'
                class QuietHandler(http.server.SimpleHTTPRequestHandler):
                    def log_message(self, *args):
                        pass
                handler = functools.partial(QuietHandler, directory=str(directory))
                with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
                    thread = threading.Thread(target=server.serve_forever, daemon=True)
                    thread.start()
                    try:
                        url = f'http://127.0.0.1:{server.server_port}'
                        with urllib.request.urlopen(url + '/version.json') as response:
                            assert json.load(response) == info
                        with urllib.request.urlopen(url + '/') as response:
                            assert b'<div id="root">' in response.read()
                    finally:
                        server.shutdown()
                        thread.join()
    print(json.dumps({'verified': archive.name, 'runtime_smoke': smoke, **info}))


def trace(archive, repository):
    verify(archive)
    with tarfile.open(archive) as tar:
        name = next(n for n in tar.getnames() if n.endswith('/BUILD_INFO'))
        info = dict(line.split('=', 1) for line in tar.extractfile(name).read().decode().splitlines())
    print(f"commit=https://github.com/{repository}/commit/{info['commit']}")
    print(f"run=https://github.com/{repository}/actions/runs/{info['run_id']}")
    print(f"release=https://github.com/{repository}/releases/tag/v{info['version']}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['package', 'verify', 'smoke', 'trace'])
    parser.add_argument('archive', nargs='?', type=Path)
    for key in ['version', 'commit', 'build_no', 'run_id']:
        parser.add_argument('--' + key.replace('_', '-'))
    parser.add_argument('--repository', default='magical-123/SE26Project-08')
    ARGS = parser.parse_args()
    if ARGS.command == 'package':
        package()
    elif ARGS.command == 'trace':
        trace(ARGS.archive, ARGS.repository)
    else:
        verify(ARGS.archive, ARGS.command == 'smoke')
