/* ════════════════════════════════════════════════════════════
   CONTACT-MODAL.JS — Alex Arias · Consultor Inmobiliario
   Modal de contacto con dos caminos:
     1) "Escribir por WhatsApp ahora"  → abre el chat (como siempre)
     2) "Prefiero que me llamen"       → nombre + celular → admin
   Autocontenido (inyecta su propio CSS) para usarse en el sitio
   principal, la página de inmueble y el blog.
   Uso: openContactModal({ waUrl, source, propId, propTitle, propPrice })
═════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.openContactModal) return;

  var BRAND = '#0f766e', BRAND_DARK = '#115e59';

  var CSS = '' +
    '.cm-overlay{position:fixed;inset:0;z-index:9600;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .22s ease;font-family:inherit}' +
    '.cm-overlay.is-open{opacity:1}' +
    '.cm-card{position:relative;width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow-y:auto;background:#fff;border-radius:26px;box-shadow:0 24px 60px rgba(0,0,0,.28);padding:30px 26px 24px;transform:translateY(16px) scale(.97);transition:transform .3s cubic-bezier(.34,1.2,.64,1);color:#111}' +
    '.cm-overlay.is-open .cm-card{transform:none}' +
    '.cm-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;border-radius:50%;background:#f3f4f6;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
    '.cm-close:hover{background:#e5e7eb;color:#111}.cm-close svg{width:16px;height:16px}' +
    '.cm-title{font-size:19px;font-weight:800;letter-spacing:-.01em;margin:0 28px 4px 0;line-height:1.25}' +
    '.cm-sub{font-size:13.5px;color:#6b7280;margin:0 0 20px;line-height:1.5;overflow-wrap:anywhere}' +
    '.cm-opt{display:flex;align-items:center;gap:13px;width:100%;box-sizing:border-box;text-align:left;border-radius:16px;padding:14px 16px;font:inherit;cursor:pointer;text-decoration:none;transition:background .18s,border-color .18s,transform .12s}' +
    '.cm-opt:active{transform:scale(.99)}' +
    '.cm-opt svg{flex-shrink:0;width:24px;height:24px}' +
    '.cm-opt-t{display:block;font-size:15px;font-weight:700;line-height:1.25}' +
    '.cm-opt-s{display:block;font-size:12.5px;font-weight:500;margin-top:2px;opacity:.85}' +
    '.cm-opt-wa{background:' + BRAND + ';color:#fff;border:2px solid ' + BRAND + '}' +
    '.cm-opt-wa:hover{background:' + BRAND_DARK + ';border-color:' + BRAND_DARK + '}' +
    '.cm-opt-call{background:#fff;color:' + BRAND + ';border:2px solid ' + BRAND + ';margin-top:10px}' +
    '.cm-opt-call:hover,.cm-opt-call.is-active{background:#f0fdfa}' +
    '.cm-form{display:none;margin-top:14px}.cm-form.is-open{display:block}' +
    '.cm-field{display:block;margin-bottom:11px}' +
    '.cm-label{display:block;font-size:12.5px;font-weight:700;color:#374151;margin-bottom:5px}' +
    '.cm-input{width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px;color:#111;background:#fff;outline:none}' +
    '.cm-input:focus{border-color:' + BRAND + ';box-shadow:0 0 0 3px rgba(15,118,110,.12)}' +
    '.cm-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}' +
    '.cm-consent{display:flex;gap:9px;align-items:flex-start;font-size:12px;color:#6b7280;line-height:1.5;margin:4px 0 14px}' +
    '.cm-consent input{margin-top:2px;width:16px;height:16px;accent-color:' + BRAND + ';flex-shrink:0}' +
    '.cm-consent a{color:' + BRAND + ';font-weight:600}' +
    '.cm-error{display:none;background:#fef2f2;color:#b91c1c;font-size:13px;font-weight:600;border-radius:10px;padding:9px 12px;margin-bottom:12px}' +
    '.cm-error.is-on{display:block}' +
    '.cm-submit{width:100%;border:none;border-radius:999px;background:' + BRAND + ';color:#fff;font:inherit;font-size:15px;font-weight:700;padding:13px 18px;cursor:pointer}' +
    '.cm-submit:hover{background:' + BRAND_DARK + '}.cm-submit:disabled{opacity:.6;cursor:default}' +
    '.cm-done{text-align:center;padding:6px 0 2px}' +
    '.cm-done-ico{width:54px;height:54px;border-radius:50%;background:#dcfce7;color:#16a34a;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}' +
    '.cm-done-ico svg{width:28px;height:28px}' +
    '.cm-done .cm-title{margin:0 0 6px}.cm-done .cm-sub{margin-bottom:18px}' +
    '.cm-link{display:block;width:100%;background:none;border:none;color:#9ca3af;font:inherit;font-size:13px;font-weight:600;padding:12px 0 0;cursor:pointer}' +
    '.cm-link:hover{color:#6b7280}';

  var ICON_WA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  var ICON_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  function injectCSS() {
    if (document.getElementById('cm-style')) return;
    var s = document.createElement('style');
    s.id = 'cm-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── Helpers de tracking (misma lógica que el resto del sitio) ──
  function getUTMParams() {
    var url = new URLSearchParams(window.location.search), stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('utm_params') || '{}'); } catch (_) {}
    var p = {
      utm_source: url.get('utm_source') || stored.utm_source || '',
      utm_medium: url.get('utm_medium') || stored.utm_medium || '',
      utm_campaign: url.get('utm_campaign') || stored.utm_campaign || '',
      utm_content: url.get('utm_content') || stored.utm_content || ''
    };
    if (url.get('utm_source')) { try { sessionStorage.setItem('utm_params', JSON.stringify(p)); } catch (_) {} }
    return p;
  }
  function deviceType() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }
  function cookie(name) {
    var m = document.cookie.split(';').map(function (c) { return c.trim(); })
      .filter(function (c) { return c.indexOf(name + '=') === 0; })[0];
    return m ? m.split('=')[1] : undefined;
  }
  function price(v) { return Number(String(v == null ? '' : v).replace(/\D/g, '')) || 0; }
  function sendJSON(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function fireLeadPixel(ctx) {
    var eid = 'Lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    var ids = ctx.propId ? [String(ctx.propId)] : [];
    var data = { content_ids: ids, content_type: 'product', content_name: ctx.propTitle || 'Consulta general', value: price(ctx.propPrice), currency: 'COP' };
    if (typeof fbq === 'function') {
      fbq('track', 'Lead', Object.assign({ content_category: 'inmobiliaria', eventID: eid }, data));
    }
    sendJSON('/api/track', {
      eventName: 'Lead', eventId: eid, customData: data,
      fbp: cookie('_fbp'), fbc: cookie('_fbc') || new URLSearchParams(location.search).get('fbclid') || undefined,
      userAgent: navigator.userAgent, pageUrl: location.href
    }).catch(function () {});
  }
  function trackWhatsApp(ctx) {
    sendJSON('/api/leads/log', Object.assign({
      propId: ctx.propId || '', propTitle: ctx.propTitle || '', propPrice: price(ctx.propPrice),
      contactChannel: 'whatsapp', source: ctx.source || 'contact_modal', device: deviceType()
    }, getUTMParams())).catch(function () {});
    fireLeadPixel(ctx);
    if (typeof fbq === 'function') {
      fbq('trackCustom', 'ContactWhatsApp', { content_ids: ctx.propId ? [String(ctx.propId)] : [], content_name: ctx.propTitle || '', value: price(ctx.propPrice), currency: 'COP' });
    }
  }

  function normPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('57') === 0) d = d.slice(2);
    return (d.length === 10 && (d.charAt(0) === '3' || d.indexOf('60') === 0)) ? d : null;
  }
  function fmtPhone(d) { return d.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'); }

  var current = null; // { overlay, onKey, prevOverflow }

  function close() {
    if (!current) return;
    var c = current; current = null;
    document.removeEventListener('keydown', c.onKey);
    c.overlay.classList.remove('is-open');
    document.body.style.overflow = c.prevOverflow;
    setTimeout(function () { c.overlay.remove(); }, 230);
  }

  window.openContactModal = function (ctx) {
    ctx = ctx || {};
    injectCSS();
    if (current) close();
    var waUrl = ctx.waUrl || 'https://wa.me/573122588521';

    var overlay = document.createElement('div');
    overlay.className = 'cm-overlay';
    overlay.innerHTML =
      '<div class="cm-card" role="dialog" aria-modal="true" aria-labelledby="cmTitle">' +
        '<button type="button" class="cm-close" aria-label="Cerrar">' + ICON_X + '</button>' +
        '<div class="cm-main">' +
          '<h2 class="cm-title" id="cmTitle">¿Cómo prefieres que hablemos?</h2>' +
          '<p class="cm-sub"></p>' +
          '<a class="cm-opt cm-opt-wa" target="_blank" rel="noopener">' + ICON_WA +
            '<span><span class="cm-opt-t">Escribir por WhatsApp ahora</span><span class="cm-opt-s">Te responde Alex directamente</span></span></a>' +
          '<button type="button" class="cm-opt cm-opt-call" aria-expanded="false">' + ICON_PHONE +
            '<span><span class="cm-opt-t">Prefiero que me llamen</span><span class="cm-opt-s">Déjanos tu número y te llamamos</span></span></button>' +
          '<form class="cm-form" novalidate>' +
            '<label class="cm-field"><span class="cm-label">Tu nombre</span><input class="cm-input" name="name" type="text" autocomplete="name" maxlength="80" placeholder="Ej. María Pérez"></label>' +
            '<label class="cm-field"><span class="cm-label">Tu celular</span><input class="cm-input" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="Ej. 300 123 4567"></label>' +
            '<input class="cm-hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
            '<label class="cm-consent"><input type="checkbox" name="consent"><span>Autorizo el tratamiento de mis datos personales para que me contacten, de acuerdo con la <a href="/privacidad" target="_blank" rel="noopener">Política de Privacidad</a>.</span></label>' +
            '<div class="cm-error" role="alert"></div>' +
            '<button type="submit" class="cm-submit">Solicitar llamada</button>' +
          '</form>' +
        '</div>' +
      '</div>';

    var card = overlay.querySelector('.cm-card');
    var sub = overlay.querySelector('.cm-sub');
    if (ctx.propTitle) { sub.textContent = ctx.propTitle; } else { sub.textContent = 'Elige la opción que te quede más cómoda.'; }

    var waBtn = overlay.querySelector('.cm-opt-wa');
    waBtn.href = waUrl;
    waBtn.addEventListener('click', function () { trackWhatsApp(ctx); setTimeout(close, 60); });

    var callBtn = overlay.querySelector('.cm-opt-call');
    var form = overlay.querySelector('.cm-form');
    var errBox = overlay.querySelector('.cm-error');
    callBtn.addEventListener('click', function () {
      var open = !form.classList.contains('is-open');
      form.classList.toggle('is-open', open);
      callBtn.classList.toggle('is-active', open);
      callBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) setTimeout(function () { form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
    });

    function showError(msg) { errBox.textContent = msg; errBox.classList.add('is-on'); }
    form.addEventListener('input', function () { errBox.classList.remove('is-on'); });
    form.addEventListener('change', function () { errBox.classList.remove('is-on'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.classList.remove('is-on');
      var name = form.elements.name.value.trim();
      var phone = normPhone(form.elements.phone.value);
      if (name.length < 2) return showError('Escribe tu nombre.');
      if (!phone) return showError('Ingresa un celular válido de 10 dígitos (ej. 3001234567).');
      if (!form.elements.consent.checked) return showError('Debes autorizar el tratamiento de tus datos para continuar.');

      var btn = form.querySelector('.cm-submit');
      btn.disabled = true; btn.textContent = 'Enviando…';
      sendJSON('/api/contacts', Object.assign({
        name: name, phone: phone, consent: true, website: form.elements.website.value,
        propId: ctx.propId || '', propTitle: ctx.propTitle || '', propPrice: price(ctx.propPrice),
        source: ctx.source || 'contact_modal', device: deviceType()
      }, getUTMParams())).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (!res.ok) { btn.disabled = false; btn.textContent = 'Solicitar llamada'; return showError(res.j.error || 'No pudimos guardar tus datos. Intenta de nuevo.'); }
        fireLeadPixel(ctx);
        var main = overlay.querySelector('.cm-main');
        main.innerHTML =
          '<div class="cm-done"><div class="cm-done-ico">' + ICON_OK + '</div>' +
          '<h2 class="cm-title" id="cmTitle"></h2><p class="cm-sub"></p>' +
          '<a class="cm-opt cm-opt-wa" target="_blank" rel="noopener">' + ICON_WA +
            '<span><span class="cm-opt-t">Escribir por WhatsApp también</span><span class="cm-opt-s">Si prefieres no esperar la llamada</span></span></a>' +
          '<button type="button" class="cm-link">Cerrar</button></div>';
        main.querySelector('.cm-title').textContent = '¡Listo, ' + name.split(' ')[0] + '!';
        main.querySelector('.cm-sub').textContent = 'Alex te llamará pronto al ' + fmtPhone(phone) + '.';
        var wa2 = main.querySelector('.cm-opt-wa');
        wa2.href = waUrl;
        wa2.addEventListener('click', function () { trackWhatsApp(ctx); setTimeout(close, 60); });
        main.querySelector('.cm-link').addEventListener('click', close);
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Solicitar llamada';
        showError('No pudimos conectar. Revisa tu internet e intenta de nuevo.');
      });
    });

    overlay.querySelector('.cm-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    current = { overlay: overlay, onKey: onKey, prevOverflow: document.body.style.overflow };
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add('is-open'); }); });
  };
})();
