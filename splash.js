/* ============================================================================
   SPLASH.JS — Pantalla de carga personalizada de OSTIKEC
   ============================================================================
   Muestra la imagen splash-screen.jpg a pantalla completa al abrir la app
   durante N segundos, luego se desvanece y da paso a la pantalla de login.

   CARACTERÍSTICAS:
     - Solo aparece una vez por sesión (usa sessionStorage).
     - Se autoelimina del DOM después del fade.
     - Bloquea clicks mientras está visible.
     - Es una capa visual aislada: no interfiere con la lógica de la app.
     - Se inserta como PRIMER hijo del body, cubriendo todo lo demás.

   INSTALACIÓN:
     1. Copiar este archivo y splash-screen.jpg a la carpeta raíz.
     2. En index.html, justo después de la etiqueta <body>, añadir:
          <script src="splash.js"></script>
     3. Incluir ambos archivos (splash.js y splash-screen.jpg) en el ZIP
        que se sube a AppMint.

   CONFIGURACIÓN:
     Cambiar TIEMPO_MINIMO_MS y DURACION_FADE_MS según necesidades.
     Cambiar IMAGEN y COLOR_FONDO si se usan otros recursos.
   ============================================================================ */

(function () {
  'use strict';

  /* --- CONFIGURACIÓN --- */
  const TIEMPO_MINIMO_MS = 2000;         // Tiempo visible mínimo (2 s)
  const DURACION_FADE_MS = 500;          // Duración de la transición de opacidad
  const CLAVE_SESION     = 'ostikec_splash_shown';
  const IMAGEN           = 'splash-screen.jpg';
  const COLOR_FONDO      = '#16324f';    // Se muestra mientras carga la imagen

  /* --- Si ya se mostró en esta sesión, salir --- */
  try {
    if (sessionStorage.getItem(CLAVE_SESION) === '1') return;
  } catch (e) {
    /* Si sessionStorage no está disponible, continuar igualmente */
  }

  /* --- Crear el overlay --- */
  function crearSplash() {
    if (document.getElementById('splashScreen')) return;
    if (!document.body) return;

    const splash = document.createElement('div');
    splash.id = 'splashScreen';
    splash.style.cssText =
      'position:fixed;' +
      'top:0;left:0;right:0;bottom:0;' +
      'width:100vw;height:100vh;' +
      'z-index:2147483646;' +
      'background-color:' + COLOR_FONDO + ';' +
      'background-image:url("' + IMAGEN + '");' +
      'background-size:cover;' +
      'background-position:center center;' +
      'background-repeat:no-repeat;' +
      'opacity:1;' +
      'transition:opacity ' + (DURACION_FADE_MS / 1000) + 's ease;' +
      'pointer-events:auto;' +
      'user-select:none;' +
      '-webkit-user-select:none;' +
      '-webkit-tap-highlight-color:transparent;';

    /* Insertar como PRIMER hijo del body */
    document.body.insertBefore(splash, document.body.firstChild);
  }

  /* --- Ocultar y eliminar del DOM --- */
  function ocultarSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;

    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';

    setTimeout(function () {
      if (splash && splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, DURACION_FADE_MS);

    try { sessionStorage.setItem(CLAVE_SESION, '1'); } catch (e) {}
  }

  /* --- Crear el splash lo antes posible --- */
  if (document.body) {
    crearSplash();
  } else {
    document.addEventListener('DOMContentLoaded', crearSplash);
  }

  /* --- Programar la ocultación --- */
  setTimeout(ocultarSplash, TIEMPO_MINIMO_MS);

})();