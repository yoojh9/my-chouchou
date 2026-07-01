#!/bin/bash
set -e
cd "$(dirname "$0")"

python3 convert_excel.py data/page_crawl_2026-07-01.xlsx --no-thumbnails --duplicate never
python3 convert_excel.py data/2026-07-01.xlsx --duplicate always
python3 convert_excel.py --purge 2026-04-01
python3 check_broken_thumbnails.py
