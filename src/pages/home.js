function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso.slice(0, 10);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

function skeletonCards() {
  return Array.from(
    { length: 6 },
    () => `
    <div class="brand-card-skeleton">
      <div class="brand-card-skeleton__preview skeleton"></div>
      <div class="brand-card-skeleton__line skeleton"></div>
      <div class="brand-card-skeleton__line--short skeleton"></div>
    </div>
  `
  ).join("");
}

function brandCardHTML(brand) {
  const previews = brand.preview_thumbnails || [];

  let previewHTML;
  if (previews.length >= 3) {
    previewHTML = `
      <div class="brand-card__mosaic">
        <div class="brand-card__mosaic-main">
          <img src="${previews[0]}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
        </div>
        <div class="brand-card__mosaic-side">
          <div class="brand-card__mosaic-cell">
            <img src="${previews[1]}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
          </div>
          <div class="brand-card__mosaic-cell">
            <img src="${previews[2]}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
          </div>
        </div>
      </div>`;
  } else if (previews.length > 0) {
    previewHTML = `
      <div class="brand-card__thumbs">
        ${previews
          .map(
            (url) => `
          <div class="brand-card__thumb-cell">
            <img src="${url}" alt="" loading="lazy" onerror="this.parentElement.style.background='#ede8e2'">
          </div>`
          )
          .join("")}
      </div>`;
  } else {
    previewHTML = `<div class="brand-card__no-preview"></div>`;
  }

  return `
    <div class="brand-card" data-brand="${encodeURIComponent(brand.id)}" role="button" tabindex="0">
      ${previewHTML}
      <div class="brand-card__info">
        <div class="brand-card__name">${brand.name}</div>
        <div class="brand-card__meta">
          <span class="brand-card__count">${brand.total}개</span>
          <span class="brand-card__date">${formatDate(brand.latest_mfg_date)}</span>
        </div>
      </div>
    </div>`;
}

export async function renderHome(app) {
  app.innerHTML = `
    <div class="home-header">
      <div class="home-header__logo">마이슈슈</div>
    </div>
    <div class="page">
      <div class="brand-grid" id="brand-grid">
        ${skeletonCards()}
      </div>
    </div>`;

  let brands;
  try {
    const res = await fetch("data/brands.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    brands = await res.json();
  } catch (e) {
    document.getElementById("brand-grid").innerHTML =
      `<div class="state-error" style="grid-column:1/-1">데이터를 불러오지 못했습니다.</div>`;
    return;
  }

  if (!brands.length) {
    document.getElementById("brand-grid").innerHTML =
      `<div class="state-empty" style="grid-column:1/-1">브랜드 정보가 없습니다.</div>`;
    return;
  }

  const grid = document.getElementById("brand-grid");
  grid.innerHTML = brands.map(brandCardHTML).join("");

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".brand-card");
    if (!card) return;
    location.hash = `#/brand/${card.dataset.brand}`;
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".brand-card");
      if (!card) return;
      location.hash = `#/brand/${card.dataset.brand}`;
    }
  });
}
