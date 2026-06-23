import { useState, useEffect, useRef, useCallback } from "react";
import {
  onSnapshot, doc, updateDoc, orderBy, query,
  addDoc, serverTimestamp, getDoc, setDoc, where, getDocs, Timestamp,
} from "firebase/firestore";
import { db, useTenant, TenantProvider } from "./TenantContext";

// ─── Re-exportamos Admin envuelto en TenantProvider ──────────────────
export default function AdminRoot() {
  return (
    <TenantProvider>
      <Admin />
    </TenantProvider>
  );
}

// ────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "shekinah2024";

const G = {
  gold:"#B8892A", goldLight:"#C9A84C", goldBg:"#7a4f1e",
  dark:"#1C1208", offWhite:"#F5F1EA", warmGray:"#E8E2D8",
  textMain:"#1C1208", textSub:"#5a4a2a", divider:"#D4C4A0",
  cardBg:"#FDFAF4", green:"#25D366",
};

const ESTADOS = {
  nuevo:      { label:"Nuevo",      color:"#e74c3c", bg:"#fdecea", icon:"🔴" },
  en_proceso: { label:"En proceso", color:"#f39c12", bg:"#fef9e7", icon:"🟡" },
  listo:      { label:"Listo",      color:"#27ae60", bg:"#eafaf1", icon:"🟢" },
  entregado:  { label:"Entregado",  color:"#7f8c8d", bg:"#f2f3f4", icon:"⚫" },
};

const NEXT = { nuevo:"en_proceso", en_proceso:"listo", listo:"entregado", entregado:null };

const MENU_POS = {
  Botanas:[
    {id:"b1",name:"Gohan",price:150},{id:"b2",name:"Rocachicken",price:140},
    {id:"b3",name:"Boneless",price:140,sauce:"boneless"},{id:"b4",name:"Alitas",price:140,sauce:"boneless"},
    {id:"b5",name:"Tortuguita",price:95},{id:"b6",name:"Tempura veggies",price:120},
    {id:"b7",name:"Chile hot",price:105},{id:"b8",name:"Hot bite",price:95},
    {id:"b9",name:"Salchipulpos",price:85},{id:"b10",name:"Nuguets de pollo",price:85},
    {id:"b11",name:"Aros de cebolla",price:80},{id:"b12",name:"Papas sazonadas",price:85},
    {id:"b13",name:"Papas a la francesa",price:70},{id:"b14",name:"Dedos de queso",price:80},
    {id:"b15",name:"Dedos de queso sazonados",price:80},{id:"b16",name:"Bolitas Philadelphia",price:80},
    {id:"b17",name:"Tocibolitas",price:85},{id:"b18",name:"Sampler",price:320},
  ],
  Sushi:[
    // fixedIngredients:true = ingredientes fijos, NO piden proteína
    {id:"s1",name:"Vegetariano roll",price:90,fixedIngredients:true},
    {id:"s2",name:"California roll",price:105,protein:true},
    {id:"s3",name:"Nevado roll",price:120,fixedIngredients:true},
    {id:"s4",name:"Chipotle roll",price:120,fixedIngredients:true},
    {id:"s5",name:"Torito roll",price:130,fixedIngredients:true},
    {id:"s6",name:"Subarachi roll",price:125,protein:true},
    {id:"s7",name:"Coso roll",price:125,fixedIngredients:true},
    {id:"s8",name:"Almond roll",price:125,fixedIngredients:true},
    {id:"s9",name:"Bacon roll",price:130,fixedIngredients:true},
    {id:"s10",name:"Boston roll",price:130,fixedIngredients:true},
    {id:"s11",name:"Cielo mar y tierra",price:135,fixedIngredients:true},
    {id:"s12",name:"Sparrow roll",price:135,protein:true},
    {id:"s13",name:"Sonora roll",price:135,fixedIngredients:true},
    {id:"s14",name:"Supremo roll",price:135,fixedIngredients:true},
    {id:"s15",name:"Bonneles roll",price:140,fixedIngredients:true,sauce:"roll"},
    {id:"s16",name:"Tocino roll",price:140,fixedIngredients:true},
    {id:"s17",name:"Especial roll",price:140,protein:true},
    {id:"s18",name:"Philip roll",price:140,fixedIngredients:true},
    {id:"s19",name:"3 Quesos roll",price:140,fixedIngredients:true},
    {id:"s20",name:"Shekinah roll",price:145,fixedIngredients:true},
  ],
  Platillos:[
    {id:"p1",name:"Teriyaki",price:170},{id:"p2",name:"Tepanyaki",price:170},
    {id:"p3",name:"Yakimeshi",price:170},{id:"p4",name:"Kung pao",price:170},
    {id:"p5",name:"Pechuga tokiyaki",price:170},{id:"p6",name:"Pechuga en crema chipotle",price:170},
    {id:"p7",name:"Chicken roll",price:170},{id:"p8",name:"Gohan especial",price:170},
  ],
  Hamburguesas:[
    {id:"h1",name:"Sencilla",price:130,burgerProtein:true},{id:"h2",name:"Doble",price:155},
    {id:"h3",name:"Mushroom",price:140,burgerProtein:true},{id:"h4",name:"Guacamole",price:140,burgerProtein:true},
    {id:"h5",name:"Norteña",price:175,burgerProtein:true},{id:"h6",name:"Bonneless",price:140,sauce:"boneless"},
    {id:"h7",name:"Cielo Mar y Tierra",price:175},
  ],
  Bebidas:[
    {id:"bv1",name:"Té Oolong 1L",price:35},{id:"bv2",name:"Refresco",price:30},
  ],
};

const CAT_ICONS={Botanas:"🍟",Sushi:"🍣",Platillos:"🍱",Hamburguesas:"🍔",Bebidas:"🧋"};
const PROTEINS_SUSHI=["Camarón","Res","Pollo","Tocino","Surimi","Tampico"];
const PROTEINS_BURGER=["Res","Pollo","Camarón"];
const SAUCES_BONELESS = ["BBQ", "Mitad y Mitad", "Búfalo", "Mixto"];
const SAUCES_ROLL     = ["BBQ", "Búfalo", "Mixto"];

// ── Generate turn number (local, date-indexed) ───────────────────────
function generateTurno() {
  const now = new Date();
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const dd = String(now.getDate()).padStart(2,"0");
  const dateKey = `${mm}${dd}`;
  const storageKey = `turno_${dateKey}`;
  const current = parseInt(localStorage.getItem(storageKey) || "0", 10) + 1;
  localStorage.setItem(storageKey, String(current));
  return `${dateKey}-${String(current).padStart(3,"0")}`;
}

// ── PedidoTimer ──────────────────────────────────────────────────────
function PedidoTimer({ creadoEn }) {
  const [mins, setMins] = useState(0);

  useEffect(() => {
    const calc = () => {
      if (!creadoEn?.toDate) { setMins(0); return; }
      const diff = Date.now() - creadoEn.toDate().getTime();
      setMins(Math.floor(diff / 60_000));
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [creadoEn]);

  const color = mins <= 15 ? "#27ae60" : mins <= 25 ? "#f39c12" : "#e74c3c";
  const label = mins <= 15 ? "A tiempo" : mins <= 25 ? "Demora" : "⚠ Crítico";
  const isPulsing = mins > 25;

  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      background:`${color}18`, color, borderRadius:12,
      padding:"2px 8px", fontSize:10, fontWeight:800,
      border:`1px solid ${color}33`,
      animation: isPulsing ? "pulse 1.2s ease-in-out infinite" : "none",
    }}>
      ⏱ {mins}min · {label}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </span>
  );
}

// ── TurnoTag ─────────────────────────────────────────────────────────
function TurnoTag({ turno }) {
  if (!turno) return null;
  return (
    <span style={{
      background:G.dark, color:G.goldLight, borderRadius:8,
      padding:"2px 8px", fontSize:11, fontWeight:900,
      border:`1px solid ${G.gold}`, letterSpacing:1, fontFamily:"Georgia,serif"
    }}>#{turno}</span>
  );
}

// ── Login ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const { unlockAudio } = useTenant();
  const [pw,setPw]=useState(""); const [err,setErr]=useState(false);
  const tryLogin=()=>{
    if(pw===ADMIN_PASSWORD){ unlockAudio(); onLogin(); }
    else{ setErr(true); setPw(""); }
  };
  return (
    <div style={{minHeight:"100vh",background:G.dark,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:G.offWhite,borderRadius:16,padding:"40px 32px",
        width:"100%",maxWidth:360,textAlign:"center",border:`2px solid ${G.gold}`}}>
        <p style={{fontSize:32,margin:"0 0 4px"}}>🔥</p>
        <p style={{fontFamily:"Georgia,serif",color:G.gold,fontSize:22,fontWeight:900,
          margin:"0 0 4px",letterSpacing:2}}>SHEKINAH</p>
        <p style={{color:G.textSub,fontSize:12,margin:"0 0 28px",letterSpacing:2}}>PANEL DE ADMINISTRACIÓN</p>
        <input id="admin-password" type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Contraseña"
          style={{width:"100%",padding:"11px 14px",borderRadius:9,fontSize:15,
            border:`2px solid ${err?"#e74c3c":G.divider}`,boxSizing:"border-box",
            marginBottom:8,fontFamily:"inherit",background:"#fff",color:G.dark,outline:"none"}} />
        {err&&<p style={{color:"#e74c3c",fontSize:12,margin:"0 0 8px"}}>Contraseña incorrecta</p>}
        <button id="btn-login" onClick={tryLogin} style={{width:"100%",padding:"12px",borderRadius:9,
          border:"none",background:G.gold,color:G.dark,fontWeight:900,fontSize:15,cursor:"pointer"}}>
          Entrar →</button>
      </div>
    </div>
  );
}

// ── OrderCard ────────────────────────────────────────────────────────
function OrderCard({ pedido, onChangeEstado }) {
  const [open,setOpen]=useState(false);
  const est=ESTADOS[pedido.estado]||ESTADOS.nuevo;
  const fecha=pedido.creadoEn?.toDate
    ?pedido.creadoEn.toDate().toLocaleString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})
    :"—";
  const nextEstado=NEXT[pedido.estado];
  const origenLabel = pedido.origen==="pos"
    ? (pedido.mesa?"🪑 Mesa "+pedido.mesa:"🏪 Mostrador")
    : pedido.entrega==="recoger"?"🏪 Recoger":"🛵 Domicilio";

  // Semaphore border color
  let borderColor = est.color + "33";
  if (pedido.creadoEn?.toDate && pedido.estado !== "entregado") {
    const mins = Math.floor((Date.now() - pedido.creadoEn.toDate().getTime()) / 60_000);
    if      (mins <= 15) borderColor = "#27ae6055";
    else if (mins <= 25) borderColor = "#f39c1255";
    else                 borderColor = "#e74c3c88";
  }

  return (
    <div style={{background:G.cardBg,borderRadius:14,marginBottom:10,
      border:`2px solid ${borderColor}`,boxShadow:"0 2px 12px #0001",overflow:"hidden",
      transition:"border-color .5s,box-shadow .5s",
      boxShadow:pedido.estado==="nuevo"?`0 0 0 2px ${borderColor},0 4px 20px ${borderColor}44`:"0 2px 8px #0001"}}>
      <div style={{display:"flex",alignItems:"center",padding:"13px 16px",gap:10,
        borderBottom:open?`1px solid ${G.divider}`:"none",cursor:"pointer",
        background:open?"#faf6ef":"transparent"}}
        onClick={()=>setOpen(!open)}>
        <div style={{background:est.bg,border:`1.5px solid ${est.color}`,
          borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:800,color:est.color,whiteSpace:"nowrap",
          boxShadow:`0 2px 6px ${est.color}22`}}>
          {est.icon} {est.label}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <p style={{color:G.dark,fontWeight:800,fontSize:14,margin:0,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pedido.nombre}</p>
            <TurnoTag turno={pedido.turno} />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginTop:3,flexWrap:"wrap"}}>
            <p style={{color:G.textSub,fontSize:11,margin:0}}>{origenLabel}</p>
            {pedido.estado !== "entregado" && <PedidoTimer creadoEn={pedido.creadoEn} />}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{color:G.gold,fontWeight:900,fontSize:17,margin:0,fontFamily:"Georgia,serif"}}>${pedido.totalFinal ?? pedido.total}</p>
          <p style={{color:G.textSub,fontSize:10,margin:"2px 0 0"}}>{fecha}</p>
        </div>
        <span style={{color:G.textSub,fontSize:12,marginLeft:4}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{padding:"14px 16px",background:"#fdfaf4"}}>
          <div style={{display:"flex",gap:12,marginBottom:10,flexWrap:"wrap"}}>
            {pedido.telefono&&<span style={{color:G.gold,fontSize:13,fontWeight:700}}>📱 {pedido.telefono}</span>}
            {pedido.pago&&<span style={{background:G.warmGray,borderRadius:8,padding:"2px 10px",
              color:G.textSub,fontSize:12,fontWeight:600}}>
              {pedido.pago==="efectivo"?"💵":pedido.pago==="transferencia"?"📲":"💳"} {pedido.pago}</span>}
            {pedido.direccion&&<span style={{color:G.textSub,fontSize:12}}>📍 {pedido.direccion}</span>}
          </div>

          {pedido.descuentoAplicado > 0 && (
            <div style={{background:"#fff8ee",borderRadius:9,padding:"9px 12px",marginBottom:10,
              border:`1px solid ${G.divider}`,display:"flex",gap:16,flexWrap:"wrap"}}>
              <span style={{color:G.textSub,fontSize:12}}>Subtotal: <strong>${pedido.subtotal}</strong></span>
              <span style={{color:"#c0392b",fontSize:12}}>
                Descuento ({pedido.tipoDescuento}): <strong>−${pedido.descuentoAplicado.toFixed(2)}</strong>
              </span>
              <span style={{color:G.gold,fontSize:12,fontWeight:900}}>Total: ${pedido.totalFinal?.toFixed(2)}</span>
            </div>
          )}

          <div style={{borderTop:`1px solid ${G.divider}`,paddingTop:10,marginBottom:10}}>
            {pedido.articulos?.map((a,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"6px 0",borderBottom:`1px solid ${G.divider}22`}}>
                <div>
                  <span style={{color:G.dark,fontWeight:700,fontSize:13}}>
                    {a.cantidad>1&&`${a.cantidad}× `}{a.nombre}
                    {a.bomba&&<span style={{color:"#c0392b",fontSize:10,marginLeft:4}}>💣</span>}
                  </span>
                  {a.preparacion&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>({a.preparacion})</span>}
                  {a.protein&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>({a.protein})</span>}
                  {a.salsa&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>[{a.salsa}]</span>}
                  {a.alga !== null && a.alga !== undefined &&
                    <span style={{color:G.textSub,fontSize:11,marginLeft:5}}>({a.alga ? "🌿 Con alga" : "Sin alga"})</span>}
                  {a.extras?.length>0&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>+{a.extras.join(",")}</span>}
                  {a.nota&&<p style={{color:"#d4850a",fontSize:11,margin:"3px 0 0",fontStyle:"italic",
                    background:"#fff8ee",borderRadius:6,padding:"2px 8px",display:"inline-block"}}>📝 {a.nota}</p>}
                </div>
                <span style={{color:G.gold,fontWeight:800,fontSize:13,marginLeft:10}}>${a.subtotal}</span>
              </div>
            ))}
            {pedido.costoEnvio>0&&(
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
                <span style={{color:G.textSub,fontSize:13}}>🛵 Envío</span>
                <span style={{color:G.gold,fontWeight:800,fontSize:13}}>${pedido.costoEnvio}</span>
              </div>
            )}
          </div>
          {nextEstado&&(
            <button id={`btn-estado-${pedido.id}`} onClick={()=>onChangeEstado(pedido.id,nextEstado)} style={{
              width:"100%",padding:"10px",borderRadius:9,border:"none",
              background:ESTADOS[nextEstado].color,color:"#fff",
              fontWeight:800,fontSize:13,cursor:"pointer",
              boxShadow:`0 3px 12px ${ESTADOS[nextEstado].color}44`,
              transition:"filter .15s"}}>
              {ESTADOS[nextEstado].icon} Marcar como "{ESTADOS[nextEstado].label}"</button>
          )}
          {!nextEstado&&<p style={{textAlign:"center",color:"#27ae60",fontSize:12,margin:0,fontWeight:700}}>✅ Completado</p>}
        </div>
      )}
    </div>
  );
}

// ── useNewOrderAlert ─────────────────────────────────────────────────
function useNewOrderAlert(pedidos, playNewOrderBeep) {
  const intervalRef = useRef(null);

  useEffect(() => {
    const hasNew = pedidos.some(p => p.estado === "nuevo");
    if (hasNew) {
      if (!intervalRef.current) {
        // Immediately beep once, then every 15s
        playNewOrderBeep();
        intervalRef.current = setInterval(playNewOrderBeep, 15_000);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {};
  }, [pedidos, playNewOrderBeep]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}

// ── DiscountPanel ────────────────────────────────────────────────────
function DiscountPanel({ subtotal, onChange }) {
  const [tipo,    setTipo]    = useState("%");
  const [valor,   setValor]   = useState("");

  useEffect(() => {
    const v = parseFloat(valor) || 0;
    let descuento = tipo === "%" ? subtotal * (v / 100) : v;
    descuento = Math.min(descuento, subtotal);
    const totalFinal = Math.max(0, subtotal - descuento);
    onChange({ descuentoAplicado: parseFloat(descuento.toFixed(2)), tipoDescuento: tipo, totalFinal });
  }, [tipo, valor, subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = parseFloat(valor) || 0;
  const descuentoCalc = tipo === "%" ? subtotal * (v / 100) : v;
  const descuento = Math.min(descuentoCalc, subtotal);
  const totalFinal = Math.max(0, subtotal - descuento);

  return (
    <div style={{background:"#fff8ee",borderRadius:10,padding:"12px 14px",
      border:`1px solid ${G.divider}`,marginBottom:12}}>
      <p style={{color:G.textSub,fontSize:11,fontWeight:800,margin:"0 0 8px",letterSpacing:1}}>DESCUENTO</p>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        {["%","$"].map(t=>(
          <button key={t} id={`discount-type-${t}`} onClick={()=>setTipo(t)} style={{
            flex:1,padding:"6px",borderRadius:8,cursor:"pointer",fontWeight:900,fontSize:13,
            border:`1.5px solid ${tipo===t?G.gold:G.divider}`,
            background:tipo===t?G.gold:"transparent",color:tipo===t?G.dark:G.textSub}}>
            {t==="%" ? "Porcentaje %" : "Monto fijo $"}
          </button>
        ))}
      </div>
      <input
        id="discount-value"
        type="number" min="0" value={valor}
        onChange={e=>setValor(e.target.value)}
        placeholder={tipo==="%"?"Ej. 10":"Ej. 50"}
        style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,
          border:`1.5px solid ${G.gold}`,fontSize:16,fontWeight:900,
          color:G.dark,fontFamily:"Georgia,serif"}}
      />
      {descuento > 0 && (
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:3}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:G.textSub,fontSize:12}}>Subtotal</span>
            <span style={{color:G.dark,fontWeight:700,fontSize:12}}>${subtotal}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:"#c0392b",fontSize:12}}>Descuento</span>
            <span style={{color:"#c0392b",fontWeight:700,fontSize:12}}>−${descuento.toFixed(2)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",
            borderTop:`1px solid ${G.divider}`,paddingTop:5,marginTop:3}}>
            <span style={{color:G.dark,fontWeight:900,fontSize:14}}>Total Neto</span>
            <span style={{color:G.gold,fontWeight:900,fontSize:18,fontFamily:"Georgia,serif"}}>${totalFinal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── POS ──────────────────────────────────────────────────────────────
function POS({ onPedidoCreado }) {
  const { colRef, playAddToCart } = useTenant();
  const isMobile = window.innerWidth < 768;
  const [cat,setCat]=useState("Sushi");
  const [cart,setCart]=useState([]);
  const [mesa,setMesa]=useState("");
  const [payment,setPayment]=useState("efectivo");
  const [showQuick,setShowQuick]=useState(null);
  const [tempProtein,setTempProtein]=useState(null);
  const [tempSauce,setTempSauce]=useState(null);
  const [tempAlga, setTempAlga] = useState(true);
  const [tempPrep, setTempPrep] = useState(null);
  const [tempNota, setTempNota] = useState("");
  const [sending,setSending]=useState(false);
  const [discount, setDiscount] = useState({ descuentoAplicado:0, tipoDescuento:"%", totalFinal:0 });
  const [editingPrice, setEditingPrice] = useState(null); // idx of cart item being price-edited
  const [editPriceVal, setEditPriceVal] = useState("");

  const subtotal=cart.reduce((s,i)=>s+i.subtotal,0);
  const totalFinal = discount.descuentoAplicado > 0 ? discount.totalFinal : subtotal;

  const addItem=(item)=>{
    const isSushi = cat === "Sushi";
    const needsModal = item.protein || item.burgerProtein || item.sauce || isSushi;
    if(needsModal){
      setShowQuick({ ...item, isSushi });
      setTempProtein(null);
      setTempSauce(null);
      setTempAlga(true);
      setTempPrep(null);
      setTempNota("");
    } else {
      playAddToCart();
      setCart(prev=>{
        const ex=prev.findIndex(c=>c.id===item.id&&!c.protein&&!c.salsa&&c.alga===null);
        if(ex>=0){ const n=[...prev]; n[ex]={...n[ex],cantidad:n[ex].cantidad+1,subtotal:(n[ex].cantidad+1)*n[ex].precio}; return n; }
        return [...prev,{...item,id:item.id,nombre:item.name,precio:item.price,cantidad:1,subtotal:item.price,protein:"",salsa:"",alga:null,nota:""}];
      });
    }
  };

  const confirmQuick=()=>{
    const item=showQuick;
    // Solo pedir proteína si explícitamente tiene protein:true o burgerProtein (no fixedIngredients)
    if((item.protein||item.burgerProtein)&&!item.fixedIngredients&&!tempProtein){ alert("Elige proteína"); return; }
    if(item.sauce&&!tempSauce){ alert("Elige salsa"); return; }
    if(item.isSushi&&!tempPrep){ alert("Elige preparación (Natural/Empanizado/Mitad y Mitad)"); return; }
    playAddToCart();
    setCart(prev=>[...prev,{
      id:item.id+"-"+Date.now(), nombre:item.name, precio:item.price,
      cantidad:1, subtotal:item.price,
      protein:tempProtein||"", salsa:tempSauce||"",
      alga: showQuick.isSushi ? tempAlga : null,
      preparacion: showQuick.isSushi ? tempPrep : "",
      nota: tempNota||"",
    }]);
    setShowQuick(null);
  };

  const removeItem=(idx)=>setCart(prev=>prev.filter((_,i)=>i!==idx));

  const changeQty=(idx,delta)=>setCart(prev=>prev.map((it,i)=>{
    if(i!==idx)return it;
    const nc=it.cantidad+delta;
    if(nc<=0)return null;
    return {...it,cantidad:nc,subtotal:nc*it.precio};
  }).filter(Boolean));

  const startEditPrice=(idx)=>{
    setEditingPrice(idx);
    setEditPriceVal(String(cart[idx].precio));
  };
  const confirmEditPrice=(idx)=>{
    const newPrice=parseFloat(editPriceVal);
    if(!isNaN(newPrice)&&newPrice>=0){
      setCart(prev=>prev.map((it,i)=>i===idx?{...it,precio:newPrice,subtotal:newPrice*it.cantidad}:it));
    }
    setEditingPrice(null);
  };

  const cobrar=async()=>{
    if(cart.length===0){alert("Agrega artículos");return;}
    setSending(true);
    const turno = generateTurno();
    const descuentoAplicado = discount.descuentoAplicado || 0;
    const tipoDescuento = discount.tipoDescuento;
    const total = parseFloat(totalFinal.toFixed(2));
    try{
      await addDoc(colRef("pedidos"),{
        nombre: mesa?"Mesa "+mesa:"Mostrador",
        telefono:"", entrega:"recoger", direccion:"",
        pago:payment, costoEnvio:0,
        mesa:mesa||"",
        articulos:cart.map(i=>({
          nombre:i.nombre,cantidad:i.cantidad,protein:i.protein||"",
          salsa:i.salsa||"",bomba:false,extras:[],platExtras:[],nota:i.nota||"",subtotal:i.subtotal,
          alga: i.alga ?? null,
          preparacion: i.preparacion || ""
        })),
        subtotal, descuentoAplicado, tipoDescuento,
        totalFinal: total, total,
        estado:"en_proceso", origen:"pos", creadoEn:serverTimestamp(), turno,
      });
      setCart([]); setMesa(""); setDiscount({descuentoAplicado:0,tipoDescuento:"%",totalFinal:0});
      onPedidoCreado&&onPedidoCreado();
    }catch(e){console.error(e);}
    setSending(false);
  };

  return (
    <div style={{display:"flex", flexDirection: isMobile?"column":"row", gap:0, height: isMobile?"auto":"calc(100vh - 60px)", fontFamily:"'Segoe UI',sans-serif"}}>
      <style>{`
        .pos-item-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px #0002 !important; }
        .pos-item-btn:active { transform:scale(.97); }
        .cart-row:hover { background:#f7f3ec !important; }
        .pay-btn:hover { opacity:.9; }
        .cobrar-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
        .cat-tab:hover { color:${G.gold} !important; }
        .price-edit-input:focus { outline:none; border-color:${G.gold} !important; }
      `}</style>

      {/* ─── Quick options modal ─── */}
      {showQuick&&(
        <div style={{position:"fixed",inset:0,background:"rgba(10,6,2,.75)",zIndex:500,
          display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
          <div style={{background:"#1a1108",borderRadius:18,padding:28,width:340,maxWidth:"92vw",
            border:`1.5px solid ${G.gold}44`,boxShadow:`0 24px 60px #0008,0 0 0 1px ${G.gold}22`}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <p style={{color:G.gold,fontWeight:900,fontFamily:"Georgia,serif",
                  fontSize:17,margin:"0 0 3px",letterSpacing:.5}}>{showQuick.name}</p>
                <p style={{color:"#6b5a3a",fontSize:12,margin:0}}>${showQuick.price} · Personaliza tu pedido</p>
              </div>
              <button onClick={()=>setShowQuick(null)} style={{background:"#ffffff0f",border:"none",
                color:"#6b5a3a",cursor:"pointer",fontSize:18,borderRadius:8,width:30,height:30,
                display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            {/* Proteína — solo si protein:true Y no fixedIngredients */}
            {(showQuick.protein||showQuick.burgerProtein)&&!showQuick.fixedIngredients&&(
              <div style={{marginBottom:16}}>
                <p style={{color:"#9a7a3a",fontSize:10,fontWeight:800,margin:"0 0 8px",letterSpacing:1.5}}>PROTEÍNA</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {(showQuick.burgerProtein?PROTEINS_BURGER:PROTEINS_SUSHI).map(p=>(
                    <button key={p} id={`quick-protein-${p}`} onClick={()=>setTempProtein(p)} style={{
                      padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                      border:`1.5px solid ${tempProtein===p?G.gold:"#3a2e1a"}`,
                      background:tempProtein===p?G.gold:"#2a1f0d",
                      color:tempProtein===p?G.dark:"#c9b07a",transition:"all .15s"}}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Preparación (solo sushi) */}
            {showQuick.isSushi && (
              <div style={{marginBottom:16}}>
                <p style={{color:"#9a7a3a",fontSize:10,fontWeight:800,margin:"0 0 8px",letterSpacing:1.5}}>PREPARACIÓN</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["Natural","Empanizado","Mitad y Mitad"].map(p=>(
                    <button key={p} id={`quick-prep-${p.replace(/\s+/g,"-")}`} onClick={()=>setTempPrep(p)} style={{
                      padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                      border:`1.5px solid ${tempPrep===p?G.gold:"#3a2e1a"}`,
                      background:tempPrep===p?G.gold:"#2a1f0d",
                      color:tempPrep===p?G.dark:"#c9b07a",transition:"all .15s"}}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Alga (solo sushi) */}
            {showQuick.isSushi && (
              <div style={{marginBottom:16}}>
                <p style={{color:"#9a7a3a",fontSize:10,fontWeight:800,margin:"0 0 8px",letterSpacing:1.5}}>ALGA</p>
                <div style={{display:"flex",gap:6}}>
                  {["🌿 Con alga","Sin alga"].map((a,i)=>(
                    <button key={a} id={`quick-alga-${i}`} onClick={()=>setTempAlga(i===0)} style={{
                      flex:1,padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                      border:`1.5px solid ${tempAlga===(i===0)?G.gold:"#3a2e1a"}`,
                      background:tempAlga===(i===0)?G.gold:"#2a1f0d",
                      color:tempAlga===(i===0)?G.dark:"#c9b07a",transition:"all .15s"}}>{a}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Salsa */}
            {showQuick.sauce&&(
              <div style={{marginBottom:16}}>
                <p style={{color:"#9a7a3a",fontSize:10,fontWeight:800,margin:"0 0 8px",letterSpacing:1.5}}>SALSA</p>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {(showQuick.sauce === "roll" ? SAUCES_ROLL : SAUCES_BONELESS).map(s=>(
                    <button key={s} id={`quick-sauce-${s}`} onClick={()=>setTempSauce(s)} style={{
                      padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                      border:`1.5px solid ${tempSauce===s?G.gold:"#3a2e1a"}`,
                      background:tempSauce===s?G.gold:"#2a1f0d",
                      color:tempSauce===s?G.dark:"#c9b07a",transition:"all .15s"}}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Nota */}
            <div style={{marginBottom:18}}>
              <p style={{color:"#9a7a3a",fontSize:10,fontWeight:800,margin:"0 0 6px",letterSpacing:1.5}}>NOTA (opcional)</p>
              <input
                value={tempNota} onChange={e=>setTempNota(e.target.value)}
                placeholder="Ej. sin cebolla, extra picante…"
                style={{width:"100%",boxSizing:"border-box",padding:"8px 12px",borderRadius:9,
                  border:"1.5px solid #3a2e1a",background:"#2a1f0d",color:"#e8d5a0",
                  fontSize:13,fontFamily:"inherit",outline:"none"}}
              />
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowQuick(null)} style={{flex:1,padding:"10px",borderRadius:10,
                border:"1.5px solid #3a2e1a",background:"transparent",cursor:"pointer",
                color:"#7a6040",fontWeight:700,fontSize:13}}>Cancelar</button>
              <button id="btn-quick-confirm" onClick={confirmQuick} style={{flex:2,padding:"10px",borderRadius:10,
                border:"none",background:`linear-gradient(135deg,${G.gold},${G.goldLight})`,
                color:G.dark,fontWeight:900,cursor:"pointer",fontSize:14,
                boxShadow:`0 4px 16px ${G.gold}44`}}>
                Agregar al pedido ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LEFT — Menú ─── */}
      <div style={{flex:1,overflowY:"auto",background:"#16110a",display:"flex",flexDirection:"column"}}>
        {/* Categorías */}
        <div style={{display:"flex",overflowX:"auto",background:"#0e0b06",
          borderBottom:`1px solid ${G.gold}33`,scrollbarWidth:"none",padding:"0 8px",flexShrink:0}}>
          {Object.keys(MENU_POS).map(c=>(
            <button key={c} id={`pos-tab-${c}`} className="cat-tab" onClick={()=>setCat(c)} style={{
              padding:"12px 16px",border:"none",
              borderBottom:`3px solid ${cat===c?G.gold:"transparent"}`,
              background:"transparent",color:cat===c?G.gold:"#5a4a2a",
              fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",
              transition:"color .2s",letterSpacing:.5}}>
              {CAT_ICONS[c]} {c}</button>
          ))}
        </div>

        {/* Grid de productos */}
        <div style={{padding:12,display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,overflowY:"auto"}}>
          {MENU_POS[cat].map(item=>(
            <button key={item.id} id={`pos-item-${item.id}`} className="pos-item-btn" onClick={()=>addItem(item)} style={{
              background:"linear-gradient(145deg,#1f1710,#1a120a)",
              border:`1px solid ${G.gold}25`,borderRadius:12,
              padding:"14px 10px",cursor:"pointer",textAlign:"center",
              transition:"all .18s",boxShadow:"0 2px 8px #00000040"}}>
              <p style={{color:G.goldLight,fontWeight:800,fontSize:13,margin:"0 0 6px",
                fontFamily:"Georgia,serif",lineHeight:1.25}}>{item.name}</p>
              <p style={{color:G.gold,fontWeight:900,fontSize:16,margin:"0 0 4px",fontFamily:"Georgia,serif"}}>${item.price}</p>
              {item.fixedIngredients&&<span style={{fontSize:9,color:"#6b5030",letterSpacing:.5}}>INGREDIENTES FIJOS</span>}
              {item.protein&&!item.fixedIngredients&&<span style={{fontSize:9,color:"#6b5030",letterSpacing:.5}}>ELIGE PROTEÍNA</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ─── RIGHT — Carrito ─── */}
      <div style={{width: isMobile?"100%":320,maxHeight: isMobile?400:"none",
        background:"#fdfaf4",borderLeft:`1px solid ${G.divider}`,
        display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px #00000018"}}>

        {/* Mesa / Mostrador */}
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${G.divider}`,
          background:"#f5f1e8"}}>
          <p style={{color:G.textSub,fontSize:10,fontWeight:800,margin:"0 0 6px",letterSpacing:1.5}}>MESA / MOSTRADOR</p>
          <input id="pos-mesa" value={mesa} onChange={e=>setMesa(e.target.value)}
            placeholder="Nº mesa — vacío = mostrador"
            style={{width:"100%",padding:"8px 12px",borderRadius:8,
              border:`1.5px solid ${G.divider}`,fontSize:13,boxSizing:"border-box",
              fontFamily:"inherit",background:"#fff",color:G.dark,outline:"none"}} />
        </div>

        {/* Lista de items */}
        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {cart.length===0&&(
            <div style={{textAlign:"center",paddingTop:48}}>
              <p style={{fontSize:32,margin:"0 0 8px"}}>🍱</p>
              <p style={{color:"#b0a080",fontSize:13}}>Toca un producto para agregarlo</p>
            </div>
          )}
          {cart.map((item,i)=>(
            <div key={i} className="cart-row" style={{
              display:"flex",alignItems:"flex-start",gap:8,
              padding:"10px 14px",borderBottom:`1px solid ${G.divider}44`,
              transition:"background .15s"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:G.dark,fontWeight:700,fontSize:13,margin:"0 0 2px",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.nombre}</p>
                {item.preparacion&&<p style={{color:"#8a7050",fontSize:11,margin:"0 0 1px"}}>{item.preparacion}</p>}
                {item.protein&&<p style={{color:"#8a7050",fontSize:11,margin:"0 0 1px"}}>🥩 {item.protein}</p>}
                {item.salsa&&<p style={{color:"#8a7050",fontSize:11,margin:"0 0 1px"}}>🫙 {item.salsa}</p>}
                {item.alga!==null&&<p style={{color:"#8a7050",fontSize:10,margin:"0 0 1px"}}>{item.alga?"🌿 Con alga":"Sin alga"}</p>}
                {item.nota&&<p style={{color:"#c07820",fontSize:11,margin:"0 0 1px",fontStyle:"italic"}}>📝 {item.nota}</p>}
                {/* Price edit inline */}
                {editingPrice===i ? (
                  <div style={{display:"flex",gap:4,marginTop:4,alignItems:"center"}}>
                    <span style={{color:"#9a7a3a",fontSize:10}}>$</span>
                    <input
                      className="price-edit-input"
                      type="number" min="0"
                      value={editPriceVal}
                      onChange={e=>setEditPriceVal(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")confirmEditPrice(i);if(e.key==="Escape")setEditingPrice(null);}}
                      autoFocus
                      style={{width:72,padding:"3px 7px",borderRadius:6,border:`1.5px solid ${G.gold}`,
                        fontSize:13,fontWeight:900,color:G.dark,fontFamily:"Georgia,serif"}}
                    />
                    <button onClick={()=>confirmEditPrice(i)} style={{padding:"3px 8px",borderRadius:6,
                      border:"none",background:G.gold,color:G.dark,fontWeight:800,fontSize:11,cursor:"pointer"}}>✓</button>
                    <button onClick={()=>setEditingPrice(null)} style={{padding:"3px 7px",borderRadius:6,
                      border:"none",background:"#e8e0d0",color:G.textSub,fontWeight:700,fontSize:11,cursor:"pointer"}}>✕</button>
                  </div>
                ) : (
                  <button onClick={()=>startEditPrice(i)} style={{background:"none",border:"none",
                    color:"#b0956a",fontSize:10,cursor:"pointer",padding:"2px 0",marginTop:2,
                    display:"flex",alignItems:"center",gap:3}}>
                    ✏️ <span style={{textDecoration:"underline"}}>Editar precio</span>
                  </button>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button id={`pos-minus-${i}`} onClick={()=>changeQty(i,-1)} style={smallBtn}>−</button>
                  <span style={{fontWeight:800,fontSize:13,minWidth:18,textAlign:"center"}}>{item.cantidad}</span>
                  <button id={`pos-plus-${i}`} onClick={()=>changeQty(i,1)} style={smallBtn}>+</button>
                </div>
                <p style={{color:G.gold,fontWeight:900,fontSize:14,margin:0,fontFamily:"Georgia,serif"}}>
                  ${item.subtotal}</p>
                <button id={`pos-remove-${i}`} onClick={()=>removeItem(i)} style={{background:"none",border:"none",
                  color:"#cc4444",cursor:"pointer",fontSize:12,padding:0}}>✕ quitar</button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: descuento, pago, cobrar */}
        <div style={{borderTop:`2px solid ${G.divider}`,background:"#f5f1e8"}}>
          {cart.length > 0 && (
            <div style={{padding:"12px 14px 0"}}>
              <DiscountPanel subtotal={subtotal} onChange={setDiscount} />
            </div>
          )}
          <div style={{padding:"12px 14px"}}>
            <p style={{color:G.textSub,fontSize:10,fontWeight:800,margin:"0 0 7px",letterSpacing:1.5}}>MÉTODO DE PAGO</p>
            <div style={{display:"flex",gap:5,marginBottom:14}}>
              {["efectivo","transferencia","terminal"].map(p=>(
                <button key={p} id={`pos-payment-${p}`} className="pay-btn" onClick={()=>setPayment(p)} style={{
                  flex:1,padding:"7px 4px",borderRadius:8,cursor:"pointer",fontSize:10,fontWeight:800,
                  border:`1.5px solid ${payment===p?G.gold:G.divider}`,
                  background:payment===p?G.gold:"transparent",
                  color:payment===p?G.dark:G.textSub,transition:"all .15s"}}>
                  {p==="efectivo"?"💵 Efect.":p==="transferencia"?"📲 Trans.":"💳 Term."}</button>
              ))}
            </div>
            {/* Total */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 12px",borderRadius:10,background:"#1a1108",marginBottom:12}}>
              <p style={{color:"#9a7a3a",fontWeight:800,fontSize:12,margin:0,letterSpacing:.5}}>TOTAL</p>
              <p style={{color:G.gold,fontWeight:900,fontSize:22,margin:0,fontFamily:"Georgia,serif"}}>
                ${totalFinal.toFixed(2)}</p>
            </div>
            <button id="btn-cobrar" className="cobrar-btn" onClick={cobrar} disabled={sending||cart.length===0} style={{
              width:"100%",padding:"13px",borderRadius:10,border:"none",
              background:cart.length===0?"#d4cfc6":`linear-gradient(135deg,${G.gold},${G.goldLight})`,
              color:cart.length===0?"#a09080":G.dark,
              fontWeight:900,fontSize:15,cursor:cart.length===0?"not-allowed":"pointer",
              boxShadow:cart.length>0?`0 4px 20px ${G.gold}44`:"none",
              transition:"all .2s",letterSpacing:.5}}>
              {sending?"⏳ Registrando...":"✓ Cobrar y enviar a cocina"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const smallBtn={
  width:22,height:22,borderRadius:"50%",border:`1px solid ${G.divider}`,
  background:"transparent",cursor:"pointer",fontSize:13,display:"flex",
  alignItems:"center",justifyContent:"center",fontWeight:700
};

// ── Cierre del día ───────────────────────────────────────────────────
function Cierre() {
  const { colRef } = useTenant();
  const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(false);

  const buscar=async()=>{
    setLoading(true);
    const ini=new Date(fecha+"T00:00:00");
    const fin=new Date(fecha+"T23:59:59");
    const q=query(colRef("pedidos"),
      where("creadoEn",">=",Timestamp.fromDate(ini)),
      where("creadoEn","<=",Timestamp.fromDate(fin)));
    const snap=await getDocs(q);
    setPedidos(snap.docs.map(d=>({id:d.id,...d.data()})));
    setLoading(false);
  };

  const total=pedidos.reduce((s,p)=>s+(p.totalFinal ?? p.total ?? 0),0);
  const porPago={efectivo:0,transferencia:0,terminal:0};
  pedidos.forEach(p=>{ if(porPago[p.pago]!=null) porPago[p.pago]+=(p.totalFinal ?? p.total ?? 0); });

  const exportExcel=()=>{
    const rows=[
      ["CIERRE DEL DÍA — SHEKINAH"],
      ["Fecha:",fecha],
      ["Total de pedidos:",pedidos.length],
      ["Total del día:","$"+total.toFixed(2)],
      [],
      ["Efectivo:","$"+porPago.efectivo.toFixed(2)],
      ["Transferencia:","$"+porPago.transferencia.toFixed(2)],
      ["Terminal:","$"+porPago.terminal.toFixed(2)],
      [],
      ["#","Hora","Turno","Cliente","Entrega","Pago","Subtotal","Descuento","Total","Estado"],
      ...pedidos.map((p,i)=>[
        i+1,
        p.creadoEn?.toDate?p.creadoEn.toDate().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):"—",
        p.turno||"—",
        p.nombre,
        p.entrega==="recoger"?(p.mesa?"Mesa "+p.mesa:"Mostrador"):"Domicilio",
        p.pago,
        "$"+(p.subtotal||p.total||0),
        p.descuentoAplicado>0?"−$"+p.descuentoAplicado.toFixed(2):"—",
        "$"+(p.totalFinal ?? p.total),
        ESTADOS[p.estado]?.label||p.estado,
      ])
    ];
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`cierre-shekinah-${fecha}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{padding:20,maxWidth:900}}>
      <h3 style={{color:G.dark,fontFamily:"Georgia,serif",marginTop:0}}>📊 Cierre del día</h3>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-end"}}>
        <div>
          <p style={{color:G.textSub,fontSize:11,fontWeight:800,margin:"0 0 4px",letterSpacing:1}}>FECHA</p>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
            style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${G.divider}`,
              fontSize:14,fontFamily:"inherit"}} />
        </div>
        <button id="btn-buscar-cierre" onClick={buscar} style={{padding:"9px 20px",borderRadius:8,border:"none",
          background:G.gold,color:G.dark,fontWeight:800,fontSize:14,cursor:"pointer"}}>
          Buscar</button>
        {pedidos.length>0&&(
          <button id="btn-exportar-csv" onClick={exportExcel} style={{padding:"9px 20px",borderRadius:8,border:"none",
            background:"#27ae60",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>
            ⬇ Exportar CSV/Excel</button>
        )}
      </div>

      {loading&&<p style={{color:G.textSub}}>Buscando pedidos…</p>}

      {!loading&&pedidos.length>0&&(
        <>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            {[
              {label:"Total del día",value:"$"+total.toFixed(2),color:G.gold},
              {label:"Pedidos",value:pedidos.length,color:G.dark},
              {label:"💵 Efectivo",value:"$"+porPago.efectivo.toFixed(2),color:"#27ae60"},
              {label:"📲 Transferencia",value:"$"+porPago.transferencia.toFixed(2),color:"#2980b9"},
              {label:"💳 Terminal",value:"$"+porPago.terminal.toFixed(2),color:"#8e44ad"},
            ].map(s=>(
              <div key={s.label} style={{background:G.cardBg,borderRadius:10,padding:"12px 16px",
                border:`1px solid ${G.divider}`,minWidth:120}}>
                <p style={{color:G.textSub,fontSize:11,fontWeight:700,margin:"0 0 4px"}}>{s.label}</p>
                <p style={{color:s.color,fontWeight:900,fontSize:18,margin:0,fontFamily:"Georgia,serif"}}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{background:G.cardBg,borderRadius:10,border:`1px solid ${G.divider}`,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:G.warmGray}}>
                  {["Hora","Turno","Cliente","Entrega","Pago","Subtotal","Descuento","Total","Estado"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",color:G.textSub,
                      fontWeight:800,fontSize:11,letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p,i)=>{
                  const hora=p.creadoEn?.toDate
                    ?p.creadoEn.toDate().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):"—";
                  const est=ESTADOS[p.estado]||ESTADOS.nuevo;
                  return (
                    <tr key={p.id} style={{borderTop:`1px solid ${G.divider}`,
                      background:i%2===0?"#fff":G.offWhite}}>
                      <td style={{padding:"8px 12px",color:G.textSub}}>{hora}</td>
                      <td style={{padding:"8px 12px",fontWeight:900,color:G.gold,fontFamily:"Georgia,serif",fontSize:12}}>
                        {p.turno?`#${p.turno}`:"—"}</td>
                      <td style={{padding:"8px 12px",fontWeight:700,color:G.dark}}>{p.nombre}</td>
                      <td style={{padding:"8px 12px",color:G.textSub,fontSize:12}}>
                        {p.entrega==="recoger"?(p.mesa?"Mesa "+p.mesa:"Mostrador"):"Domicilio"}</td>
                      <td style={{padding:"8px 12px",color:G.textSub}}>
                        {p.pago==="efectivo"?"💵":p.pago==="transferencia"?"📲":"💳"} {p.pago}</td>
                      <td style={{padding:"8px 12px",color:G.textSub}}>${p.subtotal||p.total}</td>
                      <td style={{padding:"8px 12px",color:"#c0392b"}}>
                        {p.descuentoAplicado>0?`−$${p.descuentoAplicado.toFixed(2)}`:"—"}</td>
                      <td style={{padding:"8px 12px",fontWeight:900,color:G.gold,fontFamily:"Georgia,serif"}}>
                        ${(p.totalFinal ?? p.total).toFixed ? (p.totalFinal ?? p.total).toFixed(2) : (p.totalFinal ?? p.total)}</td>
                      <td style={{padding:"8px 12px"}}>
                        <span style={{background:est.bg,color:est.color,borderRadius:12,
                          padding:"2px 8px",fontSize:11,fontWeight:800}}>{est.icon} {est.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading&&pedidos.length===0&&(
        <div style={{textAlign:"center",padding:40}}>
          <p style={{fontSize:32}}>📭</p>
          <p style={{color:G.textSub}}>No hay pedidos para esta fecha</p>
        </div>
      )}
    </div>
  );
}

// ── Config ───────────────────────────────────────────────────────────
function Config() {
  const { configDocRef, pausado, setPausa } = useTenant();
  const [deliveryCost,setDeliveryCost]=useState(30);
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    getDoc(configDocRef("general")).then(d=>{
      if(d.exists()&&d.data().deliveryCost!=null) setDeliveryCost(d.data().deliveryCost);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const save=async()=>{
    await setDoc(configDocRef("general"),{deliveryCost:Number(deliveryCost)},{merge:true});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  if(loading) return <p style={{padding:20,color:G.textSub}}>Cargando configuración…</p>;

  return (
    <div style={{padding:20,maxWidth:480}}>
      <h3 style={{color:G.dark,fontFamily:"Georgia,serif",marginTop:0}}>⚙️ Configuración</h3>

      {/* Pausa de Emergencia */}
      <div style={{background:pausado?"#fdecea":"#eafaf1",borderRadius:12,padding:20,
        border:`2px solid ${pausado?"#e74c3c":"#27ae60"}`,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <p style={{color:pausado?"#e74c3c":"#27ae60",fontWeight:900,fontSize:15,margin:"0 0 4px"}}>
              {pausado?"🚨 Cocina PAUSADA":"✅ Cocina Activa"}
            </p>
            <p style={{color:G.textSub,fontSize:12,margin:0}}>
              {pausado?"No se aceptan pedidos nuevos del menú digital.":"El menú digital acepta pedidos normalmente."}
            </p>
          </div>
          <button
            id="btn-toggle-pausa"
            onClick={()=>setPausa(!pausado)}
            style={{
              padding:"10px 20px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:900,
              fontSize:13,transition:"all .2s",
              background:pausado?G.gold:"#e74c3c",
              color:pausado?G.dark:"#fff"
            }}
          >
            {pausado?"▶ Reanudar":"⏸ Pausar"}
          </button>
        </div>
      </div>

      {/* Delivery cost */}
      <div style={{background:G.cardBg,borderRadius:12,padding:"20px",border:`1px solid ${G.divider}`}}>
        <p style={{color:G.textSub,fontSize:11,fontWeight:800,margin:"0 0 4px",letterSpacing:1}}>
          COSTO DE ENVÍO A DOMICILIO ($)</p>
        <p style={{color:G.textSub,fontSize:12,margin:"0 0 10px"}}>
          Este valor se aplica automáticamente cuando el cliente elige entrega a domicilio.</p>
        <input id="config-delivery-cost" type="number" value={deliveryCost} onChange={e=>setDeliveryCost(e.target.value)}
          style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1.5px solid ${G.gold}`,
            fontSize:20,fontWeight:900,color:G.dark,boxSizing:"border-box",fontFamily:"Georgia,serif"}} />
        <button id="btn-save-config" onClick={save} style={{width:"100%",marginTop:12,padding:"11px",borderRadius:9,
          border:"none",background:saved?"#27ae60":G.gold,color:saved?"#fff":G.dark,
          fontWeight:900,fontSize:15,cursor:"pointer",transition:"background .3s"}}>
          {saved?"✓ Guardado":"Guardar cambios"}</button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ onLogout }) {
  const { colRef, tenantId, pausado, playNewOrderBeep } = useTenant();
  const isMobile = window.innerWidth < 768;
  const [tab,setTab]=useState("pedidos");
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filtro,setFiltro]=useState("todos");
  const stablePlayBeep = useCallback(playNewOrderBeep, []); // eslint-disable-line react-hooks/exhaustive-deps

  useNewOrderAlert(pedidos, stablePlayBeep);

  useEffect(()=>{
    const q=query(colRef("pedidos"),orderBy("creadoEn","desc"));
    return onSnapshot(q,snap=>{
      setPedidos(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  },[tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarEstado=async(id,estado)=>await updateDoc(doc(db,"tenants",tenantId,"pedidos",id),{estado});

  const filtrados=filtro==="todos"?pedidos:pedidos.filter(p=>p.estado===filtro);
  const counts={
    todos:pedidos.length,
    nuevo:pedidos.filter(p=>p.estado==="nuevo").length,
    en_proceso:pedidos.filter(p=>p.estado==="en_proceso").length,
    listo:pedidos.filter(p=>p.estado==="listo").length,
    entregado:pedidos.filter(p=>p.estado==="entregado").length,
  };
  const pendiente=pedidos.filter(p=>p.estado!=="entregado").reduce((s,p)=>s+(p.totalFinal??p.total??0),0);
  const hayNuevos = counts.nuevo > 0;

  const TABS=[
    {key:"pedidos",label:"📋 Pedidos"},
    {key:"pos",label:"🏪 Punto de Venta"},
    {key:"cierre",label:"📊 Cierre del día"},
    {key:"config",label:"⚙️ Config"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f0ece4",fontFamily:"'Segoe UI',sans-serif"}}>
      <style>{`
        @keyframes badgePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)}}
        @keyframes beepRing{0%,100%{transform:scale(1)}20%,80%{transform:scale(1.08)}}
        .dash-tab:hover{color:${G.gold} !important;background:#ffffff12 !important;}
      `}</style>

      {/* Header */}
      <div style={{background:G.dark,padding:"0 20px",borderBottom:`2px solid ${G.gold}44`,
        display:"flex",alignItems:"center",height:62,boxSizing:"border-box",flexWrap:"wrap",gap:6,
        boxShadow:"0 2px 16px #00000044"}}>
        <p style={{color:G.gold,fontFamily:"Georgia,serif",fontSize:19,fontWeight:900,margin:0,letterSpacing:2.5}}>
          🔥 SHEKINAH</p>

        {/* Tenant badge */}
        <span style={{background:"#ffffff10",color:"#6a5a3a",borderRadius:6,
          padding:"2px 8px",fontSize:10,fontWeight:700,border:"1px solid #2a2010",marginLeft:2}}>
          {tenantId}
        </span>

        {/* Pausa badge */}
        {pausado && (
          <span style={{
            background:"#c0392b",color:"#fff",borderRadius:8,
            padding:"3px 12px",fontSize:11,fontWeight:900,
            animation:"badgePulse 1.2s ease infinite",border:"1px solid #e74c3c",letterSpacing:.5
          }}>🚨 PAUSADO</span>
        )}

        {/* New order bell */}
        {hayNuevos && !pausado && (
          <span style={{
            background:"#c0392b",color:"#fff",borderRadius:8,
            padding:"3px 12px",fontSize:11,fontWeight:900,
            animation:"beepRing 1.5s ease infinite",letterSpacing:.5
          }}>🔔 {counts.nuevo} NUEVO{counts.nuevo>1?"S":""}</span>
        )}

        <div style={{display:"flex",gap:2,marginLeft:isMobile?0:20,flexWrap:"wrap",
          background:"#ffffff0a",borderRadius:10,padding:"4px",border:"1px solid #2a2010"}}>
          {TABS.map(t=>(
            <button key={t.key} id={`tab-${t.key}`} className="dash-tab" onClick={()=>setTab(t.key)} style={{
              padding:"5px 14px",borderRadius:7,border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,transition:"all .18s",
              background:tab===t.key?G.gold:"transparent",
              color:tab===t.key?G.dark:"#6a5a3a"}}>{t.label}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:14}}>
          <div style={{textAlign:"right"}}>
            <p style={{color:"#5a4a2a",fontSize:9,margin:0,letterSpacing:1}}>PENDIENTE</p>
            <p style={{color:G.gold,fontWeight:900,fontSize:16,margin:0,fontFamily:"Georgia,serif"}}>
              ${pendiente.toLocaleString()}</p>
          </div>
          <button id="btn-logout" onClick={onLogout} style={{background:"none",border:`1px solid #2a2010`,
            borderRadius:8,color:"#6a5a3a",padding:"5px 12px",fontSize:12,cursor:"pointer",
            transition:"all .15s"}}>Salir</button>
        </div>
      </div>

      {/* Content */}
      {tab==="pos"&&<POS />}
      {tab==="cierre"&&<Cierre />}
      {tab==="config"&&<Config />}
      {tab==="pedidos"&&(
        <div style={{padding:"14px 16px"}}>
          <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
            {[
              {key:"todos",label:"Todos",color:"#5a4a2a"},
              {key:"nuevo",label:"Nuevos",color:ESTADOS.nuevo.color},
              {key:"en_proceso",label:"En proceso",color:ESTADOS.en_proceso.color},
              {key:"listo",label:"Listos",color:ESTADOS.listo.color},
              {key:"entregado",label:"Entregados",color:ESTADOS.entregado.color},
            ].map(f=>(
              <button key={f.key} id={`filtro-${f.key}`} onClick={()=>setFiltro(f.key)} style={{
                padding:"7px 16px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",
                border:`2px solid ${filtro===f.key?f.color:G.divider}`,
                background:filtro===f.key?f.color:"#fff",
                color:filtro===f.key?"#fff":G.textSub,
                fontWeight:700,fontSize:12,transition:"all .18s",
                boxShadow:filtro===f.key?`0 2px 10px ${f.color}44`:"none"}}>
                {f.label}{counts[f.key]>0&&(
                  <span style={{background:"rgba(255,255,255,.25)",
                    borderRadius:10,padding:"1px 6px",fontSize:10,marginLeft:5}}>
                    {counts[f.key]}</span>
                )}
              </button>
            ))}
          </div>
          {loading&&<p style={{textAlign:"center",color:G.textSub,padding:40}}>Cargando pedidos…</p>}
          {!loading&&filtrados.length===0&&(
            <div style={{textAlign:"center",padding:40}}>
              <p style={{fontSize:36}}>🍣</p>
              <p style={{color:G.textSub}}>No hay pedidos {filtro!=="todos"?`"${ESTADOS[filtro]?.label}"`:""}</p>
            </div>
          )}
          {filtrados.map(p=>(
            <OrderCard key={p.id} pedido={p} onChangeEstado={cambiarEstado} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────
function Admin() {
  const [logged,setLogged]=useState(false);
  if(!logged) return <LoginScreen onLogin={()=>setLogged(true)} />;
  return <Dashboard onLogout={()=>setLogged(false)} />;
}