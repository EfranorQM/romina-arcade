// ESTE ARCHIVO ES EL ORIGINAL. El que compila es su copia en
// android/app/src/main/java/com/romina/juegos/MainActivity.java, y la pone ahi
// build-apk.ps1 en cada compilacion.
//
// POR QUE VIVE AQUI Y NO ALLI: la carpeta android/ esta en .gitignore y la
// regenera `npx cap add android` cuando no existe (build-apk.ps1 lo hace solo).
// O sea que todo lo que se escriba dentro de android/ se pierde en cuanto
// alguien clona el proyecto o borra esa carpeta -- y se perderia EN SILENCIO:
// sin este archivo el puente no existe, el JavaScript no encuentra AndroidGiro,
// se cae al respaldo de screen.orientation.lock() y SURVIVAL vuelve a pedir el
// giro a mano. Un fallo mudo, que es el peor tipo.
//
// Por eso el original se versiona fuera de android/, como ya se hace con el
// icono (tools/icono.py lo redibuja despues de cada cap sync por el mismo
// motivo).

package com.romina.juegos;

import android.Manifest;
import android.content.ContentUris;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Mantiene la pantalla encendida jugando. Es un flag de ventana,
        // no un permiso: no reintroduce nada en el manifest.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // La ventana se dibuja POR DEBAJO de las barras del sistema en vez de
        // que Android le recorte un hueco. Sin esto, esconder las barras solo
        // dejaria el hueco en negro y no se ganaria ni un pixel de pantalla.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        esconderBarras();

        // El puente de orientacion. Capacitor ya expone su WebView y el propio
        // Capacitor se engancha asi (CapacitorCookies.java:23 hace exactamente
        // este addJavascriptInterface), o sea que no es un truco: es la via
        // normal. No es un plugin, no toca el manifest y no pide permisos.
        getBridge().getWebView().addJavascriptInterface(new Giro(), "AndroidGiro");

        // El puente de FOTOS, para el juego GALERIA. Mismo mecanismo que el
        // giro de arriba: addJavascriptInterface, sin plugin y sin dependencias.
        //
        // POR QUE NO UN PLUGIN. @capacitor/camera abre un SELECTOR donde hay
        // que elegir a mano, y eso no sirve para un juego que necesita cuarenta
        // fotos al azar en cada partida. Los plugins de terceros que si listan
        // la galeria estan sin mantenimiento (el mas usado va por la v0.0.8).
        // Cuarenta lineas aqui hacen exactamente lo que hace falta.
        getBridge().getWebView().addJavascriptInterface(new Fotos(), "AndroidFotos");

        // ---------- El boton ATRAS de Android ----------
        // QUE PASABA SIN ESTO. BridgeActivity no toca el atras (no hay ningun
        // onBackPressed en @capacitor/android 7.4.3: se comprobo grep-eando sus
        // 59 fuentes), asi que valia el de AppCompat, que cierra la actividad.
        // Jugando, el atras MATABA LA PARTIDA sin preguntar.
        //
        // QUE HACE AHORA. El atras se lo queda el juego: pausa. Y estando ya en
        // pausa, sale al menu. Es lo que ella espera de un boton de "volver".
        // Solo desde el menu cierra la app, que es donde cerrar tiene sentido.
        //
        // POR QUE NO EL PLUGIN @capacitor/app. Es la via documentada (el evento
        // 'backButton'), pero exige INSTALAR UN PLUGIN: una dependencia nueva,
        // una entrada en capacitor.settings.gradle y un modulo mas en el APK. Y
        // hay una razon dura: native-bridge.js:273 solo enlaza 'backbutton' si
        // cap.Plugins.App existe, o sea que el plugin no es opcional. Con
        // addJavascriptInterface -- que es como ya entra el puente del giro de
        // al lado, y como el propio Capacitor se engancha en
        // CapacitorCookies.java:23 -- sale gratis y sin dependencias.
        //
        // POR QUE getOnBackPressedDispatcher Y NO onBackPressed(). onBackPressed
        // esta obsoleto desde API 33 y en cuanto se active el atras predictivo
        // (android:enableOnBackInvokedCallback, que hoy no esta puesto) deja de
        // llamarse. El despachador de androidx.activity 1.9.2 -- ya en el
        // proyecto por AppCompat, no es dependencia nueva -- funciona en las dos
        // epocas. setEnabled(true) significa "yo me ocupo"; para dejar cerrar la
        // app desde el menu se apaga el callback y se repite el gesto.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                // La decision la toma JS, que es quien sabe en que escena esta.
                // Contesta 'cerrar' si no habia nada que pausar (o si el JS
                // todavia no cargo, que es cuando __arcade no existe).
                final OnBackPressedCallback self = this;
                getBridge().getWebView().evaluateJavascript(
                    "(window.__arcade && window.__arcade.atras) ? window.__arcade.atras() : 'cerrar'",
                    new ValueCallback<String>() {
                        @Override public void onReceiveValue(String value) {
                            // evaluateJavascript devuelve JSON: la cadena viene
                            // entre comillas, por eso se busca contains() y no
                            // se compara con equals().
                            if (value == null || !value.contains("cerrar")) return;
                            // Se apaga este callback y se repite el gesto: asi
                            // lo atiende el de AppCompat y la app se cierra como
                            // siempre. Cerrar a mano con finish() se saltaria
                            // cualquier otro callback registrado.
                            self.setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                        }
                    });
            }
        });
    }

    // ---------- Pantalla completa ----------
    // Al volver a la app, o al cerrarse un dialogo del sistema, las barras
    // pueden haberse quedado puestas. onResume NO basta en MIUI: el foco llega
    // despues, y pedir el ocultado sin foco se ignora en silencio. Por eso se
    // pide en los dos sitios.
    @Override
    public void onResume() {
        super.onResume();
        esconderBarras();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) esconderBarras();
    }

    // POR QUE HACE FALTA CODIGO Y NO BASTA EL TEMA. Un tema puede pedir que las
    // barras empiecen ocultas, pero no puede volver a esconderlas: en cuanto
    // ella desliza desde un borde -- y va a deslizar, porque asi se agarra el
    // telefono -- las barras salen y se QUEDAN el resto de la partida.
    //
    // POR QUE WindowInsetsControllerCompat Y NO systemUiVisibility: el proyecto
    // compila y apunta a API 35 (android/variables.gradle), y desde la 30
    // View.setSystemUiVisibility esta obsoleto y en las nuevas no hace nada. La
    // version Compat usa la API nueva donde la hay y cae sola a la vieja hasta
    // el minSdk 23. Viene en androidx.core 1.15.0, que ya esta: no se anade
    // ninguna dependencia.
    private void esconderBarras() {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        if (c == null) return;
        // El equivalente moderno de IMMERSIVE_STICKY, y es LO importante de
        // todo esto: sin el, el primer deslizamiento desde el borde saca las
        // barras y ya no se van, y ella acabaria jugando con el reloj y las
        // notificaciones encima, que es justo lo que hay que arreglar.
        c.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    // ---------- Puente de orientacion ----------
    // POR QUE EXISTE, y por que no vale screen.orientation.lock().
    //
    // La app tiene DOS orientaciones por diseno (ver el comentario largo de
    // core.js): el menu y SURVIVAL son apaisados, los otros cinco juegos son
    // verticales. Asi que el manifest NO puede fijar una sola: hay que pedirla
    // por escena.
    //
    // La via web era screen.orientation.lock(), y falla justo en el telefono
    // para el que se hace esto. La API exige pantalla completa en muchos
    // motores, y ademas queda por debajo de la preferencia del sistema: con el
    // giro bloqueado en ajustes -- que es como Romina tiene el Note 10 -- la
    // promesa se rechaza y el juego se queda de pie, con el cartel de
    // "GIRA EL TELEFONO" encima.
    //
    // setRequestedOrientation() no pide permiso a nadie: es la actividad
    // diciendo en que orientacion quiere dibujarse, y manda sobre el ajuste del
    // usuario. Es lo que hace cualquier juego apaisado de la tienda, que es
    // literalmente lo que pidio el autor ("asi como hacen muchos juegos").
    //
    // LA CONSTANTE ELEGIDA, y por que no las otras (medido contra el
    // android.jar de la API 35 del propio proyecto, y contra la tabla oficial
    // de android:screenOrientation):
    //
    //   fullUser (=13, lo que hay hoy en el manifest)
    //       "Si el usuario ha bloqueado la rotacion por sensor, se comporta
    //        como user". O sea: con el giro bloqueado NO gira. Este es el fallo
    //        que hay que arreglar, no la solucion.
    //
    //   userLandscape (=11)
    //       Igual: mira la preferencia del usuario. Con el giro bloqueado se
    //       queda como landscape a secas, en la cara que toque. No sirve.
    //
    //   sensorLandscape (=6)
    //       "El sensor se usa AUNQUE el usuario haya bloqueado la rotacion."
    //       Gira la actividad de lado si o si, y ademas deja elegir cual de los
    //       dos lados segun como ella agarre el telefono. Esta es.
    //
    //   landscape (=0)
    //       Tambien fuerza el giro, pero a UNA sola cara. Si ella agarra el
    //       telefono del otro lado, el juego le sale boca abajo y tiene que dar
    //       la vuelta al aparato. sensorLandscape le ahorra eso por 0 coste.
    //
    // Para los juegos verticales vale el mismo razonamiento pero al reves:
    // sensorPortrait (=7) giraria tambien a portrait invertido, y un telefono
    // boca abajo con el altavoz arriba es raro y ademas MIUI no siempre lo
    // ofrece. Se usa portrait (=1) a secas: los cinco juegos verticales se
    // agarran de una sola forma.
    private class Giro {

        // wide=true -> apaisado (menu, fin de partida, SURVIVAL)
        // wide=false -> vertical (los otros cinco juegos)
        @JavascriptInterface
        public void pedir(final boolean wide) {
            final int orient = wide
                ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
            // setRequestedOrientation toca la ventana, asi que TIENE que correr
            // en el hilo de interfaz. Un @JavascriptInterface entra por el hilo
            // del WebView (JavaBridge), no por el de interfaz: llamarlo directo
            // lanzaria CalledFromWrongThreadException y el giro no ocurriria.
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    // Si ya esta pedida, no se repite: cada setRequested-
                    // Orientation con un valor nuevo hace que el sistema
                    // reevalue la ventana, y el gestor de escenas llama a esto
                    // en CADA cambio de escena.
                    if (getRequestedOrientation() != orient) {
                        setRequestedOrientation(orient);
                    }
                }
            });
        }

        // La red de seguridad. Si algo saliera mal, JS puede devolver la
        // actividad al comportamiento de siempre (el del manifest) y la app
        // vuelve a depender del giro del usuario, que es como esta hoy.
        @JavascriptInterface
        public void soltar() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
                }
            });
        }
    }
    // ---------- Puente de FOTOS (el juego GALERIA) ----------
    //
    // Devuelve las N fotos mas recientes de la galeria como MINIATURAS en
    // base64, listas para que el juego las dibuje en un canvas.
    //
    // POR QUE MINIATURAS Y NO LAS FOTOS. Una foto del Note 10 son 12 MP: en el
    // canvas ocuparia 48 MB descomprimida, y cuarenta de esas revientan la
    // memoria del WebView. Se piden a 192 px de lado, que es mas de lo que el
    // juego dibuja (una carta mide 80x106), y se mandan como JPEG al 70%:
    // unos 8 KB cada una.
    //
    // LAS FOTOS NO SALEN DEL TELEFONO. Se leen aqui, se reducen aqui y se
    // pasan al JavaScript de la propia app. No hay ni una peticion de red en
    // todo este camino, y el juego tampoco las guarda: viven en memoria
    // mientras dura la partida.
    private class Fotos {

        // Que permiso toca segun la version de Android. Desde la 13 el permiso
        // amplio de almacenamiento ya no existe: es uno especifico de imagenes.
        private String permiso() {
            return Build.VERSION.SDK_INT >= 33
                ? Manifest.permission.READ_MEDIA_IMAGES
                : Manifest.permission.READ_EXTERNAL_STORAGE;
        }

        @JavascriptInterface
        public boolean hayPermiso() {
            return ContextCompat.checkSelfPermission(MainActivity.this, permiso())
                   == PackageManager.PERMISSION_GRANTED;
        }

        // Lanza el dialogo del sistema. El resultado NO se devuelve aqui (el
        // dialogo es asincrono): el juego vuelve a preguntar con hayPermiso()
        // cuando la app recupera el foco.
        @JavascriptInterface
        public void pedirPermiso() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    ActivityCompat.requestPermissions(
                        MainActivity.this, new String[] { permiso() }, 7001);
                }
            });
        }

        // Las `cuantas` fotos mas recientes, como JSON: [{id, src}, ...]
        // src es un data: URI que el canvas puede dibujar directamente.
        //
        // Devuelve "[]" ante CUALQUIER problema -- sin permiso, sin fotos, o
        // una galeria que no se deja leer. El juego lo entiende como "no hay
        // fotos" y se va a las caratulas, que es el respaldo.
        @JavascriptInterface
        public String recientes(int cuantas) {
            JSONArray out = new JSONArray();
            if (!hayPermiso()) return out.toString();
            if (cuantas < 1) cuantas = 1;
            if (cuantas > 80) cuantas = 80;   // tope: mas no cabe en memoria

            Cursor c = null;
            try {
                String[] cols = { MediaStore.Images.Media._ID };
                // Las mas recientes primero. LIMIT no es portable en todas las
                // versiones del proveedor, asi que se corta al recorrer.
                c = getContentResolver().query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        cols, null, null,
                        MediaStore.Images.Media.DATE_ADDED + " DESC");
                if (c == null) return out.toString();

                int idCol = c.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                int n = 0;
                while (c.moveToNext() && n < cuantas) {
                    long id = c.getLong(idCol);
                    Bitmap bm = null;
                    try {
                        Uri uri = ContentUris.withAppendedId(
                            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                        if (Build.VERSION.SDK_INT >= 29) {
                            // API 29+: el proveedor genera la miniatura.
                            bm = getContentResolver().loadThumbnail(
                                uri, new android.util.Size(192, 192), null);
                        } else {
                            bm = MediaStore.Images.Thumbnails.getThumbnail(
                                getContentResolver(), id,
                                MediaStore.Images.Thumbnails.MINI_KIND, null);
                        }
                    } catch (Throwable t) {
                        // Una foto rota no puede tumbar la partida: se salta.
                        continue;
                    }
                    if (bm == null) continue;

                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    bm.compress(Bitmap.CompressFormat.JPEG, 70, bos);
                    bm.recycle();
                    String b64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);

                    JSONObject o = new JSONObject();
                    o.put("id", id);
                    o.put("src", "data:image/jpeg;base64," + b64);
                    out.put(o);
                    n++;
                }
            } catch (Throwable t) {
                // Cualquier fallo -> "no hay fotos", y el juego usa caratulas.
                return new JSONArray().toString();
            } finally {
                if (c != null) try { c.close(); } catch (Throwable ignored) {}
            }
            return out.toString();
        }
    }
}
