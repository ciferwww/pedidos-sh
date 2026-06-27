import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { useTenant, useTenantConfig } from "./TenantContext";

// ── DashboardGerencial ────────────────────────────────────────────────
// Métricas reales calculadas en vivo a partir de /pedidos y /productos.
// Sin librerías de gráficas externas: las barras son divs con ancho
// proporcional, así que no agrega dependencias al proyecto.

const MXN = (n) => `$${(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diaCorto(d) {
  return d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "");
}

export default function DashboardGerencial() {
  const { colRef, tenantId } = useTenant();
  const { colors: G } = useTenantConfig();

  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState(7); // días a mostrar en la tendencia

  useEffect(() => {
    const q = query(colRef("pedidos"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = onSnapshot(colRef("productos"), (snap) => {
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoriaPorNombre = useMemo(() => {
    const map = {};
    productos.forEach((p) => { map[p.name] = p.categoria || "Otros"; });
    return map;
  }, [productos]);

  const metrics = useMemo(() => {
    const hoy = startOfDay(new Date());
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);

    const totalDe = (p) => p.totalFinal ?? p.total ?? 0;
    const fechaDe = (p) => p.creadoEn?.toDate ? p.creadoEn.toDate() : null;

    const pedidosHoy = pedidos.filter((p) => { const f = fechaDe(p); return f && f >= hoy; });
    const pedidosAyer = pedidos.filter((p) => { const f = fechaDe(p); return f && f >= ayer && f < hoy; });

    const ventasHoy = pedidosHoy.reduce((s, p) => s + totalDe(p), 0);
    const ventasAyer = pedidosAyer.reduce((s, p) => s + totalDe(p), 0);
    const cambioVsAyer = ventasAyer > 0 ? ((ventasHoy - ventasAyer) / ventasAyer) * 100 : null;

    const ticketPromedioHoy = pedidosHoy.length ? ventasHoy / pedidosHoy.length : 0;

    // Tendencia de los últimos N días (incluye hoy)
    const dias = [];
    for (let i = rango - 1; i >= 0; i--) {
      const inicio = new Date(hoy); inicio.setDate(inicio.getDate() - i);
      const fin = new Date(inicio); fin.setDate(fin.getDate() + 1);
      const delDia = pedidos.filter((p) => { const f = fechaDe(p); return f && f >= inicio && f < fin; });
      dias.push({
        fecha: inicio,
        label: diaCorto(inicio),
        ventas: delDia.reduce((s, p) => s + totalDe(p), 0),
        pedidos: delDia.length,
      });
    }
    const maxVenta = Math.max(1, ...dias.map((d) => d.ventas));

    // Top productos (por cantidad vendida, acumulado histórico cargado)
    const conteoProductos = {};
    pedidos.forEach((p) => {
      (p.articulos || []).forEach((a) => {
        if (!conteoProductos[a.nombre]) conteoProductos[a.nombre] = { cantidad: 0, ingresos: 0 };
        conteoProductos[a.nombre].cantidad += a.cantidad || 1;
        conteoProductos[a.nombre].ingresos += a.subtotal || 0;
      });
    });
    const topProductos = Object.entries(conteoProductos)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
    const maxCantidad = Math.max(1, ...topProductos.map((p) => p.cantidad));

    // Ventas por categoría
    const porCategoria = {};
    pedidos.forEach((p) => {
      (p.articulos || []).forEach((a) => {
        const cat = categoriaPorNombre[a.nombre] || "Otros";
        porCategoria[cat] = (porCategoria[cat] || 0) + (a.subtotal || 0);
      });
    });
    const categoriasOrdenadas = Object.entries(porCategoria)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
    const totalCategorias = categoriasOrdenadas.reduce((s, c) => s + c.total, 0) || 1;

    // Por origen (web / pos / whatsapp)
    const porOrigen = { web: 0, pos: 0, whatsapp: 0 };
    pedidos.forEach((p) => {
      const o = p.origen === "pos" ? "pos" : p.origen === "whatsapp" ? "whatsapp" : "web";
      porOrigen[o] += totalDe(p);
    });

    // Histórico general (todo lo cargado)
    const ventasTotales = pedidos.reduce((s, p) => s + totalDe(p), 0);
    const ticketPromedioGeneral = pedidos.length ? ventasTotales / pedidos.length : 0;

    return {
      ventasHoy, ventasAyer, cambioVsAyer, pedidosHoyCount: pedidosHoy.length,
      ticketPromedioHoy, dias, maxVenta, topProductos, maxCantidad,
      categoriasOrdenadas, totalCategorias, porOrigen,
      ventasTotales, ticketPromedioGeneral, totalPedidos: pedidos.length,
    };
  }, [pedidos, categoriaPorNombre, rango]);

  if (loading) {
    return <p style={{ textAlign: "center", color: G.textSub, padding: 60 }}>Cargando métricas…</p>;
  }

  const CAT_COLORS = [G.gold, "#2980b9", "#27ae60", "#8e44ad", "#e67e22", "#7f8c8d"];

  return (
    <div style={{ padding: "20px 22px 60px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ color: G.dark, fontFamily: "Georgia,serif", margin: "0 0 2px", fontSize: 22 }}>
          Dashboard Gerencial
        </h2>
        <p style={{ color: G.textSub, fontSize: 12, margin: 0 }}>
          Métricas en vivo basadas en los pedidos registrados.
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 22 }}>
        <KpiCard G={G} label="Ventas de hoy" value={MXN(metrics.ventasHoy)}
          sub={metrics.cambioVsAyer == null ? "Sin datos de ayer" :
            `${metrics.cambioVsAyer >= 0 ? "+" : ""}${metrics.cambioVsAyer.toFixed(0)}% vs. ayer`}
          subColor={metrics.cambioVsAyer == null ? G.textSub : metrics.cambioVsAyer >= 0 ? "#27ae60" : "#c0392b"} />
        <KpiCard G={G} label="Pedidos hoy" value={metrics.pedidosHoyCount} sub="Órdenes registradas" />
        <KpiCard G={G} label="Ticket promedio (hoy)" value={MXN(metrics.ticketPromedioHoy)} sub="Por pedido" />
        <KpiCard G={G} label="Ticket promedio (histórico)" value={MXN(metrics.ticketPromedioGeneral)}
          sub={`${metrics.totalPedidos} pedidos en total`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Tendencia de ventas */}
        <Panel G={G} title="Tendencia de ventas" action={
          <div style={{ display: "flex", gap: 4 }}>
            {[7, 14, 30].map((n) => (
              <button key={n} onClick={() => setRango(n)} style={{
                padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${rango === n ? G.gold : G.divider}`,
                background: rango === n ? G.gold : "transparent",
                color: rango === n ? G.dark : G.textSub,
              }}>{n}d</button>
            ))}
          </div>
        }>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, marginTop: 8 }}>
            {metrics.dias.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: G.textSub, fontWeight: 700 }}>
                  {d.ventas > 0 ? MXN(d.ventas) : ""}
                </span>
                <div title={`${d.label}: ${MXN(d.ventas)} · ${d.pedidos} pedidos`} style={{
                  width: "100%", maxWidth: 34,
                  height: Math.max(3, (d.ventas / metrics.maxVenta) * 110),
                  background: `linear-gradient(180deg,${G.goldLight},${G.gold})`,
                  borderRadius: "4px 4px 0 0",
                }} />
                <span style={{ fontSize: 10, color: G.textSub, textTransform: "capitalize" }}>{d.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Ventas por origen */}
        <Panel G={G} title="Ventas por canal">
          {[
            { key: "web", label: "Menú digital" },
            { key: "pos", label: "Punto de venta" },
            { key: "whatsapp", label: "WhatsApp" },
          ].map((o) => {
            const total = metrics.ventasTotales || 1;
            const pct = (metrics.porOrigen[o.key] / total) * 100;
            return (
              <div key={o.key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: G.dark, fontWeight: 700 }}>{o.label}</span>
                  <span style={{ fontSize: 12.5, color: G.textSub }}>{MXN(metrics.porOrigen[o.key])}</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: G.warmGray, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: G.gold, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Top productos */}
        <Panel G={G} title="Productos más vendidos">
          {metrics.topProductos.length === 0 && (
            <p style={{ color: G.textSub, fontSize: 12 }}>Todavía no hay ventas registradas.</p>
          )}
          {metrics.topProductos.map((p, i) => (
            <div key={p.nombre} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12.5, color: G.dark, fontWeight: 700 }}>
                  {i + 1}. {p.nombre}
                </span>
                <span style={{ fontSize: 12.5, color: G.textSub }}>{p.cantidad} vendidos · {MXN(p.ingresos)}</span>
              </div>
              <div style={{ height: 7, borderRadius: 5, background: G.warmGray, overflow: "hidden" }}>
                <div style={{ width: `${(p.cantidad / metrics.maxCantidad) * 100}%`, height: "100%", background: G.goldBg, borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </Panel>

        {/* Ventas por categoría */}
        <Panel G={G} title="Ventas por categoría">
          {metrics.categoriasOrdenadas.length === 0 && (
            <p style={{ color: G.textSub, fontSize: 12 }}>Sin datos suficientes todavía.</p>
          )}
          {metrics.categoriasOrdenadas.map((c, i) => (
            <div key={c.categoria} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12.5, color: G.dark, fontWeight: 700 }}>{c.categoria}</span>
                <span style={{ fontSize: 12.5, color: G.textSub }}>
                  {MXN(c.total)} · {((c.total / metrics.totalCategorias) * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 5, background: G.warmGray, overflow: "hidden" }}>
                <div style={{
                  width: `${(c.total / metrics.totalCategorias) * 100}%`, height: "100%",
                  background: CAT_COLORS[i % CAT_COLORS.length], borderRadius: 5,
                }} />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({ G, label, value, sub, subColor }) {
  return (
    <div style={{ background: G.cardBg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${G.divider}` }}>
      <p style={{ color: G.textSub, fontSize: 10.5, fontWeight: 800, letterSpacing: .5, margin: "0 0 6px", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ color: G.dark, fontWeight: 900, fontSize: 22, margin: "0 0 4px", fontFamily: "Georgia,serif" }}>
        {value}
      </p>
      {sub && <p style={{ color: subColor || G.textSub, fontSize: 11.5, margin: 0, fontWeight: 700 }}>{sub}</p>}
    </div>
  );
}

function Panel({ G, title, action, children }) {
  return (
    <div style={{ background: G.cardBg, borderRadius: 12, padding: "16px 18px", border: `1px solid ${G.divider}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ color: G.dark, fontWeight: 800, fontSize: 14, margin: 0, fontFamily: "Georgia,serif" }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}