#!/usr/bin/env python3
"""
사용법:
  order.md 파일 검증 (기본):
    python3 validate_price.py

  다른 md 파일 지정:
    python3 validate_price.py other.md
"""

import json
import glob
import sys
import re

DATA_DIR = 'public/data/i54/brands'
DEFAULT_ORDER_FILE = 'order.md'


def load_products():
    products = []
    for path in glob.glob(f'{DATA_DIR}/*.json'):
        if 'full' in path:
            continue
        with open(path, encoding='utf-8') as f:
            products.extend(json.load(f))
    return products


def parse_line(line):
    parts = [p.strip() for p in line.split('/')]

    # 색상 없음: 상품명 / 사이즈 / N개 / 가격
    # 색상 있음: 상품명 / 색상 / 사이즈 / N개 / 가격
    if len(parts) == 4:
        name_part, size, qty_str, price_str = parts
        color = ''
    elif len(parts) == 5:
        name_part, color, size, qty_str, price_str = parts
    else:
        raise ValueError(f'파싱 실패 (슬래시 개수 오류): {line}')

    qty = int(re.sub(r'[^0-9]', '', qty_str))
    price = int(re.sub(r'[^0-9]', '', price_str))

    return name_part.strip(), color.strip(), size.strip(), qty, price


def find_product(products, name_part):
    for p in products:
        if p['name'].replace('.', ' ') == name_part:
            return p
    return None


def calc_price(product, color, size, qty):
    color_add = 0
    size_add = 0

    for c in (product.get('colors') or []):
        if c['name'] == color:
            color_add = c.get('add_price', 0)
            break

    for s in (product.get('sizes') or []):
        if s['name'] == size:
            size_add = s.get('add_price', 0)
            break

    unit_price = product['price_sale'] + round((color_add + size_add) * 1.6)
    return unit_price * qty


def validate_line(line, products):
    line = line.strip()
    if not line or line.startswith('#') or '/' not in line:
        return None, None

    try:
        name_part, color, size, qty, price = parse_line(line)
    except ValueError as e:
        print(f'  오류: {e}')
        return None, None

    product = find_product(products, name_part)
    if not product:
        print(f'  ❌ 상품 없음: {name_part}')
        return None, None

    expected = calc_price(product, color, size, qty)

    if expected == price:
        print(f'  ✅ {name_part} → {price:,}원 일치')
    else:
        diff = price - expected
        sign = '+' if diff > 0 else ''
        print(f'  ❌ {name_part} → 입력 {price:,}원 / 계산 {expected:,}원 (차이 {sign}{diff:,}원)')

    return price, expected


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ORDER_FILE

    try:
        with open(target, encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f'파일 없음: {target}')
        sys.exit(1)

    products = load_products()
    total_input = 0
    total_expected = 0

    for line in lines:
        price, expected = validate_line(line, products)
        if price is not None:
            total_input += price
            total_expected += expected

    if total_input or total_expected:
        print()
        print(f'  입력 합계: {total_input:,}원')
        if total_input != total_expected:
            diff = total_input - total_expected
            sign = '+' if diff > 0 else ''
            print(f'  계산 합계: {total_expected:,}원 (차이 {sign}{diff:,}원)')


if __name__ == '__main__':
    main()
