import { useTenantConfig } from "./TenantContext";

// ── DashboardGerencial ────────────────────────────────────────────────
// Placeholder mínimo para que el build no falle por el import faltante.
// Aquí puedes construir más adelante: ventas por día/semana, productos
// más vendidos, ticket promedio, comparativas, etc. — todo se puede
// alimentar desde la colección "pedidos" igual que hace Dashboard/POS.
export default function DashboardGerencial() {
  const { colors: G } = useTenantConfig();
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontSize: 38, margin: "0 0 10px" }}>📈</p>
      <h3 style={{ color: G.dark, fontFamily: "Georgia,serif", margin: "0 0 8px" }}>
        Dashboard Gerencial
      </h3>
      <p style={{ color: G.textSub, fontSize: 13, lineHeight: 1.5 }}>
        Esta sección está en construcción. Aquí podrás ver ventas por día,
        productos más vendidos, ticket promedio y comparativas — dime qué
        métricas te interesan y lo construimos.
      </p>
    </div>
  );
}