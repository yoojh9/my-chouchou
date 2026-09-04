#!/bin/bash
set -e
cd "$(dirname "$0")"

# python3 crawl_page.py "https://i54.co.kr/product/list.html?cate_no=2513&sort_method=5#Product_ListMenu" --end-page 33 --since 2026-09-03

echo
echo "====================="
echo
python3 convert_excel.py data/page_crawl_2026-09-04.xlsx --clean-thumbnails --duplicate never
echo
echo "====================="
echo
# python3 convert_excel.py data/2026-07-21.xlsx --duplicate always
echo
echo "====================="
echo
python3 convert_excel.py --purge 2026-06-04
echo
echo "====================="
echo
python3 check_broken_thumbnails.py --workers 3
echo
echo "====================="
echo
