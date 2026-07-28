#!/bin/bash
set -e
cd "$(dirname "$0")"

# python3 crawl_page.py "https://i54.co.kr/product/list.html?cate_no=2513&sort_method=5#Product_ListMenu" --end-page 33 --since 2026-07-24

echo
echo "====================="
echo
python3 convert_excel.py data/page_crawl_2026-07-27.xlsx --clean-thumbnails --duplicate never
echo
echo "====================="
echo
#python3 convert_excel.py data/2026-07-14.xlsx --duplicate always
echo
echo "====================="
echo
python3 convert_excel.py --purge 2026-04-27
echo
echo "====================="
echo
python3 check_broken_thumbnails.py
echo
echo "====================="
echo
