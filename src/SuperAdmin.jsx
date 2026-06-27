/**
 * SuperAdmin.jsx
 * Panel exclusivo del dueño de la plataforma SaaS.
 * Acceso: monta este componente en index.js cuando pathname === "/superadmin"
 * o cuando exista el parámetro ?superadmin en la URL.
 *
 * Firestore path que gestiona: /tenants/{tenantId}  (colección RAÍZ)
 * No usa TenantProvider — se conecta directamente a Firebase.
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, doc, updateDoc, setDoc,
  serverTimestamp, query, orderBy, getDocs,
} from "firebase/firestore";
import { db } from "./TenantContext";

// ── Paleta SuperAdmin (dark SaaS — intencionalmente distinta al UI del restaurante) ─
const S = {
  bg:        "#0d1117",
  surface:   "#161b22",
  surface2:  "#21262d",
  border:    "#30363d",
  accent:    "#58a6ff",
  accentBg:  "#1c2d40",
  text:      "#e6edf3",
  textSub:   "#8b949e",
  green:     "#3fb950",
  greenBg:   "#1a3a22",
  greenBdr:  "#2ea043",
  red:       "#f85149",
  redBg:     "#3a1a1a",
  redBdr:    "#da3633",
  yellow:    "#d29922",
  yellowBg:  "#2d2000",
  yellowBdr: "#9e6a03",
  purple:    "#bc8cff",
  purpleBg:  "#2a1d3a",
  gold:      "#d4a843",
  goldBg:    "#2d2010",
};

// ── Planes disponibles ───────────────────────────────────────────────
const PLANES = [
  { id:"basico",     label:"Básico",     precio:299,  color:S.textSub,  icon:"⚡" },
  { id:"pro",        label:"Pro",        precio:599,  color:S.purple,   icon:"🚀" },
  { id:"enterprise", label:"Enterprise", precio:999,  color:S.gold,     icon:"👑" },
];

const PLAN_MAP = Object.fromEntries(PLANES.map(p => [p.id, p]));

// ── Contraseña del super-admin ───────────────────────────────────────
// Configura REACT_APP_SUPERADMIN_PASSWORD en tu .env.local
const SA_PASSWORD = process.env.REACT_APP_SUPERADMIN_PASSWORD || "Sa@Shekinah2025!";

// ── Helpers ──────────────────────────────────────────────────────────
const slugify  = (s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
const daysLeft = (diaCorte) => {
  if (!diaCorte) return null;
  const now   = new Date();
  const corte = new Date(now.getFullYear(), now.getMonth(), diaCorte);
  if (corte < now) corte.setMonth(corte.getMonth() + 1);
  return Math.ceil((corte - now) / 86_400_000);
};

// ─────────────────────────────────────────────────────────────────────
// 1. LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────
function SALogin({ onLogin }) {
  const [pw, setPw]   = useState("");
  const [err, setErr] = useState(false);

  const tryLogin = () => {
    if (pw === SA_PASSWORD) onLogin();
    else { setErr(true); setPw(""); }
  };

  return (
    <div style={{ minHeight:"100vh", background:S.bg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background:S.surface, borderRadius:14, padding:"36px 32px",
        width:"100%", maxWidth:360, border:`1px solid ${S.border}` }}>

        <div style={{ textAlign:"center", marginBottom:28 }}>
          <p style={{ fontSize:36, margin:"0 0 6px" }}>⚙️</p>
          <p style={{ color:S.text, fontSize:20, fontWeight:800, margin:0 }}>
            SaaS Control Center
          </p>
          <p style={{ color:S.textSub, fontSize:12, margin:"4px 0 0" }}>
            Acceso restringido — Solo administrador
          </p>
        </div>

        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === "Enter" && tryLogin()}
          placeholder="Contraseña maestra"
          style={{ width:"100%", padding:"11px 14px", borderRadius:8,
            border:`1.5px solid ${err ? S.red : S.border}`,
            background:S.surface2, color:S.text, fontSize:14,
            boxSizing:"border-box", fontFamily:"inherit", outline:"none",
            marginBottom:8 }}
          autoFocus
        />
        {err && (
          <p style={{ color:S.red, fontSize:12, margin:"0 0 8px" }}>
            Contraseña incorrecta.
          </p>
        )}

        <button onClick={tryLogin} style={{ width:"100%", padding:"11px",
          borderRadius:8, border:"none", background:S.accent, color:"#fff",
          fontWeight:800, fontSize:14, cursor:"pointer" }}>
          Entrar →
        </button>

        <p style={{ color:S.textSub, fontSize:11, textAlign:"center",
          marginTop:18, lineHeight:1.5 }}>
          Configura <code style={{ color:S.accent }}>REACT_APP_SUPERADMIN_PASSWORD</code>
          {" "}en tu <code style={{ color:S.accent }}>.env.local</code>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. METRICS STRIP
// ─────────────────────────────────────────────────────────────────────
function MetricsStrip({ tenants }) {
  const activos    = tenants.filter(t => t.status === "activo");
  const suspendidos= tenants.filter(t => t.status === "suspendido");
  const prueba     = tenants.filter(t => t.status === "prueba");
  const mrr        = activos.reduce((s, t) => s + (t.planPrecio || 0), 0);
  const arr        = mrr * 12;

  const cards = [
    { label:"Restaurantes",  value:tenants.length,              color:S.accent,  icon:"🏪" },
    { label:"Activos",       value:activos.length,              color:S.green,   icon:"✅" },
    { label:"Suspendidos",   value:suspendidos.length,          color:S.red,     icon:"🚫" },
    { label:"En prueba",     value:prueba.length,               color:S.yellow,  icon:"⏳" },
    { label:"MRR",           value:`$${mrr.toLocaleString()}`,  color:S.gold,    icon:"💰" },
    { label:"ARR estimado",  value:`$${arr.toLocaleString()}`,  color:S.purple,  icon:"📈" },
  ];

  return (
    <div style={{ display:"grid",
      gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",
      gap:10, marginBottom:20 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background:S.surface, borderRadius:10,
          padding:"14px 16px", border:`1px solid ${S.border}` }}>
          <p style={{ color:S.textSub, fontSize:11, margin:"0 0 4px",
            fontWeight:600, letterSpacing:.5 }}>{c.icon} {c.label.toUpperCase()}</p>
          <p style={{ color:c.color, fontWeight:900, fontSize:22, margin:0,
            fontFamily:"Georgia, serif" }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. NEW TENANT MODAL
// ─────────────────────────────────────────────────────────────────────
function NewTenantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    tenantId:  "",
    nombre:    "",
    slogan:    "RESTAURANT · EL SABOR A GLORIA",
    whatsapp:  "52",
    plan:      "basico",
    planPrecio:299,
    fechaCorte:1,
    status:    "prueba",
  });
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState("");
  const [autoId, setAutoId]   = useState(true);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Auto-generar tenantId desde nombre
  useEffect(() => {
    if (autoId) set("tenantId", slugify(form.nombre));
  }, [form.nombre, autoId]); // eslint-disable-line

  const handlePlan = (planId) => {
    const plan = PLAN_MAP[planId];
    set("plan", planId);
    set("planPrecio", plan.precio);
  };

  const crear = async () => {
    if (!form.tenantId || !form.nombre || !form.whatsapp) {
      setError("ID, Nombre y WhatsApp son obligatorios."); return;
    }
    if (!/^[a-z0-9-]+$/.test(form.tenantId)) {
      setError("El ID solo puede contener letras minúsculas, números y guiones."); return;
    }
    setSaving(true);
    try {
      // Documento raíz del tenant
      await setDoc(doc(db, "tenants", form.tenantId), {
        nombre:     form.nombre,
        slogan:     form.slogan,
        whatsapp:   form.whatsapp,
        plan:       form.plan,
        planPrecio: Number(form.planPrecio),
        fechaCorte: Number(form.fechaCorte),
        status:     form.status,
        creadoEn:   serverTimestamp(),
        branding:   {},
      });

      // Config general
      await setDoc(
        doc(db, "tenants", form.tenantId, "config", "general"),
        { pausado: false, deliveryCost: 30, pausado_motivo: "" }
      );

      // Config turno
      await setDoc(
        doc(db, "tenants", form.tenantId, "config", "turno"),
        { ultimo: 0 }
      );

      // Empleado admin inicial con PIN 0000
      await setDoc(
        doc(db, "tenants", form.tenantId, "empleados", "admin"),
        { nombre: "Admin", pin: "0000", rol: "jefe" }
      );

      onCreated(form.tenantId);
      onClose();
    } catch (e) {
      setError("Error al crear: " + e.message);
    }
    setSaving(false);
  };

  const Field = ({ label, children }) => (
    <div style={{ marginBottom:14 }}>
      <p style={{ color:S.textSub, fontSize:11, fontWeight:700,
        margin:"0 0 5px", letterSpacing:.5 }}>{label}</p>
      {children}
    </div>
  );

  const inputStyle = {
    width:"100%", padding:"9px 12px", borderRadius:7,
    border:`1px solid ${S.border}`, background:S.surface2,
    color:S.text, fontSize:14, boxSizing:"border-box",
    fontFamily:"inherit", outline:"none",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)",
      zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center",
      padding:16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:S.surface, borderRadius:14, padding:"28px 26px",
        width:"100%", maxWidth:500, border:`1px solid ${S.border}`,
        maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
          <p style={{ color:S.text, fontWeight:800, fontSize:17, margin:0 }}>
            🏪 Registrar nuevo restaurante
          </p>
          <button onClick={onClose} style={{ marginLeft:"auto", background:"none",
            border:"none", color:S.textSub, fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {/* Nombre */}
        <Field label="NOMBRE DEL RESTAURANTE *">
          <input style={inputStyle} value={form.nombre}
            onChange={e => set("nombre", e.target.value)}
            placeholder="Ej. Sushi Monterrey" />
        </Field>

        {/* Tenant ID */}
        <Field label={`ID (slug URL) * ${autoId ? "— auto" : ""}`}>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...inputStyle, flex:1, fontFamily:"monospace",
              color: S.accent }}
              value={form.tenantId}
              onChange={e => { setAutoId(false); set("tenantId", e.target.value); }}
              placeholder="sushi-monterrey" />
            <button onClick={() => { setAutoId(true); set("tenantId", slugify(form.nombre)); }}
              style={{ padding:"8px 12px", borderRadius:7, border:`1px solid ${S.border}`,
                background:autoId ? S.accentBg : S.surface2, color:S.accent,
                fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
              Auto
            </button>
          </div>
          <p style={{ color:S.textSub, fontSize:11, margin:"4px 0 0" }}>
            URL: {window.location.origin}/?rest={form.tenantId || "…"}
          </p>
        </Field>

        {/* Slogan */}
        <Field label="SLOGAN (opcional)">
          <input style={inputStyle} value={form.slogan}
            onChange={e => set("slogan", e.target.value)} />
        </Field>

        {/* WhatsApp */}
        <Field label="WHATSAPP (con código de país) *">
          <input style={inputStyle} value={form.whatsapp} type="tel"
            onChange={e => set("whatsapp", e.target.value)}
            placeholder="526442049243" />
        </Field>

        {/* Plan */}
        <Field label="PLAN DE SUSCRIPCIÓN">
          <div style={{ display:"flex", gap:8 }}>
            {PLANES.map(p => (
              <button key={p.id} onClick={() => handlePlan(p.id)} style={{
                flex:1, padding:"10px 6px", borderRadius:8, cursor:"pointer",
                border:`1.5px solid ${form.plan === p.id ? p.color : S.border}`,
                background: form.plan === p.id ? `${p.color}22` : S.surface2,
                color: form.plan === p.id ? p.color : S.textSub,
                fontWeight:700, fontSize:12, textAlign:"center" }}>
                <p style={{ margin:"0 0 2px", fontSize:16 }}>{p.icon}</p>
                <p style={{ margin:"0 0 2px" }}>{p.label}</p>
                <p style={{ margin:0, fontWeight:900 }}>${p.precio}/mes</p>
              </button>
            ))}
          </div>
        </Field>

        {/* Precio personalizado */}
        <Field label="PRECIO MENSUAL (MXN) — editable">
          <input style={inputStyle} type="number" value={form.planPrecio}
            onChange={e => set("planPrecio", e.target.value)} />
        </Field>

        {/* Fecha de corte */}
        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <p style={{ color:S.textSub, fontSize:11, fontWeight:700,
              margin:"0 0 5px" }}>DÍA DE CORTE (1-28)</p>
            <input style={inputStyle} type="number" min={1} max={28}
              value={form.fechaCorte}
              onChange={e => set("fechaCorte", e.target.value)} />
          </div>
          <div style={{ flex:1 }}>
            <p style={{ color:S.textSub, fontSize:11, fontWeight:700,
              margin:"0 0 5px" }}>ESTADO INICIAL</p>
            <select value={form.status} onChange={e => set("status", e.target.value)}
              style={{ ...inputStyle }}>
              <option value="prueba"> Prueba</option>
              <option value="activo"> Activo</option>
            </select>
          </div>
        </div>

        {error && (
          <p style={{ color:S.red, fontSize:12, marginBottom:10,
            background:S.redBg, padding:"8px 12px", borderRadius:6 }}>{error}</p>
        )}

        <button onClick={crear} disabled={saving} style={{
          width:"100%", padding:"12px", borderRadius:8, border:"none",
          background: saving ? S.border : S.green, color:"#fff",
          fontWeight:900, fontSize:14, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Creando…" : "✓ Crear restaurante"}
        </button>

        <p style={{ color:S.textSub, fontSize:11, marginTop:12, lineHeight:1.5 }}>
          Se crea con PIN admin <strong style={{ color:S.accent }}>0000</strong>. 
          Dile al cliente que lo cambie desde la vista de empleados.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. TENANT ROW
// ─────────────────────────────────────────────────────────────────────
function TenantRow({ tenant, onSuspend, onActivate, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const plan   = PLAN_MAP[tenant.plan] || PLAN_MAP.basico;
  const days   = daysLeft(tenant.fechaCorte);
  const isActivo = tenant.status === "activo";
  const isSusp   = tenant.status === "suspendido";
  const isPrueba = tenant.status === "prueba";

  const statusBadge = isSusp
    ? { label:"Suspendido", color:S.red,    bg:S.redBg,    bdr:S.redBdr }
    : isPrueba
    ? { label:"Prueba",     color:S.yellow, bg:S.yellowBg, bdr:S.yellowBdr }
    : { label:"Activo",     color:S.green,  bg:S.greenBg,  bdr:S.greenBdr };

  const adminUrl = `${window.location.origin}/admin?rest=${tenant.id}`;
  const menuUrl  = `${window.location.origin}/?rest=${tenant.id}`;

  const copyLink = (url) => {
    navigator.clipboard?.writeText(url).then(() => alert("Link copiado ✓"));
  };

  return (
    <>
      <tr style={{ borderTop:`1px solid ${S.border}`,
        background: expanded ? S.surface2 : "transparent",
        cursor:"pointer" }}
        onClick={() => setExpanded(e => !e)}>

        {/* Nombre */}
        <td style={{ padding:"12px 14px" }}>
          <p style={{ color:S.text, fontWeight:700, fontSize:14, margin:0 }}>
            {tenant.nombre}
          </p>
          <p style={{ color:S.accent, fontSize:11, margin:"2px 0 0",
            fontFamily:"monospace" }}>
            {tenant.id}
          </p>
        </td>

        {/* Plan */}
        <td style={{ padding:"12px 14px" }}>
          <span style={{ color:plan.color, fontWeight:800, fontSize:12 }}>
            {plan.icon} {plan.label}
          </span>
          <p style={{ color:S.textSub, fontSize:11, margin:"2px 0 0" }}>
            ${(tenant.planPrecio || plan.precio).toLocaleString()}/mes
          </p>
        </td>

        {/* Corte */}
        <td style={{ padding:"12px 14px" }}>
          <p style={{ color: days !== null && days <= 5 ? S.yellow : S.textSub,
            fontSize:12, margin:0, fontWeight: days !== null && days <= 5 ? 700 : 400 }}>
            Día {tenant.fechaCorte || "—"}
          </p>
          {days !== null && (
            <p style={{ color:S.textSub, fontSize:10, margin:"2px 0 0" }}>
              {days <= 0 ? " Venció" : `Faltan ${days}d`}
            </p>
          )}
        </td>

        {/* Estado */}
        <td style={{ padding:"12px 14px" }}>
          <span style={{
            background:statusBadge.bg, color:statusBadge.color,
            border:`1px solid ${statusBadge.bdr}`, borderRadius:12,
            padding:"3px 10px", fontSize:11, fontWeight:800 }}>
            {statusBadge.label}
          </span>
        </td>

        {/* Acciones */}
        <td style={{ padding:"12px 14px" }} onClick={e => e.stopPropagation()}>
          <div style={{ display:"flex", gap:6 }}>
            {!isActivo && (
              <button onClick={() => onActivate(tenant.id)}
                style={actionBtn(S.green, S.greenBg)}> Activar</button>
            )}
            {!isSusp && (
              <button onClick={() => {
                if(window.confirm(`¿Suspender "${tenant.nombre}"? El menú quedará bloqueado.`))
                  onSuspend(tenant.id);
              }} style={actionBtn(S.red, S.redBg)}> Suspender</button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr style={{ background:S.surface2 }}>
          <td colSpan={5} style={{ padding:"14px 20px" }}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>

              {/* Links */}
              <div style={{ background:S.surface, borderRadius:8, padding:"12px 14px",
                border:`1px solid ${S.border}`, flex:1, minWidth:220 }}>
                <p style={{ color:S.textSub, fontSize:11, fontWeight:700,
                  margin:"0 0 8px", letterSpacing:.5 }}>LINKS DE ACCESO</p>
                <LinkRow label="Menú cliente" url={menuUrl} onCopy={copyLink} />
                <LinkRow label="Panel Admin" url={adminUrl} onCopy={copyLink} />
              </div>

              {/* Datos */}
              <div style={{ background:S.surface, borderRadius:8, padding:"12px 14px",
                border:`1px solid ${S.border}`, flex:1, minWidth:220 }}>
                <p style={{ color:S.textSub, fontSize:11, fontWeight:700,
                  margin:"0 0 8px", letterSpacing:.5 }}>DATOS DEL TENANT</p>
                <InfoRow label="WhatsApp" value={tenant.whatsapp} />
                <InfoRow label="Slogan"   value={tenant.slogan}   />
                <InfoRow label="Creado"   value={
                  tenant.creadoEn?.toDate
                    ? tenant.creadoEn.toDate().toLocaleDateString("es-MX")
                    : "—"
                } />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const actionBtn = (color, bg) => ({
  padding:"5px 11px", borderRadius:6, border:`1px solid ${color}`,
  background:bg, color, fontSize:11, fontWeight:800, cursor:"pointer",
  whiteSpace:"nowrap",
});

function LinkRow({ label, url, onCopy }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
      <p style={{ color:S.textSub, fontSize:11, margin:0, minWidth:80 }}>{label}</p>
      <a href={url} target="_blank" rel="noreferrer"
        style={{ color:S.accent, fontSize:11, flex:1,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {url}
      </a>
      <button onClick={() => onCopy(url)} style={{
        background:"none", border:`1px solid ${S.border}`, borderRadius:5,
        color:S.textSub, fontSize:10, padding:"2px 7px", cursor:"pointer" }}>
        Copiar
      </button>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:4 }}>
      <p style={{ color:S.textSub, fontSize:11, margin:0, minWidth:70 }}>{label}</p>
      <p style={{ color:S.text, fontSize:11, margin:0 }}>{value || "—"}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. TENANTS TABLE
// ─────────────────────────────────────────────────────────────────────
function TenantsTable({ tenants, onSuspend, onActivate }) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = planFilter === "todos"   || t.plan   === planFilter;
    const matchStatus = statusFilter === "todos" || t.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  return (
    <div style={{ background:S.surface, borderRadius:12,
      border:`1px solid ${S.border}`, overflow:"hidden" }}>

      {/* Filtros */}
      <div style={{ padding:"14px 16px", borderBottom:`1px solid ${S.border}`,
        display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Buscar por nombre o ID…"
          style={{ flex:1, minWidth:180, padding:"7px 12px", borderRadius:7,
            border:`1px solid ${S.border}`, background:S.surface2,
            color:S.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />

        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          style={filterSelect}>
          <option value="todos">Todos los planes</option>
          {PLANES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={filterSelect}>
          <option value="todos">Todos los estados</option>
          <option value="activo"> Activos</option>
          <option value="suspendido"> Suspendidos</option>
          <option value="prueba"> En prueba</option>
        </select>
      </div>

      {/* Tabla */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:S.surface2 }}>
              {["Restaurante","Plan","Corte","Estado","Acciones"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left",
                  color:S.textSub, fontSize:11, fontWeight:800,
                  letterSpacing:.5, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding:32, textAlign:"center",
                  color:S.textSub, fontSize:13 }}>
                  No hay restaurantes que coincidan con el filtro.
                </td>
              </tr>
            )}
            {filtered.map(t => (
              <TenantRow key={t.id} tenant={t}
                onSuspend={onSuspend} onActivate={onActivate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const filterSelect = {
  padding:"7px 10px", borderRadius:7, border:`1px solid ${S.border}`,
  background:"#21262d", color:"#e6edf3", fontSize:12,
  fontFamily:"inherit", cursor:"pointer", outline:"none",
};

// ─────────────────────────────────────────────────────────────────────
// 6. ALERTS STRIP (cortes próximos)
// ─────────────────────────────────────────────────────────────────────
function AlertsStrip({ tenants }) {
  const alerts = tenants.filter(t => {
    if (t.status !== "activo") return false;
    const d = daysLeft(t.fechaCorte);
    return d !== null && d <= 5;
  });

  if (!alerts.length) return null;

  return (
    <div style={{ background:S.yellowBg, border:`1px solid ${S.yellowBdr}`,
      borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
      <p style={{ color:S.yellow, fontWeight:800, fontSize:13, margin:"0 0 6px" }}>
         Cortes próximos ({alerts.length})
      </p>
      {alerts.map(t => {
        const d = daysLeft(t.fechaCorte);
        return (
          <p key={t.id} style={{ color:S.yellow, fontSize:12, margin:"2px 0",
            opacity:.85 }}>
            • <strong>{t.nombre}</strong> — vence en {d <= 0 ? "0 días (VENCIDO)" : `${d} día${d === 1 ? "" : "s"}`}
            {" "}(${(t.planPrecio || 0).toLocaleString()}/mes)
          </p>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 7. DASHBOARD PRINCIPAL
// ─────────────────────────────────────────────────────────────────────
function SADashboard({ onLogout }) {
  const [tenants,  setTenants]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  // Listener en tiempo real a /tenants
  useEffect(() => {
    const q = query(collection(db, "tenants"), orderBy("creadoEn", "desc"));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const suspend  = (id) => updateDoc(doc(db, "tenants", id), { status:"suspendido" });
  const activate = (id) => updateDoc(doc(db, "tenants", id), { status:"activo" });

  return (
    <div style={{ minHeight:"100vh", background:S.bg,
      fontFamily:"'Segoe UI', system-ui, sans-serif", color:S.text }}>

      {/* Header */}
      <div style={{ background:S.surface, borderBottom:`1px solid ${S.border}`,
        padding:"0 24px", display:"flex", alignItems:"center",
        height:58, boxSizing:"border-box", gap:12 }}>
        <span style={{ fontSize:20 }}>⚙️</span>
        <p style={{ color:S.text, fontWeight:800, fontSize:16, margin:0 }}>
          SaaS Control Center
        </p>
        <span style={{ color:S.border }}>|</span>
        <p style={{ color:S.textSub, fontSize:12, margin:0 }}>
          {tenants.length} restaurante{tenants.length !== 1 ? "s" : ""} registrados
        </p>

        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={() => setShowNew(true)} style={{
            background:S.accentBg, border:`1px solid ${S.accent}`,
            borderRadius:8, color:S.accent, padding:"7px 16px",
            fontSize:13, fontWeight:800, cursor:"pointer" }}>
            + Nuevo restaurante
          </button>
          <button onClick={onLogout} style={{
            background:"none", border:`1px solid ${S.border}`,
            borderRadius:8, color:S.textSub, padding:"7px 12px",
            fontSize:12, cursor:"pointer" }}>
            Salir
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"20px 24px", maxWidth:1200, margin:"0 auto" }}>

        {/* Banner último creado */}
        {lastCreated && (
          <div style={{ background:S.greenBg, border:`1px solid ${S.greenBdr}`,
            borderRadius:10, padding:"12px 16px", marginBottom:16,
            display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:20 }}></span>
            <div style={{ flex:1 }}>
              <p style={{ color:S.green, fontWeight:800, fontSize:13, margin:0 }}>
                Restaurante creado exitosamente
              </p>
              <p style={{ color:S.textSub, fontSize:12, margin:"2px 0 0" }}>
                ID: <code style={{ color:S.accent }}>{lastCreated}</code>
                {" · "}
                <a href={`/?rest=${lastCreated}`} target="_blank" rel="noreferrer"
                  style={{ color:S.accent }}>Ver menú</a>
                {" · "}
                <a href={`/admin?rest=${lastCreated}`} target="_blank" rel="noreferrer"
                  style={{ color:S.accent }}>Ver admin</a>
              </p>
            </div>
            <button onClick={() => setLastCreated(null)} style={{
              background:"none", border:"none", color:S.textSub,
              fontSize:18, cursor:"pointer" }}>✕</button>
          </div>
        )}

        {loading
          ? <p style={{ color:S.textSub, textAlign:"center", padding:60 }}>
              Cargando restaurantes…
            </p>
          : <>
              <AlertsStrip tenants={tenants} />
              <MetricsStrip tenants={tenants} />
              <TenantsTable
                tenants={tenants}
                onSuspend={suspend}
                onActivate={activate}
              />
            </>
        }
      </div>

      {showNew && (
        <NewTenantModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setLastCreated(id); setShowNew(false); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 8. ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [logged, setLogged] = useState(false);
  if (!logged) return <SALogin onLogin={() => setLogged(true)} />;
  return <SADashboard onLogout={() => setLogged(false)} />;
}
