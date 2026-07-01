#!/bin/bash
set -e
cd "$(dirname "$0")"

python3 convert_excel.py data/2026-05-27.xlsx --duplicate always
python3 check_broken_thumbnails.py
python3 crawl_brand.py 소예 --since 2026-06-01
