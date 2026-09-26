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
        svg.setAttribute('fill', isLiked ? '#ef4444' : 'none');
        svg.setAttribute('stroke', isLiked ? '#ef4444' : 'currentColor');
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

  // ── Registro de leads (WhatsApp) — antes esta página no registraba
  // nada al hacer clic en WhatsApp, así que los contactos que llegaban
  // desde acá (incluyendo los del feed de Meta) quedaban invisibles en
  // las estadísticas. Misma lógica que usa el sitio principal (app.js).
  function _getCookie(name) {
    return document.cookie.split(';').map(function (c) { return c.trim(); })
      .find(function (c) { return c.indexOf(name + '=') === 0; })
      ?.split('=')[1] || undefined;
  }
  function _fbEventId(name) {
    return name + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }
  function getUTMParams() {
    var url = new URLSearchParams(window.location.search);
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('utm_params') || '{}'); } catch (_) {}
    var params = {
      utm_source:   url.get('utm_source')   || stored.utm_source   || '',
      utm_medium:   url.get('utm_medium')   || stored.utm_medium   || '',
      utm_campaign: url.get('utm_campaign') || stored.utm_campaign || '',
      utm_content:  url.get('utm_content')  || stored.utm_content  || ''
    };
    if (url.get('utm_source')) sessionStorage.setItem('utm_params', JSON.stringify(params));
    return params;
  }
  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }
  function _sendCAPI(eventName, customData, eventId) {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: eventName,
        eventId: eventId,
        customData: customData,
        fbp: _getCookie('_fbp'),
        fbc: _getCookie('_fbc') || new URLSearchParams(location.search).get('fbclid') || undefined,
        userAgent: navigator.userAgent,
        pageUrl: location.href
      })
    }).catch(function () {});
  }
  function trackWhatsAppLead(source) {
    var utm = getUTMParams();
    fetch('/api/leads/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propId: data.id || '',
        propTitle: data.title || '',
        propPrice: data.precio || 0,
        contactChannel: 'whatsapp',
        source: source,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_content: utm.utm_content,
        device: getDeviceType()
      })
    }).catch(function () {});

    if (typeof fbq !== 'function') return;
    var eid = _fbEventId('Lead');
    var ids = data.id ? [String(data.id)] : [];
    fbq('track', 'Lead', {
      content_ids: ids,
      content_type: 'product',
      content_name: data.title || 'Consulta general',
      content_category: 'inmobiliaria',
      value: data.precio || 0,
      currency: 'COP',
      eventID: eid
    });
    fbq('trackCustom', 'ContactWhatsApp', {
      content_ids: ids,
      content_name: data.title || '',
      value: data.precio || 0,
      currency: 'COP'
    });
    _sendCAPI('Lead', {
      content_ids: ids,
      content_type: 'product',
      content_name: data.title || 'Consulta general',
      value: data.precio || 0,
      currency: 'COP'
    }, eid);
  }
  var waDesktop = document.querySelector('.pdp-cta-wa');
  var waMobile  = document.querySelector('.pdp-mobile-cta');
  var waFooter  = document.querySelector('.pdp-footer-wa');
  if (waDesktop) waDesktop.addEventListener('click', function () { trackWhatsAppLead('pdp_whatsapp_desktop'); });
  if (waMobile)  waMobile.addEventListener('click',  function () { trackWhatsAppLead('pdp_whatsapp_mobile'); });
  if (waFooter)  waFooter.addEventListener('click',  function () { trackWhatsAppLead('pdp_whatsapp_footer'); });
})();
