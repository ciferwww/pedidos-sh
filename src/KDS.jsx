import { useEffect, useState, useCallback } from "react";
import { onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db, useTenant, useTenantConfig } from "./TenantContext";
import { OrderCard } from "./Admin";

// ── KDS (Kitchen Display System) ──────────────────────────────────────
// Vista exclusiva para el rol "cocinero": solo tickets activos (nuevo /
// en_proceso), sin acceso a POS, Cierre ni Config.
export default function KDS({ empleado, onLogout }) {
  const { colRef, tenantId, playNewOrderBeep } = useTenant();
  const { colors: G } = useTenantConfig();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const stablePlayBeep = useCallback(playNewOrderBeep, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = query(colRef("pedidos"), orderBy("creadoEn", "desc"));
    return onSnapshot(q, snap => {
      const activos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.estado === "nuevo" || p.estado === "en_proceso");
      setPedidos(activos);
      setLoading(false);
    });
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Beep cuando entra un ticket nuevo
  useEffect(() => {
    if (pedidos.some(p => p.estado === "nuevo")) stablePlayBeep?.();
  }, [pedidos, stablePlayBeep]);

  const cambiarEstado = (id, estado) =>
    updateDoc(doc(db, "tenants", tenantId, "pedidos", id), { estado });

  const nuevos = pedidos.filter(p => p.estado === "nuevo").length;

  return (
    <div style={{minHeight:"100vh", background:"#f0ece4", fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:G.dark, padding:"0 20px", borderBottom:`2px solid ${G.gold}44`,
        display:"flex", alignItems:"center", height:62, boxSizing:"border-box", gap:10}}>
        <p style={{color:G.gold, fontFamily:"Georgia,serif", fontSize:19, fontWeight:900,
          margin:0, letterSpacing:2.5}}>🍳 COCINA</p>
        <span style={{color:"#6a5a3a", fontSize:11}}>{empleado.nombre}</span>
        {nuevos > 0 && (
          <span style={{background:"#c0392b", color:"#fff", borderRadius:8,
            padding:"3px 12px", fontSize:11, fontWeight:900, letterSpacing:.5}}>
            🔔 {nuevos} NUEVO{nuevos > 1 ? "S" : ""}
          </span>
        )}
        <button id="btn-logout-kds" onClick={onLogout} style={{marginLeft:"auto",
          background:"none", border:"1px solid #2a2010", borderRadius:8,
          color:"#6a5a3a", padding:"5px 12px", fontSize:12, cursor:"pointer"}}>
          Salir
        </button>
      </div>

      <div style={{padding:"14px 16px"}}>
        {loading && <p style={{textAlign:"center", color:"#5a4a2a", padding:40}}>Cargando tickets…</p>}
        {!loading && pedidos.length === 0 && (
          <div style={{textAlign:"center", padding:40}}>
            <p style={{fontSize:36}}>🍣</p>
            <p style={{color:"#5a4a2a"}}>No hay tickets pendientes</p>
          </div>
        )}
        {pedidos.map(p => (
          <OrderCard key={p.id} pedido={p} onChangeEstado={cambiarEstado} G={G} />
        ))}
      </div>
    </div>
  );
}