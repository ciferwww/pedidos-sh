/**
 * import-menu.js
 * ─────────────────────────────────────────────────────────────────────
 * Script de UN SOLO USO para precargar tu catálogo de productos en
 * Firestore, en la colección que ya leen App.jsx, Admin.jsx (POS) y
 * GestorMenu.jsx:
 *
 *   /tenants/{TENANT_ID}/productos/{productId}
 *
 * CÓMO USARLO
 * ───────────
 * 1) Colca este archivo y "menu-seed.json" en la raíz de tu proyecto
 *    (junto a package.json), o en cualquier carpeta — solo ajusta la
 *    ruta del require() de abajo si lo mueves.
 *
 * 2) Asegúrate de tener el SDK de firebase instalado (ya lo tienes,
 *    porque tu app lo usa):
 *      npm install firebase
 *
 * 3) Define tus variables de entorno de Firebase ANTES de correr el
 *    script. La forma más fácil: copia los valores de tu archivo .env
 *    (los mismos REACT_APP_FIREBASE_*) y pégalos en una terminal, o
 *    usa un archivo .env y el paquete "dotenv" (ver nota abajo).
 *
 * 4) Corre:
 *      node import-menu.js shekinah
 *
 *    El argumento "shekinah" es el tenantId — usa el mismo que tienes
 *    en tu URL (?rest=shekinah) o "shekinah" si no usas ese parámetro.
 *
 * 5) Repite (opcionalmente) con --force si quieres correr el script
 *    de nuevo sin que te pregunte confirmación. Por defecto el script
 *    es seguro: si la colección "productos" del tenant YA tiene datos,
 *    se detiene y te avisa, para que no dupliques productos.
 *
 * NOTA sobre variables de entorno:
 * Si no quieres exportar variables a mano cada vez, instala dotenv:
 *      npm install dotenv
 * y crea un archivo ".env" en la raíz con:
 *      REACT_APP_FIREBASE_API_KEY=...
 *      REACT_APP_FIREBASE_AUTH_DOMAIN=...
 *      REACT_APP_FIREBASE_PROJECT_ID=...
 *      REACT_APP_FIREBASE_STORAGE_BUCKET=...
 *      REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
 *      REACT_APP_FIREBASE_APP_ID=...
 * (son los mismos valores que ya usa tu app en Vercel/.env)
 * y descomenta la línea de "require('dotenv')" más abajo.
 * ─────────────────────────────────────────────────────────────────────
 */

// require('dotenv').config(); // ← descomenta esta línea si usas dotenv

const { initializeApp } = require("firebase/app");
const {
  getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp,
} = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

async function main() {
  const tenantId = process.argv[2];
  const force = process.argv.includes("--force");

  if (!tenantId) {
    console.error("\n❌ Falta el tenantId.\n   Uso: node import-menu.js <tenantId> [--force]\n   Ejemplo: node import-menu.js shekinah\n");
    process.exit(1);
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(
      "\n❌ No se encontraron las variables de entorno de Firebase.\n" +
      "   Define REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_PROJECT_ID, etc.\n" +
      "   antes de correr este script (ver instrucciones al inicio del archivo).\n"
    );
    process.exit(1);
  }

  const seedPath = path.join(__dirname, "menu-seed.json");
  if (!fs.existsSync(seedPath)) {
    console.error(`\n❌ No encontré menu-seed.json junto a este script (${seedPath}).\n`);
    process.exit(1);
  }
  const productos = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  console.log(`\n🔥 Conectando a Firebase (proyecto: ${firebaseConfig.projectId})…`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const colRef = collection(db, "tenants", tenantId, "productos");

  console.log(`📂 Revisando si ya hay productos en /tenants/${tenantId}/productos …`);
  const existentes = await getDocs(colRef);

  if (!existentes.empty && !force) {
    console.error(
      `\n⚠️  Ya existen ${existentes.size} producto(s) en este tenant.\n` +
      `   Para evitar duplicados, el script se detiene aquí.\n` +
      `   Si de verdad quieres agregar este catálogo de todos modos, vuelve a\n` +
      `   correr el comando agregando --force al final:\n\n` +
      `     node import-menu.js ${tenantId} --force\n`
    );
    process.exit(1);
  }

  console.log(`📦 Subiendo ${productos.length} productos…`);

  // Firestore permite máximo 500 operaciones por batch — lo dividimos por si acaso.
  const CHUNK = 400;
  let subidos = 0;
  for (let i = 0; i < productos.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = productos.slice(i, i + CHUNK);
    slice.forEach((p) => {
      const ref = doc(colRef); // ID autogenerado
      batch.set(ref, {
        name: p.name,
        desc: p.desc || "",
        price: p.price,
        categoria: p.categoria,
        orden: p.orden ?? 0,
        disponible: true,
        tags: p.tags || [],
        hasProtein: !!p.hasProtein,
        hasBurgerProtein: !!p.hasBurgerProtein,
        sauceOptions: p.sauceOptions || "",
        isSushi: !!p.isSushi,
        hasExtras: !!p.hasExtras,
        imagen: null,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });
    });
    await batch.commit();
    subidos += slice.length;
    console.log(`   ✓ ${subidos}/${productos.length}`);
  }

  console.log(`\n✅ ¡Listo! Se importaron ${subidos} productos a /tenants/${tenantId}/productos`);
  console.log("   Ya puedes verlos y editarlos desde el panel de Admin → Menú.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Error durante la importación:", err.message || err);
  process.exit(1);
});
