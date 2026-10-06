# APK de ElectriCOs (Android)

Envoltorio con Capacitor: la APK abre `https://electri-cos.vercel.app` dentro de la app, así que **cada
actualización de la web llega sola, sin reinstalar**. Además programa en el celular los recordatorios del
día 10 y del día 20 (notificaciones locales, funcionan con la app cerrada y sin internet).

## Cómo obtener la APK
1. En GitHub: pestaña **Actions → "Construir APK" → Run workflow**.
2. Al terminar (unos 5–8 minutos), entra a esa ejecución y baja el archivo **electricos-apk** (contiene `app-debug.apk`).
3. Pásalo al celular (WhatsApp, Drive, cable) y ábrelo. Android pedirá permitir **instalar apps de este origen**.

Es una APK de depuración: se instala y funciona igual, pero no es la que se sube a Google Play.
Para Google Play hay que firmarla con una clave propia (no se guarda en el repositorio).

## Cómo funciona offline
La primera vez necesita internet. Después, el service worker de la web guarda la pantalla inicial y sus archivos;
los datos que se guardan sin conexión esperan en el celular y se envían solos al volver internet.
