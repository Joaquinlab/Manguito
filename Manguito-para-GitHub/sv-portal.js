(function(){var o=window.fetch.bind(window);window.fetch=function(u,opt){opt=opt||{};opt.headers=Object.assign({},opt.headers||{},{"X-Requested-With":"sv"});return o(u,opt);};})();
(function () {
  // En localhost usamos rutas relativas; en GitHub Pages, el backend local del usuario.
  var API = (function () {
    var h = location.hostname;
    var isLocal = (h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:');
    return isLocal ? '/api' : 'http://localhost:3000/api';
  })();
  var STEPS = ['Recibido', 'En negociación', 'Esperando pago', 'Procesada'];

  var STEP_META = [
    { name: 'Recibido',       icon: 'description', bg: 'bg-sky-500/10',    text: 'text-sky-400',     border: 'border-sky-500/40' },
    { name: 'En negociación', icon: 'sync',        bg: 'bg-amber-400/15',  text: 'text-amber-400',   border: 'border-amber-400/40' },
    { name: 'Esperando pago', icon: 'payments',    bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/40' },
    { name: 'Procesada',      icon: 'task_alt',    bg: 'bg-tertiary/15',   text: 'text-tertiary',    border: 'border-tertiary/30' }
  ];

  var SV_CANCELLED_META = { name: 'Cancelada', icon: 'cancel', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/40' };

  function safe(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]);
    });
  }

  function datefmt(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }

  function money(v) {
    if (v == null || v === '') return '';
    var n = Number(v);
    if (isNaN(n)) return String(v);
    try { return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch (e) { return String(n); }
  }

  function svReduceMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  var svCountSeq = 0;
  function svCountTo(el, from, to, dur) {
    if (!el) return;
    from = Number(from) || 0;
    to = Number(to) || 0;
    var my = ++svCountSeq;
    if (svReduceMotion() || from === to) { el.textContent = '$' + money(to); return; }
    el.textContent = '$' + money(Math.round(from));
    var t0 = null;
    function step(ts) {
      if (my !== svCountSeq) return;
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      if (p >= 1) { el.textContent = '$' + money(to); return; }
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = '$' + money(Math.round(from + (to - from) * e));
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderSavingTotal(total) {
    var el = document.getElementById('kpi-saving-total');
    if (!el) return;
    total = Number(total) || 0;
    var prev = (typeof window.__svSavingShown === 'number') ? window.__svSavingShown : null;
    window.__svSavingShown = total;
    if (prev === null) svCountTo(el, 0, total, 1500);
    else if (total > prev) svCountTo(el, prev, total, 950);
    else { svCountSeq++; el.textContent = '$' + money(total); }
  }

  function stepIndex(step) {
    var s = String(step || 'Recibido').toLowerCase();
    if (s.indexOf('procesada') !== -1 || s.indexOf('con ahorro') !== -1) return 3;
    if (s.indexOf('esperando pago') !== -1 || s.indexOf('pago') !== -1) return 2;
    if (s.indexOf('negociac') !== -1) return 1;
    return 0;
  }

  function commissionPercent() {
    var p = Number((window.__svPaymentSettings || {}).commission_percent);
    return (isNaN(p) || p <= 0) ? 15 : p;
  }

  function pctFor(t) {
    var p = Number(t && t.commission_pct);
    if (!isNaN(p) && p > 0) return p;
    return commissionPercent();
  }

  function buildBannerHeadline(pending, providers, totalSaving) {
    if (pending.length === 1 && pending[0].provider_name) {
      return pending[0].provider_name + ': ahorrás $' + money(totalSaving);
    }
    if (providers.length === 1) {
      return providers[0] + ': ahorrás $' + money(totalSaving);
    }
    return 'Tus ' + pending.length + ' gestiones: ahorro estimado $' + money(totalSaving);
  }

  function buildBannerSubtext(pending, providers, pendingTotal, totalSaving) {
    if (pending.length === 1) {
      return 'Aboná la comisión de éxito ($' + money(pendingTotal) + ') para aplicar el descuento final con la compañía.';
    }
    if (providers.length === 1) {
      return 'Tenés ' + pending.length + ' gestiones listas para pagar: comisión total $' + money(pendingTotal) + '.';
    }
    return 'Tenés ' + pending.length + ' gestiones listas para pagar: comisión total $' + money(pendingTotal) + ' · Ahorro estimado $' + money(totalSaving) + '.';
  }

  async function fetchJson(url) {
    var r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return [];
    return r.json().catch(function () { return []; });
  }

  function showMsg(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else alert(msg);
  }

  // Tarjeta contenedora con el mismo lenguaje visual del portal (glass + sombra).
  function card(inner) {
    return '<section class="p-5 sm:p-6 flex flex-col gap-4 relative overflow-hidden" ' +
      'style="border-radius:20px; background:rgba(23,19,15,0.72); border:1px solid rgba(251,247,240,0.09); ' +
      'box-shadow:rgba(0,0,0,0.55) 0 16px 36px -10px, rgba(255,255,255,0.06) 0 1px 0 0 inset; backdrop-filter:blur(16px);">' +
      inner + '</section>';
  }

  function cardTitle(icon, text, accent) {
    return '<h2 class="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[22px] ' + (accent || 'text-primary') + '">' + safe(icon) + '</span>' +
      safe(text) + '</h2>';
  }

  function sectionSkeleton() {
    return '<div class="space-y-3">' +
      '<div class="h-[86px] rounded-2xl bg-surface-container-high/50 animate-pulse"></div>' +
      '<div class="h-[86px] rounded-2xl bg-surface-container-high/40 animate-pulse"></div>' +
      '<div class="h-[86px] rounded-2xl bg-surface-container-high/30 animate-pulse"></div>' +
      '</div>';
  }

  function emptyState(icon, title, text) {
    return '<div class="flex flex-col items-center justify-center text-center gap-2 py-8 px-4 rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container/30">' +
      '<span class="material-symbols-outlined text-[34px] text-outline">' + safe(icon) + '</span>' +
      '<div class="font-semibold text-on-surface text-sm">' + safe(title) + '</div>' +
      (text ? '<div class="text-xs text-on-surface-variant max-w-xs leading-relaxed">' + safe(text) + '</div>' : '') +
      '</div>';
  }

  // Evita el "flash" de datos demo del HTML mientras se resuelve /auth/me.
  function renderSkeleton() {
    removeDemoBlocks();
    var left = document.querySelector('main .lg\\:col-span-8');
    if (!left || left.getAttribute('data-sv-ready')) return;
    left.innerHTML =
      '<section class="flex flex-col gap-3 pb-2 border-b border-outline-variant/30">' +
        '<div class="h-8 w-64 max-w-full rounded-xl bg-surface-container-high/60 animate-pulse"></div>' +
        '<div class="h-4 w-80 max-w-full rounded-lg bg-surface-container-high/40 animate-pulse"></div>' +
      '</section>' +
      card('<div class="h-5 w-48 rounded-lg bg-surface-container-high/50 animate-pulse"></div>' + sectionSkeleton()) +
      card('<div class="h-5 w-48 rounded-lg bg-surface-container-high/50 animate-pulse"></div>' + sectionSkeleton());
  }

  function buildShell(fullName, email) {
    var left = document.querySelector('main .lg\\:col-span-8');
    if (!left) return;
    left.dataset.svReady = '1';
    left.innerHTML =
      '<section class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">' +
        '<h1 class="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight" style="font-size:clamp(1.7rem,3.2vw,2.4rem);letter-spacing:-0.03em;">¡Hola, <span style="background:linear-gradient(120deg,#FBBF24 0%,#F97316 46%,#FB7185 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">' + safe(fullName) + '</span>!</h1>' +
        '<p class="font-body-md text-body-md text-on-surface-variant mt-1">Acá ves tus gestiones de ahorro, tus facturas y el avance de cada trámite.</p>' +
      '</section>' +
      '<div id="sinvueltas-resumen">' + sectionSkeleton() + '</div>' +
      card(cardTitle('track_changes', 'Mis gestiones de ahorro', 'text-primary') +
        '<div id="sinvueltas-tickets">' + sectionSkeleton() + '</div>') +
      card(cardTitle('receipt_long', 'Mis facturas subidas', 'text-secondary') +
        '<div id="sinvueltas-invoices">' + sectionSkeleton() + '</div>');
  }

  function emptyBox(icon, title, text) {
    return '<div class="flex flex-col items-center text-center gap-2 py-8 px-4 rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container/30">' +
      '<span class="material-symbols-outlined text-[34px] text-outline">' + safe(icon) + '</span>' +
      '<div class="font-semibold text-on-surface text-sm">' + safe(title) + '</div>' +
      (text ? '<div class="text-xs text-on-surface-variant max-w-xs">' + safe(text) + '</div>' : '') +
    '</div>';
  }

  function renderResumen(tickets, invoices) {
    var box = document.getElementById('sinvueltas-resumen');
    if (!box) return;
    tickets = Array.isArray(tickets) ? tickets : [];
    invoices = Array.isArray(invoices) ? invoices : [];
    if (!tickets.length && !invoices.length) {
      box.innerHTML =
        '<div class="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-tertiary/15 via-primary/10 to-surface-container-low border border-tertiary/40 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style="border-radius:20px;">' +
          '<div><div class="font-headline-sm text-lg font-bold text-on-surface">Empezá a ahorrar hoy</div>' +
          '<p class="text-sm text-on-surface-variant mt-1">Subí tu primera factura y negociamos una rebaja por vos.</p></div>' +
          '<button type="button" onclick="document.getElementById(\'invoice-file-input\').click()" class="px-6 py-2.5 rounded-full text-white text-sm font-bold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all" style="background:linear-gradient(135deg,#F59E0B,#F97316 55%,#EA580C);border:1px solid rgba(251,191,36,0.45);box-shadow:0 4px 16px -2px rgba(249,115,22,0.55);">Subir mi primera factura</button>' +
        '</div>';
      return;
    }
    var active = tickets.filter(function (x) { return !isCancelled(x); });
    var total = 0, top = null, topSaving = -1;
    active.forEach(function (t) {
      var s = Number(t.estimated_saving) || 0;
      total += s;
      if (s > topSaving) { topSaving = s; top = t; }
    });
    if (!top && active.length) { top = active[0]; topSaving = 0; }
    var pending = [], pendingTotal = 0, pi = 0;
    for (pi = 0; pi < tickets.length; pi++) {
      if (!isPayable(tickets[pi])) continue;
      pending.push(tickets[pi]);
      pendingTotal += payNumbers(tickets[pi]).comm;
    }
    var pendingSaving = 0, providers = [], pj = 0;
    for (pj = 0; pj < pending.length; pj++) {
      pendingSaving += Number(pending[pj].estimated_saving) || 0;
      var pn = String(pending[pj].provider_name || '').trim();
      if (pn && providers.indexOf(pn) === -1) providers.push(pn);
    }
    var headlineSaving = pendingSaving > 0 ? pendingSaving : (topSaving > 0 ? topSaving : 0);
    var payBtnInner = '<span class="material-symbols-outlined text-[22px]">credit_card</span><span><span style="display:block;font-size:0.85rem;font-weight:800;line-height:1.25;">Pagar comisión</span><span style="display:block;font-size:0.8rem;font-weight:700;line-height:1.25;opacity:0.95;">($' + safe(money(pendingTotal)) + ')</span></span>';
    var payBtnCls = 'text-white cursor-pointer inline-flex items-center gap-2.5';
    var payBtnStyle = 'background:linear-gradient(180deg,#34D399 0%,#10B981 50%,#059669 100%);border:1px solid rgba(134,239,172,0.4);box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 4px 14px -6px rgba(4,120,87,0.9);border-radius:14px;min-width:200px;padding:0.7rem 1.5rem;justify-content:center;';
    var cta = (pendingTotal > 0)
      ? '<div class="flex items-center gap-3 w-full md:w-auto">' +
        '<button type="button" class="' + payBtnCls + '" style="' + payBtnStyle + '" onclick="openPayModalTotal()">' + payBtnInner + '</button>' +
        '</div>'
      : '';
    var inv = null, k = 0;
    for (k = 0; k < invoices.length; k++) {
      if (invoices[k].parsed_amount != null && invoices[k].parsed_amount !== '') { inv = invoices[k]; break; }
    }
    if (!inv && invoices.length) inv = invoices[0];
    var banner = (pendingTotal > 0) ?
      '<div class="p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style="border-radius:20px;background:linear-gradient(135deg, rgba(52,211,153,0.16) 0%, rgba(52,211,153,0.05) 45%, rgba(19,19,23,0.97) 100%);border:1px solid rgba(52,211,153,0.55);box-shadow:0 0 28px rgba(52,211,153,0.14), 0 20px 45px -12px rgba(0,0,0,0.8);">' +
        '<div class="flex items-center gap-3.5 min-w-0">' +
          '<div style="width:3rem;height:3rem;border-radius:0.9rem;display:grid;place-items:center;flex-shrink:0;background:rgba(52,211,153,0.2);border:1px solid rgba(52,211,153,0.45);box-shadow:0 0 16px rgba(52,211,153,0.25);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 3h1c0-1.3 1-2 2-2s2 .7 2 2h5c2 0 2-2 2-3 2 0 2-7 0-7z"></path><path d="M2 9v1c0 1.1.9 2 2 2h1"></path><path d="M16 11h.01"></path></svg></div>' +
          '<div class="min-w-0"><div class="flex items-center gap-2 flex-wrap">' +
            '<span style="display:inline-flex;align-items:center;padding:0.28rem 0.8rem;border-radius:9999px;font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;background:#34D399;color:#052e22;">¡Descuento conseguido!</span>' +
            '<span style="color:#34D399;font-size:0.8rem;font-weight:700;">Paso 3 de 4</span></div>' +
            '<h2 class="font-headline-sm text-[18px] sm:text-headline-sm font-bold text-on-surface mt-0.5">' + safe(buildBannerHeadline(pending, providers, pendingSaving)) + '</h2>' +
            '<p class="text-xs sm:text-sm text-on-surface-variant">' + safe(buildBannerSubtext(pending, providers, pendingTotal, headlineSaving)) + '</p></div>' +
        '</div>' + cta +
      '</div>' : '';
    var kpiInv = inv && inv.parsed_amount != null && inv.parsed_amount !== ''
      ? '<div class="flex items-baseline gap-2.5 mt-2"><span class="font-metric-display text-[38px] font-bold text-on-surface tracking-tight leading-none">$' + safe(money(inv.parsed_amount)) + '</span></div>' +
        '<div class="text-sm text-on-surface-variant mt-2">' + safe(inv.provider_name || 'Factura') + ' · en gestión de ahorro</div>'
      : '<div class="font-metric-display text-[38px] font-bold text-on-surface tracking-tight leading-none mt-2">—</div>' +
        '<div class="text-sm text-on-surface-variant mt-2">Todavía sin facturas con monto</div>';
    box.innerHTML = banner +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">' +
        '<div class="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/60" style="border-radius:20px;">' +
          '<div class="flex items-center justify-between"><span class="text-sm text-outline font-medium">Ahorro Total Acumulado</span>' +
          '<span class="p-2 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">savings</span></span></div>' +
          '<div id="kpi-saving-total" class="font-metric-display text-[38px] font-bold text-tertiary tracking-tight leading-none mt-2">$' + safe(money(total)) + '</div>' +
          '<div class="text-sm text-on-surface-variant mt-2">' + active.length + (active.length === 1 ? ' gestión' : ' gestiones') + ' · Sin comisiones si no hay ahorro</div>' +
        '</div>' +
        '<div class="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/60" style="border-radius:20px;">' +
          '<div class="flex items-center justify-between"><span class="text-sm text-outline font-medium">Próxima Factura Bonificada</span>' +
          '<span class="p-2 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">calendar_today</span></span></div>' +
          kpiInv +
        '</div>' +
      '</div>';
    renderSavingTotal(total);
  }

  function payNumbers(t) {
    var total = Number(t.estimated_saving) || 0;
    var months = Number(t.saving_months) > 0 ? Number(t.saving_months) : 6;
    var monthly = months > 0 ? total / months : 0;
    var pct = pctFor(t);
    var comm = (t.commission_amount != null && t.commission_amount !== '')
      ? Number(t.commission_amount)
      : total * pct / 100;
    if (isNaN(comm)) comm = 0;
    var antes = (t.amount != null && t.amount !== '') ? Number(t.amount) : null;
    return { total: total, months: months, monthly: monthly, pct: pct, comm: comm, antes: antes, ahora: (antes != null ? antes - monthly : null) };
  }

  function isPayable(t) {
    if (!t) return false;
    var ps = String(t.payment_status || '');
    if (ps === 'pagado' || ps === 'reembolsado' || ps === 'cancelado') return false;
    if (stepIndex(t.current_step) !== 2) return false;
    return payNumbers(t).comm > 0;
  }

  function isCancelled(t) {
    return !!t && String(t.payment_status || '') === 'cancelado';
  }

  var PAY_STEP_NOTES = [
    'Analizando y validando tu última factura.',
    'Negociando con tu proveedor para aplicar la rebaja.',
    'Apenas pagás la comisión, aplicamos el descuento.',
    'Descuento activo en tu factura.'
  ];
  var PAY_STEP_SUBS = ['Verificada', 'Aprobada', 'Te toca a vos', 'Ya pagás menos'];

  window.openPayModalFor = function (ticketId) {
    var list = window.__svTickets || [];
    var t = null, i = 0;
    for (i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(ticketId)) { t = list[i]; break; }
    }
    if (!t) { openPagarComisionModal(); return; }
    window.__svPayLink = t.payment_link || ((window.__svPaymentSettings || {}).payment_link || '');
    var mpBig = document.getElementById('btn-mp-checkout');
    if (mpBig) { mpBig.style.display = ''; }
    var prevList = document.getElementById('paym-list');
    if (prevList) { prevList.classList.add('hidden'); prevList.classList.remove('flex'); prevList.innerHTML = ''; }
    var prevBreak = document.getElementById('paym-totbreak');
    if (prevBreak) { prevBreak.classList.add('hidden'); prevBreak.classList.remove('flex'); }
    var stepCard = document.getElementById('paym-stepcard');
    if (stepCard) stepCard.style.display = '';
    var amountCard = document.getElementById('paym-amountcard');
    if (amountCard) amountCard.style.display = '';
    var rc = document.getElementById('paym-rightcol');
    if (rc) { rc.style.alignSelf = ''; rc.style.justifyContent = ''; }
    var n = payNumbers(t);
    var set = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    set('paym-provider', (t.provider_name || 'Tu servicio') + ' · Internet');
    set('paym-for', 'Te ahorramos en ' + (t.provider_name || 'tu proveedor') + ', en ' + n.months + ' meses');
    set('paym-total', '$' + money(n.total));
    set('paym-total2', '$' + money(n.total));
    set('paym-monthly', '$' + money(n.monthly) + ' menos por mes, todos los meses');
    set('paym-monthly2', '$' + money(n.monthly));
    set('paym-comm', '$' + money(n.comm));
    set('paym-net', '$' + money(n.total - n.comm));
    set('paym-mp-label', 'Pagar $' + money(n.comm) + ' con Mercado Pago');
    set('paym-pct', n.pct + '% de tu ahorro · un solo cobro');
    var baRow = document.getElementById('paym-beforeafter');
    if (n.antes != null && n.ahora != null && n.ahora >= 0) {
      if (baRow) baRow.style.display = '';
      set('paym-before', '$' + money(n.antes));
      set('paym-now', '$' + money(n.ahora));
    } else if (baRow) {
      baRow.style.display = 'none';
    }
    var idx = Math.max(0, Math.min(3, stepIndex(t.current_step)));
    set('paym-steptitle', 'Estás en el paso ' + (idx + 1) + ' de 4: ' + STEP_META[idx].name);
    var note = document.getElementById('paym-stepnote');
    if (note) note.innerHTML = '<span class="relative flex items-center justify-center w-2.5 h-2.5"><span class="absolute inset-0 rounded-full bg-[#10B981] pointer-events-none"></span><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 relative z-10"></span></span>' + safe(PAY_STEP_NOTES[idx]);
    var grid = document.getElementById('paym-steps');
    if (grid) {
      grid.innerHTML = STEP_META.map(function (m, k) {
        var state = k < idx ? 'done' : (k === idx ? 'current' : 'todo');
        var circ = state === 'done'
          ? 'bg-emerald-400 text-emerald-950'
          : (state === 'current' ? 'bg-emerald-400 text-emerald-950 emerald-pulse-glow-green' : 'bg-surface-container text-outline border-outline-variant');
        var ic = state === 'done' ? 'check' : (state === 'current' ? m.icon : String(k + 1));
        var lab = state === 'done' ? 'text-on-surface' : (state === 'current' ? 'text-on-surface' : 'text-outline');
        var sub = state === 'done' ? 'text-emerald-400' : (state === 'current' ? 'text-emerald-400' : 'text-outline');
        return '<div class="flex flex-col items-center gap-1' + (state === 'todo' ? ' opacity-50' : '') + '">' +
          '<div class="relative flex items-center justify-center">' +
          '<div class="w-6 h-6 rounded-full flex items-center justify-center relative z-10 ' + circ + '">' +
          '<span class="material-symbols-outlined text-[13px]">' + ic + '</span></div></div>' +
          '<span class="text-[10px] font-semibold ' + lab + '">' + (k + 1) + '. ' + safe(m.name) + '</span>' +
          '<span class="text-[9px] font-medium ' + sub + '">' + PAY_STEP_SUBS[k] + '</span></div>';
      }).join('');
    }
    openPagarComisionModal();
  };

  window.openPayModalTotal = function () {
    var list = (window.__svTickets || []).filter(isPayable);
    if (!list.length) { openPagarComisionModal(); return; }
    if (list.length === 1) { window.openPayModalFor(list[0].id); return; }
    var total = 0, monthly = 0, commTot = 0, i = 0;
    for (i = 0; i < list.length; i++) {
      var n = payNumbers(list[i]);
      total += n.total;
      monthly += n.monthly;
      commTot += n.comm;
    }
    var global = (window.__svPaymentSettings || {}).payment_link || '';
    var common = '', allSame = true;
    for (i = 0; i < list.length; i++) {
      var lk = list[i].payment_link || global || '';
      if (!lk) { allSame = false; break; }
      if (i === 0) common = lk;
      else if (common !== lk) { allSame = false; break; }
    }
    if (!allSame) common = '';
    var set = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    set('paym-provider', list.length + ' gestiones listas para pagar');
    set('paym-for', 'Te ahorramos en ' + list.length + ' gestiones');
    set('paym-total', '$' + money(total));
    set('paym-total2', '$' + money(total));
    set('paym-monthly', '$' + money(monthly) + ' menos por mes, todos los meses');
    set('paym-monthly2', '$' + money(monthly));
    set('paym-comm', '$' + money(commTot));
    set('paym-net', '$' + money(total - commTot));
    set('paym-comm2', '$' + money(commTot));
    set('paym-net2', '$' + money(total - commTot));
    set('paym-pct', commissionPercent() + '% de tu ahorro · un solo cobro');
    set('paym-summlabel', 'Comisión de éxito (' + commissionPercent() + '% del ahorro)');
    set('paym-mp-label', 'Pagar $' + money(commTot) + ' con Mercado Pago');
    var baRow = document.getElementById('paym-beforeafter');
    if (baRow) baRow.style.display = 'none';
    var stepCard = document.getElementById('paym-stepcard');
    if (stepCard) stepCard.style.display = 'none';
    var amountCard = document.getElementById('paym-amountcard');
    if (amountCard) amountCard.style.display = 'none';
    var brk = document.getElementById('paym-totbreak');
    if (brk) { brk.classList.remove('hidden'); brk.classList.add('flex'); }
    var lst = document.getElementById('paym-list');
    if (lst) {
      lst.innerHTML = list.map(function (t) {
        var n2 = payNumbers(t);
        var hasLk = !!(t.payment_link || global);
        var ini = String(t.provider_name || 'G').trim().charAt(0).toUpperCase() || 'G';
        return '<div class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/35 cursor-pointer transition-colors hover:bg-surface-container/70" onclick="goToTicketCard(\'' + safe(t.id) + '\')" title="Ir a esta gestión en el portal">' +
          '<span class="w-7 h-7 shrink-0 rounded-full grid place-items-center text-[11px] font-extrabold" style="background:rgba(52,211,153,0.13);border:1px solid rgba(52,211,153,0.3);color:#34D399;">' + safe(ini) + '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<div class="text-xs font-semibold text-on-surface truncate">' + safe(t.provider_name || 'Gestión') + '</div>' +
            '<div class="text-[10px] font-semibold inline-flex items-center gap-0.5 ' + (hasLk ? 'text-emerald-400' : 'text-amber-400') + '"><span class="underline decoration-dotted underline-offset-2">' + (hasLk ? 'Listo para pagar' : 'Link pendiente') + '</span><span class="material-symbols-outlined text-[12px]">chevron_right</span></div>' +
          '</div>' +
          '<div class="text-right shrink-0">' +
            '<div class="font-mono text-xs font-bold text-on-surface">$' + safe(money(n2.comm)) + '</div>' +
            '<div class="text-[9px] text-outline leading-tight">comisión</div>' +
          '</div>' +
        '</div>';
      }).join('');
      lst.classList.remove('hidden');
      lst.classList.add('flex');
    }
    window.__svPayLink = common || '';
    var rc2 = document.getElementById('paym-rightcol');
    if (rc2) { rc2.style.alignSelf = 'stretch'; rc2.style.justifyContent = 'center'; }
    var mpBtn2 = document.getElementById('btn-mp-checkout');
    if (mpBtn2) { mpBtn2.style.display = ''; mpBtn2.style.opacity = ''; mpBtn2.title = ''; }
    openPagarComisionModal();
  };

  function paintTracker(pos) {
    var list = window.__svTickets || [];
    var dotsBox = document.getElementById('tracker-dots-container');
    var section = dotsBox ? dotsBox.closest('section') : null;
    if (!list.length) { if (section) section.style.display = 'none'; return; }
    if (section) section.style.display = '';
    pos = ((pos % list.length) + list.length) % list.length;
    window.__svTrackPos = pos;
    var t = list[pos];
    var trackCancelled = isCancelled(t);
    var idx = Math.max(0, Math.min(3, stepIndex(t.current_step)));
    var meta = trackCancelled ? SV_CANCELLED_META : STEP_META[idx];
    var n = payNumbers(t);
    var iconBox = document.getElementById('tracker-icon-container');
    if (iconBox) iconBox.className = 'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ' + meta.bg + ' ' + meta.text + ' ' + meta.border;
    var icon = document.getElementById('tracker-main-icon');
    if (icon) icon.textContent = meta.icon;
    var title = document.getElementById('tracker-company-title');
    if (title) title.textContent = (t.provider_name || 'Gestión de ahorro');
    var badge = document.getElementById('tracker-status-badge');
    if (badge) {
      badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-all ' + meta.bg + ' ' + meta.text + ' ' + meta.border;
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>' + safe(meta.name);
    }
    var sub = document.getElementById('tracker-subtitle');
    if (sub) {
      var bits = 'Gestión #' + String(t.id || '').slice(0, 8);
      bits += (t.amount != null && t.amount !== '') ? ' · Factura $' + money(t.amount) : '';
      if (n.total > 0 && !trackCancelled) bits += ' · Ahorro $' + money(n.total);
      sub.textContent = bits;
    }
    var ind = document.getElementById('tracker-state-indicator');
    if (ind) ind.textContent = 'Ticket ' + (pos + 1) + '/' + list.length;
    var stepper = document.getElementById('tracker-stepper-container');
    if (stepper) {
      var head = '<div class="flex items-center justify-between text-[13px] gap-3 flex-wrap"><span class="font-semibold text-on-surface">Estás en el paso ' + (idx + 1) + ' de 4: ' + safe(meta.name) + '</span>' +
        '<span class="text-tertiary font-bold flex items-center gap-2"><span class="relative flex items-center justify-center w-3 h-3"><span class="absolute inset-0 rounded-full bg-[#F97316] pointer-events-none" style="animation:svStepPulseRing 2s cubic-bezier(0,0.2,0.8,1) infinite;"></span><span class="w-2 h-2 rounded-full bg-tertiary relative z-10"></span></span>' + safe(PAY_STEP_NOTES[idx]) + '</span></div>';
      var items = STEP_META.map(function (m, k) {
        var state = k < idx ? 'done' : (k === idx ? 'current' : 'todo');
        var dot = state === 'done'
          ? '<span class="absolute inset-0 rounded-full bg-[#F97316] pointer-events-none" style="animation:svStepPulseRing 2s cubic-bezier(0,0.2,0.8,1) infinite;"></span><div class="w-6 h-6 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center text-xs font-bold relative z-10" style="box-shadow:0 0 12px rgba(251,191,36,0.45);"><span class="material-symbols-outlined text-[14px]">check</span></div>'
          : (state === 'current'
            ? '<span class="absolute inset-0 rounded-full pointer-events-none" style="border:2px solid currentColor;animation:svStepPulseRing 2s cubic-bezier(0,0.2,0.8,1) infinite;"></span><div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold relative z-10 sv-step-current ' + m.bg + ' ' + m.text + ' ' + m.border + '"><span class="material-symbols-outlined text-[14px]">' + m.icon + '</span></div>'
            : '<div class="w-6 h-6 rounded-full bg-surface-container text-outline border border-outline-variant/40 flex items-center justify-center text-xs font-bold relative z-10"><span class="material-symbols-outlined text-[14px]">' + m.icon + '</span></div>');
        var nm = state === 'done' ? 'text-on-surface' : (state === 'current' ? m.text : 'text-outline');
        var sb = state === 'todo' ? 'text-outline' : m.text;
        return '<div class="flex items-center gap-2.5 p-2.5 rounded-xl relative"><div class="relative flex items-center justify-center shrink-0 ' + m.text + '">' + dot + '</div>' +
          '<div><span class="font-label-sm text-on-surface font-semibold block">' + (k + 1) + '. ' + safe(m.name) + '</span><span class="text-[11px] font-medium ' + sb + '">' + safe(PAY_STEP_NOTES[k]) + '</span></div></div>';
      }).join('');
      stepper.innerHTML = trackCancelled ? '<div class="flex items-center gap-2 text-sm text-on-surface-variant"><span class="material-symbols-outlined text-[18px] text-outline">block</span>Esta gestión fue cancelada: no se cobra comisión de éxito.</div>' : '<div class="flex flex-col gap-3">' + head + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">' + items + '</div></div>';
    }
    if (dotsBox) {
      dotsBox.innerHTML = list.map(function (x, k) {
        var on = k === pos;
        return '<button type="button" onclick="paintTracker(' + k + ')" class="' + (on ? 'w-6 h-3' : 'w-3 h-3') + ' rounded-full transition-all cursor-pointer ' + (on ? 'bg-secondary shadow-sm' : 'bg-outline-variant hover:bg-tertiary') + '" title="' + safe((x.provider_name || 'Gestión') + ' · ' + (isCancelled(x) ? SV_CANCELLED_META.name : STEP_META[Math.max(0, Math.min(3, stepIndex(x.current_step)))].name)) + '"></button>';
      }).join('');
    }
    var actBox = document.getElementById('tracker-header-action-container');
    if (actBox) {
      if (idx === 2 && n.comm > 0 && !trackCancelled) {
        actBox.innerHTML = '<button id="tracker-primary-btn" class="px-4 py-1.5 rounded-full text-white font-label-sm text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer group hover:scale-[1.02] active:scale-[0.98] duration-200 backdrop-blur-md" style="background:linear-gradient(180deg,#34D399 0%,#10B981 50%,#059669 100%);border:1px solid rgba(134,239,172,0.35);box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 2px 8px -1px rgba(4,120,87,0.55);" onclick="openPayModalFor(\'' + safe(t.id) + '\')"><span class="material-symbols-outlined text-[16px]" id="tracker-btn-icon">credit_card</span><span id="tracker-btn-label">Pagar comisión ($' + safe(money(n.comm)) + ')</span></button>';
      } else {
        actBox.innerHTML = '';
      }
    }
  }
  window.paintTracker = paintTracker;
  window.renderTrackerState = function (i) { paintTracker(typeof i === 'number' ? i : (window.__svTrackPos || 0)); };
  window.prevTrackerState = function () { paintTracker((window.__svTrackPos || 0) - 1); };
  window.nextTrackerState = function () { paintTracker((window.__svTrackPos || 0) + 1); };
  window.prevTrackerStep = window.prevTrackerState;
  window.nextTrackerStep = window.nextTrackerState;

  var SV_TK_MS = 5000;
  function svTkSet(idx, animate) {
    var track = document.getElementById('sv-tk-track');
    var total = window.__svTkTotal || 0;
    if (!track || !total) return;
    if (idx < 0) idx = 0;
    if (idx > total) idx = total;
    if (!animate) {
      track.style.transition = 'none';
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      void track.offsetWidth;
      track.style.transition = 'transform 650ms cubic-bezier(0.4,0,0.2,1)';
    } else {
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    }
    window.__svTkPos = idx;
    svTkDots();
  }
  function svTkDots() {
    var box = document.getElementById('sv-tk-dots');
    var total = window.__svTkTotal || 0;
    if (!box || !total) return;
    var cur = (window.__svTkPos || 0) % total;
    var btns = box.querySelectorAll('button');
    for (var i = 0; i < btns.length && i < total; i++) {
      btns[i].className = (i === cur ? 'w-6 h-2.5 bg-tertiary shadow-sm' : 'w-2.5 h-2.5 bg-outline-variant hover:bg-tertiary') + ' rounded-full transition-all duration-300 cursor-pointer';
    }
  }
  function svTkAutoStop() { if (window.__svTkT) { clearInterval(window.__svTkT); window.__svTkT = null; } }
  function svTkAutoStart() {
    svTkAutoStop();
    if ((window.__svTkTotal || 0) < 2) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.__svTkT = setInterval(function () { if (!document.hidden) window.svTkNext(); }, SV_TK_MS);
  }
  window.svTkNext = function () {
    var total = window.__svTkTotal || 0;
    if (total < 2) return;
    var p = window.__svTkPos || 0;
    if (p >= total) { svTkSet(0, false); p = 0; }
    svTkSet(p + 1, true);
  };
  window.svTkPrev = function () {
    var total = window.__svTkTotal || 0;
    if (total < 2) return;
    var p = window.__svTkPos || 0;
    if (p <= 0) {
      svTkSet(total, false);
      requestAnimationFrame(function () { requestAnimationFrame(function () { svTkSet(total - 1, true); }); });
    } else {
      svTkSet(p - 1, true);
    }
  };
  window.svTkGo = function (k) {
    var total = window.__svTkTotal || 0;
    if (total < 2) return;
    var cur = (window.__svTkPos || 0) % total;
    if (k === cur) return;
    svTkSet(k, true);
  };
  window.goToTicketCard = function (ticketId) {
    try {
      if (typeof window.closePagarComisionModal === 'function') window.closePagarComisionModal();
      else {
        var m = document.getElementById('pagar-comision-modal');
        if (m) m.classList.add('hidden');
      }
      var list = window.__svTickets || [];
      var idx = -1, i = 0;
      for (i = 0; i < list.length; i++) { if (list[i] && list[i].id === ticketId) { idx = i; break; } }
      if (idx < 0) return;
      if (typeof window.svTkGo === 'function') window.svTkGo(idx);
      svTkAutoStop();
      setTimeout(function () { svTkAutoStart(); }, 12000);
      var vp = document.getElementById('sv-tk-viewport');
      if (vp && vp.scrollIntoView) {
        try { vp.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { vp.scrollIntoView(); }
      }
      var track = document.getElementById('sv-tk-track');
      var card = (track && track.children[idx]) ? (track.children[idx].firstElementChild || track.children[idx]) : null;
      if (card) {
        if (!document.getElementById('sv-tk-flash-style')) {
          var st = document.createElement('style');
          st.id = 'sv-tk-flash-style';
          st.textContent = '@keyframes svCardFlash{0%,100%{box-shadow:inset 0 0 0 1px rgba(249,115,22,0);}30%,70%{box-shadow:inset 0 0 0 2px rgba(249,115,22,0.9),inset 0 0 34px rgba(249,115,22,0.22);}} .sv-card-flash{animation:svCardFlash 1.4s ease-in-out 2 !important;}';
          document.head.appendChild(st);
        }
        card.classList.remove('sv-card-flash');
        void card.offsetWidth;
        card.classList.add('sv-card-flash');
        setTimeout(function () { card.classList.remove('sv-card-flash'); }, 3200);
      }
    } catch (e) {}
  };

  window.svAskCancelTicket = function (ticketId) {
    var list = window.__svTickets || [];
    var t = null, i = 0;
    for (i = 0; i < list.length; i++) { if (String(list[i].id) === String(ticketId)) { t = list[i]; break; } }
    if (!t) return;
    var id8 = safe(String(t.id || '').slice(0, 8));
    var prov = safe(t.provider_name || 'esta gestión');
    var sv2 = Number(t.estimated_saving) || 0;
    var html =
      '<div class="text-sm text-on-surface-variant leading-relaxed">Vas a cancelar la gestión de <b class="text-on-surface">' + prov + '</b> (N° Ticket ' + id8 + ').</div>' +
      '<div class="text-xs text-outline mt-1.5 leading-relaxed">' + (sv2 > 0 ? 'El ahorro estimado de $' + safe(money(sv2)) + ' saldrá de tu Ahorro Total Acumulado y no se generará ninguna comisión con la compañía. ' : 'No se generará ninguna comisión con la compañía. ') + 'Usalo si adjuntaste una factura equivocada: después podés subir la factura correcta.</div>' +
      '<div class="flex justify-end gap-2 pt-4 flex-wrap">' +
        '<button type="button" onclick="closeInfoModal()" class="px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface text-sm font-semibold cursor-pointer transition-colors">No, volver</button>' +
        '<button type="button" onclick="svCancelTicket(\'' + safe(t.id) + '\')" class="px-4 py-2 rounded-xl text-white text-sm font-bold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all" style="background:linear-gradient(180deg,#F87171 0%,#DC2626 100%);border:1px solid rgba(252,165,165,0.4);box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 2px 8px -1px rgba(127,29,29,0.6);">Sí, cancelar gestión</button>' +
      '</div>';
    if (typeof window.openReceiptModal === 'function') {
      window.openReceiptModal('Cancelar gestión', html);
    } else if (window.confirm('¿Cancelar la gestión ' + id8 + '? No se cobrará comisión.')) {
      window.svCancelTicket(ticketId);
    }
  };

  window.svCancelTicket = async function (ticketId) {
    try {
      var res = await fetch(API + '/tickets/' + encodeURIComponent(ticketId) + '/cancel', { method: 'POST', credentials: 'include' });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) { showMsg((data && data.detail) || 'No se pudo cancelar la gestión.'); return; }
      if (typeof window.closeInfoModal === 'function') window.closeInfoModal();
      showMsg('Gestión cancelada. No se te cobrará comisión por ella.');
      await renderRealData();
    } catch (e) {
      showMsg('Error de conexión al cancelar la gestión.');
    }
  };

  function renderTickets(tickets) {
    var box = document.getElementById('sinvueltas-tickets');
    if (!box) return;
    tickets = (Array.isArray(tickets) ? tickets : []).filter(function (t) { return !isCancelled(t); });
    if (!tickets.length) {
      svTkAutoStop();
      window.__svTkTotal = 0;
      box.innerHTML = emptyBox('inbox', 'Todavía no tenés gestiones activas', 'Subí tu primera factura desde el panel lateral y arrancamos a negociar tu ahorro.');
      return;
    }
    var cards = tickets.map(function (t) {
      var cancelled = isCancelled(t);
      var idx = Math.max(0, Math.min(3, stepIndex(t.current_step)));
      var meta = cancelled ? SV_CANCELLED_META : STEP_META[idx];
      var stepper = STEP_META.slice(0, 3).map(function (m, i) {
        var state = i < idx ? 'done' : (i === idx ? 'current' : 'todo');
        var circle, icon;
        if (state === 'done') { circle = 'bg-tertiary/15 text-tertiary border-tertiary/40'; icon = 'check'; }
        else if (state === 'current') { circle = m.bg + ' ' + m.text + ' ' + m.border; icon = m.icon; }
        else { circle = 'bg-surface-container text-outline border-outline-variant/40'; icon = m.icon; }
        var label = state === 'done' ? 'text-tertiary' : (state === 'current' ? m.text : 'text-outline');
        var ringHtml = state === 'current' ? '<span class="sv-step-ring absolute inset-0 rounded-full pointer-events-none" style="border:2px solid currentColor;"></span>' : '';
        var curCls = state === 'current' ? ' sv-step-current relative' : '';
        var haloStyle = state === 'done' ? ' style="box-shadow:0 0 12px rgba(251,191,36,0.45);"' : (state === 'current' ? ' style="box-shadow:0 0 14px rgba(249,115,22,0.55);"' : '');
        return '<div class="flex flex-col items-center gap-1 text-center min-w-0">' +
            '<div class="w-7 h-7 rounded-full flex items-center justify-center border ' + circle + curCls + '"' + haloStyle + '>' + ringHtml +
              '<span class="material-symbols-outlined text-[14px]">' + icon + '</span>' +
            '</div>' +
            '<span class="text-[10px] font-semibold leading-tight ' + label + '">' + safe(m.name) + '</span>' +
          '</div>';
      }).join('');

      var amountLine = (t.amount != null && t.amount !== '')
        ? 'Monto: $' + safe(money(t.amount)) : 'Monto pendiente de lectura';
      var savingBig = (!cancelled && t.estimated_saving != null && t.estimated_saving !== '')
        ? '<div class="leading-tight"><div class="text-[10px] uppercase tracking-wider text-outline font-bold">Ahorro estimado</div><div class="text-xl font-extrabold text-tertiary tracking-tight">$' + safe(money(t.estimated_saving)) + '</div></div>' : '';

      var comm = 0;
      if (t.commission_amount != null && t.commission_amount !== '') comm = Number(t.commission_amount);
      else if (t.estimated_saving != null && t.estimated_saving !== '') comm = Number(t.estimated_saving) * (pctFor(t) / 100);
      if (isNaN(comm)) comm = 0;

      var payBlock = '';
      if (comm > 0 && !cancelled) {
        var ps = String(t.payment_status || 'sin_link');
        if (ps === 'pagado') {
          var paidPay = (window.__svPayments || []).filter(function (p) { return p.ticket_id === t.id && p.status === 'pagado'; })[0];
          var recBtn = paidPay ? ' <button type="button" class="text-[10px] px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary border border-tertiary/30 font-semibold" onclick="showPaymentReceipt(\'' + safe(paidPay.id) + '\')">Ver comprobante</button>' : '';
          payBlock = '<div class="text-xs text-tertiary font-semibold flex items-center gap-1 flex-wrap">' +
            '<span class="material-symbols-outlined text-[15px]">verified</span>Comisión abonada' +
            (t.paid_at ? ' · ' + safe(datefmt(t.paid_at)) : '') + recBtn + '</div>';
        } else if (isPayable(t)) {
          payBlock = '<div class="flex flex-col sm:items-end items-stretch">' +
            '<button type="button" onclick="openPayModalFor(\'' + safe(t.id) + '\')" class="text-xs whitespace-nowrap px-4 py-1.5 min-h-[36px] rounded-full text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all" style="background:linear-gradient(180deg,#34D399 0%,#10B981 50%,#059669 100%);border:1px solid rgba(134,239,172,0.35);box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 2px 8px -1px rgba(4,120,87,0.55);">' +
              '<span class="material-symbols-outlined text-[15px]">credit_card</span>Pagar comisión' +
            '</button></div>';
        }
      }

      var sideBlock = (savingBig || payBlock)
        ? '<div class="shrink-0 sm:max-w-[230px] sm:text-right sm:pl-3 sm:border-l sm:border-outline-variant/30 flex sm:flex-col sm:items-end items-center gap-2 flex-wrap">' + savingBig + payBlock + '</div>'
        : '';
      var progressBlock = cancelled
        ? '<div class="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/30 text-xs text-on-surface-variant"><span class="material-symbols-outlined text-[16px] text-outline">block</span>Esta gestión fue cancelada: no se cobra comisión de éxito.</div>'
        : '<div class="relative grid grid-cols-3 gap-1.5 p-2.5 pt-3 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/30">' + '<div class="absolute top-[26px] left-[calc(100%/6)] right-[calc(100%/6)] h-px bg-outline-variant/40 pointer-events-none"></div>' + stepper + '</div>';
      var payStatusTx = String(t.payment_status || 'sin_link');
      var cancelBtn = (!cancelled && payStatusTx !== 'pagado' && payStatusTx !== 'reembolsado' && idx < 3)
        ? '<button type="button" class="text-[11px] px-3.5 py-1.5 min-h-[36px] rounded-full bg-error/10 border border-error/30 text-error font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-error/20 transition-colors" onclick="svAskCancelTicket(\'' + safe(t.id) + '\')"><span class="material-symbols-outlined text-[14px]">cancel</span>Cancelar gestión</button>'
        : '';
      return '<div class="p-3.5 sm:p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/40 flex flex-col gap-3" style="border-radius:20px">' +
        '<div class="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3 min-w-0">' +
          '<div class="flex items-start gap-2.5 min-w-0 flex-1">' +
          '<div class="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ' + meta.bg + ' ' + meta.text + ' ' + meta.border + '">' +
            '<span class="material-symbols-outlined text-[20px]">' + meta.icon + '</span>' +
          '</div>' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex items-center gap-1.5 flex-wrap min-w-0">' +
              '<span class="font-bold text-on-surface truncate text-sm">' + safe(t.provider_name || 'Gestión de ahorro') + '</span>' +
              '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap shrink-0 ' + meta.bg + ' ' + meta.text + ' ' + meta.border + '">' + safe(meta.name) + '</span>' +
            '</div>' +
            '<div class="text-[11px] text-on-surface-variant mt-0.5">N° Ticket ' + safe(String(t.id || '').slice(0, 8)) + ' · ' + safe(datefmt(t.created_at)) + '</div>' +
            '<div class="text-[11px] text-outline mt-0.5">' + safe(amountLine) + '</div>' +
          '</div>' +
          '</div>' +
          sideBlock +
        '</div>' +
        progressBlock +
        '<div class="flex items-center gap-2 flex-wrap">' +
          '<button type="button" class="text-[11px] px-3.5 py-1.5 min-h-[36px] rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface font-semibold inline-flex items-center gap-1" onclick="toggleTicketHistory(\'' + safe(t.id) + '\')"><span class="material-symbols-outlined text-[14px]">history</span>Ver historial</button>' +
          (t.invoice_id ? '<a class="text-[11px] px-3.5 py-1.5 min-h-[36px] rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold inline-flex items-center gap-1" href="' + API + '/invoices/' + encodeURIComponent(t.invoice_id) + '/file" target="_blank" rel="noopener"><span class="material-symbols-outlined text-[14px]">description</span>Ver factura</a>' : '') +
          cancelBtn +
        '</div>' +
        '<div id="tk-hist-' + safe(t.id) + '" class="hidden text-xs text-on-surface-variant border-t border-outline-variant/30 pt-2"></div>' +
      '</div>';
    });
    var slides = '', si = 0;
    for (si = 0; si < cards.length; si++) {
      slides += '<div class="w-full shrink-0 min-w-full">' + cards[si] + '</div>';
    }
    var cloneSlide = '<div class="w-full shrink-0 min-w-full" aria-hidden="true">' + cards[0].replace('id="tk-hist-', 'id="tk-hist-c-') + '</div>';
    var n = cards.length;
    var dotsHtml = '', di = 0;
    for (di = 0; di < n; di++) {
      dotsHtml += '<button type="button" onclick="svTkGo(' + di + ')" class="' + (di === 0 ? 'w-6 h-2.5 bg-tertiary shadow-sm' : 'w-2.5 h-2.5 bg-outline-variant hover:bg-tertiary') + ' rounded-full transition-all duration-300 cursor-pointer" title="Gestión ' + (di + 1) + '"></button>';
    }
    svTkAutoStop();
    window.__svTkTotal = n;
    window.__svTkPos = 0;
    box.innerHTML =
      '<div class="relative">' +
        '<div id="sv-tk-viewport" class="overflow-hidden">' +
          '<div id="sv-tk-track" class="flex items-stretch" style="transition:transform 650ms cubic-bezier(0.4,0,0.2,1);will-change:transform;">' + slides + cloneSlide + '</div>' +
        '</div>' +
        (n > 1
          ? '<div class="flex items-center justify-center gap-3 pt-3">' +
              '<button type="button" onclick="svTkPrev()" class="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors" title="Gestión anterior"><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>' +
              '<div id="sv-tk-dots" class="flex items-center gap-1.5">' + dotsHtml + '</div>' +
              '<button type="button" onclick="svTkNext()" class="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors" title="Siguiente gestión"><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>' +
            '</div>'
          : '') +
      '</div>';
    var tkTrack = document.getElementById('sv-tk-track');
    if (tkTrack) {
      tkTrack.addEventListener('transitionend', function (e) {
        if (e.target !== tkTrack || e.propertyName !== 'transform') return;
        if ((window.__svTkPos || 0) === (window.__svTkTotal || 0)) svTkSet(0, false);
      });
    }
    var tkVp = document.getElementById('sv-tk-viewport');
    if (tkVp && n > 1) {
      tkVp.addEventListener('mouseenter', svTkAutoStop);
      tkVp.addEventListener('mouseleave', svTkAutoStart);
      var tkTx0 = null;
      tkVp.addEventListener('touchstart', function (e) { tkTx0 = e.touches[0].clientX; svTkAutoStop(); }, { passive: true });
      tkVp.addEventListener('touchend', function (e) {
        if (tkTx0 != null) {
          var dx = e.changedTouches[0].clientX - tkTx0;
          if (dx <= -40) window.svTkNext();
          else if (dx >= 40) window.svTkPrev();
        }
        tkTx0 = null;
        svTkAutoStart();
      }, { passive: true });
      svTkAutoStart();
    }
  }

  function renderInvoices(invoices) {
    var box = document.getElementById('sinvueltas-invoices');
    if (!box) return;
    if (!Array.isArray(invoices) || !invoices.length) {
      box.innerHTML = emptyBox('upload_file', 'Sin facturas todavía', 'Subí una factura desde el panel lateral para que la analicemos.');
      return;
    }
    box.innerHTML = invoices.map(function (i) {
      var amount = (i.parsed_amount != null && i.parsed_amount !== '') ? ('$' + safe(money(i.parsed_amount))) : 'Pendiente';
      var mineTk = (window.__svTickets || []).filter(function (x) { return x.invoice_id && String(x.invoice_id) === String(i.id); })[0];
      var invCancelled = !!mineTk && isCancelled(mineTk);
      var status = invCancelled ? 'Cancelada' : String(i.status || '');
      var low = status.toLowerCase();
      var badge = invCancelled
        ? 'bg-red-500/15 text-red-400 border-red-500/40'
        : ((low.indexOf('error') !== -1 || low.indexOf('rechaz') !== -1)
          ? 'bg-error/15 text-error border-error/30'
          : (low.indexOf('recib') !== -1
            ? 'bg-sky-500/10 text-sky-400 border-sky-500/40'
            : (low.indexOf('negoci') !== -1
              ? 'bg-amber-400/15 text-amber-400 border-amber-400/40'
              : (low.indexOf('esper') !== -1
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : ((low.indexOf('proces') !== -1 || low.indexOf('ok') !== -1)
                  ? 'bg-tertiary/15 text-tertiary border-tertiary/30'
                  : 'bg-secondary/15 text-secondary border-secondary/30')))));
      var statusChip = status ? ' · <span class="px-1.5 py-0.5 rounded-full border ' + badge + '">' + safe(status) + '</span>' : '';
      var ticketInfo = mineTk
        ? '<div class="text-[11px] text-on-surface-variant mt-0.5">N° Ticket ' + safe(String(mineTk.id || '').slice(0, 8)) + ' · ' + safe(datefmt(mineTk.created_at)) + '</div>'
        : '';
      return '<div class="p-3.5 rounded-2xl bg-surface-container/50 border border-outline-variant/40 flex justify-between items-center gap-3">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<div class="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined text-[18px]">draft</span></div>' +
          '<div class="min-w-0">' +
            '<div class="font-semibold text-on-surface truncate">' + safe(i.provider_name || 'Factura') + '</div>' +
            '<div class="text-xs text-on-surface-variant truncate">' + safe(i.original_filename) + (i.account_number ? ' · Cuenta ' + safe(i.account_number) : '') + '</div>' +
            ticketInfo +
            '<div class="text-[10px] text-outline flex items-center flex-wrap gap-0.5">' + safe(datefmt(i.uploaded_at)) + statusChip + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="text-right shrink-0 flex flex-col items-end gap-1">' +
          '<div class="font-mono text-sm text-tertiary font-bold">' + amount + '</div>' +
          '<a class="text-[10px] px-2.5 py-1 min-h-[28px] rounded-full bg-primary/10 border border-primary/30 text-primary font-semibold inline-flex items-center gap-1" href="' + API + '/invoices/' + encodeURIComponent(i.id) + '/file" target="_blank" rel="noopener"><span class="material-symbols-outlined text-[13px]">description</span>Ver factura</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.showPaymentReceipt = async function (id) {
    try {
      var res = await fetch(API + '/payments/' + encodeURIComponent(id) + '/receipt', { credentials: 'include' });
      var data = await res.json();
      if (!res.ok) { showMsg(data.detail || 'No se pudo cargar el comprobante.'); return; }
      var modal = document.getElementById('sv-receipt-modal');
      if (!modal) { modal = document.createElement('div'); modal.id = 'sv-receipt-modal'; document.body.appendChild(modal); }
      modal.className = 'fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-4';
      modal.innerHTML =
        '<div class="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl">' +
          '<h3 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-tertiary">receipt_long</span>Comprobante de pago</h3>' +
          '<div class="space-y-1.5 text-sm text-on-surface-variant">' +
            '<div><span class="text-outline">Número: </span>' + safe(data.receipt_number || '\u2014') + '</div>' +
            '<div><span class="text-outline">Cliente: </span>' + safe(data.client_name || '') + '</div>' +
            '<div><span class="text-outline">Gestión: </span>' + safe(data.provider_name || data.ticket_id || '') + '</div>' +
            '<div><span class="text-outline">Monto: </span><span class="font-bold text-tertiary">$' + safe(money(data.amount)) + ' ' + safe(data.currency || 'ARS') + '</span></div>' +
            '<div><span class="text-outline">Estado: </span>' + safe(data.status) + '</div>' +
            '<div><span class="text-outline">Fecha: </span>' + safe(datefmt(data.paid_at || data.created_at)) + '</div>' +
          '</div>' +
          '<div class="flex justify-end gap-2 mt-4">' +
            '<button onclick="window.print()" class="px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface text-sm font-semibold">Imprimir</button>' +
            '<button onclick="document.getElementById(\'sv-receipt-modal\').remove()" class="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-semibold">Cerrar</button>' +
          '</div>' +
        '</div>';
    } catch (e) {
      showMsg('Error de conexión al cargar el comprobante.');
    }
  };

  async function renderRealData() {
    var results = await Promise.all([fetchJson(API + '/tickets'), fetchJson(API + '/invoices'), fetchJson(API + '/payments')]);
    window.__svPayments = Array.isArray(results[2]) ? results[2] : [];
    window.__svTickets = Array.isArray(results[0]) ? results[0] : [];
    renderTickets(results[0]);
    renderResumen(results[0], results[1]);
    renderInvoices(results[1]);
    try {
      var best = 0, bestIdx = -1;
      (window.__svTickets || []).forEach(function (t, k) {
        if (isCancelled(t)) return;
        var si = Math.max(0, Math.min(3, stepIndex(t.current_step)));
        if (si > bestIdx) { bestIdx = si; best = k; }
      });
      paintTracker(best);
    } catch (e) {}
  }

  window.toggleTicketHistory = async function (ticketId) {
    var box = document.getElementById('tk-hist-' + ticketId);
    if (!box) return;
    if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = '<span class="text-outline">Cargando…</span>';
    var items = await fetchJson(API + '/tickets/' + encodeURIComponent(ticketId) + '/events');
    if (!Array.isArray(items) || !items.length) { box.innerHTML = '<span class="text-outline">Sin historial todavía.</span>'; return; }
    box.innerHTML = items.map(function (h) {
      var title = h.to_step ? safe(h.to_step) : safe(h.from_step || '');
      return '<div class="flex items-start gap-2 py-1.5 border-b border-outline-variant/20 last:border-0">' +
        '<span class="material-symbols-outlined text-[14px] text-outline mt-0.5">history</span>' +
        '<div class="min-w-0"><div class="text-on-surface">' + title + '</div>' +
        (h.note ? '<div class="text-outline">' + safe(h.note) + '</div>' : '') +
        '<div class="text-[10px] text-outline">' + safe(datefmt(h.created_at)) + '</div></div>' +
      '</div>';
    }).join('');
  };

  // Quita la tabla de servicios demo que trae el HTML de ejemplo.
  function removeDemoBlocks() {
    var demo = document.getElementById('servicios-table');
    if (demo && demo.parentElement) demo.parentElement.removeChild(demo);
  }

  window.changePortalPassword = async function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var cur = document.getElementById('acc-current-pass');
    var nw = document.getElementById('acc-new-pass');
    if (!cur || !nw) return;
    if (!nw.value || nw.value.length < 8) { showMsg('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    try {
      var r = await fetch(API + '/account/password', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: cur.value, new_password: nw.value }),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) { showMsg(data.detail || 'No se pudo cambiar la contraseña.'); return; }
      cur.value = ''; nw.value = '';
      showMsg('Contraseña actualizada correctamente.');
    } catch (e) {
      showMsg('Error de conexión al cambiar la contraseña.');
    }
  };

  window.saveAccountData = async function (event) {
    event.preventDefault();
    var firstName = document.getElementById('acc-first-name').value.trim();
    var lastName = document.getElementById('acc-last-name').value.trim();
    var phone = document.getElementById('acc-phone') ? document.getElementById('acc-phone').value.trim() : '';
    var dni = document.getElementById('acc-dni') ? document.getElementById('acc-dni').value.trim() : '';
    if (!firstName || !lastName) { showMsg('Nombre y apellido son obligatorios.'); return; }
    try {
      var r = await fetch(API + '/account', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone: phone, dni: dni }),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) { showMsg(data.detail || 'No se pudieron guardar los datos.'); return; }
      showMsg('Datos guardados.');
      if (typeof window.closeAccountModal === 'function') window.closeAccountModal();
    } catch (e) {
      showMsg('Error de conexión al guardar.');
    }
  };

  function paintAvatars(url, name) {
    var initials = String(name || 'C').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase() || 'C';
    [['header-user-avatar', 'header-user-initials'], ['dropdown-user-avatar', 'dropdown-user-initials']].forEach(function (pair) {
      var img = document.getElementById(pair[0]);
      var fb = document.getElementById(pair[1]);
      if (!img || !fb) return;
      if (url) {
        img.src = url;
        img.classList.remove('hidden');
        fb.classList.add('hidden');
        fb.classList.remove('flex');
      } else {
        fb.textContent = initials;
        fb.classList.remove('hidden');
        fb.classList.add('flex');
        img.classList.add('hidden');
      }
    });
  }
  function toggleAvatarDelete(show) {
    var b = document.getElementById('avatar-delete-item');
    if (!b) return;
    b.classList.toggle('hidden', !show);
    b.classList.toggle('flex', !!show);
  }
  window.deleteAvatar = async function () {
    if (!confirm('¿Eliminar tu foto de perfil?')) return;
    try {
      var r = await fetch(API + '/account/avatar', { method: 'DELETE', credentials: 'include' });
      if (!r.ok) { showMsg('No se pudo eliminar la foto.'); return; }
      window.__svHasAvatar = false;
      paintAvatars(null, window.__svName || 'C');
      toggleAvatarDelete(false);
      showMsg('Foto eliminada.');
    } catch (e) { showMsg('Error de conexión.'); }
  };
  window.triggerAvatarUpload = function () {
    var i = document.getElementById('avatar-file-input');
    if (i) i.click();
  };
  window.handleAvatarFile = function (input) {
    var f = input && input.files && input.files[0];
    if (input) input.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { showMsg('Usá JPG, PNG o WEBP.'); return; }
    if (f.size > 2 * 1024 * 1024) { showMsg('La foto debe pesar hasta 2MB.'); return; }
    try {
      var rd = new FileReader();
      rd.onload = function () { paintAvatars(rd.result, window.__svName || 'C'); };
      rd.readAsDataURL(f);
    } catch (e) {}
    var fd = new FormData();
    fd.append('avatar', f);
    fetch(API + '/account/avatar', { method: 'POST', credentials: 'include', body: fd })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { showMsg((x.d && x.d.detail) || 'No se pudo subir la foto.'); return; }
        paintAvatars(API + '/account/avatar?t=' + Date.now(), window.__svName || 'C');
        window.__svHasAvatar = true;
        try { toggleAvatarDelete(true); } catch (e) {}
        showMsg('Foto actualizada.');
      })
      .catch(function () { showMsg('Error de conexión al subir.'); });
  };

  function injectPasswordSection() {
    var form = document.getElementById('account-form');
    if (!form || document.getElementById('pwd-code-btn')) return;
    var INP = 'w-full px-3 py-2 rounded-xl bg-surface-container-high border border-outline-variant/50 text-xs sm:text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors';
    var BTN = 'self-start px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold';
    var wrap = document.createElement('div');
    wrap.className = 'p-3 rounded-xl bg-surface-container border border-outline-variant/50 flex flex-col gap-2';
    wrap.id = 'pwd-code-wrap';
    wrap.innerHTML =
      '<button type="button" id="pwd-code-btn" onclick="window.__pwdStep(1)" class="' + BTN + '">Cambiar contraseña</button>' +
      '<div id="pwd-step-1" class="hidden flex-col gap-2">' +
        '<div class="text-xs text-on-surface-variant">Escribí el mail de tu cuenta para recibir el código de verificación.</div>' +
        '<input type="email" id="pwd-code-email" autocomplete="email" placeholder="tu@mail.com" class="' + INP + '">' +
        '<button type="button" onclick="sendPwdCode()" class="' + BTN + '">Enviar código</button>' +
      '</div>' +
      '<div id="pwd-step-2" class="hidden flex-col gap-2">' +
        '<div class="text-xs text-on-surface-variant" id="pwd-code-hint">Revisá tu mail e ingresá el código de 6 dígitos.</div>' +
        '<input type="text" id="pwd-code" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" class="' + INP + '">' +
        '<input type="password" id="pwd-new-pass" autocomplete="new-password" placeholder="Nueva contraseña (mínimo 8 caracteres)" class="' + INP + '">' +
        '<input type="password" id="pwd-new-pass2" autocomplete="new-password" placeholder="Repetí la nueva contraseña" class="' + INP + '">' +
        '<button type="button" onclick="confirmPwdCode()" class="' + BTN + '">Guardar nueva contraseña</button>' +
      '</div>' +
      '<div id="pwd-code-msg" class="hidden text-xs font-semibold"></div>';
    var footer = form.querySelector('.flex.items-center.justify-end');
    if (footer && footer.parentElement === form) form.insertBefore(wrap, footer);
    else form.appendChild(wrap);
  }

  window.__pwdStep = function (n) {
    var s1 = document.getElementById('pwd-step-1');
    var s2 = document.getElementById('pwd-step-2');
    if (s1) { s1.classList.toggle('hidden', n !== 1); s1.classList.toggle('flex', n === 1); }
    if (s2) { s2.classList.toggle('hidden', n !== 2); s2.classList.toggle('flex', n === 2); }
  };
  function pwdMsg(text, ok) {
    var m = document.getElementById('pwd-code-msg');
    if (!m) return;
    m.textContent = text;
    m.classList.remove('hidden');
    m.style.color = ok ? '#FBBF24' : '#FB7185';
  }
  window.sendPwdCode = async function () {
    var em = document.getElementById('pwd-code-email');
    var email = em ? em.value.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { pwdMsg('Ingresá un mail válido.', false); return; }
    pwdMsg('Enviando código…', true);
    try {
      var r = await fetch(API + '/account/password-code', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) { pwdMsg(data.detail || 'No se pudo enviar el código.', false); return; }
      if (data && data.emailSent === false) { pwdMsg('No se pudo enviar el mail con el código. Avisanos por WhatsApp y lo resolvemos.', false); return; }
      var hint = document.getElementById('pwd-code-hint');
      if (hint) hint.textContent = 'Te enviamos un código de 6 dígitos a ' + email + '. Revisá tu mail (también spam).';
      window.__pwdStep(2);
      pwdMsg('Código enviado. Expira en 10 minutos.', true);
    } catch (e) {
      pwdMsg('Error de conexión al enviar.', false);
    }
  };
  window.confirmPwdCode = async function () {
    var codeEl = document.getElementById('pwd-code');
    var p1El = document.getElementById('pwd-new-pass');
    var p2El = document.getElementById('pwd-new-pass2');
    var code = codeEl ? codeEl.value.trim() : '';
    var p1 = p1El ? p1El.value : '';
    var p2 = p2El ? p2El.value : '';
    if (!/^\d{6}$/.test(code)) { pwdMsg('El código debe tener 6 dígitos.', false); return; }
    if (p1 !== p2) { pwdMsg('Las contraseñas no coinciden.', false); return; }
    if (p1.length < 8) { pwdMsg('Mínimo 8 caracteres.', false); return; }
    pwdMsg('Guardando…', true);
    try {
      var r = await fetch(API + '/account/password-code', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, password: p1 }),
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) { pwdMsg(data.detail || 'No se pudo cambiar la contraseña.', false); return; }
      pwdMsg('Contraseña actualizada.', true);
      if (p1El) p1El.value = '';
      if (p2El) p2El.value = '';
      if (codeEl) codeEl.value = '';
    } catch (e) {
      pwdMsg('Error de conexión al guardar.', false);
    }
  };

  function wireUpload() {
    var input = document.getElementById('invoice-file-input');
    if (input) input.removeAttribute('onchange');
    if (!input) return;
    async function uploadFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return;
      // El avatar del portal "se traga" la factura con giro tornado.
      if (window.ManguitoAvatar && window.ManguitoAvatar.chew) window.ManguitoAvatar.chew();
      var okCount = 0, lastProvider = '', lastAmount = '', ocrErrors = 0;
      // Subimos en paralelo: con varias facturas se tarda lo que la más lenta, no la suma.
      await Promise.all(files.map(async function (file) {
        var fd = new FormData();
        fd.append('file', file);
        try {
          var r = await fetch(API + '/invoices/upload', { method: 'POST', credentials: 'include', body: fd });
          var data = await r.json().catch(function () { return {}; });
          if (r.ok) {
            okCount++;
            if (data.provider_name) lastProvider = data.provider_name;
            if (data.parsed_amount) lastAmount = data.parsed_amount;
            if (data.ocr_error) ocrErrors++;
          } else {
            showMsg(data.detail || ('No se pudo procesar ' + file.name));
          }
        } catch (e) {
          showMsg('Error de conexión al subir ' + file.name);
        }
      }));
      input.value = '';
      if (okCount) {
        var msg = okCount + (okCount === 1 ? ' factura procesada' : ' facturas procesadas');
        if (lastProvider) msg += ': ' + lastProvider + (lastAmount ? ' · $' + money(lastAmount) : '');
        if (ocrErrors) msg += ' (' + ocrErrors + ' sin lectura OCR)';
        showMsg(msg);
      }
      await renderRealData();
    }
    input.addEventListener('change', function () { uploadFiles(input.files); });
    // Soltar el archivo sobre la tarjeta también carga la factura (antes solo masticaba).
    var dz = document.getElementById('portal-dropzone');
    if (dz) {
      dz.addEventListener('dragover', function (e) {
        if (e.preventDefault) e.preventDefault();
        if (window.ManguitoAvatar && window.ManguitoAvatar.setOpenMouth) window.ManguitoAvatar.setOpenMouth(true);
      });
      dz.addEventListener('dragleave', function () {
        if (window.ManguitoAvatar && window.ManguitoAvatar.setOpenMouth) window.ManguitoAvatar.setOpenMouth(false);
      });
      dz.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      });
    }
    var analyzeBtn = document.getElementById('btn-analizar-factura');
    if (analyzeBtn) analyzeBtn.onclick = function () { input.click(); };
  }

  function wireLogout() {
    window.confirmLogout = function () {
      if (!confirm('¿Estás seguro de que deseas cerrar tu sesión en Manguito?')) return;
      fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' })
        .finally(function () { window.location.href = 'index.html'; });
    };
  }

  renderSkeleton();

  fetch(API + '/auth/me', { credentials: 'include' })
    .then(function (r) {
      if (!r.ok) { window.location.href = 'index.html'; return null; }
      return r.json();
    })
    .then(async function (user) {
      if (!user) return;
      var prettyName = function (s) { return String(s || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); };
      var fullName = prettyName(((user.first_name || 'Cliente') + ' ' + (user.last_name || '')).trim());
      var firstName = prettyName(user.first_name || 'Cliente');

      var headerName = document.getElementById('header-user-display-name');
      if (headerName) headerName.textContent = firstName;
      var dropName = document.getElementById('dropdown-user-full-name');
      if (dropName) dropName.textContent = fullName;
      var dropEmail = document.getElementById('dropdown-user-email');
      if (dropEmail) dropEmail.textContent = user.email;

      var accFirst = document.getElementById('acc-first-name');
      if (accFirst) accFirst.value = user.first_name || '';
      var accLast = document.getElementById('acc-last-name');
      if (accLast) accLast.value = user.last_name || '';
      var accEmail = document.getElementById('acc-email');
      if (accEmail) { accEmail.value = user.email || ''; accEmail.readOnly = true; }
      var accPhone = document.getElementById('acc-phone');
      if (accPhone) accPhone.value = user.phone || '';
      var accDni = document.getElementById('acc-dni');
      if (accDni) accDni.value = user.dni || '';

      // Ajustes globales (comisión / link de pago) antes de pintar el shell.
      var ps = await fetchJson(API + '/payment-settings');
      window.__svPaymentSettings = {
        commission_percent: (Number(ps && ps.commission_percent) || 15),
        payment_link: String((ps && ps.payment_link) || '').trim()
      };

      removeDemoBlocks();
      buildShell(fullName, user.email);
      window.__svName = fullName;
      window.__svHasAvatar = !!user.avatar_url;
      try { paintAvatars(user.avatar_url || null, fullName); } catch (e) {}
      try { toggleAvatarDelete(!!user.avatar_url); } catch (e2) {}
      injectPasswordSection();
      renderRealData();
      wireUpload();
      wireLogout();
    })
    .catch(function () { window.location.href = 'index.html'; });
})();
