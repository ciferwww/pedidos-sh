// api/create-preference.js
//
// Recibe el pedido desde el menú del cliente, lo guarda en Firestore con
// estado "pendiente_pago" (NO entra a cocina todavía) y crea una preferencia
// de pago en Mercado Pago Checkout Pro. Devuelve la URL a la que el cliente
// debe ser redirigido para pagar.
//
// Variables de entorno requeridas en Vercel:
//   MP_ACCESS_TOKEN                 → Access Token de tu cuenta de Mercado Pago
//   FIREBASE_SERVICE_ACCOUNT_BASE64 → ver api/_lib/firebaseAdmin.js

import { getAdminDb } from "./_lib/firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const {
      tenantId, name, phone, delivery, address,
      deliveryCost, total, cart, turno,
    } = req.body || {};

    if (!tenantId || !name || !phone || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Datos del pedido incompletos." });
    }

    // ── Validación de variables de entorno requeridas ────────────────────
    const missingVars = [];
    if (!process.env.MP_ACCESS_TOKEN)                  missingVars.push("MP_ACCESS_TOKEN");
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64)  missingVars.push("FIREBASE_SERVICE_ACCOUNT_BASE64");
    if (missingVars.length > 0) {
      console.error("[create-preference] Faltan variables de entorno:", missingVars);
      return res.status(500).json({
        error: `Configuración incompleta en el servidor. Variables faltantes: ${missingVars.join(", ")}. ` +
               `Agrégalas en Vercel → Project Settings → Environment Variables y haz un nuevo deploy.`,
      });
    }

    // Detectar token de prueba vs producción y avisar si no coincide con la URL
    const token = process.env.MP_ACCESS_TOKEN;
    const isTestToken = token.startsWith("TEST-");
    const isProdUrl   = (req.headers.origin || "").includes("vercel.app") || (req.headers.origin || "").includes("shekinah");
    if (isTestToken && isProdUrl) {
      console.warn("[create-preference] ⚠️  Usando token de PRUEBA en URL de producción. Los pagos reales no se procesarán.");
    }

    const db = getAdminDb();

    // 1) Crear el pedido en Firestore — todavía NO visible en cocina/POS
    //    (KDS y Admin solo muestran estado "nuevo"/"en_proceso").
    const pedidoRef = db
      .collection("tenants").doc(tenantId)
      .collection("pedidos").doc();

    await pedidoRef.set({
      nombre: name,
      telefono: phone,
      entrega: delivery,
      direccion: address || "",
      pago: "tarjeta",
      metodoPago: "tarjeta",
      pagado: false,
      costoEnvio: delivery === "domicilio" ? Number(deliveryCost) || 0 : 0,
      articulos: cart.map((i) => ({
        nombre: i.name,
        cantidad: i.qty,
        protein: i.protein || "",
        salsa: i.sauce || "",
        bomba: i.bomba || false,
        extras: i.extras || [],
        platExtras: i.platExtras || [],
        nota: i.note || "",
        subtotal: i.totalPrice,
        alga: i.alga ?? null,
        preparacion: i.preparacion || "",
      })),
      total,
      estado: "pendiente_pago",
      origen: "web",
      creadoEn: new Date(),
      turno,
      tenantId,
    });
    const orderId = pedidoRef.id;

    // 2) Construir la preferencia de Mercado Pago
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const items = cart.map((i) => ({
      title: i.name,
      quantity: Number(i.qty) || 1,
      unit_price: Number((i.totalPrice / (i.qty || 1)).toFixed(2)),
      currency_id: "MXN",
    }));
    if (delivery === "domicilio" && Number(deliveryCost) > 0) {
      items.push({
        title: "Costo de envío",
        quantity: 1,
        unit_price: Number(deliveryCost),
        currency_id: "MXN",
      });
    }

    const preferenceBody = {
      items,
      payer: { name, phone: { number: String(phone) } },
      external_reference: `${tenantId}::${orderId}`,
      back_urls: {
        success: `${origin}/?rest=${tenantId}&track=${orderId}`,
        failure: `${origin}/?rest=${tenantId}&track=${orderId}&payment=failed`,
        pending: `${origin}/?rest=${tenantId}&track=${orderId}&payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${origin}/api/mp-webhook`,
      statement_descriptor: (tenantId || "PEDIDO").toUpperCase().slice(0, 22),
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      // Log completo para diagnóstico en Vercel Functions → Logs
      console.error("[create-preference] Mercado Pago error HTTP", mpRes.status, JSON.stringify(mpData));
      const mpMsg = mpData?.message || mpData?.error || JSON.stringify(mpData);
      await pedidoRef.update({ estado: "pago_rechazado" });
      return res.status(502).json({
        error: `Mercado Pago rechazó la solicitud (HTTP ${mpRes.status}): ${mpMsg}. ` +
               `Revisa que MP_ACCESS_TOKEN sea válido y que la cuenta de MP esté activa.`,
        mp_status: mpRes.status,
        mp_detail: mpData,
      });
    }

    return res.status(200).json({ orderId, initPoint: mpData.init_point });
  } catch (err) {
    console.error("[create-preference] error:", err);
    return res.status(500).json({ error: "Error interno al iniciar el pago." });
  }
}