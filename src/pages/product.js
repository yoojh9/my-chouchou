import { addToCart, updateCartBadge } from "../cart.js";

const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

function formatPrice(n) {
  return Number(n).toLocaleString("ko-KR") + "원";
}

function openLightbox(imgSrc) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  const img = document.createElement("img");
  img.className = "lightbox__img";
  img.src = imgSrc;
  overlay.appendChild(img);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

function detailImageHTML(url, idx) {
  if (!url) return "";
  return `
    <div class="product-detail__img-wrap skeleton" data-img-wrap>
      <img class="product-detail__img"
        src="${url}"
        alt="상세 이미지 ${idx + 1}"
        loading="${idx === 0 ? "eager" : "lazy"}"
        data-full="${url}"
        onload="this.classList.add('is-loaded');this.closest('[data-img-wrap]').classList.remove('skeleton')"
        onerror="var w=this.closest('[data-img-wrap]');w.classList.add('is-error');w.classList.remove('skeleton');this.remove()"
      >
    </div>`;
}

function attachImageSkeletonCleanup(container) {
  container.querySelectorAll("[data-img-wrap] img").forEach((img) => {
    if (img.complete && img.naturalWidth) {
      img.classList.add("is-loaded");
      img.closest("[data-img-wrap]").classList.remove("skeleton");
    }
  });
}

function colorTagsHTML(colors) {
  if (!colors || !colors.length) return "";
  const tags = colors
    .map((c) => {
      const badge = c.add_price > 0
        ? `<span class="option-chip__badge">+${Math.round(c.add_price * 1.6).toLocaleString()}원</span>`
        : "";
      return `<button class="product-detail__color-tag" data-color="${c.name}" data-add-price="${c.add_price}"><span class="option-chip__name">${c.name}</span>${badge}</button>`;
    })
    .join("");
  return `
    <div class="product-detail__option-block product-detail__colors-section">
      <div class="product-detail__option-label"><span>색상</span></div>
      <div class="product-detail__option-chips">${tags}</div>
    </div>`;
}

function sizeTagsHTML(sizes) {
  if (!sizes || !sizes.length) return "";
  const tags = sizes
    .map((s) => {
      const extraClass = s.add_price > 0 ? " product-detail__size-tag--extra" : "";
      const badge = s.add_price > 0
        ? `<span class="option-chip__badge">+${Math.round(s.add_price * 1.6).toLocaleString()}원</span>`
        : "";
      return `<button class="product-detail__size-tag${extraClass}" data-size="${s.name}" data-add-price="${s.add_price}"><span class="option-chip__name">${s.name}</span>${badge}</button>`;
    })
    .join("");
  return `
    <div class="product-detail__option-block">
      <div class="product-detail__option-label"><span>사이즈</span></div>
      <div class="product-detail__option-chips">${tags}</div>
    </div>`;
}

export async function renderProduct(app, brandId, productId, backHash) {
  app.innerHTML = `
    <div class="header">
      <button class="header__logo" aria-label="홈으로">마이슈슈</button>
      <div class="header__nav">
        <button class="header__back" id="back-btn" aria-label="뒤로가기">
          ${BACK_SVG}${brandId}
        </button>
      </div>
    </div>
    <div id="product-content" style="padding-bottom:32px">
      <div class="state-empty">불러오는 중...</div>
    </div>`;

  document.getElementById("back-btn").addEventListener("click", () => {
    location.hash = backHash || `#/brand/${encodeURIComponent(brandId)}`;
  });

  let allProducts, soldoutIds;
  try {
    const [productsRes, soldoutRes] = await Promise.all([
      fetch(`data/i54/brands/${encodeURIComponent(brandId)}.full.json`),
      fetch("data/soldout.json"),
    ]);
    if (!productsRes.ok) throw new Error(`HTTP ${productsRes.status}`);
    allProducts = await productsRes.json();
    soldoutIds = new Set(
      (soldoutRes.ok ? await soldoutRes.json() : []).map(String),
    );
  } catch (e) {
    document.getElementById("product-content").innerHTML =
      `<div class="state-error">데이터를 불러오지 못했습니다.</div>`;
    return;
  }

  const product = allProducts.find((p) => String(p.id) === String(productId));
  const isSoldout = soldoutIds.has(String(productId));
  const content = document.getElementById("product-content");

  if (!product) {
    content.innerHTML = `<div class="state-empty">상품을 찾을 수 없습니다.</div>`;
    return;
  }

  const isSale = (product.name || '').includes('(세일)');
  const displayName = isSale ? product.name.replace('(세일) ', '') : (product.name || '');

  const colors = product.colors || [];
  const sizes = product.sizes || [];

  // 색상 1개면 자동 선택
  let selectedColor = colors.length === 1 ? colors[0].name : null;
  let selectedColorAddPrice = colors.length === 1 ? (colors[0].add_price || 0) : 0;
  let selectedSize = null;
  let selectedSizeAddPrice = 0;
  let quantity = 1;

  const detailImages = product.detail_images || [];
  const imagesHTML = detailImages.length
    ? detailImages.map((url, i) => detailImageHTML(url, i)).join("")
    : `<div style="padding:48px;text-align:center;color:#bbb;font-size:14px">이미지 없음</div>`;

  content.innerHTML = `
    <div class="product-detail__info">
      <div class="product-detail__brand">${brandId}</div>
      <div class="product-detail__name">${displayName}</div>
      ${isSoldout ? '<div class="soldout-label">품절</div>' : isSale ? '<div class="sale-label">SALE</div>' : ''}
      <div class="product-detail__prices">
        <span class="product-detail__price-sale" id="display-price">${formatPrice(product.price_sale)}</span>
      </div>
      <div class="product-detail__divider"></div>
      ${colorTagsHTML(colors)}
      ${sizeTagsHTML(sizes)}
      <div class="product-detail__qty-row">
        <span class="product-detail__qty-label">수량</span>
        <div class="qty-stepper">
          <button class="qty-stepper__btn" id="qty-minus">−</button>
          <span class="qty-stepper__num" id="qty-num">1</span>
          <button class="qty-stepper__btn" id="qty-plus">+</button>
        </div>
      </div>
      <button class="product-detail__cart-btn" id="cart-btn" disabled>${
        colors.length > 1 ? "색상을 선택해주세요" : "사이즈를 선택해주세요"
      }</button>
    </div>
    <div class="product-detail__images">${imagesHTML}</div>`;

  attachImageSkeletonCleanup(content);

  // 자동 선택된 색상 표시
  if (selectedColor) {
    content
      .querySelector(`.product-detail__color-tag[data-color="${selectedColor}"]`)
      ?.classList.add("is-selected");
  }

  function totalAddPrice() {
    return selectedColorAddPrice + selectedSizeAddPrice;
  }

  function updateDisplayPrice() {
    const el = document.getElementById("display-price");
    if (!el) return;
    const add = Math.round(totalAddPrice() * 1.6);
    const total = product.price_sale + add;
    if (add > 0) {
      el.innerHTML = `${formatPrice(product.price_sale)}<span class="price-add"> +${formatPrice(add)}</span><span class="price-total"> = ${formatPrice(total)}</span>`;
    } else {
      el.textContent = formatPrice(product.price_sale);
    }
    el.classList.remove("price-updated");
    void el.offsetWidth;
    el.classList.add("price-updated");
  }

  function updateCartBtn() {
    const cartBtn = document.getElementById("cart-btn");
    if (!cartBtn) return;
    const needColor = colors.length > 1;
    const needSize = sizes.length > 0;
    const ready = (!needColor || selectedColor) && (!needSize || selectedSize);
    cartBtn.disabled = !ready;
    if (ready) {
      cartBtn.textContent = "장바구니 담기";
      cartBtn.classList.remove("is-added");
    } else if (needColor && !selectedColor) {
      cartBtn.textContent = "색상을 선택해주세요";
    } else {
      cartBtn.textContent = "사이즈를 선택해주세요";
    }
  }

  content.addEventListener("click", (e) => {
    const img = e.target.closest(".product-detail__img");
    if (img) {
      openLightbox(img.dataset.full || img.src);
      return;
    }

    const colorTag = e.target.closest(".product-detail__color-tag[data-color]");
    if (colorTag) {
      content
        .querySelectorAll(".product-detail__color-tag")
        .forEach((b) => b.classList.remove("is-selected"));
      colorTag.classList.add("is-selected");
      selectedColor = colorTag.dataset.color;
      selectedColorAddPrice = Number(colorTag.dataset.addPrice) || 0;
      updateDisplayPrice();
      updateCartBtn();
      return;
    }

    const sizeTag = e.target.closest(".product-detail__size-tag[data-size]");
    if (sizeTag) {
      content
        .querySelectorAll(".product-detail__size-tag")
        .forEach((b) => b.classList.remove("is-selected"));
      sizeTag.classList.add("is-selected");
      selectedSize = sizeTag.dataset.size;
      selectedSizeAddPrice = Number(sizeTag.dataset.addPrice) || 0;
      updateDisplayPrice();
      updateCartBtn();
      return;
    }

    if (e.target.id === "qty-minus") {
      if (quantity > 1) {
        quantity--;
        document.getElementById("qty-num").textContent = quantity;
      }
      return;
    }

    if (e.target.id === "qty-plus") {
      quantity++;
      document.getElementById("qty-num").textContent = quantity;
      return;
    }

    const cartBtn = e.target.closest("#cart-btn");
    if (cartBtn && !cartBtn.disabled) {
      const result = addToCart({
        id: String(product.id),
        brand: brandId,
        name: product.name.replace(".", " "),
        selectedColor: selectedColor || "",
        size: selectedSize || "FREE",
        addPrice: totalAddPrice(),
        basePrice: product.price_sale,
        quantity,
        thumbnail_url: product.thumbnail_url || "",
      });
      if (result === 'added') {
        cartBtn.textContent = "담겼어요 ✓";
      } else {
        cartBtn.textContent = "수량이 추가됐어요 ✓";
      }
      cartBtn.classList.add("is-added");
      updateCartBadge();
    }
  });
}
