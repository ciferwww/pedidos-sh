import { useState, useEffect, useMemo, useCallback } from "react";
import {
  onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, getDocs, serverTimestamp, Timestamp, getDoc,
} from "firebase/firestore";
import { db, useTenant, useTenantConfig } from "./TenantContext";

// ── Constantes ────────────────────────────────────────────────────────
const ROLES_DISPONIBLES = ["cajero", "cocinero", "mesero", "repartidor", "limpieza", "jefe"];
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_ABREV = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

// Devuelve el lunes de la semana de la fecha dada
function lunesDe(d = new Date()) {
  const x = new Date(d);
  const dia = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - dia);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmt(d) {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtHora(d) {
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function semanaKey(lunes) {
  return lunes.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const MXN = (n) => `$${(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Componentes compartidos ───────────────────────────────────────────
function Label({ G, children }) {
  return (
    <p style={{ color: G.textSub, fontSize: 10, fontWeight: 800, letterSpacing: 1, margin: "0 0 5px", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function Input({ G, ...props }) {
  return (
    <input
      {...props}
      style={{
        width: "100%", boxSizing: "border-box", padding: "9px 12px",
        borderRadius: 8, border: `1.5px solid ${G.divider}`,
        fontSize: 13, fontFamily: "inherit", background: "#fff",
        color: G.dark, outline: "none", ...props.style,
      }}
    />
  );
}

function Card({ G, children, style }) {
  return (
    <div style={{
      background: G.cardBg, borderRadius: 12, padding: "16px 18px",
      border: `1px solid ${G.divider}`, ...style,
    }}>
      {children}
    </div>
  );
}

function Btn({ G, variant = "primary", children, style, ...props }) {
  const base = {
    padding: "9px 18px", borderRadius: 9, border: "none",
    fontWeight: 800, fontSize: 13, cursor: "pointer",
    fontFamily: "inherit", transition: "all .15s",
  };
  const variants = {
    primary: { background: G.gold, color: G.dark },
    danger:  { background: "#c0392b", color: "#fff" },
    ghost:   { background: "transparent", border: `1.5px solid ${G.divider}`, color: G.textSub },
    green:   { background: "#27ae60", color: "#fff" },
  };
  return <button style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</button>;
}

// ── Vista principal ───────────────────────────────────────────────────
export default function NominaPanel() {
  const { colRef, tenantId } = useTenant();
  const { colors: G } = useTenantConfig();

  const [subTab, setSubTab] = useState("empleados"); // empleados | asistencia | adelantos | nomina
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(colRef("empleados"), orderBy("nombre")),
      snap => {
        setEmpleados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [tenantId]); // eslint-disable-line

  const SUB_TABS = [
    { key: "empleados",  label: "👤 Empleados" },
    { key: "asistencia", label: "🕐 Asistencia" },
    { key: "adelantos",  label: "💸 Adelantos" },
    { key: "nomina",     label: "📋 Nómina" },
  ];

  if (loading) return <p style={{ padding: 40, color: G.textSub, textAlign: "center" }}>Cargando módulo de nómina…</p>;

  return (
    <div style={{ padding: "20px 22px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ color: G.dark, fontFamily: "Georgia,serif", margin: "0 0 2px", fontSize: 22 }}>
          Gestión de Personal y Nómina
        </h2>
        <p style={{ color: G.textSub, fontSize: 12, margin: 0 }}>
          Empleados activos: {empleados.length}
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 22,
        background: "#ffffff0a", borderRadius: 10, padding: 4,
        border: `1px solid ${G.divider}`, width: "fit-content",
      }}>
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, transition: "all .18s",
            background: subTab === t.key ? G.gold : "transparent",
            color: subTab === t.key ? G.dark : G.textSub,
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === "empleados"  && <TabEmpleados G={G} colRef={colRef} tenantId={tenantId} empleados={empleados} />}
      {subTab === "asistencia" && <TabAsistencia G={G} colRef={colRef} tenantId={tenantId} empleados={empleados} />}
      {subTab === "adelantos"  && <TabAdelantos G={G} colRef={colRef} tenantId={tenantId} empleados={empleados} />}
      {subTab === "nomina"     && <TabNomina G={G} colRef={colRef} tenantId={tenantId} empleados={empleados} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: EMPLEADOS
// ══════════════════════════════════════════════════════════════════════
function TabEmpleados({ G, colRef, tenantId, empleados }) {
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.4fr" : "1fr", gap: 16 }}>
      {/* Lista */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: G.dark, fontWeight: 800, fontSize: 15 }}>Directorio</span>
          <Btn G={G} onClick={() => { setSelected(null); setShowForm(true); }}>+ Nuevo empleado</Btn>
        </div>
        {showForm && !selected && (
          <EmpleadoForm G={G} colRef={colRef} tenantId={tenantId} onDone={() => setShowForm(false)} />
        )}
        {empleados.length === 0 && !showForm && (
          <Card G={G} style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: G.textSub }}>No hay empleados registrados todavía.</p>
          </Card>
        )}
        {empleados.map(e => (
          <Card G={G} key={e.id} style={{
            marginBottom: 8, cursor: "pointer",
            border: `1px solid ${selected?.id === e.id ? G.gold : G.divider}`,
            background: selected?.id === e.id ? `${G.gold}10` : G.cardBg,
          }} onClick={() => { setSelected(e); setShowForm(false); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800, color: G.dark, fontSize: 14 }}>{e.nombre}</p>
                <p style={{ margin: "3px 0 0", color: G.textSub, fontSize: 12 }}>
                  {e.rol || "—"} · PIN: {e.pin}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, color: G.gold, fontWeight: 900, fontSize: 15, fontFamily: "Georgia,serif" }}>
                  {MXN(e.sueldoBase || 0)}
                </p>
                <p style={{ margin: "2px 0 0", color: G.textSub, fontSize: 10 }}>sueldo base / semana</p>
              </div>
            </div>
            {e.diasDescanso?.length > 0 && (
              <p style={{ margin: "6px 0 0", color: G.textSub, fontSize: 11 }}>
                Descanso: {(e.diasDescanso || []).map(d => DIAS_ABREV[d]).join(", ")}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Detalle / edición */}
      {selected && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: G.dark, fontWeight: 800, fontSize: 15 }}>Editar empleado</span>
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: G.textSub, cursor: "pointer", fontSize: 18,
            }}>✕</button>
          </div>
          <EmpleadoForm
            G={G} colRef={colRef} tenantId={tenantId}
            empleado={selected}
            onDone={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}

function EmpleadoForm({ G, colRef, tenantId, empleado, onDone }) {
  const [nombre, setNombre]       = useState(empleado?.nombre || "");
  const [pin, setPin]             = useState(empleado?.pin || "");
  const [rol, setRol]             = useState(empleado?.rol || "cajero");
  const [sueldoBase, setSueldo]   = useState(String(empleado?.sueldoBase || ""));
  const [horaEntrada, setHE]      = useState(empleado?.horaEntrada || "08:00");
  const [horaSalida, setHS]       = useState(empleado?.horaSalida || "17:00");
  const [diasDescanso, setDD]     = useState(empleado?.diasDescanso || [6]); // default: domingo
  const [bonoAsistencia, setBonA] = useState(String(empleado?.bonoAsistencia || ""));
  const [bonoProductividad, setBonP] = useState(String(empleado?.bonoProductividad || ""));
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const toggleDescanso = (idx) => {
    setDD(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
  };

  const guardar = async () => {
    if (!nombre.trim()) { alert("El nombre es obligatorio."); return; }
    if (pin.length !== 4 || isNaN(Number(pin))) { alert("El PIN debe ser exactamente 4 dígitos."); return; }
    if (!sueldoBase || isNaN(parseFloat(sueldoBase))) { alert("Ingresa el sueldo base."); return; }
    setSaving(true);
    const data = {
      nombre: nombre.trim(), pin,
      rol, sueldoBase: parseFloat(sueldoBase),
      horaEntrada, horaSalida, diasDescanso,
      bonoAsistencia: parseFloat(bonoAsistencia) || 0,
      bonoProductividad: parseFloat(bonoProductividad) || 0,
      actualizadoEn: serverTimestamp(),
    };
    try {
      if (empleado?.id) {
        await updateDoc(doc(db, "tenants", tenantId, "empleados", empleado.id), data);
      } else {
        await addDoc(colRef("empleados"), { ...data, creadoEn: serverTimestamp() });
      }
      onDone();
    } catch (e) {
      console.error(e);
      alert("Error al guardar. Verifica la conexión.");
    }
    setSaving(false);
  };

  const eliminar = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "empleados", empleado.id));
      onDone();
    } catch (e) { console.error(e); alert("Error al eliminar."); }
    setDeleting(false);
  };

  return (
    <Card G={G}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label G={G}>Nombre completo</Label>
            <Input G={G} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del empleado" />
          </div>
          <div>
            <Label G={G}>PIN (4 dígitos)</Label>
            <Input G={G} value={pin} onChange={e => setPin(e.target.value.slice(0,4))} placeholder="1234" maxLength={4} inputMode="numeric" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label G={G}>Rol</Label>
            <select value={rol} onChange={e => setRol(e.target.value)} style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1.5px solid ${G.divider}`, fontSize: 13, background: "#fff",
              color: G.dark, fontFamily: "inherit",
            }}>
              {ROLES_DISPONIBLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <Label G={G}>Sueldo base / semana ($)</Label>
            <Input G={G} type="number" min="0" value={sueldoBase} onChange={e => setSueldo(e.target.value)} placeholder="Ej. 1500" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label G={G}>Hora entrada</Label>
            <Input G={G} type="time" value={horaEntrada} onChange={e => setHE(e.target.value)} />
          </div>
          <div>
            <Label G={G}>Hora salida</Label>
            <Input G={G} type="time" value={horaSalida} onChange={e => setHS(e.target.value)} />
          </div>
        </div>

        <div>
          <Label G={G}>Día(s) de descanso</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
            {DIAS_ABREV.map((d, i) => (
              <button key={i} onClick={() => toggleDescanso(i)} style={{
                padding: "5px 10px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${diasDescanso.includes(i) ? G.gold : G.divider}`,
                background: diasDescanso.includes(i) ? G.gold : "transparent",
                color: diasDescanso.includes(i) ? G.dark : G.textSub,
              }}>{d}</button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${G.divider}`, paddingTop: 14 }}>
          <p style={{ color: G.dark, fontWeight: 800, fontSize: 12, margin: "0 0 10px" }}>
            Bonos automáticos (se proponen en cierre de semana)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label G={G}>Bono de asistencia ($)</Label>
              <Input G={G} type="number" min="0" value={bonoAsistencia} onChange={e => setBonA(e.target.value)} placeholder="Ej. 200" />
              <p style={{ color: G.textSub, fontSize: 10, margin: "4px 0 0" }}>Se aplica si no tuvo faltas en la semana.</p>
            </div>
            <div>
              <Label G={G}>Bono de productividad ($)</Label>
              <Input G={G} type="number" min="0" value={bonoProductividad} onChange={e => setBonP(e.target.value)} placeholder="Ej. 150" />
              <p style={{ color: G.textSub, fontSize: 10, margin: "4px 0 0" }}>Se aplica manualmente en el cierre semanal.</p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {empleado?.id && (
            confirmDel ? (
              <>
                <Btn G={G} variant="danger" onClick={eliminar} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Confirmar eliminación"}
                </Btn>
                <Btn G={G} variant="ghost" onClick={() => setConfirmDel(false)}>Cancelar</Btn>
              </>
            ) : (
              <Btn G={G} variant="ghost" onClick={() => setConfirmDel(true)}>🗑 Eliminar</Btn>
            )
          )}
          <Btn G={G} variant="ghost" onClick={onDone} style={{ marginLeft: "auto" }}>Cancelar</Btn>
          <Btn G={G} onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Btn>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: ASISTENCIA
// ══════════════════════════════════════════════════════════════════════
function TabAsistencia({ G, colRef, tenantId, empleados }) {
  const [semana, setSemana] = useState(lunesDe());
  const [registros, setRegistros] = useState([]);
  const [loadingR, setLoadingR] = useState(true);
  const [registrando, setRegistrando] = useState({});

  const lunes = lunesDe(semana);
  const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6); domingo.setHours(23, 59, 59, 999);
  const sKey = semanaKey(lunes);

  useEffect(() => {
    setLoadingR(true);
    const q = query(
      colRef("asistencia"),
      where("creadoEn", ">=", Timestamp.fromDate(lunes)),
      where("creadoEn", "<=", Timestamp.fromDate(domingo))
    );
    const unsub = onSnapshot(q, snap => {
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingR(false);
    }, () => setLoadingR(false));
    return unsub;
  }, [sKey, tenantId]); // eslint-disable-line

  // Pivot: registros por empleadoId → por día (0-6 Lu-Do)
  const pivot = useMemo(() => {
    const p = {};
    empleados.forEach(e => { p[e.id] = {}; for (let d = 0; d < 7; d++) p[e.id][d] = []; });
    registros.forEach(r => {
      if (!p[r.empleadoId]) p[r.empleadoId] = {};
      const diaIdx = new Date(r.creadoEn.toDate()).getDay();
      const diaLu = diaIdx === 0 ? 6 : diaIdx - 1;
      if (!p[r.empleadoId][diaLu]) p[r.empleadoId][diaLu] = [];
      p[r.empleadoId][diaLu].push(r);
    });
    return p;
  }, [registros, empleados]);

  const navSemana = (delta) => {
    const s = new Date(semana);
    s.setDate(s.getDate() + delta * 7);
    setSemana(s);
  };

  const registrarAsistencia = async (empleado, tipo) => {
    const key = `${empleado.id}-${tipo}`;
    setRegistrando(p => ({ ...p, [key]: true }));
    try {
      await addDoc(colRef("asistencia"), {
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombre,
        tipo, // "entrada" | "salida" | "falta"
        creadoEn: serverTimestamp(),
        semanaKey: sKey,
      });
    } catch (e) { console.error(e); alert("Error al registrar."); }
    setRegistrando(p => ({ ...p, [key]: false }));
  };

  const eliminarRegistro = async (id) => {
    try { await deleteDoc(doc(db, "tenants", tenantId, "asistencia", id)); }
    catch (e) { console.error(e); }
  };

  const hoyIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const esEstaSemana = semanaKey(lunesDe()) === sKey;

  return (
    <div>
      {/* Navegación de semana */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Btn G={G} variant="ghost" onClick={() => navSemana(-1)}>← Semana anterior</Btn>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 800, color: G.dark, fontSize: 14 }}>
            {fmt(lunes)} — {fmt(domingo)}
          </p>
          {esEstaSemana && (
            <span style={{ background: G.gold, color: G.dark, borderRadius: 8, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>
              SEMANA ACTUAL
            </span>
          )}
        </div>
        <Btn G={G} variant="ghost" onClick={() => navSemana(1)}>Semana siguiente →</Btn>
        {!esEstaSemana && (
          <Btn G={G} onClick={() => setSemana(lunesDe())}>Hoy</Btn>
        )}
      </div>

      {loadingR && <p style={{ color: G.textSub, textAlign: "center", padding: 30 }}>Cargando registros…</p>}

      {!loadingR && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 780 }}>
            <thead>
              <tr style={{ background: G.warmGray }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: G.textSub, fontWeight: 800, fontSize: 11, width: 160 }}>
                  EMPLEADO
                </th>
                {DIAS_ABREV.map((d, i) => (
                  <th key={i} style={{
                    padding: "10px 8px", textAlign: "center",
                    color: i === hoyIdx && esEstaSemana ? G.gold : G.textSub,
                    fontWeight: i === hoyIdx && esEstaSemana ? 900 : 800, fontSize: 11,
                    background: i === hoyIdx && esEstaSemana ? `${G.gold}18` : "transparent",
                  }}>
                    {d}
                    <br />
                    <span style={{ fontWeight: 400, fontSize: 10 }}>
                      {(() => { const x = new Date(lunes); x.setDate(x.getDate() + i); return x.getDate(); })()}
                    </span>
                  </th>
                ))}
                {esEstaSemana && <th style={{ padding: "10px 8px", color: G.textSub, fontSize: 11, fontWeight: 800 }}>REGISTRAR HOY</th>}
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp, ei) => (
                <tr key={emp.id} style={{ borderTop: `1px solid ${G.divider}`, background: ei % 2 === 0 ? "#fff" : G.offWhite }}>
                  <td style={{ padding: "10px 14px" }}>
                    <p style={{ margin: 0, fontWeight: 700, color: G.dark, fontSize: 13 }}>{emp.nombre}</p>
                    <p style={{ margin: "2px 0 0", color: G.textSub, fontSize: 11 }}>{emp.rol}</p>
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map(dIdx => {
                    const regs = pivot[emp.id]?.[dIdx] || [];
                    const esDescanso = (emp.diasDescanso || []).includes(dIdx);
                    const entrada = regs.find(r => r.tipo === "entrada");
                    const salida = regs.find(r => r.tipo === "salida");
                    const falta = regs.find(r => r.tipo === "falta");
                    const esHoy = dIdx === hoyIdx && esEstaSemana;

                    return (
                      <td key={dIdx} style={{
                        padding: "8px 6px", textAlign: "center",
                        background: esHoy ? `${G.gold}08` : "transparent",
                      }}>
                        {esDescanso && !entrada && !falta && (
                          <span style={{ color: "#8e9eab", fontSize: 11, fontStyle: "italic" }}>descanso</span>
                        )}
                        {falta && (
                          <div>
                            <span style={{ background: "#fdecea", color: "#c0392b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>
                              ✗ Falta
                            </span>
                            <button onClick={() => eliminarRegistro(falta.id)} style={{
                              display: "block", margin: "3px auto 0", background: "none", border: "none",
                              color: "#aaa", fontSize: 10, cursor: "pointer",
                            }}>borrar</button>
                          </div>
                        )}
                        {!esDescanso && !falta && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                            {entrada && (
                              <span style={{ background: "#eafaf1", color: "#27ae60", borderRadius: 8, padding: "2px 7px", fontSize: 10, fontWeight: 800 }}>
                                ↑ {fmtHora(entrada.creadoEn.toDate())}
                              </span>
                            )}
                            {salida && (
                              <span style={{ background: "#fff8ee", color: "#e67e22", borderRadius: 8, padding: "2px 7px", fontSize: 10, fontWeight: 800 }}>
                                ↓ {fmtHora(salida.creadoEn.toDate())}
                              </span>
                            )}
                            {!entrada && !salida && (
                              <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Columna de registro rápido (solo semana actual) */}
                  {esEstaSemana && (
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                        <button
                          onClick={() => registrarAsistencia(emp, "entrada")}
                          disabled={registrando[`${emp.id}-entrada`]}
                          style={{
                            padding: "4px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                            background: "#eafaf1", color: "#27ae60", fontWeight: 800, fontSize: 11,
                          }}>↑ Entrada</button>
                        <button
                          onClick={() => registrarAsistencia(emp, "salida")}
                          disabled={registrando[`${emp.id}-salida`]}
                          style={{
                            padding: "4px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                            background: "#fff8ee", color: "#e67e22", fontWeight: 800, fontSize: 11,
                          }}>↓ Salida</button>
                        <button
                          onClick={() => registrarAsistencia(emp, "falta")}
                          disabled={registrando[`${emp.id}-falta`]}
                          style={{
                            padding: "4px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                            background: "#fdecea", color: "#c0392b", fontWeight: 800, fontSize: 11,
                          }}>✗ Falta</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {empleados.length === 0 && (
        <Card G={G} style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: G.textSub }}>Agrega empleados primero en la pestaña "Empleados".</p>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: ADELANTOS
// ══════════════════════════════════════════════════════════════════════
function TabAdelantos({ G, colRef, tenantId, empleados }) {
  const [empId, setEmpId] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [adelantos, setAdelantos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroPendiente, setFiltroPendiente] = useState(true);

  useEffect(() => {
    const q = query(colRef("adelantos"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, snap => {
      setAdelantos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId]); // eslint-disable-line

  const registrar = async () => {
    if (!empId) { alert("Selecciona un empleado."); return; }
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) { alert("Ingresa un monto válido."); return; }
    setSaving(true);
    const emp = empleados.find(e => e.id === empId);
    try {
      await addDoc(colRef("adelantos"), {
        empleadoId: empId,
        empleadoNombre: emp?.nombre || "",
        monto: parseFloat(monto),
        nota: nota.trim(),
        descontado: false,
        creadoEn: serverTimestamp(),
      });
      setMonto(""); setNota(""); setEmpId("");
    } catch (e) { console.error(e); alert("Error al registrar."); }
    setSaving(false);
  };

  const marcarDescontado = async (id) => {
    try { await updateDoc(doc(db, "tenants", tenantId, "adelantos", id), { descontado: true, descontadoEn: serverTimestamp() }); }
    catch (e) { console.error(e); }
  };

  const eliminar = async (id) => {
    try { await deleteDoc(doc(db, "tenants", tenantId, "adelantos", id)); }
    catch (e) { console.error(e); }
  };

  const filtrados = filtroPendiente ? adelantos.filter(a => !a.descontado) : adelantos;

  // Total pendiente por empleado
  const totalesPendientes = useMemo(() => {
    const t = {};
    adelantos.filter(a => !a.descontado).forEach(a => {
      t[a.empleadoId] = (t[a.empleadoId] || 0) + a.monto;
    });
    return t;
  }, [adelantos]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 18 }}>
      {/* Formulario */}
      <div>
        <Card G={G}>
          <p style={{ color: G.dark, fontWeight: 800, fontSize: 14, margin: "0 0 14px" }}>Registrar adelanto</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Label G={G}>Empleado</Label>
              <select value={empId} onChange={e => setEmpId(e.target.value)} style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: `1.5px solid ${G.divider}`, fontSize: 13, background: "#fff",
                color: G.dark, fontFamily: "inherit",
              }}>
                <option value="">Selecciona…</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <Label G={G}>Monto ($)</Label>
              <Input G={G} type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej. 500" />
            </div>
            <div>
              <Label G={G}>Nota (opcional)</Label>
              <Input G={G} value={nota} onChange={e => setNota(e.target.value)} placeholder="Razón del adelanto…" />
            </div>
            <Btn G={G} onClick={registrar} disabled={saving}>{saving ? "Registrando…" : "Registrar adelanto"}</Btn>
          </div>
        </Card>

        {/* Resumen de pendientes */}
        {Object.keys(totalesPendientes).length > 0 && (
          <Card G={G} style={{ marginTop: 12 }}>
            <p style={{ color: G.dark, fontWeight: 800, fontSize: 13, margin: "0 0 10px" }}>Pendiente por descontar</p>
            {Object.entries(totalesPendientes).map(([id, total]) => {
              const emp = empleados.find(e => e.id === id);
              return (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${G.divider}33` }}>
                  <span style={{ color: G.dark, fontSize: 13 }}>{emp?.nombre || id}</span>
                  <span style={{ color: "#c0392b", fontWeight: 900, fontSize: 13, fontFamily: "Georgia,serif" }}>{MXN(total)}</span>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Historial */}
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <span style={{ color: G.dark, fontWeight: 800, fontSize: 14, flex: 1 }}>Historial</span>
          <button onClick={() => setFiltroPendiente(true)} style={{
            padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${filtroPendiente ? G.gold : G.divider}`,
            background: filtroPendiente ? G.gold : "transparent", color: filtroPendiente ? G.dark : G.textSub,
            fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>Pendientes</button>
          <button onClick={() => setFiltroPendiente(false)} style={{
            padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${!filtroPendiente ? G.gold : G.divider}`,
            background: !filtroPendiente ? G.gold : "transparent", color: !filtroPendiente ? G.dark : G.textSub,
            fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>Todos</button>
        </div>

        {loading && <p style={{ color: G.textSub, textAlign: "center" }}>Cargando…</p>}
        {!loading && filtrados.length === 0 && (
          <Card G={G} style={{ textAlign: "center", padding: 30 }}>
            <p style={{ color: G.textSub }}>Sin adelantos {filtroPendiente ? "pendientes" : "registrados"}.</p>
          </Card>
        )}
        {filtrados.map(a => (
          <Card G={G} key={a.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: G.dark, fontSize: 13 }}>{a.empleadoNombre}</p>
                {a.nota && <p style={{ margin: "3px 0 0", color: G.textSub, fontSize: 11, fontStyle: "italic" }}>{a.nota}</p>}
                <p style={{ margin: "3px 0 0", color: G.textSub, fontSize: 10 }}>
                  {a.creadoEn?.toDate ? fmt(a.creadoEn.toDate()) : "—"}
                  {a.descontado && <span style={{ color: "#27ae60", marginLeft: 8, fontWeight: 700 }}>✓ Descontado</span>}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, color: "#c0392b", fontWeight: 900, fontSize: 16, fontFamily: "Georgia,serif" }}>
                  {MXN(a.monto)}
                </p>
                {!a.descontado && (
                  <div style={{ display: "flex", gap: 5, marginTop: 5, justifyContent: "flex-end" }}>
                    <button onClick={() => marcarDescontado(a.id)} style={{
                      padding: "3px 9px", borderRadius: 6, border: "none",
                      background: "#eafaf1", color: "#27ae60", fontWeight: 800, fontSize: 11, cursor: "pointer",
                    }}>✓ Marcar descontado</button>
                    <button onClick={() => eliminar(a.id)} style={{
                      padding: "3px 7px", borderRadius: 6, border: "none",
                      background: "#fdecea", color: "#c0392b", fontSize: 11, cursor: "pointer",
                    }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: NÓMINA (Calculador semanal)
// ══════════════════════════════════════════════════════════════════════
function TabNomina({ G, colRef, tenantId, empleados }) {
  const [semana, setSemana] = useState(lunesDe());
  const [asistencias, setAsistencias] = useState([]);
  const [adelantos, setAdelantos] = useState([]);
  const [nominaGuardada, setNominaGuardada] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bonos overrides por empleado (pueden modificarse antes de guardar)
  const [bonosAprobados, setBonosAprobados] = useState({});   // { empId: { asistencia: bool, productividad: bool } }
  const [bonosExtra, setBonosExtra] = useState({});           // { empId: number } bonos manuales adicionales

  const lunes = lunesDe(semana);
  const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6); domingo.setHours(23, 59, 59, 999);
  const sKey = semanaKey(lunes);

  useEffect(() => {
    setLoadingData(true);
    setNominaGuardada(null);

    // Cargar asistencias de la semana
    const qA = query(
      colRef("asistencia"),
      where("creadoEn", ">=", Timestamp.fromDate(lunes)),
      where("creadoEn", "<=", Timestamp.fromDate(domingo))
    );

    // Cargar adelantos pendientes
    const qAd = query(colRef("adelantos"), where("descontado", "==", false));

    // Cargar nómina guardada si existe
    Promise.all([
      getDocs(qA),
      getDocs(qAd),
      getDoc(doc(db, "tenants", tenantId, "nominas", sKey)),
    ]).then(([snapA, snapAd, nomSnap]) => {
      setAsistencias(snapA.docs.map(d => ({ id: d.id, ...d.data() })));
      setAdelantos(snapAd.docs.map(d => ({ id: d.id, ...d.data() })));

      if (nomSnap.exists()) {
        setNominaGuardada(nomSnap.data());
        // Restaurar los overrides guardados
        const saved = nomSnap.data();
        const bonA = {}, bonE = {};
        (saved.lineas || []).forEach(l => {
          bonA[l.empleadoId] = { asistencia: l.bonoAsistenciaAplicado, productividad: l.bonoProductividadAplicado };
          bonE[l.empleadoId] = l.bonoExtra || 0;
        });
        setBonosAprobados(bonA);
        setBonosExtra(bonE);
      } else {
        // Inicializar defaults: calcular si empleado no tuvo faltas → bono asistencia on
        const bonA = {}, bonE = {};
        empleados.forEach(e => {
          const faltas = snapA.docs.filter(d => d.data().empleadoId === e.id && d.data().tipo === "falta").length;
          bonA[e.id] = {
            asistencia: faltas === 0 && (e.bonoAsistencia || 0) > 0,
            productividad: false, // productividad siempre empieza en false, jefe decide
          };
          bonE[e.id] = 0;
        });
        setBonosAprobados(bonA);
        setBonosExtra(bonE);
      }

      setLoadingData(false);
    }).catch(err => { console.error(err); setLoadingData(false); });
  }, [sKey, tenantId]); // eslint-disable-line

  // ── Calcular nómina ──────────────────────────────────────────────
  const lineas = useMemo(() => {
    return empleados.map(emp => {
      const regsEmp = asistencias.filter(r => r.empleadoId === emp.id);
      const entradas = regsEmp.filter(r => r.tipo === "entrada").length;
      const faltas = regsEmp.filter(r => r.tipo === "falta").length;

      // Días laborables esperados = días totales de la semana - días de descanso
      const diasDescanso = (emp.diasDescanso || []).length;
      const diasEsperados = 7 - diasDescanso;

      // Horas trabajadas (simplificado: pares entrada/salida por día)
      let horasTrabajadas = 0;
      const [heH, heM] = (emp.horaEntrada || "08:00").split(":").map(Number);
      const [hsH, hsM] = (emp.horaSalida || "17:00").split(":").map(Number);
      const horasPorDia = ((hsH * 60 + hsM) - (heH * 60 + heM)) / 60;
      const diasAsistidos = Math.max(0, entradas);
      horasTrabajadas = diasAsistidos * horasPorDia;

      // Sueldo proporcional (sueldo base × días asistidos / días esperados)
      const sueldoBase = emp.sueldoBase || 0;
      const sueldoProporcional = diasEsperados > 0
        ? (sueldoBase / diasEsperados) * diasAsistidos
        : 0;

      const bonA = emp.bonoAsistencia || 0;
      const bonP = emp.bonoProductividad || 0;
      const bonos = bonosAprobados[emp.id] || {};
      const bonoAsistenciaAplicado = bonos.asistencia ?? (faltas === 0 && bonA > 0);
      const bonoProductividadAplicado = bonos.productividad ?? false;
      const bonoExtra = parseFloat(bonosExtra[emp.id] || 0);

      const adelantosEmp = adelantos.filter(a => a.empleadoId === emp.id);
      const totalAdelantos = adelantosEmp.reduce((s, a) => s + a.monto, 0);

      const totalBonos = (bonoAsistenciaAplicado ? bonA : 0) + (bonoProductividadAplicado ? bonP : 0) + bonoExtra;
      const totalNeto = Math.max(0, sueldoProporcional + totalBonos - totalAdelantos);

      return {
        empleadoId: emp.id,
        nombre: emp.nombre,
        rol: emp.rol,
        sueldoBase,
        diasEsperados,
        diasAsistidos,
        faltas,
        horasTrabajadas: parseFloat(horasTrabajadas.toFixed(1)),
        sueldoProporcional: parseFloat(sueldoProporcional.toFixed(2)),
        bonoAsistenciaBase: bonA,
        bonoProductividadBase: bonP,
        bonoAsistenciaAplicado,
        bonoProductividadAplicado,
        bonoExtra,
        totalBonos: parseFloat(totalBonos.toFixed(2)),
        adelantosEmp: adelantosEmp.map(a => ({ id: a.id, monto: a.monto, nota: a.nota })),
        totalAdelantos: parseFloat(totalAdelantos.toFixed(2)),
        totalNeto: parseFloat(totalNeto.toFixed(2)),
      };
    });
  }, [empleados, asistencias, adelantos, bonosAprobados, bonosExtra]);

  const totalNomina = lineas.reduce((s, l) => s + l.totalNeto, 0);

  const guardarNomina = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "tenants", tenantId, "nominas", sKey), {
        semanaKey: sKey,
        lunes: Timestamp.fromDate(lunes),
        domingo: Timestamp.fromDate(domingo),
        lineas,
        totalNomina: parseFloat(totalNomina.toFixed(2)),
        creadoEn: serverTimestamp(),
        estado: "cerrada",
      });
      // Marcar adelantos incluidos como descontados
      await Promise.all(
        lineas.flatMap(l => l.adelantosEmp.map(a =>
          updateDoc(doc(db, "tenants", tenantId, "adelantos", a.id), {
            descontado: true, descontadoEn: serverTimestamp(), nomina: sKey,
          })
        ))
      );
      setNominaGuardada({ lineas, totalNomina, estado: "cerrada" });
    } catch (e) { console.error(e); alert("Error al guardar la nómina."); }
    setSaving(false);
  };

  const navSemana = (delta) => {
    const s = new Date(semana); s.setDate(s.getDate() + delta * 7); setSemana(s);
  };
  const esSabado = new Date().getDay() === 6;

  return (
    <div>
      {/* Navegación */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Btn G={G} variant="ghost" onClick={() => navSemana(-1)}>← Anterior</Btn>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 800, color: G.dark, fontSize: 14 }}>
            Semana del {fmt(lunes)} al {fmt(domingo)}
          </p>
          {nominaGuardada && (
            <span style={{ background: "#27ae60", color: "#fff", borderRadius: 8, padding: "2px 10px", fontSize: 10, fontWeight: 800 }}>
              ✓ NÓMINA CERRADA
            </span>
          )}
          {!nominaGuardada && esSabado && semanaKey(lunesDe()) === sKey && (
            <span style={{ background: G.gold, color: G.dark, borderRadius: 8, padding: "2px 10px", fontSize: 10, fontWeight: 800 }}>
              ¡HOY ES SÁBADO — CIERRE DE SEMANA!
            </span>
          )}
        </div>
        <Btn G={G} variant="ghost" onClick={() => navSemana(1)}>Siguiente →</Btn>
      </div>

      {loadingData && <p style={{ color: G.textSub, textAlign: "center", padding: 40 }}>Calculando nómina…</p>}

      {!loadingData && (
        <>
          {/* Aviso de bonos automáticos */}
          {!nominaGuardada && (
            <Card G={G} style={{ marginBottom: 16, background: "#fffdf0", border: `1px solid ${G.gold}` }}>
              <p style={{ margin: "0 0 6px", fontWeight: 800, color: G.dark, fontSize: 13 }}>
                ⚡ Revisa los bonos antes de cerrar
              </p>
              <p style={{ margin: 0, color: G.textSub, fontSize: 12 }}>
                El bono de asistencia se activa automáticamente si el empleado no tuvo faltas.
                El bono de productividad debes aprobarlo tú. Puedes modificar cualquier bono antes de cerrar la nómina.
              </p>
            </Card>
          )}

          {/* Tabla de nómina */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
              <thead>
                <tr style={{ background: G.warmGray }}>
                  {["Empleado", "Días esperados", "Días asistidos", "Horas", "Sueldo proporcional",
                    "B. Asistencia", "B. Productividad", "B. Extra", "Adelantos", "TOTAL NETO"].map(h => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: G.textSub, fontWeight: 800, fontSize: 10.5, letterSpacing: .3 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={l.empleadoId} style={{ borderTop: `1px solid ${G.divider}`, background: i % 2 === 0 ? "#fff" : G.offWhite }}>
                    <td style={{ padding: "10px 10px" }}>
                      <p style={{ margin: 0, fontWeight: 700, color: G.dark, fontSize: 13 }}>{l.nombre}</p>
                      <p style={{ margin: "2px 0 0", color: G.textSub, fontSize: 10 }}>{l.rol}</p>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: G.textSub }}>{l.diasEsperados}</td>
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      <span style={{
                        background: l.faltas === 0 ? "#eafaf1" : "#fdecea",
                        color: l.faltas === 0 ? "#27ae60" : "#c0392b",
                        borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 12,
                      }}>
                        {l.diasAsistidos}
                        {l.faltas > 0 && ` (${l.faltas}F)`}
                      </span>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: G.textSub }}>{l.horasTrabajadas}h</td>
                    <td style={{ padding: "10px 10px", color: G.dark, fontWeight: 700, fontFamily: "Georgia,serif" }}>
                      {MXN(l.sueldoProporcional)}
                    </td>

                    {/* Bono asistencia */}
                    <td style={{ padding: "10px 10px" }}>
                      {l.bonoAsistenciaBase > 0 && !nominaGuardada && (
                        <button
                          onClick={() => setBonosAprobados(p => ({
                            ...p,
                            [l.empleadoId]: { ...p[l.empleadoId], asistencia: !l.bonoAsistenciaAplicado },
                          }))}
                          style={{
                            padding: "4px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                            background: l.bonoAsistenciaAplicado ? "#eafaf1" : "#f5f5f5",
                            color: l.bonoAsistenciaAplicado ? "#27ae60" : "#aaa",
                            fontWeight: 800, fontSize: 11,
                          }}>
                          {l.bonoAsistenciaAplicado ? `✓ ${MXN(l.bonoAsistenciaBase)}` : `✗ ${MXN(l.bonoAsistenciaBase)}`}
                        </button>
                      )}
                      {nominaGuardada && (
                        <span style={{ color: l.bonoAsistenciaAplicado ? "#27ae60" : "#aaa", fontWeight: 700, fontSize: 12 }}>
                          {l.bonoAsistenciaAplicado ? MXN(l.bonoAsistenciaBase) : "—"}
                        </span>
                      )}
                      {l.bonoAsistenciaBase === 0 && <span style={{ color: "#ccc", fontSize: 11 }}>—</span>}
                    </td>

                    {/* Bono productividad */}
                    <td style={{ padding: "10px 10px" }}>
                      {l.bonoProductividadBase > 0 && !nominaGuardada && (
                        <button
                          onClick={() => setBonosAprobados(p => ({
                            ...p,
                            [l.empleadoId]: { ...p[l.empleadoId], productividad: !l.bonoProductividadAplicado },
                          }))}
                          style={{
                            padding: "4px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                            background: l.bonoProductividadAplicado ? "#eaf3ff" : "#f5f5f5",
                            color: l.bonoProductividadAplicado ? "#2980b9" : "#aaa",
                            fontWeight: 800, fontSize: 11,
                          }}>
                          {l.bonoProductividadAplicado ? `✓ ${MXN(l.bonoProductividadBase)}` : `✗ ${MXN(l.bonoProductividadBase)}`}
                        </button>
                      )}
                      {nominaGuardada && (
                        <span style={{ color: l.bonoProductividadAplicado ? "#2980b9" : "#aaa", fontWeight: 700, fontSize: 12 }}>
                          {l.bonoProductividadAplicado ? MXN(l.bonoProductividadBase) : "—"}
                        </span>
                      )}
                      {l.bonoProductividadBase === 0 && <span style={{ color: "#ccc", fontSize: 11 }}>—</span>}
                    </td>

                    {/* Bono extra manual */}
                    <td style={{ padding: "10px 10px" }}>
                      {!nominaGuardada ? (
                        <input
                          type="number" min="0"
                          value={bonosExtra[l.empleadoId] || ""}
                          onChange={e => setBonosExtra(p => ({ ...p, [l.empleadoId]: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          style={{
                            width: 70, padding: "4px 8px", borderRadius: 7,
                            border: `1.5px solid ${G.divider}`, fontSize: 12,
                            fontFamily: "Georgia,serif", fontWeight: 700,
                          }}
                        />
                      ) : (
                        <span style={{ color: l.bonoExtra > 0 ? "#8e44ad" : "#ccc", fontWeight: 700, fontSize: 12 }}>
                          {l.bonoExtra > 0 ? MXN(l.bonoExtra) : "—"}
                        </span>
                      )}
                    </td>

                    {/* Adelantos */}
                    <td style={{ padding: "10px 10px" }}>
                      {l.totalAdelantos > 0 ? (
                        <span style={{ color: "#c0392b", fontWeight: 800, fontSize: 12, fontFamily: "Georgia,serif" }}>
                          −{MXN(l.totalAdelantos)}
                          <br />
                          <span style={{ fontSize: 9, fontWeight: 400, color: G.textSub, fontFamily: "inherit" }}>
                            {l.adelantosEmp.length} adelanto{l.adelantosEmp.length > 1 ? "s" : ""}
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
                      )}
                    </td>

                    {/* Total neto */}
                    <td style={{ padding: "10px 12px" }}>
                      <p style={{ margin: 0, color: G.gold, fontWeight: 900, fontSize: 16, fontFamily: "Georgia,serif" }}>
                        {MXN(l.totalNeto)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: G.warmGray, borderTop: `2px solid ${G.divider}` }}>
                  <td colSpan={9} style={{ padding: "10px 14px", fontWeight: 800, color: G.dark, fontSize: 13 }}>
                    TOTAL A PAGAR ESTA SEMANA
                  </td>
                  <td style={{ padding: "10px 12px", color: G.gold, fontWeight: 900, fontSize: 18, fontFamily: "Georgia,serif" }}>
                    {MXN(totalNomina)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Acciones */}
          {!nominaGuardada && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Btn G={G} variant="green" onClick={guardarNomina} disabled={saving} style={{ padding: "12px 28px", fontSize: 14 }}>
                {saving ? "Cerrando nómina…" : "✓ Cerrar y guardar nómina"}
              </Btn>
              <p style={{ color: G.textSub, fontSize: 12, margin: 0 }}>
                Al cerrar, los adelantos pendientes se marcarán como descontados automáticamente.
              </p>
            </div>
          )}

          {nominaGuardada && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={() => exportarCSV(lineas, lunes, domingo, totalNomina)}
                style={{
                  padding: "10px 20px", borderRadius: 9, border: "none",
                  background: "#27ae60", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                }}>
                📥 Exportar CSV
              </button>
              <p style={{ color: "#27ae60", fontSize: 13, fontWeight: 700, margin: 0 }}>
                ✓ Nómina cerrada. Solo lectura.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function exportarCSV(lineas, lunes, domingo, totalNomina) {
  const rows = [
    ["NÓMINA SEMANAL"],
    [`Semana:`, `${fmt(lunes)} — ${fmt(domingo)}`],
    [],
    ["Empleado", "Rol", "Días esperados", "Días asistidos", "Horas", "Sueldo proporcional",
     "Bono asistencia", "Bono productividad", "Bono extra", "Adelantos descontados", "Total neto"],
    ...lineas.map(l => [
      l.nombre, l.rol, l.diasEsperados, l.diasAsistidos, l.horasTrabajadas,
      l.sueldoProporcional.toFixed(2),
      l.bonoAsistenciaAplicado ? l.bonoAsistenciaBase.toFixed(2) : "0.00",
      l.bonoProductividadAplicado ? l.bonoProductividadBase.toFixed(2) : "0.00",
      l.bonoExtra.toFixed(2),
      l.totalAdelantos.toFixed(2),
      l.totalNeto.toFixed(2),
    ]),
    [],
    ["TOTAL", "", "", "", "", "", "", "", "", "", totalNomina.toFixed(2)],
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `nomina-${semanaKey(lunes)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
