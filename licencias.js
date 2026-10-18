/* ============================================================================
   LICENCIAS.JS — Sistema de licencias remotas
   ============================================================================
   Permite añadir o revocar licencias editando un archivo licencias.json
   alojado en GitHub Pages, sin necesidad de recompilar el APK.

   FUENTES DE LICENCIAS (combinadas, con el cache ganando en duplicados):
     1. Bootstrap: array USUARIOS_AUTORIZADOS definido en index.html.
     2. Cache: última lista descargada, guardada en localStorage.
     3. Remoto: licencias.json en GitHub Pages (fuente de verdad).

   FAIL-SAFE:
     - Si el JSON falla o no existe, se usa el cache anterior o el bootstrap.
     - Si nunca se ha sincronizado y no hay internet, solo bootstrap.
     - La app nunca deja de funcionar por un fallo de red.

   TIMEOUT:
     - El fetch tiene un timeout de 10 segundos (AbortController si está
       disponible; si no, fetch normal sin timeout).

   LOAD ORDER:
     - Debe cargarse DESPUÉS del script inline de index.html (necesita
       USUARIOS_AUTORIZADOS y calcularHashCredencial ya definidos).
     - Debe cargarse ANTES que extras.js (no es estrictamente necesario,
       pero así el módulo está disponible desde el primer momento).

   ESTE ARCHIVO SÍ DEBE INCLUIRSE EN EL APK.
   ============================================================================ */

(function () {
  'use strict';

  /* Evitar doble carga */
  if (window.OSTIKEC_LICENCIAS) return;

  /* --- Constantes --- */
  const URL_LICENCIAS     = 'https://tito-corrioso.github.io/ostikec/licencias.json';
  const CLAVE_CACHE       = 'ostikec_licencias_cache';
  const CLAVE_ULTIMA_SYNC = 'ostikec_licencias_last_sync';
  const HORAS_ENTRE_SYNC  = 1;
  const DELAY_SYNC        = 1500;
  const TIMEOUT_FETCH_MS  = 10000;

  /* ============================================================
     UTILIDADES
     ============================================================ */
  function normHash(h) {
    return String(h || '').trim().toUpperCase();
  }

  function obtenerBootstrap() {
    try {
      if (typeof USUARIOS_AUTORIZADOS !== 'undefined' &&
          Array.isArray(USUARIOS_AUTORIZADOS)) {
        return USUARIOS_AUTORIZADOS;
      }
    } catch (e) {
      /* TDZ o referencia no disponible */
    }
    return [];
  }

  /* ============================================================
     CACHE LOCAL
     ============================================================ */
  function leerCache() {
    try {
      const bruto = localStorage.getItem(CLAVE_CACHE);
      if (!bruto) return { usuarios: [], actualizado: 0 };
      const datos = JSON.parse(bruto);
      if (!datos || !Array.isArray(datos.usuarios)) {
        return { usuarios: [], actualizado: 0 };
      }
      return datos;
    } catch (e) {
      return { usuarios: [], actualizado: 0 };
    }
  }

  function guardarCache(usuarios) {
    try {
      localStorage.setItem(CLAVE_CACHE, JSON.stringify({
        usuarios: usuarios,
        actualizado: Date.now()
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     LISTA COMBINADA (bootstrap + cache)
     ============================================================ */
  function listarCombinada() {
    const bootstrap = obtenerBootstrap();
    const cache = leerCache().usuarios;

    const mapa = new Map();

    /* Bootstrap primero */
    bootstrap.forEach(function (u) {
      if (!u) return;
      const h = normHash(u.hashCred);
      if (h) mapa.set(h, { hashCred: h, tipo: u.tipo, origen: 'bootstrap' });
    });

    /* Cache después: sobrescribe bootstrap en duplicados */
    cache.forEach(function (u) {
      if (!u) return;
      const h = normHash(u.hashCred);
      if (h) mapa.set(h, { hashCred: h, tipo: u.tipo, origen: 'cache' });
    });

    return Array.from(mapa.values());
  }

  /* ============================================================
     VERIFICACIÓN
     ============================================================ */
  function verificar(hashCred) {
    const h = normHash(hashCred);
    if (!h) return null;
    const lista = listarCombinada();
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].hashCred === h) {
        return { tipo: lista[i].tipo, origen: lista[i].origen };
      }
    }
    return null;
  }

  /* ============================================================
     SINCRONIZACIÓN CON EL JSON REMOTO
     ============================================================ */
  function sincronizar() {
    /* Guardia contra fetch no disponible */
    if (typeof fetch !== 'function') {
      return Promise.resolve({ ok: false, error: 'fetch no disponible' });
    }

    let controller = null;
    let timeoutId = null;
    const opciones = { cache: 'no-store' };

    if (typeof AbortController === 'function') {
      controller = new AbortController();
      opciones.signal = controller.signal;
      timeoutId = setTimeout(function () {
        try { controller.abort(); } catch (e) {}
      }, TIMEOUT_FETCH_MS);
    }

    let promesa;
    try {
      promesa = fetch(URL_LICENCIAS + '?t=' + Date.now(), opciones);
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      return Promise.resolve({ ok: false, error: 'No se pudo iniciar la petición' });
    }

    return promesa
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (datos) {
        if (!datos || !Array.isArray(datos.usuarios)) {
          throw new Error('Formato inválido');
        }
        const usuarios = datos.usuarios
          .filter(function (u) {
            return u &&
                   typeof u.hashCred === 'string' &&
                   (u.tipo === 'creador' || u.tipo === 'validador');
          })
          .map(function (u) {
            return { hashCred: normHash(u.hashCred), tipo: u.tipo };
          });

        guardarCache(usuarios);
        try {
          localStorage.setItem(CLAVE_ULTIMA_SYNC, String(Date.now()));
        } catch (e) {}

        return { ok: true, total: usuarios.length };
      })
      .catch(function (err) {
        return {
          ok: false,
          error: err && err.message ? err.message : String(err)
        };
      })
      .then(function (result) {
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      });
  }

  /* ============================================================
     AUTO-SYNC
     ============================================================ */
  function debeSincronizar() {
    let ultima = 0;
    try {
      ultima = parseInt(localStorage.getItem(CLAVE_ULTIMA_SYNC) || '0', 10);
    } catch (e) {}
    if (!ultima) return true;
    return (Date.now() - ultima) > (HORAS_ENTRE_SYNC * 3600000);
  }

  /* ============================================================
     API PÚBLICA
     ============================================================ */
  window.OSTIKEC_LICENCIAS = {
    verificar:    verificar,
    sincronizar:  sincronizar,
    listar:       listarCombinada,

    totalBootstrap: function () {
      return obtenerBootstrap().length;
    },

    totalCache: function () {
      return leerCache().usuarios.length;
    },

    ultimaSync: function () {
      try {
        return parseInt(localStorage.getItem(CLAVE_ULTIMA_SYNC) || '0', 10);
      } catch (e) { return 0; }
    },

    reset: function () {
      try {
        localStorage.removeItem(CLAVE_CACHE);
        localStorage.removeItem(CLAVE_ULTIMA_SYNC);
      } catch (e) {}
    }
  };

  /* Auto-sync en segundo plano al arrancar */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (debeSincronizar()) {
        setTimeout(function () { sincronizar(); }, DELAY_SYNC);
      }
    });
  } else {
    /* DOMContentLoaded ya ocurrió */
    if (debeSincronizar()) {
      setTimeout(function () { sincronizar(); }, DELAY_SYNC);
    }
  }

})();