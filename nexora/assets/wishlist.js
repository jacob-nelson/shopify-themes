(function () {
  const STORAGE_KEY = 'nexora_wishlist_handles';

  function readHandles() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (h) {
        return typeof h === 'string' && h.length > 0;
      });
    } catch {
      return [];
    }
  }

  function writeHandles(handles) {
    const uniq = [];
    handles.forEach(function (h) {
      if (uniq.indexOf(h) === -1) uniq.push(h);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uniq));
    updateWishlistUi();
    document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: { count: uniq.length } }));
  }

  function toggleHandle(handle) {
    const list = readHandles();
    const i = list.indexOf(handle);
    if (i === -1) list.push(handle);
    else list.splice(i, 1);
    writeHandles(list);
  }

  function removeHandle(handle) {
    writeHandles(readHandles().filter(function (h) {
      return h !== handle;
    }));
  }

  function productJsonUrl(handle) {
    const root = window.routes && window.routes.root_url ? window.routes.root_url : '/';
    const base = root.endsWith('/') ? root : root + '/';
    return base + 'products/' + encodeURIComponent(handle) + '.js';
  }

  function formatMoney(cents) {
    const code = (window.wishlistCurrency || 'USD').toString();
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2) + ' ' + code;
    }
  }

  function minVariantCents(product) {
    if (!product || !product.variants || !product.variants.length) return 0;
    return Math.min.apply(
      null,
      product.variants.map(function (v) {
        return Number(v.price);
      })
    );
  }

  function updateWishlistUi() {
    const list = readHandles();
    document.querySelectorAll('.wishlist-btn[data-product-handle]').forEach(function (btn) {
      const h = btn.getAttribute('data-product-handle');
      const on = list.indexOf(h) !== -1;
      btn.classList.toggle('wishlist-btn--active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (window.wishlistStrings) {
        btn.setAttribute('aria-label', on ? window.wishlistStrings.remove : window.wishlistStrings.add);
      }
    });

    const link = document.getElementById('wishlist-icon-link');
    const bubble = link ? link.querySelector('.wishlist-count-bubble') : document.querySelector('.wishlist-count-bubble');
    if (bubble) {
      if (list.length > 0) {
        bubble.textContent = list.length < 100 ? String(list.length) : '99+';
        bubble.hidden = false;
      } else {
        bubble.textContent = '';
        bubble.hidden = true;
      }
    }
    if (link && window.wishlistStrings) {
      const t = window.wishlistStrings;
      const label =
        list.length > 0 && t.link_with_count
          ? String(t.link_with_count).replace('[count]', String(list.length))
          : t.title || link.getAttribute('aria-label');
      if (label) link.setAttribute('aria-label', label);
    }
  }

  let wishlistPageReload = null;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.wishlist-btn[data-product-handle]');
    if (btn) {
      e.preventDefault();
      toggleHandle(btn.getAttribute('data-product-handle'));
      return;
    }
    const rm = e.target.closest('.wishlist-remove[data-product-handle]');
    if (!rm) return;
    const pageRoot = document.getElementById('wishlist-page-root');
    if (!pageRoot || !pageRoot.contains(rm)) return;
    e.preventDefault();
    removeHandle(rm.getAttribute('data-product-handle'));
    if (typeof wishlistPageReload === 'function') wishlistPageReload();
  });

  function bindWishlistPage() {
    const root = document.getElementById('wishlist-page-root');
    if (!root) {
      wishlistPageReload = null;
      return;
    }

    const empty = document.getElementById('wishlist-empty');
    const loading = document.getElementById('wishlist-loading');
    const grid = document.getElementById('wishlist-grid');
    const strings = window.wishlistStrings || {};

    function render(list, products) {
      if (loading) loading.hidden = true;
      if (!list.length) {
        if (empty) empty.hidden = false;
        if (grid) {
          grid.innerHTML = '';
          grid.hidden = true;
        }
        return;
      }
      if (!products.length) {
        if (empty) empty.hidden = false;
        if (grid) {
          grid.innerHTML = '';
          grid.hidden = true;
        }
        return;
      }
      if (empty) empty.hidden = true;
      if (!grid) return;
      grid.hidden = false;

      grid.innerHTML = products
        .map(function (p) {
          const cents = minVariantCents(p);
          const img =
            typeof p.featured_image === 'string'
              ? p.featured_image
              : p.featured_image && p.featured_image.src
                ? p.featured_image.src
                : p.images && p.images[0]
                  ? typeof p.images[0] === 'string'
                    ? p.images[0]
                    : p.images[0].src
                  : '';
          const title = p.title || '';
          const handle = p.handle || '';
          const url = p.url || '/products/' + encodeURIComponent(handle);
          const price = formatMoney(cents);
          const imgAlt = (strings.product_image_alt || '').replace('[title]', title);
          return (
            '<div class="wishlist-card">' +
            (img
              ? '<a class="wishlist-card__media" href="' +
                url +
                '"><img src="' +
                img +
                '" alt="' +
                escapeAttr(title) +
                '" loading="lazy" width="533" height="533"></a>'
              : '') +
            '<div class="wishlist-card__info">' +
            '<a class="wishlist-card__title h5" href="' +
            url +
            '">' +
            escapeHtml(title) +
            '</a>' +
            '<p class="wishlist-card__price">' +
            escapeHtml(price) +
            '</p>' +
            '<div class="wishlist-card__actions">' +
            '<a class="button button--secondary" href="' +
            url +
            '">' +
            escapeHtml(strings.view_product || 'View') +
            '</a>' +
            '<button type="button" class="button button--tertiary wishlist-remove" data-product-handle="' +
            escapeAttr(handle) +
            '">' +
            escapeHtml(strings.remove_from_wishlist || 'Remove') +
            '</button>' +
            '</div></div></div>'
          );
        })
        .join('');
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
      return escapeHtml(str).replace(/'/g, '&#39;');
    }

    async function load() {
      const list = readHandles();
      if (!list.length) {
        render([], []);
        return;
      }
      if (loading) loading.hidden = false;

      const kept = [];
      const products = [];
      for (let i = 0; i < list.length; i++) {
        const handle = list[i];
        try {
          const res = await fetch(productJsonUrl(handle));
          if (!res.ok) continue;
          const p = await res.json();
          kept.push(handle);
          products.push(p);
        } catch {
          /* skip */
        }
      }

      if (kept.length !== list.length) {
        writeHandles(kept);
      }

      render(kept, products);
    }

    wishlistPageReload = load;
    load();
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateWishlistUi();
    bindWishlistPage();
  });

  document.addEventListener('shopify:section:load', function () {
    updateWishlistUi();
    bindWishlistPage();
  });
})();
