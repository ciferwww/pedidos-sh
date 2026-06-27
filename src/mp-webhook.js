// api/mp-webhook.js
//
// Mercado Pago llama esta URL cuando el estado de un pago cambia
// (la configuramos como `notification_url` al crear la preferencia).
// Aquí se confirma el pago contra la API de Mercado Pago (nunca confiar
// solo en el contenido del webhook) y se actualiza el pedido en Firestore.
//
// Configura esta URL también en tu cuenta de Mercado Pago si te lo pide:
//   https://tu-dominio.vercel.app/api/mp-webhook

import { getAdminDb } from "./_lib/firebaseAdmin.js";

export default async function handler(req, res) {
  try {
    // Mercado Pago manda el id del pago por query string o en el body,
    // según la versión/integración. Cubrimos ambos casos.
    const paymentId =
      req.query?.["data.id"] || req.body?.data?.id || req.query?.id || req.body?.id;
    const topic = req.query?.type || req.body?.type || req.query?.topic;

    // Ignora notificaciones que no sean de pagos (ej. "merchant_order")
    if (!paymentId || (topic && topic !== "payment")) {
      return res.status(200).send("ignored");
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!mpRes.ok) {
      console.error("[mp-webhook] no se pudo verificar el pago", paymentId);
      return res.status(200).send("verify-failed"); // 200 para evitar reintentos infinitos
    }
    const payment = await mpRes.json();

    const externalRef = payment.external_reference || "";
    const [tenantId, orderId] = externalRef.split("::");
    if (!tenantId || !orderId) {
      return res.status(200).send("no external_reference");
    }

    const db = getAdminDb();
    const pedidoRef = db
      .collection("tenants").doc(tenantId)
      .collection("pedidos").doc(orderId);

    if (payment.status === "approved") {
      await pedidoRef.update({
        pagado: true,
        estado: "nuevo", // a partir de aquí ya entra a cocina/POS/KDS
        pagoConfirmadoEn: new Date(),
        mpPaymentId: String(paymentId),
      });
    } else if (payment.status === "rejected" || payment.status === "cancelled") {
      await pedidoRef.update({ estado: "pago_rechazado", mpPaymentId: String(paymentId) });
    }
    // "pending" / "in_process" → no se toca, el cliente sigue viendo "Confirmando tu pago…"

    return res.status(200).send("ok");
  } catch (err) {
    console.error("[mp-webhook] error:", err);
    // Responder 200 igualmente: si el error es nuestro, no queremos que
    // Mercado Pago reintente indefinidamente la misma notificación.
    return res.status(200).send("error-logged");
  }
}
