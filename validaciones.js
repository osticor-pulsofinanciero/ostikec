/* ============================================================================
   VALIDACIONES.JS — Detección de doble uso de tickets
   ============================================================================
   Detecta cuando un mismo ticket se valida más de una vez dentro de una
   ventana de 24 horas. Muestra un aviso con el mismo estilo que el de
   "Ticket con fecha vencida". No bloquea: el validador decide.

   DEPENDENCIAS:
     - window.sha256Hex (definido en index.html)
     - window.jspdf (para exportar PDF) — opcional
     - window.XLSX (para exportar Excel) — opcional
     - clases CSS: .tarjeta, .seccion-titulo, .panel-historial-lista,
       .panel-historial-item, .h-nombre, .h-fecha, .btn, .btn-secundario,
       .btn-acento, .acciones

   ORDEN DE CARGA:
     Debe cargarse DESPUÉS de trial.js (para envolver las funciones de
     validación como capa más externa) y ANTES de update.js.

   ALCANCE:
     - Registro local por dispositivo. No se sincroniza entre dispositivos.
     - Solo el validador registra por defecto. Configurable con
       REGISTRAR_DESDE_CREADOR.

   ESTE ARCHIVO SÍ DEBE INCLUIRSE EN EL APK.
   ============================================================================ */

(function () {
  'use strict';

  /* Evitar doble carga */
  if (window.OSTIKEC_VALIDACIONES) return;

  /* ============================================================
     CONFIGURACIÓN
     ============================================================ */
  const CLAVE_VALIDACIONES = 'ostikec_validaciones';
  const CLAVE_OCULTO       = 'ostikec_validaciones_oculto';
  const VENTANA_USO_MS     = 24 * 60 * 60 * 1000;  // 24 horas
  const MAX_ENTRADAS       = 500;

  /* Si true, el creador también registra sus escaneos como uso.
     Por defecto false: el creador solo consulta, no registra. */
  const REGISTRAR_DESDE_CREADOR = false;

  /* ============================================================
     UTILIDADES
     ============================================================ */
  function leerJSON(k, def) {
    try {
      const v = localStorage.getItem(k);
      if (!v) return def;
      return JSON.parse(v);
    } catch (e) { return def; }
  }

  function guardarJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  function sha256(str) {
    if (typeof window.sha256Hex !== 'function') return '';
    try { return window.sha256Hex(String(str)); }
    catch (e) { return ''; }
  }

  /* Hash determinista del ticket: ordena las claves del objeto antes de
     hacer el SHA-256, para que el resultado no dependa del orden en que
     se construyó el JSON original. */
  function hashTicket(datos) {
    if (!datos || typeof datos !== 'object') return null;
    try {
      const keys = Object.keys(datos).sort();
      const obj = {};
      keys.forEach(function (k) { obj[k] = datos[k]; });
      const h = sha256(JSON.stringify(obj));
      return h ? String(h).toLowerCase() : null;
    } catch (e) { return null; }
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
      }[c];
    });
  }

  function formatFechaCorta(ts) {
    const d = new Date(ts);
    const hoy = new Date();
    const hhmm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString()) return hhmm;
    const ayer = new Date(hoy.getTime() - 86400000);
    if (d.toDateString() === ayer.toDateString()) return 'ayer ' + hhmm;
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ============================================================
     ALMACENAMIENTO
     ============================================================ */
  function leerLista(ahora) {
    const raw = leerJSON(CLAVE_VALIDACIONES, []);
    if (!Array.isArray(raw)) return [];
    const lim = ahora - VENTANA_USO_MS;
    return raw.filter(function (e) {
      return e &&
             typeof e.primeraValidacion === 'number' &&
             e.primeraValidacion > lim;
    });
  }

  function guardarLista(lista) {
    guardarJSON(CLAVE_VALIDACIONES, lista);
  }

  function buscarUsoReciente(hash) {
    if (!hash) return null;
    const lista = leerLista(Date.now());
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].hash === hash) return lista[i];
    }
    return null;
  }

  function registrar(datos, origen) {
    const hash = hashTicket(datos);
    if (!hash) return null;

    const ahora = Date.now();
    let lista = leerLista(ahora);
    const idx = lista.findIndex(function (e) { return e.hash === hash; });

    let entrada;
    if (idx >= 0) {
      lista[idx].ultimaValidacion = ahora;
      lista[idx].veces = (lista[idx].veces || 1) + 1;
      lista[idx].origen = origen;
      entrada = lista[idx];
    } else {
      entrada = {
        hash: hash,
        primeraValidacion: ahora,
        ultimaValidacion: ahora,
        veces: 1,
        origen: origen,
        datos: datos
      };
      lista.push(entrada);
    }

    lista.sort(function (a, b) { return a.primeraValidacion - b.primeraValidacion; });
    while (lista.length > MAX_ENTRADAS) lista.shift();
    guardarLista(lista);
    return entrada;
  }

  function estaOculto() {
    return leerJSON(CLAVE_OCULTO, false) === true;
  }

  function toggleOculto() {
    guardarJSON(CLAVE_OCULTO, !estaOculto());
    refrescarLista();
  }

  /* ============================================================
     RENDERIZADO DE LA LISTA
     ============================================================ */
  function renderItem(e) {
    const d = e.datos || {};
    const partes = [];
    if (d.n) partes.push(escapeHTML(d.n));
    if (d.t) partes.push('📞 ' + escapeHTML(d.t));
    if (d.a) partes.push(escapeHTML(d.a));
    if (d.i) partes.push(escapeHTML(d.i));

    const texto = partes.length ? partes.join(' · ') : '—';
    const veces = e.veces || 1;
    const marca = veces > 1
      ? ' <span style="color:#991b1b;font-weight:800;">(×' + veces + ')</span>'
      : '';
    const demoTag = d.demo
      ? ' <span style="color:#7a5500;background:#fff9e6;padding:1px 5px;' +
        'border-radius:4px;font-size:10px;font-weight:700;">DEMO</span>'
      : '';
    const fechaTxt = formatFechaCorta(e.ultimaValidacion);

    return '<div class="panel-historial-item">' +
      '<span class="h-nombre">' + texto + marca + demoTag + '</span>' +
      '<span class="h-fecha">' + fechaTxt + '</span>' +
    '</div>';
  }

  function refrescarLista() {
    const conts = document.querySelectorAll('.valid-lista');
    if (conts.length === 0) return;

    const lista = leerLista(Date.now());
    lista.sort(function (a, b) { return b.ultimaValidacion - a.ultimaValidacion; });

    let html;
    if (estaOculto()) {
      html = '<div class="panel-historial-vacio">Lista oculta. Pulsa ' +
             '&quot;Mostrar lista&quot; para verla.</div>';
    } else if (lista.length === 0) {
      html = '<div class="panel-historial-vacio">No hay tickets validados ' +
             'en las últimas 24 horas.</div>';
    } else {
      html = lista.map(renderItem).join('');
    }

    conts.forEach(function (c) { c.innerHTML = html; });

    document.querySelectorAll('.valid-toggle-btn').forEach(function (b) {
      b.textContent = estaOculto() ? 'Mostrar lista' : 'Ocultar lista';
    });
  }

  /* ============================================================
     AVISO "Ticket ya utilizado"
     ============================================================ */
  function renderAvisoUso(contenedorId, uso) {
    const idAviso = contenedorId + '_aviso_uso';
    const existente = document.getElementById(idAviso);
    if (existente && existente.parentNode) {
      existente.parentNode.removeChild(existente);
    }
    if (!uso) return;

    const banner = document.getElementById(contenedorId);
    if (!banner || !banner.parentNode) return;

    const veces = uso.veces || 1;
    const ts = uso.primeraValidacion || uso.ultimaValidacion || Date.now();
    const cuando = formatFechaCorta(ts);

    let texto = '⚠ Ticket ya utilizado';
    if (veces > 1) texto += ' (' + veces + ' veces)';
    texto += ' — primera validación ' + cuando;

    const aviso = document.createElement('p');
    aviso.id = idAviso;
    aviso.textContent = texto;
    aviso.style.cssText =
      'background:#fff9e6;' +
      'color:#7a5500;' +
      'border-left:4px solid #f2a900;' +
      'padding:10px 14px;' +
      'border-radius:6px;' +
      'font-size:13px;' +
      'font-weight:700;' +
      'margin:12px 0;' +
      'text-align:center;' +
      'line-height:1.4;';
    banner.parentNode.insertBefore(aviso, banner.nextSibling);
  }

  /* ============================================================
     INYECCIÓN DE LA SECCIÓN EN LAS PANTALLAS
     ============================================================ */
  function crearTarjetaHTML(idTarjeta) {
    return '' +
      '<div class="tarjeta" id="' + idTarjeta + '" style="margin-top:16px;">' +
        '<h2 class="seccion-titulo">Tickets validados recientemente</h2>' +
        '<p class="mensaje-info" style="text-align:left;margin:0 0 12px 0;">' +
          'Últimas 24 horas. Aquí puedes verificar los tickets validados ' +
          'y detectar dobles usos.' +
        '</p>' +
        '<div class="valid-lista panel-historial-lista"></div>' +
        '<div class="acciones" style="margin-top:12px;">' +
          '<button type="button" class="btn btn-secundario valid-export-pdf">' +
            'Exportar PDF' +
          '</button>' +
          '<button type="button" class="btn btn-acento valid-export-excel">' +
            'Exportar Excel' +
          '</button>' +
        '</div>' +
        '<div class="acciones" style="margin-top:8px;">' +
          '<button type="button" class="btn btn-secundario valid-toggle-btn">' +
            'Ocultar lista' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function inyectarSeccion() {
    const creador = document.getElementById('pantallaCreador');
    if (creador && !document.getElementById('tarjetaValidacionesCreador')) {
      const main = creador.querySelector('main');
      if (main) {
        main.insertAdjacentHTML('beforeend',
          crearTarjetaHTML('tarjetaValidacionesCreador'));
      }
    }

    const validador = document.getElementById('pantallaValidador');
    if (validador && !document.getElementById('tarjetaValidacionesValidador')) {
      const main = validador.querySelector('main');
      if (main) {
        main.insertAdjacentHTML('beforeend',
          crearTarjetaHTML('tarjetaValidacionesValidador'));
      }
    }

    refrescarLista();
  }

  /* ============================================================
     EXPORTAR A PDF
     ============================================================ */
  function exportarPDF() {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      alert('La librería PDF no está disponible.');
      return;
    }
    const lista = leerLista(Date.now());
    if (lista.length === 0) {
      alert('No hay tickets validados para exportar.');
      return;
    }
    lista.sort(function (a, b) { return b.ultimaValidacion - a.ultimaValidacion; });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(22, 50, 79);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('OSTIKEC', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Tickets validados (últimas 24 horas)', 14, 20);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.text('Fecha de exportación: ' + new Date().toLocaleString('es-ES'), 14, 41);
    doc.text('Total de tickets validados: ' + lista.length, 14, 47);

    const startY = 55;
    const rowH = 7;
    const cols = [
      { x: 14,  label: 'Última' },
      { x: 34,  label: 'Veces' },
      { x: 46,  label: 'Nombre' },
      { x: 82,  label: 'Teléfono' },
      { x: 104, label: 'Campo 4' },
      { x: 126, label: 'Campo 5' },
      { x: 148, label: 'Emitido por' },
      { x: 172, label: 'Tipo' }
    ];

    doc.setFillColor(240, 244, 248);
    doc.rect(10, startY - 5, 190, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 50, 79);
    cols.forEach(function (c) { doc.text(c.label, c.x, startY); });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(7);
    let y = startY + rowH;
    const pageH = 280;

    lista.forEach(function (e) {
      if (y > pageH) { doc.addPage(); y = 20; }
      const d = e.datos || {};
      const fechaTxt = new Date(e.ultimaValidacion).toLocaleString('es-ES',
        { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const tipo = d.demo ? 'DEMO' : 'Real';
      const vals = [
        fechaTxt,
        String(e.veces || 1),
        (d.n || '').substring(0, 24),
        (d.t || '').substring(0, 14),
        (d.a || '').substring(0, 14),
        (d.i || '').substring(0, 14),
        (d.e || '').substring(0, 16),
        tipo
      ];
      vals.forEach(function (v, i) { doc.text(String(v), cols[i].x, y); });
      doc.setDrawColor(230, 230, 230);
      doc.line(10, y + 2, 200, y + 2);
      y += rowH;
    });

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      'OSTIKEC © OSTICOR 2026 — Contacto: osticor.pulsofinanciero@gmail.com',
      105, 290, { align: 'center' }
    );

    doc.save('ostikec_validaciones_' + Date.now() + '.pdf');
  }

  /* ============================================================
     EXPORTAR A EXCEL
     ============================================================ */
  function exportarExcel() {
    if (typeof window.XLSX === 'undefined') {
      alert('La librería Excel no está disponible.');
      return;
    }
    const lista = leerLista(Date.now());
    if (lista.length === 0) {
      alert('No hay tickets validados para exportar.');
      return;
    }
    lista.sort(function (a, b) { return b.ultimaValidacion - a.ultimaValidacion; });

    const filas = [];
    filas.push(['OSTIKEC — Tickets validados (últimas 24 horas)']);
    filas.push(['Fecha de exportación: ' + new Date().toLocaleString('es-ES')]);
    filas.push(['Total de tickets validados: ' + lista.length]);
    filas.push([]);
    filas.push([
      'Última validación', 'Primera validación', 'Veces',
      'Nombre', 'Teléfono', 'Campo 4', 'Campo 5',
      'Emitido por', 'Tipo'
    ]);

    lista.forEach(function (e) {
      const d = e.datos || {};
      filas.push([
        new Date(e.ultimaValidacion).toLocaleString('es-ES'),
        new Date(e.primeraValidacion).toLocaleString('es-ES'),
        e.veces || 1,
        d.n || '',
        d.t || '',
        d.a || '',
        d.i || '',
        d.e || '',
        d.demo ? 'DEMO' : 'Real'
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(filas);
    ws1['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 8 },
      { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 8 }
    ];

    const resumen = { Real: 0, DEMO: 0 };
    lista.forEach(function (e) {
      const t = (e.datos && e.datos.demo) ? 'DEMO' : 'Real';
      resumen[t] = (resumen[t] || 0) + 1;
    });
    const filasR = [['Tipo', 'Cantidad']];
    Object.keys(resumen).forEach(function (k) { filasR.push([k, resumen[k]]); });
    const ws2 = XLSX.utils.aoa_to_sheet(filasR);
    ws2['!cols'] = [{ wch: 20 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Validaciones');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.writeFile(wb, 'ostikec_validaciones_' + Date.now() + '.xlsx');
  }

  /* ============================================================
     DELEGACIÓN DE EVENTOS
     ============================================================ */
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains('valid-export-pdf')) {
      exportarPDF();
    } else if (t.classList.contains('valid-export-excel')) {
      exportarExcel();
    } else if (t.classList.contains('valid-toggle-btn')) {
      toggleOculto();
    }
  });

  /* ============================================================
     WRAPPER: RESULTADO DEL CREADOR
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidacion !== 'function') return;
    const orig = window.mostrarResultadoValidacion;

    window.mostrarResultadoValidacion = function (esValido, datos, error) {
      orig.apply(this, arguments);

      if (esValido && datos) {
        const hash = hashTicket(datos);
        const usoPrevio = buscarUsoReciente(hash);

        if (REGISTRAR_DESDE_CREADOR) {
          const ent = registrar(datos, 'creador');
          renderAvisoUso('bannerValidacion', usoPrevio ? ent : null);
        } else {
          renderAvisoUso('bannerValidacion', usoPrevio);
        }
      } else {
        renderAvisoUso('bannerValidacion', null);
      }

      refrescarLista();
    };
  })();

  /* ============================================================
     WRAPPER: RESULTADO DEL VALIDADOR
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidador !== 'function') return;
    const orig = window.mostrarResultadoValidador;

    window.mostrarResultadoValidador = function (resultado) {
      orig.apply(this, arguments);

      if (resultado && resultado.valido && resultado.datos) {
        const hash = hashTicket(resultado.datos);
        const usoPrevio = buscarUsoReciente(hash);
        const ent = registrar(resultado.datos, 'validador');
        renderAvisoUso('bannerValidacion3', usoPrevio ? ent : null);
      } else {
        renderAvisoUso('bannerValidacion3', null);
      }

      refrescarLista();
    };
  })();

  /* ============================================================
     API PÚBLICA
     ============================================================ */
  window.OSTIKEC_VALIDACIONES = {
    listar:       function () { return leerLista(Date.now()); },
    buscar:       buscarUsoReciente,
    hashTicket:   hashTicket,
    refrescar:    refrescarLista,
    estaOculto:   estaOculto,
    toggleOculto: toggleOculto,

    /* Solo para desarrollo: borra TODAS las validaciones. */
    limpiarTodo: function () {
      if (!confirm('Borrar TODAS las validaciones almacenadas. ¿Continuar?')) return;
      guardarLista([]);
      refrescarLista();
    }
  };

  /* ============================================================
     ARRANQUE
     ============================================================ */
  function init() {
    if (typeof window.sha256Hex !== 'function') {
      console.warn('validaciones.js: sha256Hex no disponible. Se desactiva.');
      return;
    }
    inyectarSeccion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 1500);
    });
  } else {
    setTimeout(init, 1500);
  }

})();