import { useState, useEffect, useMemo } from "react";
import { onSnapshot, query, orderBy, doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db, useTenant, useTenantConfig } from "./TenantContext";

// ── helpers ───────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n ?? 0);

function startOf(unit) {
  const d = new Date();
  if (unit === "day")  { d.setHours(0,0,0,0); }
  if (unit === "week") { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0,0,0,0); }
  if (unit === "month"){ d.setDate(1); d.setHours(0,0,0,0); }
  return d;
}

const ESTADOS_COBRADOS = ["entregado", "finalizado"];
const PAGO_ICONS = { efectivo: "💵", transferencia: "📲", tarjeta: "💳" };

// ── KPI Card ─────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon, G, accent }) {
  return (
    <div style={{
      background: G.cardBg,
      border: `1.5px solid ${accent || G.divider}`,
      borderRadius: 14,
      padding: "18px 20px",
      flex: "1 1 140px",
      minWidth: 140,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      boxShadow: `0 3px 16px ${G.dark}09`,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <p style={{ margin: 0, color: G.textSub, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </p>
      <p style={{
        margin: 0,
        color: accent || G.gold,
        fontFamily: "Georgia,serif",
        fontSize: 24,
        fontWeight: 900,
        lineHeight: 1.1,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: 0, color: G.textSub, fontSize: 11 }}>{sub}</p>
      )}
    </div>
  );
}

// ── Bar Chart (last 7 days) ───────────────────────────────────────────
function BarChart({ data, G }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110, padding: "0 4px" }}>
      {data.map((d, i) => {
        const pct = (d.total / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={i} style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            height: "100%",
            justifyContent: "flex-end",
          }}>
            {/* value label */}
            <span style={{ color: G.textSub, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>
              {d.total > 0 ? `$${(d.total / 1000).toFixed(1)}k` : ""}
            </span>
            {/* bar */}
            <div style={{
              width: "100%",
              height: `${Math.max(pct, 3)}%`,
              background: isToday
                ? `linear-gradient(180deg, ${G.goldLight} 0%, ${G.gold} 100%)`
                : `${G.gold}40`,
              borderRadius: "5px 5px 2px 2px",
              border: isToday ? `1.5px solid ${G.gold}` : "none",
              transition: "height .5s ease",
              boxShadow: isToday ? `0 0 10px ${G.gold}44` : "none",
            }} />
            {/* day label */}
            <span style={{
              color: isToday ? G.gold : G.textSub,
              fontSize: 10,
              fontWeight: isToday ? 900 : 600,
            }}>
              {DAYS[d.dayOfWeek]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Top 5 Platillos ───────────────────────────────────────────────────
function TopDishes({ items, G }) {
  if (!items.length) {
    return <p style={{ color: G.textSub, textAlign: "center", padding: 20, fontSize: 13 }}>Sin datos este mes.</p>;
  }
  const max = items[0].qty;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => {
        const pct = (item.qty / max) * 100;
        const medals = ["🥇", "🥈", "🥉", "4", "5"];
        return (
          <div key={item.nombre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 22, textAlign: "center",
              fontSize: i < 3 ? 16 : 12,
              color: i < 3 ? G.gold : G.textSub,
              fontWeight: 900,
              fontFamily: "Georgia,serif",
            }}>{medals[i]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: G.textMain, fontSize: 12, fontWeight: 700 }}>{item.nombre}</span>
                <span style={{ color: G.textSub, fontSize: 11 }}>
                  {item.qty} uds · {fmt(item.revenue)}
                </span>
              </div>
              <div style={{ background: G.warmGray, borderRadius: 6, height: 7, overflow: "hidden" }}>
                <div style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: i === 0
                    ? `linear-gradient(90deg, ${G.gold}, ${G.goldLight})`
                    : `${G.gold}${60 - i * 10}`,
                  borderRadius: 6,
                  transition: "width .6s ease",
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cierre de Caja modal / panel ──────────────────────────────────────
function CierreCaja({ pedidosMes, G, tenantId }) {
  const [fondo, setFondo] = useState("");
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [loadingTurno, setLoadingTurno] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCierre, setShowCierre] = useState(false);

  // Load active shift from Firestore
  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "config", "turno_activo");
    getDoc(ref).then(snap => {
      if (snap.exists() && snap.data().activo) {
        setTurnoActivo(snap.data());
      }
      setLoadingTurno(false);
    }).catch(() => setLoadingTurno(false));
  }, [tenantId]);

  const iniciarTurno = async () => {
    const fondoNum = parseFloat(fondo) || 0;
    if (fondoNum < 0) return;
    setSaving(true);
    const turnoData = {
      activo: true,
      fondoInicial: fondoNum,
      iniciadoEn: Timestamp.now(),
    };
    try {
      await setDoc(
        doc(db, "tenants", tenantId, "config", "turno_activo"),
        turnoData,
        { merge: false }
      );
      setTurnoActivo(turnoData);
    } catch (e) {
      console.error("[DashboardGerencial] Error iniciando turno:", e);
    }
    setSaving(false);
  };

  const cerrarTurno = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "tenants", tenantId, "config", "turno_activo"),
        { activo: false },
        { merge: true }
      );
      setTurnoActivo(null);
      setShowCierre(false);
      setFondo("");
    } catch (e) {
      console.error("[DashboardGerencial] Error cerrando turno:", e);
    }
    setSaving(false);
  };

  // Pedidos del turno activo (desde que inició el turno hasta ahora)
  const pedidosTurno = useMemo(() => {
    if (!turnoActivo?.iniciadoEn) return [];
    const desde = turnoActivo.iniciadoEn.toDate
      ? turnoActivo.iniciadoEn.toDate()
      : new Date(turnoActivo.iniciadoEn.seconds * 1000);
    return pedidosMes.filter(p => {
      if (!ESTADOS_COBRADOS.includes(p.estado)) return false;
      const fecha = p.creadoEn?.toDate ? p.creadoEn.toDate() : null;
      return fecha && fecha >= desde;
    });
  }, [pedidosMes, turnoActivo]);

  const efectivo    = pedidosTurno.filter(p => p.pago === "efectivo").reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);
  const tarjeta     = pedidosTurno.filter(p => p.pago === "tarjeta").reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);
  const transferencia = pedidosTurno.filter(p => p.pago === "transferencia").reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);
  const totalTurno  = efectivo + tarjeta + transferencia;
  const fondoInicial = turnoActivo?.fondoInicial ?? 0;
  const cajaEsperada = fondoInicial + efectivo;
  // difference is informational — fondo + cash sales = expected in drawer

  if (loadingTurno) return (
    <div style={{ padding: 20, textAlign: "center", color: G.textSub }}>Cargando turno…</div>
  );

  // No active shift
  if (!turnoActivo) {
    return (
      <div style={{
        background: G.cardBg,
        border: `1.5px solid ${G.divider}`,
        borderRadius: 14,
        padding: "20px 22px",
      }}>
        <p style={{ margin: "0 0 6px", color: G.textMain, fontWeight: 800, fontSize: 14 }}>
          🏦 Iniciar Turno
        </p>
        <p style={{ margin: "0 0 14px", color: G.textSub, fontSize: 12 }}>
          Registra el efectivo inicial en caja antes de comenzar a operar.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: G.textSub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
              FONDO INICIAL ($)
            </label>
            <input
              id="fondo-inicial"
              type="number"
              min="0"
              value={fondo}
              onChange={e => setFondo(e.target.value)}
              placeholder="Ej. 500"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 9,
                border: `1.5px solid ${G.gold}`,
                fontSize: 16,
                fontWeight: 900,
                color: G.dark,
                fontFamily: "Georgia,serif",
                background: "#fff",
              }}
            />
          </div>
          <button
            id="btn-iniciar-turno"
            disabled={saving}
            onClick={iniciarTurno}
            style={{
              marginTop: 18,
              padding: "10px 20px",
              borderRadius: 9,
              border: "none",
              background: G.gold,
              color: G.dark,
              fontWeight: 900,
              fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}>
            {saving ? "Guardando…" : "▶ Iniciar Turno"}
          </button>
        </div>
      </div>
    );
  }

  // Active shift view
  const desde = turnoActivo.iniciadoEn?.toDate
    ? turnoActivo.iniciadoEn.toDate().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div style={{
      background: G.cardBg,
      border: `1.5px solid ${G.divider}`,
      borderRadius: 14,
      padding: "20px 22px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, color: G.textMain, fontWeight: 800, fontSize: 14 }}>
            🟢 Turno activo desde las {desde}
          </p>
          <p style={{ margin: "3px 0 0", color: G.textSub, fontSize: 11 }}>
            Fondo inicial: {fmt(fondoInicial)}
          </p>
        </div>
        <button
          id="btn-cierre-caja"
          onClick={() => setShowCierre(true)}
          style={{
            padding: "8px 16px",
            borderRadius: 9,
            border: `1.5px solid #c0392b`,
            background: "#fdecea",
            color: "#c0392b",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
          }}>
          🔒 Cierre de Caja
        </button>
      </div>

      {/* Desglose por pago */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { label: "Efectivo", icon: "💵", val: efectivo, key: "efectivo" },
          { label: "Tarjeta",  icon: "💳", val: tarjeta,  key: "tarjeta"  },
          { label: "Transf.",  icon: "📲", val: transferencia, key: "transferencia" },
        ].map(row => (
          <div key={row.key} style={{
            flex: "1 1 100px",
            background: "#fff",
            border: `1px solid ${G.divider}`,
            borderRadius: 10,
            padding: "10px 14px",
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 18 }}>{row.icon}</p>
            <p style={{ margin: 0, color: G.textSub, fontSize: 10, fontWeight: 700 }}>{row.label}</p>
            <p style={{ margin: 0, color: G.gold, fontWeight: 900, fontSize: 15, fontFamily: "Georgia,serif" }}>
              {fmt(row.val)}
            </p>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div style={{
        background: G.warmGray,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        justifyContent: "space-between",
      }}>
        <span style={{ color: G.textSub, fontSize: 12 }}>
          Total del turno: <strong style={{ color: G.textMain }}>{fmt(totalTurno)}</strong>
        </span>
        <span style={{ color: G.textSub, fontSize: 12 }}>
          En caja (fondo + efectivo):{" "}
          <strong style={{ color: G.gold, fontFamily: "Georgia,serif" }}>{fmt(cajaEsperada)}</strong>
        </span>
        <span style={{ color: G.textSub, fontSize: 12 }}>
          Pedidos cobrados: <strong>{pedidosTurno.length}</strong>
        </span>
      </div>

      {/* Cierre modal overlay */}
      {showCierre && (
        <CierreCajaModal
          efectivo={efectivo}
          tarjeta={tarjeta}
          transferencia={transferencia}
          totalTurno={totalTurno}
          fondoInicial={fondoInicial}
          cajaEsperada={cajaEsperada}
          G={G}
          onCancel={() => setShowCierre(false)}
          onConfirm={cerrarTurno}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Cierre de Caja confirmation modal ────────────────────────────────
function CierreCajaModal({
  efectivo, tarjeta, transferencia, totalTurno,
  fondoInicial, cajaEsperada, G,
  onCancel, onConfirm, saving,
}) {
  const [conteo, setConteo] = useState("");
  const conteoNum = parseFloat(conteo) || 0;
  const diferencia = conteoNum - cajaEsperada;
  const haConteo = conteo !== "";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000066",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: G.offWhite,
        border: `2px solid ${G.gold}`,
        borderRadius: 18,
        padding: "28px 26px",
        width: "100%",
        maxWidth: 380,
        boxShadow: "0 20px 60px #00000044",
      }}>
        <p style={{ margin: "0 0 4px", fontFamily: "Georgia,serif", fontSize: 20, color: G.gold, fontWeight: 900 }}>
          🔒 Cierre de Caja
        </p>
        <p style={{ margin: "0 0 20px", color: G.textSub, fontSize: 12 }}>
          Resumen del turno. Confirma para cerrar.
        </p>

        {/* Resumen */}
        {[
          ["💵 Ventas efectivo", efectivo],
          ["💳 Ventas tarjeta", tarjeta],
          ["📲 Ventas transf.", transferencia],
          ["📦 Total ventas", totalTurno],
          ["🏦 Fondo inicial", fondoInicial],
          ["💰 Esperado en caja", cajaEsperada],
        ].map(([label, val]) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: `1px solid ${G.divider}22`,
          }}>
            <span style={{ color: G.textSub, fontSize: 13 }}>{label}</span>
            <span style={{ color: G.gold, fontWeight: 800, fontFamily: "Georgia,serif", fontSize: 14 }}>
              {fmt(val)}
            </span>
          </div>
        ))}

        {/* Conteo real */}
        <div style={{ marginTop: 18 }}>
          <label style={{ color: G.textSub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5 }}>
            EFECTIVO CONTADO EN CAJA ($)
          </label>
          <input
            id="conteo-caja"
            type="number"
            min="0"
            value={conteo}
            onChange={e => setConteo(e.target.value)}
            placeholder="Ingresa el monto físico en caja"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 9,
              border: `1.5px solid ${G.gold}`,
              fontSize: 16,
              fontWeight: 900,
              color: G.dark,
              fontFamily: "Georgia,serif",
              background: "#fff",
            }}
          />
        </div>

        {/* Diferencia */}
        {haConteo && (
          <div style={{
            marginTop: 12,
            background: diferencia === 0 ? "#eafaf1" : diferencia > 0 ? "#eafaf1" : "#fdecea",
            border: `1.5px solid ${diferencia >= 0 ? "#27ae60" : "#e74c3c"}`,
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: diferencia >= 0 ? "#27ae60" : "#c0392b" }}>
              {diferencia > 0 ? "⬆ Sobrante" : diferencia < 0 ? "⬇ Faltante" : "✅ Cuadrado"}
            </span>
            <span style={{
              fontSize: 18, fontWeight: 900, fontFamily: "Georgia,serif",
              color: diferencia >= 0 ? "#27ae60" : "#c0392b",
            }}>
              {diferencia >= 0 ? "+" : ""}{fmt(diferencia)}
            </span>
          </div>
        )}

        {/* Botones */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            id="btn-cancelar-cierre"
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px", borderRadius: 9,
              border: `1.5px solid ${G.divider}`,
              background: "#fff",
              color: G.textSub,
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
            Cancelar
          </button>
          <button
            id="btn-confirmar-cierre"
            disabled={saving}
            onClick={onConfirm}
            style={{
              flex: 2, padding: "10px", borderRadius: 9, border: "none",
              background: "#c0392b",
              color: "#fff",
              fontWeight: 900, fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? "Cerrando…" : "Confirmar Cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main DashboardGerencial ──────────────────────────────────────────
export default function DashboardGerencial() {
  const { colRef, tenantId } = useTenant();
  const { colors: G } = useTenantConfig();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to all orders, last 90 days is fine (Firestore real-time)
  useEffect(() => {
    const q = query(colRef("pedidos"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed analytics ───────────────────────────────────────────
  const analytics = useMemo(() => {
    const cobrados = pedidos.filter(p => ESTADOS_COBRADOS.includes(p.estado));

    const dayStart   = startOf("day");
    const weekStart  = startOf("week");
    const monthStart = startOf("month");

    const toDate = (p) => p.creadoEn?.toDate ? p.creadoEn.toDate() : null;

    const ventasDia   = cobrados.filter(p => { const d = toDate(p); return d && d >= dayStart; })
                                .reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);
    const ventasSemana = cobrados.filter(p => { const d = toDate(p); return d && d >= weekStart; })
                                 .reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);
    const ventasMes   = cobrados.filter(p => { const d = toDate(p); return d && d >= monthStart; })
                                .reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);

    const ticketsDia   = cobrados.filter(p => { const d = toDate(p); return d && d >= dayStart; }).length;
    const ticketsMes   = cobrados.filter(p => { const d = toDate(p); return d && d >= monthStart; }).length;
    const avgTicket    = ticketsMes > 0 ? ventasMes / ticketsMes : 0;

    // ── Last 7 days bar chart ───────────────────────────────────────
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      const total = cobrados
        .filter(p => { const f = toDate(p); return f && f >= d && f <= dEnd; })
        .reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0);
      return { dayOfWeek: d.getDay(), total, label: d.toLocaleDateString("es-MX", { weekday: "short" }) };
    });

    // ── Top 5 dishes (current month) ───────────────────────────────
    const dishMap = {};
    cobrados
      .filter(p => { const d = toDate(p); return d && d >= monthStart; })
      .forEach(p => {
        (p.articulos || []).forEach(a => {
          const nombre = a.nombre || a.name || "?";
          if (!dishMap[nombre]) dishMap[nombre] = { qty: 0, revenue: 0 };
          const qty = a.cantidad || 1;
          dishMap[nombre].qty += qty;
          dishMap[nombre].revenue += a.subtotal || 0;
        });
      });

    const topDishes = Object.entries(dishMap)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // ── Payment split (current day) ────────────────────────────────
    const pagosDia = cobrados.filter(p => { const d = toDate(p); return d && d >= dayStart; });
    const pagoSplit = {
      efectivo:     pagosDia.filter(p => p.pago === "efectivo").reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0),
      tarjeta:      pagosDia.filter(p => p.pago === "tarjeta").reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0),
      transferencia:pagosDia.filter(p => p.pago === "transferencia").reduce((s, p) => s + (p.totalFinal ?? p.total ?? 0), 0),
    };

    return { ventasDia, ventasSemana, ventasMes, ticketsDia, ticketsMes, avgTicket, last7, topDishes, pagoSplit, cobrados };
  }, [pedidos]);

  const { ventasDia, ventasSemana, ventasMes, ticketsDia, avgTicket, last7, topDishes, pagoSplit, cobrados } = analytics;

  // ── Responsive ──────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: G.textSub }}>
        <p style={{ fontSize: 28 }}>📊</p>
        <p>Cargando datos…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 18px", fontFamily: "'Segoe UI', sans-serif", maxWidth: 900, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          margin: "0 0 2px",
          fontFamily: "Georgia,serif",
          color: G.gold,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: 1,
        }}>📈 Dashboard Gerencial</p>
        <p style={{ margin: 0, color: G.textSub, fontSize: 12, textTransform: "capitalize" }}>{today}</p>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KPICard label="VENTAS HOY" value={fmt(ventasDia)} sub={`${ticketsDia} ticket${ticketsDia !== 1 ? "s" : ""}`} icon="🗓" G={G} />
        <KPICard label="ESTA SEMANA" value={fmt(ventasSemana)} icon="📅" G={G} />
        <KPICard label="ESTE MES" value={fmt(ventasMes)} icon="📆" G={G} accent={G.goldLight} />
        <KPICard label="TICKET PROMEDIO" value={fmt(avgTicket)} icon="🧾" G={G} />
      </div>

      {/* ── Pago split del día ── */}
      <div style={{
        background: G.cardBg,
        border: `1.5px solid ${G.divider}`,
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 20,
      }}>
        <p style={{ margin: "0 0 12px", color: G.textSub, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
          FORMA DE PAGO — HOY
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(pagoSplit).map(([key, val]) => {
            const total = Object.values(pagoSplit).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return (
              <div key={key} style={{ flex: "1 1 80px", textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 20 }}>{PAGO_ICONS[key]}</p>
                <p style={{ margin: "0 0 2px", color: G.textMain, fontWeight: 900, fontFamily: "Georgia,serif", fontSize: 16 }}>
                  {fmt(val)}
                </p>
                <p style={{ margin: "0 0 6px", color: G.textSub, fontSize: 10, textTransform: "capitalize" }}>{key} · {pct}%</p>
                <div style={{ background: G.warmGray, borderRadius: 4, height: 5, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: `linear-gradient(90deg, ${G.gold}, ${G.goldLight})`,
                    borderRadius: 4,
                    transition: "width .6s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>

        {/* Bar chart */}
        <div style={{
          background: G.cardBg,
          border: `1.5px solid ${G.divider}`,
          borderRadius: 14,
          padding: "16px 20px",
          flex: "2 1 260px",
        }}>
          <p style={{ margin: "0 0 14px", color: G.textSub, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
            VENTAS ÚLTIMOS 7 DÍAS
          </p>
          <BarChart data={last7} G={G} />
        </div>

        {/* Top dishes */}
        <div style={{
          background: G.cardBg,
          border: `1.5px solid ${G.divider}`,
          borderRadius: 14,
          padding: "16px 20px",
          flex: "3 1 260px",
        }}>
          <p style={{ margin: "0 0 14px", color: G.textSub, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
            TOP 5 PLATILLOS — ESTE MES
          </p>
          <TopDishes items={topDishes} G={G} />
        </div>
      </div>

      {/* ── Cierre de Caja ── */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: "0 0 10px", color: G.textSub, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
          ARQUEO DE CAJA
        </p>
        <CierreCaja pedidosMes={cobrados} G={G} tenantId={tenantId} />
      </div>

    </div>
  );
}
