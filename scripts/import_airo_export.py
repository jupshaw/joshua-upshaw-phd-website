#!/usr/bin/env python3
"""Import a GoDaddy Airo ZIP into a review-only directory.

Usage: python3 scripts/import_airo_export.py ~/Downloads/my-airo-project.zip

Never automatically commit exported files. Inspect the security report and original
files before pushing a public GitHub repository. This does not deploy the export.
"""
from __future__ import annotations
import argparse
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DEST = ROOT / 'airo-export'
DANGER = re.compile(r'(?i)(^|/)(\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|p12|pfx|key|sqlite|db)|credentials(?:\..*)?|secrets?(?:\..*)?)$')
PATTERNS = [
    ('possible API key or credential assignment',re.compile(r'(?i)(API[_-]?KEY|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?TOKEN)\s*[:=]\s*["\']?[^\s"\']{8,}')),
    ('GitHub token prefix', re.compile(r'(ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{10,}')),
    ('private key content',re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip_path',type=Path)
    parser.add_argument('--dest',type=Path,default=DEFAULT_DEST)
    args=parser.parse_args()
    zip_path=args.zip_path.expanduser().resolve()
    dest=args.dest.expanduser().resolve()
    if not zip_path.is_file():
        parser.error(f'File not found: {zip_path}')
    if dest.exists() and any(dest.iterdir()):
        parser.error(f'Destination is not empty: {dest}. Rename or remove it intentionally before import.')
    dest.mkdir(parents=True,exist_ok=True)
    warnings=[]
    extracted=0
    total=0
    try:
        with zipfile.ZipFile(zip_path,'r') as z:
            for info in z.infolist():
                path=PurePosixPath(info.filename.replace('\\','/'))
                if info.is_dir() or '__MACOSX' in path.parts or '.DS_Store' in path.parts:
                    continue
                if path.is_absolute() or not path.parts or any(part in ('..','') for part in path.parts):
                    raise ValueError(f'Unsafe archive path: {info.filename}')
                if path.parts[0] in ('.git','node_modules'):
                    warnings.append(f'Skipped repository/dependency artifact: {path}')
                    continue
                if (info.external_attr >> 16) & 0o170000 == stat.S_IFLNK:
                    raise ValueError(f'Symlink not allowed: {path}')
                total += info.file_size
                if info.file_size > 50*1024*1024 or total > 250*1024*1024:
                    raise ValueError('Archive exceeds safe size limits (50MB/file, 250MB total).')
                target=dest.joinpath(*path.parts)
                target.parent.mkdir(parents=True,exist_ok=True)
                data=z.read(info)
                target.write_bytes(data)
                extracted+=1
                if DANGER.search('/'.join(path.parts)):
                    warnings.append(f'Potentially sensitive filename: {path}')
                if len(data)<2_000_000 and target.suffix.lower() in ('.txt','.js','.ts','.json','.yml','.yaml','.html','.env','.py','.md','.tsx','.jsx'):
                    body=data.decode('utf-8','ignore')
                    for label,rx in PATTERNS:
                        if rx.search(body):
                            warnings.append(f'Potential {label} in {path}')
    except Exception:
        # Keep extracted work for incident review, but exit nonzero without staging.
        raise
    report=ROOT / 'AIRO_IMPORT_REVIEW.txt'
    lines=[f'Imported {extracted} files from {zip_path.name} to {dest}',
           'REVIEW BEFORE GIT ADD OR PUBLIC PUSH.',
           'This report may include false positives. Check every flagged file manually.',
           '',*(['Warnings:']+warnings if warnings else ['No automated warnings. Manual review is still required.']),
           '', 'Verify that exported code runs per GoDaddy instructions and that proprietary assets are approved for public release.',
           'Do not publish patient data, private source files, passwords, provider records, or proprietary Hidalga material.']
    report.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'Imported {extracted} file(s). Review report at {report}')
    if warnings:
        print(f'{len(warnings)} warning(s) to inspect before committing:')
        for w in warnings[:30]: print(' - '+w)
        return 2
    return 0

if __name__=='__main__':
    sys.exit(main())
