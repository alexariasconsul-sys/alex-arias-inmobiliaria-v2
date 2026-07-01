(function () {
  'use strict';
  var data = window.__PROP__;
  if (!data) return;

  // ── Registrar vista ─────────────────────────────────────────
  fetch('/api/properties/' + data.id + '/view', { method: 'POST' }).catch(function () {});

  // ── Lightbox ─────────────────────────────────────────────────
  var lightbox = document.getElementById('pdpLightbox');
  var lbImg    = document.getElementById('pdpLightboxImg');
  var lbCount  = document.getElementById('pdpLightboxCount');
  var images   = data.images || [];
  var lbIndex  = 0;

  function openLightbox(i) {
    if (!images.length) return;
    lbIndex = i;
    render();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function render() {
    lbImg.src = images[lbIndex];
    lbCount.textContent = (lbIndex + 1) + ' / ' + images.length;
  }
  function next() { lbIndex = (lbIndex + 1) % images.length; render(); }
  function prev() { lbIndex = (lbIndex - 1 + images.length) % images.length; render(); }

  document.querySelectorAll('[data-pdp-open-gallery]').forEach(function (el) {
    el.addEventListener('click', function () {
      openLightbox(parseInt(el.getAttribute('data-pdp-open-gallery'), 10) || 0);
    });
  });
  var closeBtn = document.getElementById('pdpLightboxClose');
  var nextBtn  = document.getElementById('pdpLightboxNext');
  var prevBtn  = document.getElementById('pdpLightboxPrev');
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (nextBtn)  nextBtn.addEventListener('click', next);
  if (prevBtn)  prevBtn.addEventListener('click', prev);
  if (lightbox) lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  // ── Descripción "ver más" ───────────────────────────────────
  var descToggle = document.getElementById('pdpDescToggle');
  var descText   = document.getElementById('pdpDescText');
  if (descToggle && descText) {
    descToggle.addEventListener('click', function () {
      var expanded = descText.classList.contains('is-clamped'); // estaba clampeado → lo vamos a expandir
      descText.classList.toggle('is-clamped', !expanded);
      descToggle.textContent = expanded ? 'Ver menos' : 'Ver más';
    });
  }

  // ── Me gusta (mismo mecanismo de deviceId que el catálogo) ───
  function getDeviceId() {
    var id = localStorage.getItem('deviceId');
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', id);
    }
    return id;
  }
  function getLikedIds() {
    try { return new Set(JSON.parse(localStorage.getItem('likedProperties') || '[]')); }
    catch (_) { return new Set(); }
  }
  function saveLikedIds(set) {
    localStorage.setItem('likedProperties', JSON.stringify(Array.from(set)));
  }
  function paintLikeButtons(isLiked) {
    document.querySelectorAll('[data-pdp-like]').forEach(function (btn) {
      btn.classList.toggle('is-liked', isLiked);
      var svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', isLiked ? '#E71433' : 'none');
        svg.setAttribute('stroke', isLiked ? '#E71433' : 'currentColor');
      }
    });
  }
  var liked = getLikedIds();
  paintLikeButtons(liked.has(String(data.id)));

  document.querySelectorAll('[data-pdp-like]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = String(data.id);
      var isLiked = liked.has(id);
      if (isLiked) liked.delete(id); else liked.add(id);
      saveLikedIds(liked);
      paintLikeButtons(!isLiked);
      fetch('/api/properties/' + id + '/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() })
      }).catch(function () {});
    });
  });

  // ── Compartir ────────────────────────────────────────────────
  document.querySelectorAll('[data-pdp-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: data.title, url: url }).catch(function () {});
      } else {
        navigator.clipboard.writeText(url).then(function () {
          btn.classList.add('is-liked');
          var label = btn.querySelector('.pdp-btn-label');
          var prevText = label ? label.textContent : null;
          if (label) label.textContent = '¡Copiado!';
          setTimeout(function () {
            btn.classList.remove('is-liked');
            if (label && prevText) label.textContent = prevText;
          }, 1800);
        }).catch(function () {});
      }
      fetch('/api/properties/' + data.id + '/share', { method: 'POST' }).catch(function () {});
    });
  });
})();
