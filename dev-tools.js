/* ============================================================================
   DEV-TOOLS.JS — Herramientas de desarrollo de OSTIKEC (v2)
   ============================================================================
   
   ⚠️ SOLO PARA LA VERSIÓN "OSTIKEC PRO" DEL DESARROLLADOR.
   NO incluir en el ZIP de la versión de usuarios.
   
   INSTALACIÓN:
     1. Copiar este archivo a la carpeta raíz.
     2. En index.html (SOLO en la versión de desarrollo), añadir al final
        del <body>, DESPUÉS de bloqueo.js:
          <script src="dev-tools.js"></script>
     3. Incluir el archivo en el ZIP de desarrollo.
     4. NO incluir en el ZIP de usuarios.
   
   DOBLE SEGURIDAD:
     - Cambiar ACTIVAR = false antes de compilar la APK de usuarios.
     - O simplemente NO cargar el <script> en el index.html de usuarios.
   
   FUNCIONA CON O SIN window.OSTIKEC:
     - Si extras.js está cargado, usa sus helpers (leerJSON, sha256Hex, etc.).
     - Si no, usa localStorage directo como fallback.
   
   SECCIONES:
     1.  Calculadora de hash de licencia
     2.  Calculadora de PIN maestro (para usuarios remotos)
     3.  Otros hashes (huella, PIN personal, firma QR)
     4.  Diagnóstico de fallos (para debug del log)
     5.  Estado del sistema
     6.  Verificación de sesión
     7.  Visor de JSON remotos (blocked, update, licencias, etc.)
     8.  Sincronización manual
     9.  Inspector de localStorage
     10. Editor de clave específica
     11. Limpiar datos selectivamente
     12. Generar QR de prueba
     13. Test de validación end-to-end
   ============================================================================ */

(function () {
  'use strict';

  /* ⚠️ CAMBIAR A false ANTES DE COMPILAR PARA USUARIOS */
  const ACTIVAR = true;
  if (!ACTIVAR) return;
  if (window.__ostikec_dev_tools_loaded) return;
  window.__ostikec_dev_tools_loaded = true;

  const ID_TARJETA = 'tarjetaDevTools';
  const BASE_URL = 'https://osticor-pulsofinanciero.github.io/ostikec/';

  /* ============================================================
     UTILIDADES CON FALLBACK
     ============================================================ */
  function OST() { return window.OSTIKEC || null; }

  function sha256(str) {
    try {
      if (typeof window.sha256Hex === 'function') return window.sha256Hex(String(str));
      const o = OST();
      if (o && typeof o.sha256Hex === 'function') return o.sha256Hex(String(str));
    } catch (e) {}
    return null;
  }

  function getJSON(k, def) {
    try {
      const o = OST();
      if (o && typeof o.leerJSON === 'function') return o.leerJSON(k, def);
      const raw = localStorage.getItem(k);
      if (!raw) return def;
      return JSON.parse(raw);
    } catch (e) { return def; }
  }

  function setJSON(k, v) {
    try {
      const o = OST();
      if (o && typeof o.guardarJSON === 'function') { o.guardarJSON(k, v); return true; }
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) { return false; }
  }

  function getClaveSecreta() {
    try {
      if (typeof CLAVE_SECRETA !== 'undefined' && CLAVE_SECRETA) return String(CLAVE_SECRETA);
    } catch (e) {}
    return null;
  }

  function flash(msg) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'background:#16324f;color:#fff;padding:12px 20px;border-radius:8px;' +
      'z-index:2147483647;font-weight:700;font-size:13px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.4);max-width:90%;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function copiar(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(
        function () { flash('✅ Copiado'); },
        function () { prompt('Copia manualmente:', t); }
      );
    } else {
      prompt('Copia manualmente:', t);
    }
  }

  /* ============================================================
     HTML
     ============================================================ */
  function htmlTarjeta() {
    return '' +
    '<div class="tarjeta" id="' + ID_TARJETA + '" style="margin-top:16px;border:2px dashed #991b1b;">' +
      '<h2 class="seccion-titulo" style="color:#991b1b;border-bottom-color:#991b1b;">🛠️ Herramientas de desarrollo</h2>' +
      '<p style="font-size:11px;color:#991b1b;margin:0 0 14px 0;font-weight:600;">Solo en OSTIKEC PRO (desarrollo). Nunca en el ZIP de usuarios.</p>' +

      /* 1. Hash de licencia */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🔑 Calculadora de hash de licencia</summary>' +
        '<div style="margin-top:12px;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Teléfono</label>' +
          '<input id="devTelLic" type="tel" placeholder="54089688" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Licencia</label>' +
          '<input id="devCodigoLic" type="text" placeholder="OT-C001-88-O" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:10px;box-sizing:border-box;">' +
          '<button type="button" id="devCalcLic" style="width:100%;padding:10px;background:#16324f;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Calcular hash</button>' +
          '<div id="devResLic" style="margin-top:10px;font-size:12px;font-family:monospace;word-break:break-all;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
          '<div style="margin-top:8px;font-size:10px;color:#64748b;">' +
            'Cadena: <code>Ostikec-Salt-Licencias-2026-v1|TELEFONO|LICENCIA</code>. ' +
            'Sirve para añadir a <code>licencias.json</code> o <code>USUARIOS_AUTORIZADOS</code>.' +
          '</div>' +
        '</div>' +
      '</details>' +

      /* 2. PIN maestro remoto */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🔐 Calculadora de PIN maestro (usuarios remotos)</summary>' +
        '<div style="margin-top:12px;">' +
          '<p style="font-size:11px;color:#475569;margin:0 0 10px 0;">Para usuarios que olvidaron ambos PINs. Introduce su teléfono y licencia (que él conoce). Opcionalmente su huella (del reporte de Telegram) para verificar.</p>' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Teléfono del usuario</label>' +
          '<input id="devTelPin" type="tel" placeholder="54089688" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Licencia del usuario</label>' +
          '<input id="devLicPin" type="text" placeholder="OT-C001-88-O" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Huella (opcional, solo para verificar)</label>' +
          '<input id="devHuellaPin" type="text" placeholder="a1b2c3d4e5f6a7b8" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:10px;box-sizing:border-box;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Fórmula</label>' +
          '<select id="devModoPin" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:10px;box-sizing:border-box;">' +
            '<option value="actual">PIN maestro actual (tel + licencia + CLAVE_SECRETA)</option>' +
            '<option value="huella">PIN maestro con huella (tel + licencia + huella + CLAVE_SECRETA)</option>' +
          '</select>' +
          '<button type="button" id="devCalcPinMaestro" style="width:100%;padding:10px;background:#16324f;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Calcular PIN maestro</button>' +
          '<div id="devResPinMaestro" style="margin-top:10px;font-size:12px;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
        '</div>' +
      '</details>' +

      /* 3. Otros hashes */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🧮 Otros hashes</summary>' +
        '<div style="margin-top:12px;">' +
          '<button type="button" data-hash="device" style="width:100%;padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Huella del dispositivo actual</button>' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin:8px 0 4px 0;">PIN personal (4 dígitos)</label>' +
          '<input id="devPinPersonal" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:6px;box-sizing:border-box;text-align:center;letter-spacing:8px;">' +
          '<button type="button" data-hash="pin" style="width:100%;padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:8px;">Calcular hash del PIN personal</button>' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin:8px 0 4px 0;">JSON del ticket (para firma QR)</label>' +
          '<textarea id="devJSONFirma" rows="3" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:11px;font-family:monospace;margin-bottom:6px;box-sizing:border-box;">{"f":"15/10/26","n":"Prueba","t":"55555555","a":"A-1","i":"SVC-1","e":"54089688"}</textarea>' +
          '<button type="button" data-hash="firma" style="width:100%;padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Calcular firma QR</button>' +
          '<div id="devResHash" style="margin-top:10px;font-size:12px;font-family:monospace;word-break:break-all;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
        '</div>' +
      '</details>' +

      /* 4. Diagnóstico de fallos */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#991b1b;font-size:13px;">🐞 Diagnóstico del log de fallos</summary>' +
        '<div style="margin-top:12px;">' +
          '<p style="font-size:11px;color:#475569;margin:0 0 10px 0;">Diagnostica por qué las validaciones fallidas no se registran en el panel de Seguridad.</p>' +
          '<button type="button" id="devDiagFallos" style="width:100%;padding:8px;background:#16324f;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Ejecutar diagnóstico completo</button>' +
          '<button type="button" id="devActivarLog" style="width:100%;padding:8px;background:#f2a900;color:#16324f;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Forzar activación del switch</button>' +
          '<button type="button" id="devTestFallo" style="width:100%;padding:8px;background:#f2a900;color:#16324f;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Simular fallo manualmente</button>' +
          '<button type="button" id="devVerLogFallos" style="width:100%;padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Ver contenido del log</button>' +
          '<div id="devResDiagFallos" style="margin-top:10px;font-size:11px;background:#f8fafc;padding:8px;border-radius:6px;display:none;max-height:400px;overflow-y:auto;"></div>' +
        '</div>' +
      '</details>' +

      /* 5. Estado del sistema */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">📊 Estado del sistema</summary>' +
        '<div id="devEstado" style="margin-top:12px;font-size:12px;line-height:1.6;"></div>' +
        '<button type="button" id="devRefreshEstado" style="width:100%;padding:8px;background:#16324f;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-top:10px;">Refrescar</button>' +
      '</details>' +

      /* 6. Verificación de sesión */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🔍 Verificación de sesión</summary>' +
        '<div id="devEstadoSesion" style="margin-top:12px;font-size:12px;line-height:1.6;"></div>' +
        '<button type="button" id="devRefreshSesion" style="width:100%;padding:8px;background:#16324f;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-top:10px;">Refrescar</button>' +
      '</details>' +

      /* 7. Visor de JSON remotos */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🌐 Visor de archivos remotos</summary>' +
        '<div style="margin-top:12px;">' +
          '<p style="font-size:11px;color:#475569;margin:0 0 10px 0;">Verifica el estado de los archivos en el repositorio.</p>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">' +
            '<button type="button" data-json="blocked" style="padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">blocked.json</button>' +
            '<button type="button" data-json="update" style="padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">update.json</button>' +
            '<button type="button" data-json="licencias" style="padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">licencias.json</button>' +
            '<button type="button" data-json="enviar-error" style="padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">enviar-error.json</button>' +
            '<button type="button" data-json="privacidad" style="padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">privacidad.html</button>' +
            '<button type="button" data-json="manual" style="padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">manual.html</button>' +
          '</div>' +
          '<div id="devResJSON" style="font-size:11px;background:#f8fafc;padding:8px;border-radius:6px;display:none;max-height:400px;overflow-y:auto;"></div>' +
        '</div>' +
      '</details>' +

      /* 8. Sync manual */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🔄 Sincronización manual</summary>' +
        '<div style="margin-top:12px;">' +
          '<button type="button" id="devSyncLic" style="width:100%;padding:8px;background:#f2a900;color:#16324f;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Sincronizar licencias</button>' +
          '<button type="button" id="devSyncBlock" style="width:100%;padding:8px;background:#f2a900;color:#16324f;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Descargar blocked.json</button>' +
          '<button type="button" id="devSyncUpdate" style="width:100%;padding:8px;background:#f2a900;color:#16324f;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Consultar update.json</button>' +
          '<button type="button" id="devResetUpdate" style="width:100%;padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Borrar cache de update</button>' +
          '<div id="devResSync" style="margin-top:10px;font-size:12px;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
        '</div>' +
      '</details>' +

      /* 9. Inspector localStorage */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">💾 Inspector de localStorage</summary>' +
        '<div style="margin-top:12px;">' +
          '<input id="devBuscarClave" type="text" placeholder="Buscar clave..." style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:12px;margin-bottom:6px;box-sizing:border-box;">' +
          '<button type="button" id="devInspect" style="width:100%;padding:8px;background:#16324f;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Listar claves</button>' +
          '<button type="button" id="devExport" style="width:100%;padding:8px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Exportar TODO a JSON</button>' +
          '<div id="devResInspect" style="margin-top:10px;font-size:11px;font-family:monospace;background:#f8fafc;padding:8px;border-radius:6px;max-height:400px;overflow-y:auto;display:none;"></div>' +
        '</div>' +
      '</details>' +

      /* 10. Editor de clave */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">✏️ Editar clave específica</summary>' +
        '<div style="margin-top:12px;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Nombre exacto de la clave</label>' +
          '<input id="devClaveEditar" type="text" placeholder="ostikec_negocios" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:12px;margin-bottom:6px;box-sizing:border-box;">' +
          '<button type="button" id="devCargarClave" style="width:100%;padding:8px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Cargar valor actual</button>' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Valor (editable)</label>' +
          '<textarea id="devValorClave" rows="8" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:11px;font-family:monospace;margin-bottom:6px;box-sizing:border-box;"></textarea>' +
          '<button type="button" id="devGuardarClave" style="width:100%;padding:8px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Guardar cambios</button>' +
          '<button type="button" id="devExportarClave" style="width:100%;padding:8px;background:#f2a900;color:#16324f;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Exportar esta clave</button>' +
          '<button type="button" id="devEliminarClave" style="width:100%;padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:6px;">Eliminar esta clave</button>' +
          '<div id="devResClave" style="margin-top:10px;font-size:11px;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
        '</div>' +
      '</details>' +

      /* 11. Limpiar */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#991b1b;font-size:13px;">🗑️ Limpiar datos selectivamente</summary>' +
        '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
          '<button type="button" data-clean="historial" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Historial</button>' +
          '<button type="button" data-clean="validaciones" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Validaciones</button>' +
          '<button type="button" data-clean="logfallos" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Log fallos</button>' +
          '<button type="button" data-clean="logerrores" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Log errores</button>' +
          '<button type="button" data-clean="trial" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Prueba</button>' +
          '<button type="button" data-clean="pin" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">PIN</button>' +
          '<button type="button" data-clean="sesion" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Sesión</button>' +
          '<button type="button" data-clean="listanegra" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Lista negra</button>' +
          '<button type="button" data-clean="cachelic" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Cache licencias</button>' +
          '<button type="button" data-clean="updatecache" style="padding:8px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:inherit;font-size:11px;">Cache update</button>' +
          '<button type="button" data-clean="TODO" style="grid-column:span 2;padding:8px;background:#991b1b;color:#fff;border:none;border-radius:6px;font-weight:800;cursor:pointer;font-family:inherit;font-size:11px;">⚠️ BORRAR TODO</button>' +
        '</div>' +
        '<div id="devResClean" style="margin-top:10px;font-size:11px;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
      '</details>' +

      /* 12. Generar QR */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🎫 Generar QR de prueba</summary>' +
        '<div style="margin-top:12px;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Nombre</label>' +
          '<input id="devQRNombre" type="text" value="Juan Pérez" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Fecha (DD/MM/AA)</label>' +
          '<input id="devQRFecha" type="text" placeholder="15/10/26" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">' +
          '<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;"><input id="devQRDemo" type="checkbox" style="width:18px;height:18px;"> Demo</label>' +
          '<button type="button" id="devGenQR" style="width:100%;padding:10px;background:#16324f;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Generar QR</button>' +
          '<canvas id="devQRCanvas" style="display:none;max-width:100%;background:#fff;padding:10px;border-radius:6px;"></canvas>' +
          '<div id="devResQR" style="margin-top:10px;font-size:11px;font-family:monospace;word-break:break-all;background:#f8fafc;padding:8px;border-radius:6px;display:none;"></div>' +
        '</div>' +
      '</details>' +

      /* 13. Test validación */
      '<details style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">' +
        '<summary style="cursor:pointer;font-weight:700;color:#16324f;font-size:13px;">🧪 Test de validación end-to-end</summary>' +
        '<div style="margin-top:12px;">' +
          '<p style="font-size:11px;color:#475569;margin:0 0 10px 0;">Genera un ticket, lo valida, y muestra todos los avisos (fecha vencida, uso previo, etc.).</p>' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;">Escenario</label>' +
          '<select id="devTestEscenario" style="width:100%;padding:8px;border:2px solid #cbd5e1;border-radius:8px;font-size:12px;margin-bottom:8px;box-sizing:border-box;">' +
            '<option value="valido-hoy">Ticket válido con fecha de hoy</option>' +
            '<option value="valido-viejo">Ticket válido con fecha de hace 5 días</option>' +
            '<option value="invalido-firma">Ticket con firma incorrecta</option>' +
            '<option value="formato-invalido">QR con formato no-OSTIKEC</option>' +
            '<option value="doble-uso">Dos usos del mismo ticket</option>' +
          '</select>' +
          '<button type="button" id="devTestValidacion" style="width:100%;padding:10px;background:#16324f;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Ejecutar test</button>' +
          '<div id="devResTestValidacion" style="margin-top:10px;font-size:11px;background:#f8fafc;padding:8px;border-radius:6px;display:none;max-height:400px;overflow-y:auto;"></div>' +
        '</div>' +
      '</details>' +

    '</div>';
  }

  /* ============================================================
     HANDLERS
     ============================================================ */

  /* --- 1. Hash de licencia --- */
  function calcHashLic() {
    const tel = (document.getElementById('devTelLic').value || '').trim();
    const lic = (document.getElementById('devCodigoLic').value || '').trim().toUpperCase();
    const res = document.getElementById('devResLic');

    if (!tel || !lic) { flash('Introduce teléfono y licencia'); return; }
    if (typeof window.calcularHashCredencial !== 'function') {
      flash('Función calcularHashCredencial no disponible'); return;
    }

    let hash;
    try { hash = window.calcularHashCredencial(tel, lic); }
    catch (e) { flash('Error calculando hash'); return; }
    if (!hash) { flash('Hash vacío'); return; }

    const hashUp = hash.toUpperCase();
    const hashShort = hashUp.substring(0, 16);

    res.style.display = 'block';
    res.innerHTML =
      '<div style="margin-bottom:10px;">' +
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px;">HASH COMPLETO (64 hex)</div>' +
        '<div style="color:#16324f;font-weight:700;user-select:all;margin-bottom:4px;">' + hashUp + '</div>' +
        '<button type="button" data-copy="' + esc(hashUp) + '" style="padding:4px 8px;background:#16324f;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar completo</button>' +
      '</div>' +
      '<div style="margin-bottom:10px;">' +
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px;">HASH CORTO (16 hex, para Telegram)</div>' +
        '<div style="color:#16324f;font-weight:700;user-select:all;">' + hashShort + '</div>' +
      '</div>' +
      '<div style="margin-bottom:10px;">' +
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px;">ENTRADA PARA licencias.json</div>' +
        '<textarea readonly rows="3" style="width:100%;padding:6px;border:2px solid #cbd5e1;border-radius:6px;font-size:10px;font-family:monospace;box-sizing:border-box;" id="devJSONLic">' +
          '{\n  "hashCred": "' + hashUp + '",\n  "tipo": "creador"\n}' +
        '</textarea>' +
        '<button type="button" data-copy="' + esc('{ "hashCred": "' + hashUp + '", "tipo": "creador" }') + '" style="margin-top:4px;padding:4px 8px;background:#16a34a;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar JSON</button>' +
      '</div>' +
      '<div style="font-size:10px;color:#64748b;">' +
        'Cadena: <code>Ostikec-Salt-Licencias-2026-v1|' + esc(tel) + '|' + esc(lic) + '</code>' +
      '</div>';

    res.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { copiar(this.dataset.copy); });
    });
  }

  /* --- 2. PIN maestro remoto --- */
  function calcPinMaestroRemoto() {
    const tel = (document.getElementById('devTelPin').value || '').trim();
    const lic = (document.getElementById('devLicPin').value || '').trim().toUpperCase();
    const huella = (document.getElementById('devHuellaPin').value || '').trim();
    const modo = document.getElementById('devModoPin').value;
    const res = document.getElementById('devResPinMaestro');

    if (!tel || !lic) { flash('Introduce teléfono y licencia'); return; }
    const clave = getClaveSecreta();
    if (!clave) { flash('CLAVE_SECRETA no disponible'); return; }

    let semilla, etiqueta;
    if (modo === 'huella') {
      if (!huella) { flash('La fórmula con huella requiere el campo huella'); return; }
      semilla = tel + lic + huella + clave;
      etiqueta = 'PIN maestro con huella (futuro)';
    } else {
      semilla = tel + lic + clave;
      etiqueta = 'PIN maestro actual';
    }

    const hash = sha256(semilla);
    if (!hash) { flash('Error calculando hash'); return; }
    const pin = hash.substring(0, 6).toUpperCase();

    /* Verificar si hay sesión activa para comparar */
    let sesion = null;
    try { sesion = JSON.parse(localStorage.getItem('ostikec_sesion') || 'null'); } catch (e) {}
    let huellaActual = null;
    if (typeof window.huellaDispositivo === 'function') {
      try { huellaActual = window.huellaDispositivo(); } catch (e) {}
    }

    const avisos = [];
    if (huella && huellaActual && huella !== huellaActual) {
      avisos.push('⚠️ La huella introducida NO coincide con la huella actual del dispositivo.');
    }
    if (sesion && sesion.huella) {
      if (huella && huella !== sesion.huella) {
        avisos.push('⚠️ La huella introducida NO coincide con la de la sesión actual.');
      }
      if (sesion.tel && sesion.tel !== tel) {
        avisos.push('⚠️ El teléfono introducido NO coincide con el de la sesión actual.');
      }
    }

    res.style.display = 'block';
    res.innerHTML =
      '<div style="margin-bottom:10px;">' +
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px;">' + esc(etiqueta) + '</div>' +
        '<div style="color:#16324f;font-weight:800;font-size:26px;user-select:all;letter-spacing:2px;">' + esc(pin) + '</div>' +
        '<button type="button" data-copy="' + esc(pin) + '" style="margin-top:4px;padding:4px 8px;background:#16324f;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar PIN</button>' +
      '</div>' +
      (avisos.length > 0 ? '<div style="padding:8px;background:#fff9e6;border-left:3px solid #f2a900;border-radius:4px;font-size:10px;color:#7a5500;margin-bottom:8px;">' + avisos.join('<br>') + '</div>' : '') +
      '<div style="font-size:10px;color:#64748b;line-height:1.5;">' +
        'Fórmula: <code>sha256(' + esc(modo === 'huella' ? 'tel + lic + huella + CLAVE_SECRETA' : 'tel + lic + CLAVE_SECRETA') + ')[0..6]</code><br>' +
        'Comunica este PIN al usuario. Él lo introduce en el modal del panel en lugar de su PIN personal.' +
      '</div>';

    res.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { copiar(this.dataset.copy); });
    });
  }

  /* --- 3. Otros hashes --- */
  function calcHashOtro(tipo) {
    const res = document.getElementById('devResHash');
    let contenido = '';

    if (tipo === 'device') {
      if (typeof window.huellaDispositivo !== 'function') { flash('Función no disponible'); return; }
      const h = window.huellaDispositivo();
      contenido =
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:4px;">HUELLA DEL DISPOSITIVO (16 hex)</div>' +
        '<div style="color:#16324f;font-weight:700;user-select:all;margin-bottom:4px;">' + esc(h) + '</div>' +
        '<button type="button" data-copy="' + esc(h) + '" style="padding:4px 8px;background:#16324f;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar</button>' +
        '<div style="font-size:10px;color:#64748b;margin-top:8px;">Verifica que la sesión guardada pertenece al mismo dispositivo.</div>';
    } else if (tipo === 'pin') {
      const input = document.getElementById('devPinPersonal');
      const pin = (input ? input.value : '').trim();
      if (!/^\d{4}$/.test(pin)) { flash('Introduce 4 dígitos'); return; }
      const h = sha256(pin);
      if (!h) { flash('Error'); return; }
      const hu = h.toUpperCase();
      contenido =
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:4px;">HASH DEL PIN (64 hex)</div>' +
        '<div style="color:#16324f;font-weight:700;user-select:all;word-break:break-all;margin-bottom:4px;">' + esc(hu) + '</div>' +
        '<button type="button" data-copy="' + esc(hu) + '" style="padding:4px 8px;background:#16324f;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar</button>' +
        '<div style="font-size:10px;color:#64748b;margin-top:8px;">Lo que se guarda al configurar un PIN personal. El PIN en claro nunca se almacena.</div>';
    } else if (tipo === 'firma') {
      const json = (document.getElementById('devJSONFirma').value || '').trim();
      if (!json) { flash('Introduce un JSON'); return; }
      try { JSON.parse(json); } catch (e) { flash('JSON inválido'); return; }
      const clave = getClaveSecreta();
      if (!clave) { flash('CLAVE_SECRETA no disponible'); return; }
      const h = sha256(clave + json);
      if (!h) { flash('Error'); return; }
      const firma = h.substring(0, 12).toUpperCase();
      contenido =
        '<div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:4px;">FIRMA DEL QR (12 hex)</div>' +
        '<div style="color:#16324f;font-weight:800;font-size:18px;user-select:all;">' + esc(firma) + '</div>' +
        '<div style="font-size:10px;color:#64748b;margin-top:8px;">sha256(CLAVE_SECRETA + JSON)[0..12]. Parte final del QR: <code>OTK1|cifrado|firma</code>.</div>';
    }

    res.style.display = 'block';
    res.innerHTML = contenido;
    res.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { copiar(this.dataset.copy); });
    });
  }

  /* --- 4. Diagnóstico de fallos --- */
  function diagFallos() {
    const res = document.getElementById('devResDiagFallos');
    if (!res) return;
    res.style.display = 'block';
    res.innerHTML = '⏳ Ejecutando diagnóstico...';

    const checks = [];

    /* 1. switch */
    let seg = null;
    try { seg = OST() && OST().leerSeguridad ? OST().leerSeguridad() : JSON.parse(localStorage.getItem('ostikec_seguridad') || 'null'); }
    catch (e) {}
    checks.push({
      ok: !!(seg && seg.logFallos),
      label: 'Switch "logFallos" activo',
      detalle: seg ? (seg.logFallos ? 'SÍ' : 'NO — actívalo en Panel > Seguridad') : 'No se pudo leer'
    });

    /* 2. log actual */
    let log = [];
    try { log = JSON.parse(localStorage.getItem('ostikec_log_fallos') || '[]'); } catch (e) {}
    if (!Array.isArray(log)) log = [];
    checks.push({
      ok: log.length > 0,
      label: 'Entradas en el log',
      detalle: log.length + ' entradas'
    });

    /* 3. wrapper */
    let wrapper = '';
    try { wrapper = String(window.mostrarResultadoValidacion || ''); } catch (e) {}
    const tieneLlamada = wrapper.indexOf('agregarFalloLog') !== -1;
    checks.push({
      ok: tieneLlamada,
      label: 'Wrapper creador llama a agregarFalloLog',
      detalle: tieneLlamada ? 'SÍ' : 'NO — revisa extras.js sección 20 o la caché del navegador'
    });

    /* 4. test end-to-end */
    const antes = log.length;
    let testError = null;
    try {
      if (typeof window.mostrarResultadoValidacion === 'function') {
        window.mostrarResultadoValidacion(false, null, 'TEST-DIAG-' + Date.now());
      }
    } catch (e) { testError = e.message; }

    setTimeout(function () {
      let despues = [];
      try { despues = JSON.parse(localStorage.getItem('ostikec_log_fallos') || '[]'); } catch (e) {}
      if (!Array.isArray(despues)) despues = [];
      const inc = despues.length - antes;
      checks.push({
        ok: inc > 0,
        label: 'Test end-to-end (simular fallo)',
        detalle: inc > 0 ? 'SÍ, +' + inc + ' entrada' : (testError ? 'ERROR: ' + testError : 'NO se añadió entrada')
      });

      /* render */
      let html = '';
      checks.forEach(function (c) {
        html += '<div style="padding:8px;margin-bottom:6px;background:' + (c.ok ? '#dcfce7' : '#fee2e2') + ';border-left:3px solid ' + (c.ok ? '#166534' : '#991b1b') + ';border-radius:4px;">' +
          '<div style="font-weight:700;color:' + (c.ok ? '#166534' : '#991b1b') + ';">' + (c.ok ? '✓' : '✗') + ' ' + esc(c.label) + '</div>' +
          '<div style="color:#475569;font-size:10px;margin-top:2px;">' + esc(c.detalle) + '</div>' +
        '</div>';
      });
      const ok = checks.every(function (c) { return c.ok; });
      html += '<div style="padding:8px;background:#eef2f7;border-radius:4px;font-size:10px;color:#16324f;margin-top:8px;">' +
        (ok ? '✅ Todo funciona. Si el panel sigue vacío, ciérralo y vuelve a abrirlo.' :
          '⚠️ Hay problemas arriba. Sigue las instrucciones de cada ✗.') +
      '</div>';
      res.innerHTML = html;
    }, 200);
  }

  function activarLogFallos() {
    try {
      const o = OST();
      if (o && typeof o.leerSeguridad === 'function' && typeof o.guardarSeguridad === 'function') {
        const s = o.leerSeguridad();
        s.logFallos = true;
        o.guardarSeguridad(s);
        flash('✅ Switch activado');
        diagFallos();
        return;
      }
      /* fallback */
      const raw = localStorage.getItem('ostikec_seguridad');
      const s = raw ? JSON.parse(raw) : { modoCiego: false, logFallos: true };
      s.logFallos = true;
      localStorage.setItem('ostikec_seguridad', JSON.stringify(s));
      flash('✅ Switch activado (fallback)');
      diagFallos();
    } catch (e) { flash('Error: ' + e.message); }
  }

  function testFalloManual() {
    if (typeof window.mostrarResultadoValidacion !== 'function') { flash('Función no disponible'); return; }
    try {
      window.mostrarResultadoValidacion(false, null, 'TEST-MANUAL-' + Date.now());
      setTimeout(function () {
        const log = JSON.parse(localStorage.getItem('ostikec_log_fallos') || '[]');
        flash('Log ahora tiene ' + log.length + ' entradas');
      }, 100);
    } catch (e) { flash('Error: ' + e.message); }
  }

  function verLogFallos() {
    const res = document.getElementById('devResDiagFallos');
    res.style.display = 'block';
    let log = [];
    try { log = JSON.parse(localStorage.getItem('ostikec_log_fallos') || '[]'); } catch (e) {}
    if (!Array.isArray(log) || log.length === 0) {
      res.innerHTML = '<div style="font-size:11px;color:#64748b;font-style:italic;">Log vacío</div>';
      return;
    }
    let html = '<div style="font-size:11px;">';
    log.slice(-20).reverse().forEach(function (e) {
      html += '<div style="padding:6px;background:#fff;margin-bottom:4px;border-left:2px solid #991b1b;border-radius:4px;">' +
        '<div style="color:#991b1b;font-weight:700;">' + esc(e.motivo || '?') + '</div>' +
        '<div style="color:#64748b;font-size:10px;">' + esc(e.fecha || '') + '</div>' +
      '</div>';
    });
    html += '</div>';
    res.innerHTML = html;
  }

  /* --- 5. Estado sistema --- */
  function refrescarEstado() {
    const el = document.getElementById('devEstado');
    if (!el) return;
    const partes = [];
    partes.push('<div><b>Versión:</b> ' + esc(window.VERSION_APP || '—') + '</div>');

    const mods = ['OSTIKEC','OSTIKEC_PANEL','OSTIKEC_TRIAL','OSTIKEC_UPDATE','OSTIKEC_TOUR','OSTIKEC_ERROR_REPORT','OSTIKEC_LICENCIAS','OSTIKEC_VALIDACIONES'];
    partes.push('<div style="margin-top:6px;"><b>Módulos:</b><br>' +
      mods.map(function (m) {
        const ok = typeof window[m] !== 'undefined';
        return '<span style="color:' + (ok ? '#166534' : '#991b1b') + ';">' + m + ': ' + (ok ? '✓' : '✗') + '</span>';
      }).join('<br>') + '</div>');

    try {
      const ses = JSON.parse(localStorage.getItem('ostikec_sesion') || 'null');
      partes.push('<div style="margin-top:6px;"><b>Sesión:</b> ' + (ses ? esc(ses.tel) + ' · ' + esc(ses.tipo) : 'sin sesión') + '</div>');
    } catch (e) {}

    let hist = [];
    try { hist = JSON.parse(localStorage.getItem('ostikec_historial') || '[]'); } catch (e) {}
    partes.push('<div><b>Historial:</b> ' + hist.length + '</div>');

    let val = [];
    try { val = JSON.parse(localStorage.getItem('ostikec_validaciones') || '[]'); } catch (e) {}
    partes.push('<div><b>Validaciones:</b> ' + val.length + '</div>');

    let lf = [];
    try { lf = JSON.parse(localStorage.getItem('ostikec_log_fallos') || '[]'); } catch (e) {}
    partes.push('<div><b>Log fallos:</b> ' + lf.length + '</div>');

    let le = [];
    try { le = JSON.parse(localStorage.getItem('ostikec_log_errores') || '[]'); } catch (e) {}
    partes.push('<div><b>Log errores:</b> ' + le.length + '</div>');

    if (window.OSTIKEC_LICENCIAS) {
      try {
        const u = window.OSTIKEC_LICENCIAS.ultimaSync();
        partes.push('<div style="margin-top:6px;"><b>Licencias:</b> bootstrap=' +
          window.OSTIKEC_LICENCIAS.totalBootstrap() + ' · cache=' +
          window.OSTIKEC_LICENCIAS.totalCache() + '</div>');
        partes.push('<div style="font-size:10px;color:#64748b;">Última sync: ' + (u ? new Date(u).toLocaleString() : 'nunca') + '</div>');
      } catch (e) {}
    }

    if (window.OSTIKEC_TRIAL) {
      try {
        const t = window.OSTIKEC_TRIAL.leer();
        if (t) {
          partes.push('<div style="margin-top:6px;"><b>Prueba:</b> ' + (t.agotada ? 'agotada' : (12 - (t.usados || 0)) + ' restantes') + '</div>');
        }
      } catch (e) {}
    }

    try {
      const u = parseInt(localStorage.getItem('ostikec_update_last_check') || '0', 10);
      if (u) partes.push('<div style="margin-top:6px;font-size:10px;color:#64748b;">Update check: ' + new Date(u).toLocaleString() + '</div>');
    } catch (e) {}

    try {
      const ln = JSON.parse(localStorage.getItem('ostikec_lista_negra') || 'null');
      partes.push('<div><b>Lista negra:</b> ' + (ln && ln.bloqueados ? ln.bloqueados.length : 'no descargada') + '</div>');
    } catch (e) {}

    el.innerHTML = partes.join('');
  }

  /* --- 6. Sesión --- */
  function refrescarEstadoSesion() {
    const el = document.getElementById('devEstadoSesion');
    if (!el) return;
    let ses = null;
    try { ses = JSON.parse(localStorage.getItem('ostikec_sesion') || 'null'); } catch (e) {}

    if (!ses) { el.innerHTML = '<div style="font-size:12px;">Sin sesión guardada.</div>'; return; }

    let huellaActual = null;
    if (typeof window.huellaDispositivo === 'function') {
      try { huellaActual = window.huellaDispositivo(); } catch (e) {}
    }
    const coincide = ses.huella && ses.huella === huellaActual;

    let autorizado = null;
    if (typeof window.calcularHashCredencial === 'function' && window.OSTIKEC_LICENCIAS) {
      try {
        const h = window.calcularHashCredencial(ses.tel, ses.licencia);
        const r = window.OSTIKEC_LICENCIAS.verificar(h);
        autorizado = r ? 'SÍ (' + r.origen + ')' : 'NO';
      } catch (e) {}
    }

    el.innerHTML =
      '<div style="font-size:11px;line-height:1.7;">' +
      '<div><b>Teléfono:</b> ' + esc(ses.tel) + '</div>' +
      '<div><b>Licencia:</b> ' + esc(ses.licencia) + '</div>' +
      '<div><b>Tipo:</b> ' + esc(ses.tipo) + '</div>' +
      '<div><b>Huella guardada:</b> <code>' + esc(ses.huella || '—') + '</code></div>' +
      '<div><b>Huella actual:</b> <code>' + esc(huellaActual || '—') + '</code></div>' +
      '<div><b>Huellas coinciden:</b> ' + (coincide ? '<span style="color:#166534;font-weight:700;">SÍ ✓</span>' : '<span style="color:#991b1b;font-weight:700;">NO ✗</span>') + '</div>' +
      '<div><b>Creada:</b> ' + (ses.fecha ? new Date(ses.fecha).toLocaleString() : '—') + '</div>' +
      '<div><b>Credencial autorizada:</b> ' + esc(autorizado || 'no verificable') + '</div>' +
      '</div>';
  }

  /* --- 7. JSON remotos --- */
  function verJSON(tipo) {
    const res = document.getElementById('devResJSON');
    const urls = {
      'blocked': BASE_URL + 'blocked.json',
      'update': BASE_URL + 'update.json',
      'licencias': BASE_URL + 'licencias.json',
      'enviar-error': BASE_URL + 'enviar-error.json',
      'privacidad': BASE_URL + 'privacidad.html',
      'manual': BASE_URL + 'manual.html'
    };
    const url = urls[tipo];
    if (!url) return;

    res.style.display = 'block';
    res.innerHTML = '⏳ Cargando <code>' + esc(url) + '</code>...';

    fetch(url + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        const status = r.status;
        const ct = r.headers.get('content-type') || '';
        return r.text().then(function (t) {
          let html = '';
          html += '<div style="margin-bottom:8px;">';
          html += '<div><b>URL:</b> <code style="font-size:10px;">' + esc(url) + '</code></div>';
          html += '<div><b>Status:</b> ' + (status === 200 ? '<span style="color:#166534;font-weight:700;">200 ✓</span>' : '<span style="color:#991b1b;font-weight:700;">' + status + ' ✗</span>') + '</div>';
          html += '<div><b>Content-Type:</b> ' + esc(ct) + '</div>';
          html += '</div>';

          if (status === 200) {
            let preview = t;
            let esJSON = false;
            if (ct.indexOf('json') !== -1) {
              try { preview = JSON.stringify(JSON.parse(t), null, 2); esJSON = true; }
              catch (e) {}
            }
            html += '<div style="font-family:monospace;background:#0d2033;color:#7dd3fc;padding:10px;border-radius:6px;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-all;font-size:10px;">' +
              esc(preview.substring(0, 5000)) +
              (preview.length > 5000 ? '\n\n...(truncado)' : '') +
              '</div>';
            html += '<button type="button" data-copy-json="' + esc(t.substring(0, 50000)) + '" style="margin-top:6px;padding:6px 10px;background:#16324f;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar contenido</button>';

            if (esJSON && tipo === 'blocked') {
              html += ' <button type="button" id="devAplicarBlocked" style="margin-top:6px;padding:6px 10px;background:#f2a900;color:#16324f;border:none;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;">Aplicar a localStorage</button>';
            }
            if (esJSON && tipo === 'licencias') {
              html += ' <button type="button" id="devAplicarLicencias" style="margin-top:6px;padding:6px 10px;background:#f2a900;color:#16324f;border:none;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;">Aplicar a cache</button>';
            }
          } else {
            html += '<div style="color:#991b1b;">El archivo no existe o no es accesible.</div>';
          }

          res.innerHTML = html;

          res.querySelectorAll('[data-copy-json]').forEach(function (b) {
            b.addEventListener('click', function () { copiar(this.dataset.copyJson); });
          });
          const ab = document.getElementById('devAplicarBlocked');
          if (ab) ab.addEventListener('click', function () {
            try {
              const d = JSON.parse(t);
              localStorage.setItem('ostikec_lista_negra', JSON.stringify(d));
              flash('✅ blocked.json aplicado');
              refrescarEstado();
            } catch (e) { flash('Error: JSON inválido'); }
          });
          const al = document.getElementById('devAplicarLicencias');
          if (al) al.addEventListener('click', function () {
            try {
              const d = JSON.parse(t);
              if (window.OSTIKEC_LICENCIAS && typeof window.OSTIKEC_LICENCIAS.sincronizar === 'function') {
                localStorage.setItem('ostikec_licencias_cache', JSON.stringify({ usuarios: d.usuarios || [], actualizado: Date.now() }));
                flash('✅ licencias aplicadas al cache');
                refrescarEstado();
              } else {
                flash('OSTIKEC_LICENCIAS no disponible');
              }
            } catch (e) { flash('Error: JSON inválido'); }
          });
        });
      })
      .catch(function (e) {
        res.innerHTML = '<div style="color:#991b1b;">❌ Error: ' + esc(e.message) + '</div>';
      });
  }

  /* --- 8. Sync --- */
  function syncLic() {
    if (!window.OSTIKEC_LICENCIAS) { flash('No disponible'); return; }
    const r = document.getElementById('devResSync');
    r.style.display = 'block';
    r.innerHTML = '⏳ Sincronizando...';
    window.OSTIKEC_LICENCIAS.sincronizar().then(function (res) {
      r.innerHTML = res.ok ? '✅ Total: ' + res.total : '❌ ' + (res.error || 'error');
      refrescarEstado();
    });
  }

  function syncBlock() {
    const r = document.getElementById('devResSync');
    r.style.display = 'block';
    r.innerHTML = '⏳ Descargando...';
    localStorage.removeItem('ostikec_lista_negra');
    fetch(BASE_URL + 'blocked.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (d) {
        localStorage.setItem('ostikec_lista_negra', JSON.stringify(d));
        r.innerHTML = '✅ Bloqueados: ' + (d.bloqueados ? d.bloqueados.length : 0);
        refrescarEstado();
      })
      .catch(function (e) { r.innerHTML = '❌ ' + e.message; });
  }

  function syncUpdate() {
    const r = document.getElementById('devResSync');
    r.style.display = 'block';
    r.innerHTML = '⏳ Consultando...';
    localStorage.removeItem('ostikec_update_last_check');
    localStorage.removeItem('ostikec_update_notified');
    if (!window.OSTIKEC_UPDATE) { r.innerHTML = '❌ OSTIKEC_UPDATE no disponible'; return; }
    window.OSTIKEC_UPDATE.consultar();
    setTimeout(function () {
      r.innerHTML = '✅ Consulta enviada';
      refrescarEstado();
    }, 1500);
  }

  function resetUpdate() {
    localStorage.removeItem('ostikec_update_last_check');
    localStorage.removeItem('ostikec_update_notified');
    flash('✅ Cache borrada');
    refrescarEstado();
  }

  /* --- 9. Inspector --- */
  function inspeccionar() {
    const el = document.getElementById('devResInspect');
    const filtro = (document.getElementById('devBuscarClave').value || '').toLowerCase();

    const filas = [];
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (filtro && k.toLowerCase().indexOf(filtro) === -1) continue;
      const v = localStorage.getItem(k);
      const b = new Blob([v]).size;
      total += b;
      filas.push({ clave: k, bytes: b, preview: v.substring(0, 60) + (v.length > 60 ? '…' : '') });
    }
    filas.sort(function (a, b) { return b.bytes - a.bytes; });

    let html = '<div style="font-weight:700;color:#16324f;margin-bottom:8px;">' +
      filas.length + ' claves · ' + (total / 1024).toFixed(1) + ' KB</div>';

    filas.forEach(function (f) {
      html += '<div style="margin-bottom:4px;padding:6px;background:#fff;border-left:2px solid #16324f;border-radius:4px;">' +
        '<div style="font-weight:700;color:#16324f;word-break:break-all;">' + esc(f.clave) + '</div>' +
        '<div style="color:#64748b;font-size:10px;">' + f.bytes + ' bytes</div>' +
        '<div style="color:#94a3b8;font-size:10px;word-break:break-all;">' + esc(f.preview) + '</div>' +
        '<button type="button" data-load-clave="' + esc(f.clave) + '" style="margin-top:4px;padding:2px 6px;background:#f2a900;color:#16324f;border:none;border-radius:4px;font-size:9px;cursor:pointer;font-weight:700;">Cargar en editor</button>' +
      '</div>';
    });
    el.style.display = 'block';
    el.innerHTML = html;
    el.querySelectorAll('[data-load-clave]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.getElementById('devClaveEditar').value = this.dataset.loadClave;
        cargarClave();
      });
    });
  }

  function exportarTodo() {
    const datos = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      datos[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ostikec-dev-dump-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    flash('✅ Exportado');
  }

  /* --- 10. Editor --- */
  function cargarClave() {
    const clave = (document.getElementById('devClaveEditar').value || '').trim();
    const ta = document.getElementById('devValorClave');
    const res = document.getElementById('devResClave');
    if (!clave) { flash('Introduce la clave'); return; }

    const valor = localStorage.getItem(clave);
    res.style.display = 'block';
    if (valor === null) {
      res.innerHTML = '<div style="color:#991b1b;">La clave "' + esc(clave) + '" no existe.</div>';
      ta.value = '';
      return;
    }
    ta.value = valor;
    res.innerHTML = '<div style="color:#166534;">✓ Cargada. ' + valor.length + ' caracteres.</div>';
  }

  function guardarClave() {
    const clave = (document.getElementById('devClaveEditar').value || '').trim();
    const ta = document.getElementById('devValorClave');
    const res = document.getElementById('devResClave');
    if (!clave) { flash('Introduce la clave'); return; }
    if (!confirm('¿Guardar cambios en "' + clave + '"? Se sobrescribe el valor actual.')) return;

    try {
      localStorage.setItem(clave, ta.value);
      res.style.display = 'block';
      res.innerHTML = '<div style="color:#166534;">✓ Guardado.</div>';
      flash('Guardado');
      refrescarEstado();
    } catch (e) {
      res.style.display = 'block';
      res.innerHTML = '<div style="color:#991b1b;">Error: ' + esc(e.message) + '</div>';
    }
  }

  function exportarClave() {
    const clave = (document.getElementById('devClaveEditar').value || '').trim();
    if (!clave) { flash('Introduce la clave'); return; }
    const valor = localStorage.getItem(clave);
    if (valor === null) { flash('No existe'); return; }
    const blob = new Blob([valor], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = clave.replace(/[^a-z0-9_-]/gi, '_') + '-' + Date.now() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    flash('✅ Exportada');
  }

  function eliminarClave() {
    const clave = (document.getElementById('devClaveEditar').value || '').trim();
    if (!clave) { flash('Introduce la clave'); return; }
    if (!confirm('¿Eliminar "' + clave + '"? No se puede deshacer.')) return;
    localStorage.removeItem(clave);
    document.getElementById('devValorClave').value = '';
    document.getElementById('devResClave').style.display = 'block';
    document.getElementById('devResClave').innerHTML = '<div style="color:#166534;">✓ Eliminada.</div>';
    flash('Eliminada');
    refrescarEstado();
  }

  /* --- 11. Limpiar --- */
  function limpiar(tipo) {
    const msgs = {
      historial: '¿Borrar historial de tickets?',
      validaciones: '¿Borrar validaciones almacenadas?',
      logfallos: '¿Borrar log de fallos?',
      logerrores: '¿Borrar log de errores?',
      trial: '¿Resetear prueba gratuita?',
      pin: '¿Borrar PIN del panel?',
      sesion: '¿Cerrar sesión actual?',
      listanegra: '¿Borrar lista negra cacheada?',
      cachelic: '¿Borrar cache de licencias?',
      updatecache: '¿Borrar cache de update?',
      TODO: '⚠️ ¿BORRAR TODO EL LOCALSTORAGE? Se perderá configuración, historial y sesión.'
    };
    if (!confirm(msgs[tipo] + '\n\nNo se puede deshacer.')) return;

    const map = {
      historial: ['ostikec_historial'],
      validaciones: ['ostikec_validaciones'],
      logfallos: ['ostikec_log_fallos'],
      logerrores: ['ostikec_log_errores'],
      trial: ['ostikec_trial', 'ostikec_cache_001', 'ostikec_stats', 'ostikec_trial_tour_visto'],
      pin: ['ostikec_pin_panel', 'ostikec_pin_intentos'],
      sesion: ['ostikec_sesion'],
      listanegra: ['ostikec_lista_negra'],
      cachelic: ['ostikec_licencias_cache', 'ostikec_licencias_last_sync'],
      updatecache: ['ostikec_update_last_check', 'ostikec_update_notified'],
      TODO: null
    };

    try {
      if (tipo === 'TODO') {
        if (!confirm('¿SEGUNDA CONFIRMACIÓN: borrar TODO? Esto es irreversible.')) return;
        localStorage.clear();
      } else {
        (map[tipo] || []).forEach(function (k) { localStorage.removeItem(k); });
      }
      const res = document.getElementById('devResClean');
      res.style.display = 'block';
      res.innerHTML = '<div style="color:#166534;">✓ ' + esc(tipo) + ' borrado.</div>';
      flash('✅ ' + tipo + ' borrado');
      refrescarEstado();
      if (window.OSTIKEC && typeof window.OSTIKEC.refrescarPanelSiAbierto === 'function') {
        window.OSTIKEC.refrescarPanelSiAbierto();
      }
    } catch (e) { flash('Error: ' + e.message); }
  }

  /* --- 12. Generar QR --- */
  function generarQR() {
    const nombre = (document.getElementById('devQRNombre').value || '').trim();
    const fecha = (document.getElementById('devQRFecha').value || '').trim();
    const demo = document.getElementById('devQRDemo').checked;
    const res = document.getElementById('devResQR');
    const cv = document.getElementById('devQRCanvas');

    if (!nombre) { flash('Falta nombre'); return; }
    if (!/^\d{2}\/\d{2}\/\d{2}$/.test(fecha)) { flash('Fecha inválida (DD/MM/AA)'); return; }
    if (typeof window.construirContenidoQR !== 'function') { flash('Función no disponible'); return; }

    const datos = { f: fecha, n: nombre, t: '55555555', a: 'A-1', i: 'SVC-TEST', e: '54089688' };
    if (demo) datos.demo = true;

    let qr;
    try { qr = window.construirContenidoQR(datos); }
    catch (e) { flash('Error: ' + e.message); return; }

    res.style.display = 'block';
    res.innerHTML =
      '<div style="font-size:10px;color:#64748b;font-weight:700;">JSON</div>' +
      '<div style="word-break:break-all;margin-bottom:8px;user-select:all;font-size:10px;">' + esc(JSON.stringify(datos)) + '</div>' +
      '<div style="font-size:10px;color:#64748b;font-weight:700;">CONTENIDO QR</div>' +
      '<div style="word-break:break-all;user-select:all;font-size:10px;">' + esc(qr) + '</div>' +
      '<button type="button" data-copy="' + esc(qr) + '" style="margin-top:8px;padding:4px 8px;background:#16324f;color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">Copiar QR</button>';
    res.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { copiar(this.dataset.copy); });
    });

    /* Dibujar QR en canvas si la librería está disponible */
    try {
      if (typeof qrcode === 'function' && cv) {
        const qrObj = qrcode(0, 'M');
        qrObj.addData(qr);
        qrObj.make();
        const mods = qrObj.getModuleCount();
        const size = 280;
        const lado = size / mods;
        cv.width = size;
        cv.height = size;
        cv.style.display = 'block';
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        for (let f = 0; f < mods; f++) {
          for (let c = 0; c < mods; c++) {
            if (qrObj.isDark(f, c)) ctx.fillRect(c * lado, f * lado, Math.ceil(lado), Math.ceil(lado));
          }
        }
      }
    } catch (e) {}
  }

  /* --- 13. Test validación --- */
  function testValidacion() {
    const escenario = document.getElementById('devTestEscenario').value;
    const res = document.getElementById('devResTestValidacion');
    if (!res) return;
    res.style.display = 'block';
    res.innerHTML = '⏳ Ejecutando...';

    const pasos = [];

    /* Datos según escenario */
    const hoy = new Date();
    const dos = n => String(n).padStart(2, '0');
    const fechaHoy = dos(hoy.getDate()) + '/' + dos(hoy.getMonth() + 1) + '/' + String(hoy.getFullYear()).substring(2);
    const hace5 = new Date(hoy.getTime() - 5 * 86400000);
    const fechaVieja = dos(hace5.getDate()) + '/' + dos(hace5.getMonth() + 1) + '/' + String(hace5.getFullYear()).substring(2);

    let datosBase = {
      f: fechaHoy,
      n: 'Test ' + escenario,
      t: '55555555',
      a: 'A-1',
      i: 'SVC-' + Date.now(),
      e: '54089688'
    };
    if (escenario === 'valido-viejo') datosBase.f = fechaVieja;

    try {
      /* 1. Construir QR */
      const qr = window.construirContenidoQR(datosBase);
      pasos.push({ ok: true, label: '1. QR construido', detalle: qr.substring(0, 60) + '...' });

      /* 2. Escenario: formato inválido */
      if (escenario === 'formato-invalido') {
        const r = window.leerContenidoQR('NO-ES-OSTIKEC');
        pasos.push({ ok: !r.valido, label: '2. QR no-OSTIKEC detectado', detalle: r.error || '(validado como válido)' });
        /* Disparar validación de creador con error */
        if (window.mostrarResultadoValidacion) {
          window.mostrarResultadoValidacion(false, null, r.error);
          pasos.push({ ok: true, label: '3. mostrarResultadoValidacion llamado con error', detalle: 'Ver panel de Seguridad' });
        }
      }
      /* 3. Escenario: firma inválida */
      else if (escenario === 'invalido-firma') {
        const partes = qr.split('|');
        const qrAlterado = partes[0] + '|' + partes[1] + '|AAAAAAAAAAAA';
        const r = window.leerContenidoQR(qrAlterado);
        pasos.push({ ok: !r.valido, label: '2. Firma alterada detectada', detalle: r.error || '' });
        if (window.mostrarResultadoValidacion) {
          window.mostrarResultadoValidacion(false, null, r.error);
          pasos.push({ ok: true, label: '3. mostrarResultadoValidacion llamado', detalle: 'Ver panel de Seguridad' });
        }
      }
      /* 4. Válidos */
      else {
        const r = window.leerContenidoQR(qr);
        pasos.push({ ok: r.valido, label: '2. QR leído correctamente', detalle: r.error || 'válido' });
        if (window.mostrarResultadoValidacion) {
          window.mostrarResultadoValidacion(true, r.datos, '');
          pasos.push({ ok: true, label: '3. mostrarResultadoValidacion (válido)', detalle: 'Ver avisos en el modal' });
        }
        if (escenario === 'doble-uso' && window.mostrarResultadoValidacion) {
          setTimeout(function () {
            window.mostrarResultadoValidacion(true, r.datos, '');
            pasos.push({ ok: true, label: '4. Segundo uso simulado', detalle: 'Debería aparecer "Ticket ya utilizado"' });
            renderTest(pasos, res);
          }, 300);
          return;
        }
      }
    } catch (e) {
      pasos.push({ ok: false, label: 'ERROR', detalle: e.message });
    }

    setTimeout(function () { renderTest(pasos, res); }, 200);
  }

  function renderTest(pasos, res) {
    let html = '';
    pasos.forEach(function (p) {
      html += '<div style="padding:6px;margin-bottom:4px;background:' + (p.ok ? '#dcfce7' : '#fee2e2') + ';border-left:2px solid ' + (p.ok ? '#166534' : '#991b1b') + ';border-radius:4px;">' +
        '<div style="font-weight:700;color:' + (p.ok ? '#166534' : '#991b1b') + ';">' + (p.ok ? '✓' : '✗') + ' ' + esc(p.label) + '</div>' +
        '<div style="color:#475569;font-size:10px;">' + esc(p.detalle) + '</div>' +
      '</div>';
    });
    res.innerHTML = html;
  }

  /* ============================================================
     INYECCIÓN
     ============================================================ */
  function inyectar() {
    const pantalla = document.getElementById('pantallaCreador');
    if (!pantalla) return;
    if (document.getElementById(ID_TARJETA)) return;
    const main = pantalla.querySelector('main');
    if (!main) return;

    const val = document.getElementById('tarjetaValidacionesCreador');
    if (val) {
      val.insertAdjacentHTML('afterend', htmlTarjeta());
    } else {
      main.insertAdjacentHTML('beforeend', htmlTarjeta());
    }

    instalarEventos();
    refrescarEstado();
    refrescarEstadoSesion();
  }

  function instalarEventos() {
    const on = function (id, ev, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    };

    on('devCalcLic', 'click', calcHashLic);
    on('devCalcPinMaestro', 'click', calcPinMaestroRotemoto_);
    on('devDiagFallos', 'click', diagFallos);
    on('devActivarLog', 'click', activarLogFallos);
    on('devTestFallo', 'click', testFalloManual);
    on('devVerLogFallos', 'click', verLogFallos);
    on('devRefreshEstado', 'click', refrescarEstado);
    on('devRefreshSesion', 'click', refrescarEstadoSesion);
    on('devSyncLic', 'click', syncLic);
    on('devSyncBlock', 'click', syncBlock);
    on('devSyncUpdate', 'click', syncUpdate);
    on('devResetUpdate', 'click', resetUpdate);
    on('devInspect', 'click', inspeccionar);
    on('devExport', 'click', exportarTodo);
    on('devCargarClave', 'click', cargarClave);
    on('devGuardarClave', 'click', guardarClave);
    on('devExportarClave', 'click', exportarClave);
    on('devEliminarClave', 'click', eliminarClave);
    on('devGenQR', 'click', generarQR);
    on('devTestValidacion', 'click', testValidacion);

    document.querySelectorAll('[data-hash]').forEach(function (btn) {
      btn.addEventListener('click', function () { calcHashOtro(this.dataset.hash); });
    });
    document.querySelectorAll('[data-json]').forEach(function (btn) {
      btn.addEventListener('click', function () { verJSON(this.dataset.json); });
    });
    document.querySelectorAll('[data-clean]').forEach(function (btn) {
      btn.addEventListener('click', function () { limpiar(this.dataset.clean); });
    });
  }

  /* Wrapper para mantener el nombre en el listener */
  function calcPinMaestroRotemoto_() { calcPinMaestroRemoto(); }

  /* ============================================================
     ARRANQUE
     ============================================================ */
  function init() {
    if (typeof window.sha256Hex !== 'function' && !(OST() && OST().sha256Hex)) {
      console.warn('dev-tools.js: sha256Hex no disponible');
      return;
    }

    /* Esperar a validaciones.js para colocarnos debajo */
    let intentos = 0;
    const timer = setInterval(function () {
      intentos++;
      if (document.getElementById('tarjetaValidacionesCreador') || intentos > 20) {
        clearInterval(timer);
        inyectar();
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();