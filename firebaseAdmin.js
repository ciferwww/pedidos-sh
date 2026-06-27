// api/_lib/firebaseAdmin.js
//
// Inicializa el Admin SDK de Firebase una sola vez por instancia de función
// serverless. Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT_BASE64
// en Vercel: el JSON de tu cuenta de servicio (Firebase Console → Configuración
// del proyecto → Cuentas de servicio → Generar nueva clave privada),
// codificado en base64 (para evitar problemas de comillas/saltos de línea
// al pegarlo en el panel de Vercel).
//
//   En tu terminal:  base64 -i service-account.json | pbcopy   (macOS)
//                     certutil -encode service-account.json tmp.b64  (Windows)
//
// Pega el resultado completo como valor de FIREBASE_SERVICE_ACCOUNT_BASE64
// en Vercel → Project Settings → Environment Variables.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let dbInstance = null;

export function getAdminDb() {
  if (dbInstance) return dbInstance;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    throw new Error(
      "Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT_BASE64 en Vercel."
    );
  }

  if (!getApps().length) {
    const json = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64"
    ).toString("utf-8");
    const serviceAccount = JSON.parse(json);
    initializeApp({ credential: cert(serviceAccount) });
  }

  dbInstance = getFirestore();
  return dbInstance;
}
