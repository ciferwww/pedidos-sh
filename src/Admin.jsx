import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc, orderBy, query } from "firebase/firestore";

// ── MISMA configuración de Firebase que en App.jsx ───────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBDvEi4Fd-fWi3UgYrtmOq_jnKvoay4tfs",
  authDomain: "shekinah-pedidos.firebaseapp.com",
  projectId: "shekinah-pedidos",
  storageBucket: "shekinah-pedidos.firebasestorage.app",
  messagingSenderId: "665781041109",
  appId: "1:665781041109:web:2d1e566882fa2f4733ef5c"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
// ────────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = "shekinah2024"; // ← cambia esto por tu contraseña

const ESTADOS = {
  nuevo:      { label:"Nuevo",      color:"#e74c3c", bg:"#fdecea", icon:"🔴" },
  en_proceso: { label:"En proceso", color:"#f39c12", bg:"#fef9e7", icon:"🟡" },
  listo:      { label:"Listo",      color:"#27ae60", bg:"#eafaf1", icon:"🟢" },
  entregado:  { label:"Entregado",  color:"#7f8c8d", bg:"#f2f3f4", icon:"⚫" },
};

const G = {
  gold:    "#B8892A",
  dark:    "#1C1208",
  offWhite:"#F5F1EA",
  divider: "#D4C4A0",
  cardBg:  "#FDFAF4",
  textSub: "#5a4a2a",
};

function LoginScreen({ onLogin }) {
  const [pw, setPw]     = useState("");
  const [err, setErr]   = useState(false);

  const tryLogin = () => {
    if (pw === ADMIN_PASSWORD) { onLogin(); }
    else { setErr(true); setPw(""); }
  };

  return (
    <div style={{
      minHeight:"100vh", background:G.dark,
      display:"flex", alignItems:"center", justifyContent:"center"
    }}>
      <div style={{
        background:G.offWhite, borderRadius:16, padding:"40px 32px",
        width:"100%", maxWidth:360, textAlign:"center",
        border:`2px solid ${G.gold}`
      }}>
        <p style={{fontSize:32, margin:"0 0 4px"}}>🔥</p>
        <p style={{fontFamily:"Georgia,serif", color:G.gold,
          fontSize:22, fontWeight:900, margin:"0 0 4px", letterSpacing:2}}>SHEKINAH</p>
        <p style={{color:G.textSub, fontSize:12, margin:"0 0 28px", letterSpacing:2}}>
          PANEL DE PEDIDOS
        </p>

        <input
          type="password" value={pw}
          onChange={e=>{ setPw(e.target.value); setErr(false); }}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}
          placeholder="Contraseña"
          style={{
            width:"100%", padding:"11px 14px", borderRadius:9, fontSize:15,
            border:`2px solid ${err?"#e74c3c":G.divider}`,
            boxSizing:"border-box", marginBottom:8, fontFamily:"inherit",
            background:"#fff", color:G.dark, outline:"none"
          }}
        />
        {err && <p style={{color:"#e74c3c", fontSize:12, margin:"0 0 8px"}}>
          Contraseña incorrecta</p>}

        <button onClick={tryLogin} style={{
          width:"100%", padding:"12px", borderRadius:9, border:"none",
          background:G.gold, color:G.dark, fontWeight:900,
          fontSize:15, cursor:"pointer", marginTop:4
        }}>Entrar →</button>
      </div>
    </div>
  );
}

function OrderCard({ pedido, onChangeEstado }) {
  const [open, setOpen] = useState(false);
  const est = ESTADOS[pedido.estado] || ESTADOS.nuevo;

  const fecha = pedido.creadoEn?.toDate
    ? pedido.creadoEn.toDate().toLocaleString("es-MX", {
        day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"
      })
    : "—";

  const nextEstado = {
    nuevo:      "en_proceso",
    en_proceso: "listo",
    listo:      "entregado",
    entregado:  null,
  }[pedido.estado];

  return (
    <div style={{
      background:G.cardBg, borderRadius:12, marginBottom:12,
      border:`2px solid ${est.color}33`,
      boxShadow:"0 2px 8px #0001", overflow:"hidden"
    }}>
      {/* Header row */}
      <div style={{
        display:"flex", alignItems:"center", padding:"12px 16px",
        gap:10, borderBottom: open ? `1px solid ${G.divider}` : "none"
      }}>
        <div style={{
          background:est.bg, border:`1.5px solid ${est.color}`,
          borderRadius:20, padding:"3px 10px",
          fontSize:11, fontWeight:800, color:est.color, whiteSpace:"nowrap"
        }}>{est.icon} {est.label}</div>

        <div style={{flex:1, minWidth:0}}>
          <p style={{color:G.dark, fontWeight:800, fontSize:14, margin:0,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
            {pedido.nombre}
          </p>
          <p style={{color:G.textSub, fontSize:11, margin:"2px 0 0"}}>
            {pedido.entrega==="recoger"?"🏪 Recoger":"🛵 Domicilio"} ·{" "}
            {pedido.pago==="efectivo"?"💵":pedido.pago==="transferencia"?"📲":"💳"}{" "}
            {pedido.pago}
          </p>
        </div>

        <div style={{textAlign:"right"}}>
          <p style={{color:G.gold, fontWeight:900, fontSize:17, margin:0,
            fontFamily:"Georgia,serif"}}>${pedido.total}</p>
          <p style={{color:G.textSub, fontSize:10, margin:"2px 0 0"}}>{fecha}</p>
        </div>

        <button onClick={()=>setOpen(!open)} style={{
          background:"none", border:`1px solid ${G.divider}`,
          borderRadius:8, padding:"5px 10px", cursor:"pointer",
          color:G.textSub, fontSize:12, fontWeight:700
        }}>{open?"▲":"▼"}</button>
      </div>

      {/* Detail */}
      {open && (
        <div style={{padding:"12px 16px"}}>
          <div style={{display:"flex", gap:16, marginBottom:10, flexWrap:"wrap"}}>
            <div>
              <p style={{color:G.textSub,fontSize:10,fontWeight:700,margin:"0 0 2px"}}>TELÉFONO</p>
              <a href={`tel:${pedido.telefono}`} style={{color:G.gold,fontWeight:700,fontSize:13}}>
                {pedido.telefono}
              </a>
            </div>
            {pedido.entrega==="domicilio" && pedido.direccion && (
              <div>
                <p style={{color:G.textSub,fontSize:10,fontWeight:700,margin:"0 0 2px"}}>DIRECCIÓN</p>
                <p style={{color:G.dark,fontSize:13,margin:0}}>{pedido.direccion}</p>
              </div>
            )}
          </div>

          <div style={{borderTop:`1px solid ${G.divider}`, paddingTop:10, marginBottom:10}}>
            <p style={{color:G.textSub,fontSize:10,fontWeight:700,margin:"0 0 6px"}}>ARTÍCULOS</p>
            {pedido.articulos?.map((a,i)=>(
              <div key={i} style={{
                display:"flex", justifyContent:"space-between",
                padding:"5px 0", borderBottom:`1px solid ${G.divider}33`
              }}>
                <div>
                  <span style={{color:G.dark,fontWeight:700,fontSize:13}}>
                    {a.cantidad>1&&`${a.cantidad}× `}{a.nombre}
                    {a.bomba&&<span style={{color:"#c0392b",fontSize:10,marginLeft:4}}>💣BOMBA</span>}
                  </span>
                  {a.proteina && <span style={{color:G.textSub,fontSize:11,marginLeft:6}}>({a.proteina})</span>}
                  {a.salsa    && <span style={{color:G.textSub,fontSize:11,marginLeft:6}}>[{a.salsa}]</span>}
                  {a.nota     && <p style={{color:"#e67e22",fontSize:11,margin:"2px 0 0",fontStyle:"italic"}}>
                    📝 {a.nota}</p>}
                </div>
                <span style={{color:G.gold,fontWeight:800,fontSize:13}}>${a.subtotal}</span>
              </div>
            ))}
          </div>

          {/* Cambiar estado */}
          {nextEstado && (
            <button onClick={()=>onChangeEstado(pedido.id, nextEstado)} style={{
              width:"100%", padding:"10px", borderRadius:9, border:"none",
              background: ESTADOS[nextEstado].color, color:"#fff",
              fontWeight:800, fontSize:13, cursor:"pointer"
            }}>
              {ESTADOS[nextEstado].icon} Marcar como "{ESTADOS[nextEstado].label}"
            </button>
          )}
          {!nextEstado && (
            <p style={{textAlign:"center",color:G.textSub,fontSize:12,margin:0}}>
              ✅ Pedido completado
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [pedidos,  setPedidos]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState("todos");

  useEffect(()=>{
    const q = query(collection(db,"pedidos"), orderBy("creadoEn","desc"));
    const unsub = onSnapshot(q, snap=>{
      setPedidos(snap.docs.map(d=>({ id:d.id, ...d.data() })));
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const cambiarEstado = async (id, nuevoEstado) => {
    await updateDoc(doc(db,"pedidos",id), { estado: nuevoEstado });
  };

  const filtrados = filtro==="todos"
    ? pedidos
    : pedidos.filter(p=>p.estado===filtro);

  const counts = {
    todos:      pedidos.length,
    nuevo:      pedidos.filter(p=>p.estado==="nuevo").length,
    en_proceso: pedidos.filter(p=>p.estado==="en_proceso").length,
    listo:      pedidos.filter(p=>p.estado==="listo").length,
    entregado:  pedidos.filter(p=>p.estado==="entregado").length,
  };

  const totalHoy = pedidos
    .filter(p=>p.estado!=="entregado")
    .reduce((s,p)=>s+(p.total||0),0);

  return (
    <div style={{minHeight:"100vh", background:"#f0ece4", fontFamily:"'Segoe UI',sans-serif"}}>

      {/* Header */}
      <div style={{background:G.dark, padding:"14px 20px", borderBottom:`3px solid ${G.gold}`,
        display:"flex", alignItems:"center"}}>
        <div>
          <p style={{color:G.gold,fontFamily:"Georgia,serif",fontSize:18,
            fontWeight:900,margin:0,letterSpacing:2}}>🔥 SHEKINAH</p>
          <p style={{color:"#aaa",fontSize:10,margin:0,letterSpacing:2}}>PANEL DE PEDIDOS</p>
        </div>
        <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:12}}>
          <div style={{textAlign:"right"}}>
            <p style={{color:"#aaa",fontSize:10,margin:0}}>PENDIENTE</p>
            <p style={{color:G.gold,fontWeight:900,fontSize:16,margin:0,
              fontFamily:"Georgia,serif"}}>${totalHoy.toLocaleString()}</p>
          </div>
          <button onClick={onLogout} style={{
            background:"none",border:`1px solid #444`,borderRadius:8,
            color:"#aaa",padding:"6px 12px",fontSize:12,cursor:"pointer"
          }}>Salir</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex", gap:8, padding:"12px 16px", overflowX:"auto"}}>
        {[
          {key:"todos",      label:"Todos",      color:"#555"},
          {key:"nuevo",      label:"Nuevos",     color:ESTADOS.nuevo.color},
          {key:"en_proceso", label:"En proceso", color:ESTADOS.en_proceso.color},
          {key:"listo",      label:"Listos",     color:ESTADOS.listo.color},
          {key:"entregado",  label:"Entregados", color:ESTADOS.entregado.color},
        ].map(f=>(
          <button key={f.key} onClick={()=>setFiltro(f.key)} style={{
            padding:"8px 14px", borderRadius:20, cursor:"pointer", whiteSpace:"nowrap",
            border:`2px solid ${filtro===f.key ? f.color : G.divider}`,
            background: filtro===f.key ? f.color : G.cardBg,
            color: filtro===f.key ? "#fff" : G.textSub,
            fontWeight:700, fontSize:12, transition:"all .15s"
          }}>
            {f.label} {counts[f.key]>0 && (
              <span style={{
                background: filtro===f.key ? "rgba(255,255,255,.3)" : f.color,
                color: filtro===f.key ? "#fff" : "#fff",
                borderRadius:10, padding:"1px 6px", fontSize:10, marginLeft:4
              }}>{counts[f.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{padding:"0 16px 24px"}}>
        {loading && (
          <p style={{textAlign:"center",color:G.textSub,padding:40}}>Cargando pedidos…</p>
        )}
        {!loading && filtrados.length===0 && (
          <div style={{textAlign:"center",padding:40}}>
            <p style={{fontSize:32}}>🍣</p>
            <p style={{color:G.textSub}}>No hay pedidos {filtro!=="todos"?`"${ESTADOS[filtro]?.label}"`:""}</p>
          </div>
        )}
        {filtrados.map(p=>(
          <OrderCard key={p.id} pedido={p} onChangeEstado={cambiarEstado} />
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const [logged, setLogged] = useState(false);
  if (!logged) return <LoginScreen onLogin={()=>setLogged(true)} />;
  return <Dashboard onLogout={()=>setLogged(false)} />;
}