#!/usr/bin/env python3
"""Build approved public packs from a local, hash-verified data-only ZIP."""
from pathlib import Path
import argparse, hashlib, subprocess, sys, tempfile, zipfile

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '0a28aa2d13d92184de69375bfdde65df1d3de71b1cb5c212d935777d82e6963f'
EXPECTED = {'china_indices__sh000001_1d.json','china_indices__sh000016_1d.json','china_indices__sh000300_1d.json','china_indices__sh000852_1d.json','china_indices__sh000905_1d.json','china_indices__sz399001_1d.json','china_indices__sz399006_1d.json','crypto__BTCUSDT_spot_1h.json','crypto__ETHUSDT_spot_1h.json','export-manifest.json','futures__jm__contracts_1h.json','us__AAPL_1d.json','us__DOW_1d.json','us__MSFT_1d.json','us__NASDAQ_1d.json','us__NVDA_1d.json','us__QQQ_1d.json','us__SP500_1d.json','us__SPY_1d.json'}

def prepare(archive: Path, output: Path, verify_only: bool = False) -> None:
    if not archive.is_file():
        raise FileNotFoundError('Missing approved OHLC ZIP. Upload cta-public-ohlc-export.zip to the repository root; do not upload private framework files.')
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
        raise ValueError('Data archive SHA256 differs from the reviewed teaching artifact')
    with zipfile.ZipFile(archive) as z:
        if set(z.namelist()) != EXPECTED or len(z.namelist()) != len(EXPECTED):
            raise ValueError('Unexpected or duplicate archive entry')
        if sum(x.file_size for x in z.infolist()) > 100000000:
            raise ValueError('Unexpected decompressed size')
        if verify_only:
            print('PASS: SHA256 and all 19 whitelisted JSON entries verified')
            return
        with tempfile.TemporaryDirectory(prefix='cta-approved-') as tmp:
            for name in sorted(EXPECTED):
                (Path(tmp) / name).write_bytes(z.read(name))
            subprocess.run([sys.executable, str(ROOT/'scripts/build_data.py'), '--source', tmp, '--out', str(output)], check=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, default=ROOT/'cta-public-ohlc-export.zip')
    parser.add_argument('--out', type=Path, default=ROOT/'data')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if not args.verify_only and (args.out/'catalog.js').is_file():
        print('Existing generated packs found; scripts/audit_data.js validates every pack hash next.')
    else:
        prepare(args.archive, args.out, args.verify_only)
