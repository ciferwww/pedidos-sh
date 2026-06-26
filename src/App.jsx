import { useState, useEffect, useRef, useCallback } from "react";
import {  addDoc, serverTimestamp, getDoc, onSnapshot, doc, collection} from "firebase/firestore";
import { useTenant, useTenantConfig, useIsClosedHours, TenantProvider } from "./TenantContext";


// 

const buildMsg = (data) => {
  return encodeURIComponent(`¡Hola! Mi pedido es el #${data.turno}. ID de rastreo: ${data.orderId}`); };

export default function AppRoot() {
  return (
    <TenantProvider>
      <App />
    </TenantProvider>
  );
}

// ────────────────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = "526442049243";

const G = {
  gold:      "#B8892A", goldLight: "#C9A84C", goldBg: "#7a4f1e",
  dark:      "#1C1208", offWhite:  "#F5F1EA", warmGray: "#E8E2D8",
  textMain:  "#1C1208", textSub:   "#5a4a2a", divider: "#D4C4A0",
  cardBg:    "#FDFAF4", green: "#25D366",
};

const PROTEINS_SUSHI  = ["Camarón","Res","Pollo","Tocino","Surimi","Tampico"];
const PROTEINS_BURGER = ["Res","Pollo","Camarón"];
const PROTEINS_PLAT   = ["Res","Pollo","Camarón"];
const SAUCES_BONELESS = ["BBQ", "Mitad y Mitad", "Búfalo", "Mixto"];
const SAUCES_ROLL     = ["BBQ", "Búfalo", "Mixto"];
const BOMBA_PRICE     = 165;
const EXTRA_SUSHI     = 20;
const EXTRA_PLAT      = 30;
const SUSHI_EXTRAS    = ["Philadelphia","Gratinado"];


const ALL_TAGS = ["Picante","Popular","Individual"];

const CAT_ICONS = {
  Botanas:"🍟", Sushi:"🍣", Platillos:"🍱", Entradas:"🥗",
  Hamburguesas:"🍔", Paquetes:"📦", Bebidas:"🧋"
};

//  Generador de turno
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

// 
const Chip = ({ label, active, onClick, danger, small }) => (
  <button id={`chip-${label}`} onClick={onClick} style={{
    padding: small ? "3px 10px" : "5px 13px", borderRadius:20, cursor:"pointer",
    border:`1.5px solid ${active?(danger?"#c0392b":G.gold):G.divider}`,
    background: active?(danger?"#c0392b":G.gold):"transparent",
    color: active?(danger?"#fff":G.dark):G.textSub,
    fontSize: small?11:12, fontWeight:700, transition:"all .15s", whiteSpace:"nowrap"
  }}>{label}</button>
);

const Divider = () => <div style={{borderTop:`1px solid ${G.divider}`,margin:"10px 0"}} />;

const Label = ({children}) => (
  <p style={{color:G.gold,fontSize:11,fontWeight:800,letterSpacing:1.5,
    textTransform:"uppercase",margin:"0 0 6px"}}>{children}</p>
);

// 
function BannerCierre({ pausado }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, zIndex:500,
      background: pausado
        ? "linear-gradient(90deg,#7b0000,#c0392b)"
        : "linear-gradient(90deg,#7a4f1e,#B8892A)",
      borderBottom:`2px solid ${pausado?"#ff6b6b":G.goldLight}`,
      padding:"10px 20px", maxWidth:640, margin:"0 auto",
      display:"flex", alignItems:"center", gap:10,
      boxShadow:"0 4px 20px rgba(0,0,0,.4)",
      animation:"slideDown .35s ease"
    }}>
      <style>{`@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}`}</style>
      <span style={{fontSize:20}}>{pausado ? "🚨" : "🕐"}</span>
      <div style={{flex:1}}>
        <p style={{color:"#fff",fontWeight:900,fontSize:13,margin:0}}>
          {pausado ? "Cocina en pausa — No se aceptan pedidos en este momento" : "Establecimiento cerrado"}
        </p>
        <p style={{color:"rgba(255,255,255,.8)",fontSize:11,margin:0}}>
          Horario de atención: 12:00 PM a 11:30 PM
        </p>
      </div>
      <button onClick={()=>setVisible(false)} style={{
        background:"none", border:"none", color:"rgba(255,255,255,.7)",
        fontSize:18, cursor:"pointer", padding:0
      }}>✕</button>
    </div>
  );
}

// ── barraa de busqueda, no creo dejarla
function SearchBar({ value, onChange }) {
  return (
    <div style={{padding:"10px 16px 6px", background:G.warmGray}}>
      <div style={{position:"relative"}}>
        <span style={{
          position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
          fontSize:14, color:G.textSub, pointerEvents:"none"
        }}>🔍</span>
        <input
          id="search-menu"
          type="text"
          value={value}
          onChange={e=>onChange(e.target.value)}
          placeholder="Buscar platillo..."
          style={{
            width:"100%", boxSizing:"border-box",
            padding:"9px 12px 9px 36px",
            border:`1.5px solid ${G.divider}`, borderRadius:10,
            fontSize:13, fontFamily:"inherit",
            background:"#fff", color:G.textMain, outline:"none",
            transition:"border-color .15s"
          }}
          onFocus={e=>{ e.target.style.borderColor=G.gold; }}
          onBlur={e=>{ e.target.style.borderColor=G.divider; }}
        />
        {value && (
          <button onClick={()=>onChange("")} style={{
            position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
            background:"none", border:"none", cursor:"pointer",
            color:G.textSub, fontSize:16, padding:0, lineHeight:1
          }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ── TagPills ─────────────────────────────────────────────────────────
function TagPills({ active, onChange }) {
  return (
    <div style={{
      display:"flex", gap:6, padding:"6px 16px 10px",
      background:G.warmGray, overflowX:"auto", scrollbarWidth:"none"
    }}>
      {ALL_TAGS.map(tag => {
        const icons = { Picante:"🌶", Popular:"⭐", Individual:"👤" };
        const isActive = active.includes(tag);
        return (
          <button
            key={tag}
            id={`tag-pill-${tag}`}
            onClick={() => onChange(isActive ? active.filter(t=>t!==tag) : [...active,tag])}
            style={{
              padding:"4px 12px", borderRadius:20, cursor:"pointer",
              border:`1.5px solid ${isActive ? G.gold : G.divider}`,
              background: isActive ? G.gold : "#fff",
              color: isActive ? G.dark : G.textSub,
              fontSize:12, fontWeight:700, whiteSpace:"nowrap",
              transition:"all .15s"
            }}
          >
            {icons[tag]} {tag}
          </button>
        );
      })}
    </div>
  );
}

// ── MenuItem ─────────────────────────────────────────────────────────
function MenuItem({ item, onAdd, disabled }) {
  const [open,    setOpen]    = useState(false);
  const [protein, setProtein] = useState(null);
  const [sauce,   setSauce]   = useState(null);
  const [bomba,   setBomba]   = useState(false);
  const [extras,  setExtras]  = useState([]);
  const [platExtras, setPlatExtras] = useState([]);
  const [note,    setNote]    = useState("");
  const [qty,     setQty]     = useState(1);
  const [alga, setAlga] = useState(true);
  const [preparacion, setPreparacion] = useState(null);

  const toggleSushiExtra = (e) =>
    setExtras(prev => prev.includes(e) ? prev.filter(x=>x!==e) : [...prev,e]);

  const togglePlatExtra = (p) =>
    setPlatExtras(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]);

  const extraCost = (item.isSushi ? extras.length * EXTRA_SUSHI : 0)
                  + (item.hasExtras ? platExtras.length * EXTRA_PLAT : 0)
                  + (bomba ? BOMBA_PRICE : 0);
  const price = item.price + extraCost;
  const total = price * qty;

  const doAdd = () => {
    if (disabled) return;
    if (item.hasProtein && !protein)       { alert("Elige una proteína."); return; }
    if (item.hasBurgerProtein && !protein) { alert("Elige la carne de tu hamburguesa."); return; }
    if (item.sauceOptions && !sauce)       { alert("Elige una salsa."); return; }
    if (item.isSushi && !preparacion)      { alert("Elige una preparación para tu sushi."); return; }
    onAdd({ ...item, protein, sauce, bomba, extras, platExtras, alga: item.isSushi ? alga : null, preparacion: item.isSushi ? preparacion : null, note, qty, totalPrice:total });
    setOpen(false); setProtein(null); setSauce(null);
    setBomba(false); setExtras([]); setPlatExtras([]); setAlga(true); setPreparacion(null); setNote(""); setQty(1);
  };

  const proteins = item.hasBurgerProtein ? PROTEINS_BURGER
                 : item.hasProtein       ? PROTEINS_SUSHI
                 : [];

  return (
    <div className="menu-item-card" style={{
      background:G.cardBg, borderRadius:10,
      border:`1px solid ${open?G.gold:G.divider}`,
      marginBottom:8, overflow:"hidden",
      boxShadow:open?`0 2px 12px ${G.gold}22`:"0 1px 3px #0001",
      transition:"border-color .2s, box-shadow .2s",
      opacity: disabled ? 0.55 : 1
    }}>
      <div style={{display:"flex",alignItems:"flex-start",padding:"13px 14px",gap:10}}>
        {item.imagen && (
          <div style={{
            width:64, height:64, borderRadius:9, overflow:"hidden", flexShrink:0,
            background:G.warmGray,
          }}>
            <img src={item.imagen} alt={item.name} className="menu-item-img" style={{
              width:"100%", height:"100%", objectFit:"cover", display:"block",
              transition:"transform .35s ease",
            }} />
          </div>
        )}
        <div style={{flex:1}}>
          <p style={{color:G.gold,fontWeight:800,fontSize:14.5,margin:"0 0 3px",
            fontFamily:"Georgia,serif"}}>{item.name}</p>
          <p style={{color:G.textSub,fontSize:12,margin:0,lineHeight:1.45}}>{item.desc}</p>
          {item.tags?.length > 0 && (
            <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
              {item.tags.map(t => {
                const colors = { Picante:"#e74c3c", Popular:"#B8892A", Individual:"#2980b9" };
                const icons  = { Picante:"🌶", Popular:"⭐", Individual:"👤" };
                return (
                  <span key={t} style={{
                    background:`${colors[t]}18`,color:colors[t],
                    borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:800,
                    border:`1px solid ${colors[t]}33`
                  }}>{icons[t]} {t}</span>
                );
              })}
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,minWidth:66}}>
          <p style={{color:G.dark,fontWeight:900,fontSize:15.5,margin:0,
            fontFamily:"Georgia,serif"}}>${item.price}</p>
          <button
            id={`add-${item.id}`}
            disabled={disabled}
            onClick={()=>!disabled && setOpen(!open)}
            style={{
              padding:"5px 13px",borderRadius:8,
              border:`1.5px solid ${G.gold}`,
              background:open?G.gold:"transparent",
              color:open?G.dark:G.gold,
              fontSize:12,fontWeight:800,
              cursor:disabled?"not-allowed":"pointer",
              opacity: disabled ? 0.5 : 1
            }}>{open?"Cerrar":"+ Pedir"}</button>
        </div>
      </div>

      {open && (
        <div style={{padding:"0 14px 14px",borderTop:`1px solid ${G.divider}`}}>

          {proteins.length>0 && (
            <div style={{marginTop:12}}>
              <Label>{item.hasBurgerProtein?"Carne":"Proteína"}</Label>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {proteins.map(p=>(
                  <Chip key={p} label={p} active={protein===p} onClick={()=>setProtein(p)} />
                ))}
              </div>
            </div>
          )}

          {item.sauceOptions && (
            <div style={{marginTop:12}}>
              <Label>Salsa</Label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {(item.sauceOptions === "roll" ? SAUCES_ROLL : SAUCES_BONELESS).map(s=>(
                  <Chip key={s} label={s} active={sauce===s} onClick={()=>setSauce(s)} />
                ))}
              </div>
            </div>
          )}

          {item.isSushi && (
            <div style={{marginTop:12}}>
              <Label>Ingredientes extra (+${EXTRA_SUSHI} c/u)</Label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {SUSHI_EXTRAS.map(e=>(
                  <Chip key={e} label={e} active={extras.includes(e)}
                    onClick={()=>toggleSushiExtra(e)} small />
                ))}
                <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
                  <Label>Alga</Label>
                  <div style={{display:"flex",gap:6}}>
                    <Chip label="🌿 Con alga" active={alga===true}  onClick={()=>setAlga(true)} />
                    <Chip label="Sin alga"   active={alga===false} onClick={()=>setAlga(false)} />
                  </div>
                </div>
              </div>
              <div style={{marginTop:8}}>
                <Chip label={`💣 Convertir en Bomba +$${BOMBA_PRICE}`}
                  active={bomba} onClick={()=>setBomba(!bomba)} danger />
                {bomba && <p style={{color:G.textSub,fontSize:11,marginTop:4}}>
                  + Philadelphia, aguacate y pepino por fuera</p>}
              </div>
            </div>
          )}

          {item.hasExtras && (
            <div style={{marginTop:12,background:"#fff8ee",borderRadius:8,padding:"10px 12px",
              border:`1px solid ${G.divider}`}}>
              <Label>Proteína extra (+${EXTRA_PLAT} c/u)</Label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {PROTEINS_PLAT.map(p=>(
                  <Chip key={p} label={p} active={platExtras.includes(p)}
                    onClick={()=>togglePlatExtra(p)} small />
                ))}
              </div>
              {platExtras.length>0 && (
                <p style={{color:G.gold,fontSize:11,margin:"6px 0 0",fontWeight:700}}>
                  +${platExtras.length*EXTRA_PLAT} por {platExtras.join(", ")}
                </p>
              )}
            </div>
          )}

          <div style={{marginTop:12}}>
            <Label>Nota especial</Label>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Sin picante, extra queso, sin cebolla…" rows={2}
              style={{width:"100%",background:"#fff",border:`1px solid ${G.divider}`,
                borderRadius:8,color:G.textMain,fontSize:13,padding:"8px 10px",
                resize:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>setQty(Math.max(1,qty-1))} style={qBtn(G)}>−</button>
              <span style={{fontWeight:800,color:G.dark,minWidth:18,textAlign:"center"}}>{qty}</span>
              <button onClick={()=>setQty(qty+1)} style={qBtn(G)}>+</button>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{color:G.textSub,fontSize:10,margin:0}}>TOTAL</p>
              <p style={{color:G.gold,fontWeight:900,fontSize:17,margin:0,
                fontFamily:"Georgia,serif"}}>${total}</p>
            </div>
            <button id={`confirm-add-${item.id}`} onClick={doAdd} disabled={disabled} style={{
              padding:"9px 18px",borderRadius:9,border:"none",
              background:G.gold,color:G.dark,fontWeight:900,fontSize:13,
              cursor:disabled?"not-allowed":"pointer",
              opacity:disabled?0.5:1
            }}>✓ Agregar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const qBtn = (G) => ({
  width:28,height:28,borderRadius:"50%",
  border:`1.5px solid ${G.divider}`,background:"#fff",
  color:G.dark,fontSize:16,cursor:"pointer",
  display:"flex",alignItems:"center",justifyContent:"center"
});

// ── CartBar ──────────────────────────────────────────────────────────
function CartBar({ count, total, onClick }) {
  if (!count) return null;
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,
      background:G.dark,borderTop:`2px solid ${G.gold}`,
      padding:"12px 20px",zIndex:200,maxWidth:640,margin:"0 auto",
      display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <p style={{color:"#aaa",fontSize:11,margin:0}}>{count} artículo{count!==1?"s":""}</p>
        <p style={{color:G.goldLight,fontWeight:900,fontSize:19,margin:0,
          fontFamily:"Georgia,serif"}}>${total}</p>
      </div>
      <button id="btn-ver-pedido" onClick={onClick} style={{
        background:G.gold,border:"none",borderRadius:11,
        color:G.dark,fontWeight:900,fontSize:14,
        padding:"10px 22px",cursor:"pointer"}}>Ver pedido →</button>
    </div>
  );
}


// ── OrderTracker ───────────────────────────────────────────────────────
function OrderTracker({ orderId, onClose }) {

  const { db, tenantId } = useTenant();
  const [pedido, setPedido] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId || !tenantId || !db) return;
    setPedido(null);
    setNotFound(false);

    const unsub = onSnapshot(
      doc(db, "tenants", tenantId, "pedidos", orderId),
      (snap) => {
        if (snap.exists()) setPedido({ id: snap.id, ...snap.data() });
        else setNotFound(true);
      },
      () => setNotFound(true)
    );
    return unsub;
  }, [orderId, tenantId, db]);

  if (notFound) {
    return (
      <div style={{padding:40,textAlign:"center"}}>
        <p style={{color:G.textSub,fontSize:15,marginBottom:18}}>
          No encontramos este pedido. Puede que el link haya caducado.
        </p>
        {onClose && (
          <button onClick={onClose} style={{padding:"12px 24px",borderRadius:12,border:"none",
            background:G.gold,color:G.dark,fontWeight:900,fontSize:15,cursor:"pointer"}}>
            Ir al Menú
          </button>
        )}
      </div>
    );
  }

  if(!pedido) return <div style={{padding:40,textAlign:"center",color:G.textSub}}>Cargando estado...</div>;

  const est = pedido.estado;
  const stages = [
    {key:"nuevo", label:"Recibido", icon:"📥"},
    {key:"en_proceso", label:"Preparando", icon:"🍳"},
    {key:"listo", label:pedido.entrega==="domicilio"?"En Camino":"Listo para recoger", icon:pedido.entrega==="domicilio"?"🛵":"🏪"},
    {key:"entregado", label:"Entregado", icon:"✅"}
  ];

  const currentIdx = stages.findIndex(s=>s.key===est);
  const isDone = est === "entregado";

  return (
    <div style={{background:G.offWhite,minHeight:"100vh",padding:20,maxWidth:640,margin:"0 auto",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:G.dark,borderRadius:16,padding:24,color:"#fff",border:`2px solid ${G.gold}`,marginBottom:24,textAlign:"center"}}>
        <p style={{color:G.goldLight,fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>ESTADO DE TU PEDIDO</p>
        <p style={{fontSize:40,fontWeight:900,margin:"0 0 4px",fontFamily:"Georgia,serif"}}>#{pedido.turno}</p>
        <p style={{color:"#aaa",fontSize:13,margin:0}}>{pedido.nombre}</p>
      </div>

      <div style={{background:G.cardBg,borderRadius:16,padding:24,border:`1px solid ${G.divider}`}}>
        {stages.map((stage, i) => {
          const isPast = currentIdx >= i;
          const isCurrent = currentIdx === i;
          return (
            <div key={stage.key} style={{display:"flex",gap:16,marginBottom:i===stages.length-1?0:24,opacity:isPast?1:0.4}}>
              <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:isCurrent?G.gold:isPast?G.dark:G.divider,color:isCurrent?G.dark:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,zIndex:2}}>
                  {stage.icon}
                </div>
                {i < stages.length-1 && <div style={{position:"absolute",top:36,bottom:-24,width:2,background:isPast?G.dark:G.divider,zIndex:1}} />}
              </div>
              <div style={{paddingTop:8}}>
                <p style={{margin:0,fontWeight:isCurrent?900:700,color:isCurrent?G.goldBg:G.dark,fontSize:16}}>{stage.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {onClose && (
        <button onClick={onClose} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:G.gold,color:G.dark,fontWeight:900,fontSize:15,marginTop:24,cursor:"pointer"}}>
          {isDone ? "✓ Hacer un nuevo pedido" : "Ver Menú (tu pedido sigue en curso)"}
        </button>
      )}
    </div>
  );
}

// 
function Field({ label, value, onChange, placeholder, type="text" }) {
  return (
    <div style={{marginBottom:12}}>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} style={{
          width:"100%",background:"#fff",border:`1px solid ${G.divider}`,
          borderRadius:8,color:G.textMain,fontSize:14,padding:"9px 12px",
          boxSizing:"border-box",fontFamily:"inherit"}} />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{display:"flex",gap:8,marginBottom:6}}>
      <span style={{color:G.textSub,fontSize:12,minWidth:70,fontWeight:700}}>{label}</span>
      <span style={{color:G.dark,fontSize:13,fontWeight:600}}>{value}</span>
    </div>
  );
}

// ── OrderModal 
function OrderModal({ items, onClose, onSend, onRemove, disabled }) {
  const { configDocRef } = useTenant();
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [delivery, setDelivery] = useState(null);
  const [address,  setAddress]  = useState("");
  const [payment,  setPayment]  = useState(null);
  const [step,     setStep]     = useState(1);
  const [sending,  setSending]  = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [deliveryCost, setDeliveryCost] = useState(30);
  const [confirmedTurno, setConfirmedTurno] = useState(null);

  useEffect(()=>{
    getDoc(configDocRef("general")).then(d=>{
      if(d.exists() && d.data().deliveryCost!=null)
        setDeliveryCost(d.data().deliveryCost);
    }).catch(()=>{});
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = items.reduce((s,i)=>s+i.totalPrice,0);
  const total    = subtotal + (delivery==="domicilio" ? deliveryCost : 0);
  const canNext2 = name.trim() && phone.trim() && delivery &&
                   (delivery==="recoger" || address.trim()) && payment;
  const STEPS    = ["Pedido","Datos","Confirmar"];

  const doSend = (mode) => onSend(
    { name, phone, delivery, address, payment, deliveryCost, total },
    setSending, mode, setConfirmedTurno
  );

  if (confirmedTurno) {
    const isPagoTarjeta = payment === "tarjeta";
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(28,18,8,.92)",
        zIndex:300,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center"}}>
        <div style={{
          background:G.offWhite, borderRadius:20,
          padding:"40px 32px", textAlign:"center",
          border:`3px solid ${isPagoTarjeta ? "#27ae60" : G.gold}`, maxWidth:320,
          animation:"popIn .4s cubic-bezier(.175,.885,.32,1.275)"
        }}>
          <style>{`@keyframes popIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}`}</style>
          <p style={{fontSize:48,margin:"0 0 8px"}}>{isPagoTarjeta ? "✅" : "💬"}</p>
          <p style={{color: isPagoTarjeta ? "#27ae60" : G.gold, fontFamily:"Georgia,serif",fontSize:22,fontWeight:900,margin:"0 0 4px"}}>
            {isPagoTarjeta ? "¡Pedido confirmado!" : "¡Pedido enviado!"}
          </p>
          <p style={{color:G.textSub,fontSize:13,margin:"0 0 20px"}}>
            {isPagoTarjeta
              ? "Tu pago fue procesado. Tu pedido ya está en cocina."
              : "El cajero lo registrará al validar tu pago. Tu turno es:"}
          </p>
          {isPagoTarjeta && (
            <div style={{background:G.dark,borderRadius:12,padding:"16px 24px",
              border:`2px solid ${G.gold}`, marginBottom:20}}>
              <p style={{color:"#aaa",fontSize:11,margin:"0 0 4px",letterSpacing:2}}>TURNO</p>
              <p style={{color:G.goldLight,fontFamily:"Georgia,serif",
                fontSize:36,fontWeight:900,margin:0,letterSpacing:4}}>
                #{confirmedTurno}
              </p>
            </div>
          )}
          {!isPagoTarjeta && (
            <div style={{background:"#fffbf0",borderRadius:12,padding:"12px 16px",
              border:`1px solid ${G.gold}`, marginBottom:20,
              display:"flex",flexDirection:"column",gap:4}}>
              <p style={{color:G.textSub,fontSize:12,margin:0}}>
                📋 Guarda tu número de referencia:
              </p>
              <p style={{color:G.gold,fontFamily:"Georgia,serif",
                fontSize:22,fontWeight:900,margin:0,letterSpacing:2}}>
                #{confirmedTurno}
              </p>
            </div>
          )}
          <button onClick={onClose} style={{
            width:"100%",padding:"13px",borderRadius:10,border:"none",
            background: isPagoTarjeta ? "#27ae60" : G.gold,
            color: isPagoTarjeta ? "#fff" : G.dark,
            fontWeight:900,fontSize:15,cursor:"pointer"
          }}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,18,8,.82)",
      zIndex:300,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:G.offWhite,borderRadius:"20px 20px 0 0",
        width:"100%",maxWidth:640,maxHeight:"90vh",
        display:"flex",flexDirection:"column",borderTop:`3px solid ${G.gold}`}}>

        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${G.divider}`,
          display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:"Georgia,serif",color:G.gold,fontSize:13,fontWeight:700}}>
            SHEKINAH</span>
          <div style={{display:"flex",gap:6,marginLeft:"auto",alignItems:"center"}}>
            {STEPS.map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:22,height:22,borderRadius:"50%",fontSize:11,fontWeight:800,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:step===i+1?G.gold:step>i+1?G.goldBg:G.divider,
                  color:step>i?"#fff":G.textSub}}>{step>i+1?"✓":i+1}</div>
                <span style={{fontSize:10,color:step===i+1?G.gold:G.textSub,fontWeight:700}}>{s}</span>
                {i<2&&<span style={{color:G.divider,fontSize:11}}>›</span>}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",
            color:G.textSub,fontSize:20,cursor:"pointer",marginLeft:8}}>✕</button>
        </div>

        <div style={{overflowY:"auto",padding:"16px 20px",flex:1}}>

          {step===1 && (
            <>
              <h3 style={{color:G.dark,fontFamily:"Georgia,serif",marginTop:0}}>Tu pedido</h3>
              {items.map((item,i)=>(
                <div key={i} style={{background:G.cardBg,borderRadius:9,
                  border:`1px solid ${G.divider}`,padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <p style={{color:G.gold,fontWeight:800,margin:0,fontSize:14,
                      fontFamily:"Georgia,serif",flex:1}}>
                      {item.qty>1&&<span style={{color:G.goldBg}}>{item.qty}× </span>}
                      {item.name}
                      {item.bomba&&<span style={{color:"#c0392b",fontSize:10,marginLeft:4}}>💣BOMBA</span>}
                    </p>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <p style={{color:G.dark,fontWeight:900,margin:0,fontFamily:"Georgia,serif"}}>${item.totalPrice}</p>
                      <button onClick={()=>onRemove(i)} style={{
                        background:"#fee",border:"1px solid #f88",borderRadius:6,
                        color:"#c0392b",fontSize:12,padding:"2px 7px",cursor:"pointer",fontWeight:700
                      }}>✕</button>
                    </div>
                  </div>
                  {item.protein&&<p style={{color:G.textSub,fontSize:12,margin:"3px 0 0"}}>Proteína: {item.protein}</p>}
                  {item.sauce&&<p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>Salsa: {item.sauce}</p>}
                  {item.extras?.length>0&&<p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>Extras: {item.extras.join(", ")}</p>}
                  {item.platExtras?.length>0&&<p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>Proteína extra: {item.platExtras.join(", ")}</p>}
                  {item.alga !== null && item.alga !== undefined &&
                   <p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>
                    Alga: {item.alga ? "Con alga 🌿" : "Sin alga"}
                   </p>}
                  {item.note&&<p style={{color:G.textSub,fontSize:12,margin:"2px 0 0",fontStyle:"italic"}}>📝 {item.note}</p>}
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",
                borderTop:`2px solid ${G.divider}`,paddingTop:10,marginTop:4}}>
                <p style={{color:G.dark,fontWeight:800,fontSize:15,margin:0}}>Subtotal</p>
                <p style={{color:G.gold,fontWeight:900,fontSize:20,margin:0,
                  fontFamily:"Georgia,serif"}}>${subtotal}</p>
              </div>
              <button id="btn-continuar-datos" onClick={()=>setStep(2)} style={nextBtn(G)}>Continuar →</button>
            </>
          )}

          {step===2 && (
            <>
              <h3 style={{color:G.dark,fontFamily:"Georgia,serif",marginTop:0}}>Tus datos</h3>
              <Field label="Nombre completo" value={name} onChange={setName} placeholder="Ej. Juan García" />
              <Field label="WhatsApp / Teléfono" value={phone} onChange={setPhone} placeholder="644 123 4567" type="tel" />
              <Divider />
              <Label>¿Cómo quieres recibir tu pedido?</Label>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[
                  {val:"recoger",icon:"🏪",label:"Recoger en restaurante"},
                  {val:"domicilio",icon:"🛵",label:"Entrega a domicilio"},
                ].map(o=>(
                  <button key={o.val} id={`delivery-${o.val}`} onClick={()=>setDelivery(o.val)} style={{
                    flex:1,padding:"12px 8px",borderRadius:10,cursor:"pointer",
                    border:`2px solid ${delivery===o.val?G.gold:G.divider}`,
                    background:delivery===o.val?`${G.gold}18`:G.cardBg,
                    textAlign:"center",transition:"all .15s"}}>
                    <p style={{fontSize:22,margin:"0 0 4px"}}>{o.icon}</p>
                    <p style={{color:delivery===o.val?G.gold:G.textSub,
                      fontWeight:700,fontSize:12,margin:0,lineHeight:1.3}}>{o.label}</p>
                    {o.val==="domicilio"&&<p style={{color:"#e67e22",fontSize:11,margin:"4px 0 0",fontWeight:700}}>
                      +${deliveryCost} envío</p>}
                  </button>
                ))}
              </div>
              {delivery==="domicilio"&&(
                <Field label="Dirección de entrega" value={address} onChange={setAddress}
                  placeholder="Calle, número, colonia…" />
              )}
              <Divider />
              <Label>Método de pago</Label>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {[
                  {val:"tarjeta",     icon:"🔒",label:"Pago online con tarjeta",   sub:"Tu pedido entra directo a cocina al pagar. Seguro y rápido."},
                  {val:"efectivo",    icon:"💵",label:"Efectivo",                  sub:"Paga al recoger / recibir. El cajero lo registra en el sistema."},
                  {val:"transferencia",icon:"📲",label:"Transferencia",            sub:"Te enviamos datos por WhatsApp. El cajero valida y registra."},
                  {val:"terminal",    icon:"💳",label:"Terminal bancaria",          sub:"Débito o crédito al recoger / en puerta. El cajero lo registra."},
                ].map(o=>(
                  <button key={o.val} id={`payment-${o.val}`} onClick={()=>setPayment(o.val)} style={{
                    display:"flex",alignItems:"center",gap:12,
                    padding:"11px 14px",borderRadius:10,cursor:"pointer",
                    border:`2px solid ${payment===o.val?G.gold:G.divider}`,
                    background:payment===o.val?`${G.gold}15`:G.cardBg,
                    textAlign:"left",transition:"all .15s"}}>
                    <span style={{fontSize:22}}>{o.icon}</span>
                    <div>
                      <p style={{color:payment===o.val?G.gold:G.dark,fontWeight:800,fontSize:13,margin:0}}>{o.label}</p>
                      <p style={{color:G.textSub,fontSize:11,margin:"2px 0 0"}}>{o.sub}</p>
                    </div>
                    <div style={{marginLeft:"auto",width:18,height:18,borderRadius:"50%",
                      border:`2px solid ${payment===o.val?G.gold:G.divider}`,
                      background:payment===o.val?G.gold:"transparent",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {payment===o.val&&<span style={{color:G.dark,fontSize:9}}>✓</span>}
                    </div>
                  </button>
                ))}
              </div>
              <button id="btn-revisar-pedido"
                onClick={()=>{if(canNext2)setStep(3);else alert("Completa todos los campos.");}}
                style={{...nextBtn(G),marginTop:20,opacity:canNext2?1:.5}}>
                Revisar pedido →
              </button>
            </>
          )}

          {step===3 && (
            <>
              <h3 style={{color:G.dark,fontFamily:"Georgia,serif",marginTop:0}}>Confirmar pedido</h3>
              <SummaryRow label="Cliente" value={name} />
              <SummaryRow label="Teléfono" value={phone} />
              <SummaryRow label="Entrega"
                value={delivery==="recoger"?"🏪 Recoger en restaurante":`🛵 Domicilio: ${address}`} />
              <SummaryRow label="Pago"
                value={payment==="efectivo"?"💵 Efectivo"
                      :payment==="transferencia"?"📲 Transferencia"
                      :payment==="terminal"?"💳 Terminal bancaria":"💳 Tarjeta"} />
              <Divider />
              <p style={{color:G.textSub,fontWeight:700,fontSize:12,margin:"0 0 6px"}}>
                ARTÍCULOS ({items.reduce((s,i)=>s+i.qty,0)})</p>
              {items.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:G.dark,fontSize:13}}>
                    {item.qty>1&&`${item.qty}× `}{item.name}
                    {item.bomba&&" 💣"}{item.protein&&` (${item.protein})`}
                  </span>
                  <span style={{color:G.gold,fontWeight:800,fontSize:13}}>${item.totalPrice}</span>
                </div>
              ))}
              {delivery==="domicilio"&&(
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:G.textSub,fontSize:13}}>🛵 Costo de envío</span>
                  <span style={{color:G.gold,fontWeight:800,fontSize:13}}>${deliveryCost}</span>
                </div>
              )}
              <Divider />
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                <p style={{color:G.dark,fontWeight:800,fontSize:16,margin:0}}>Total a pagar</p>
                <p style={{color:G.gold,fontWeight:900,fontSize:22,margin:0,
                  fontFamily:"Georgia,serif"}}>${total}</p>
              </div>

              {payment === "tarjeta" ? (
                /* ── Opción A: Pago con tarjeta → pasarela → Firestore ── */
                <div style={{background:"#f0faf4",border:"1.5px solid #27ae60",borderRadius:12,padding:"14px 16px",marginBottom:8}}>
                  <p style={{color:"#1a7a40",fontWeight:800,fontSize:13,margin:"0 0 4px"}}>
                    💳 Pago seguro en línea
                  </p>
                  <p style={{color:"#3a6a4a",fontSize:12,margin:"0 0 12px"}}>
                    Tu pedido entra directo a cocina al confirmarse el pago. No necesitas enviar nada por WhatsApp.
                  </p>
                  <button
                    id="btn-pagar-tarjeta"
                    onClick={()=>!disabled&&doSend("tarjeta")}
                    disabled={sending||disabled}
                    style={{
                      ...nextBtn(G),
                      background: sending ? "#aaa" : "linear-gradient(135deg,#27ae60,#2ecc71)",
                      marginTop:0,
                      display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                      opacity:(sending||disabled)?.7:1,
                    }}>
                    {sending
                      ? <><span style={{fontSize:16}}>⏳</span> Procesando pago…</>
                      : <><span style={{fontSize:16}}>🔒</span> Pagar ${total} con tarjeta</>}
                  </button>
                </div>
              ) : (
                /* ── Opción B: Efectivo / Transferencia / Terminal → WhatsApp ── */
                <div style={{background:"#fffbf0",border:`1.5px solid ${G.gold}`,borderRadius:12,padding:"14px 16px",marginBottom:8}}>
                  <p style={{color:G.goldBg,fontWeight:800,fontSize:13,margin:"0 0 4px"}}>
                    {payment==="efectivo"?"💵 Pago en efectivo"
                     :payment==="transferencia"?"📲 Pago por transferencia"
                     :"💳 Terminal bancaria"}
                  </p>
                  <p style={{color:G.textSub,fontSize:12,margin:"0 0 12px"}}>
                    {payment==="transferencia"
                      ? "Te enviaremos los datos de transferencia por WhatsApp. Manda tu comprobante y el cajero registra tu pedido."
                      : "El cajero validará tu pago y registrará el pedido en el sistema. Envía tu orden por WhatsApp para avisarnos."}
                  </p>
                  <button
                    id="btn-send-whatsapp"
                    onClick={()=>!disabled&&doSend("whatsapp")}
                    disabled={sending||disabled}
                    style={{
                      ...nextBtn(G),
                      background: sending ? "#aaa" : G.green,
                      marginTop:0,
                      display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                      opacity:(sending||disabled)?.7:1,
                    }}>
                    {sending
                      ? "Abriendo WhatsApp…"
                      : <><span style={{fontSize:18}}>💬</span> Enviar pedido por WhatsApp</>}
                  </button>
                  <p style={{color:G.textSub,fontSize:10,textAlign:"center",margin:"8px 0 0"}}>
                    ⚠ Tu pedido NO entra a cocina hasta que el cajero lo confirme.
                  </p>
                </div>
              )}

              <button id="btn-back-datos" onClick={()=>setStep(2)} style={{
                width:"100%",marginTop:8,padding:"10px",borderRadius:9,
                border:`1.5px solid ${G.divider}`,background:"transparent",
                color:G.textSub,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                ← Editar datos</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const nextBtn = (G) => ({
  width:"100%",marginTop:16,padding:"13px",borderRadius:10,
  border:"none",background:G.gold,color:G.dark,fontWeight:900,fontSize:15,cursor:"pointer"
});

// ── App ──────────────────────────────────────────────────────────────
function App() {
  const { tenantId, colRef, pausado, horario, unlockAudio, playAddToCart, playOrderConfirmed } = useTenant();
  const { loading: configLoading, isSuspended: tenantSuspended } = useTenantConfig();
  const isClosed = useIsClosedHours(horario);
  const isDisabled = isClosed || pausado;
  const [trackingOrderId, setTrackingOrderId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("track");
    return fromUrl || localStorage.getItem("trackingOrderId");
  });
  const [cat,       setCat]       = useState("Botanas");
  const [cart,      setCart]      = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [search,    setSearch]    = useState("");
  const [activeTags,setActiveTags]= useState([]);
  const [menu,      setMenu]      = useState({});
  const [menuLoading, setMenuLoading] = useState(true);
  const audioUnlockedRef = useRef(false);
  const categories = Object.keys(menu);
  const cartCount  = cart.reduce((s,i)=>s+i.qty,0);
  const cartTotal  = cart.reduce((s,i)=>s+i.totalPrice,0);

  useEffect(() => {
    if (trackingOrderId) localStorage.setItem("trackingOrderId", trackingOrderId);
  }, [trackingOrderId]);

  // Unlock audio on first interaction
  const handleFirstInteraction = useCallback(() => {
    if (!audioUnlockedRef.current) {
      unlockAudio();
      audioUnlockedRef.current = true;
    }
  }, [unlockAudio]);

  useEffect(() => {
    window.addEventListener("touchstart", handleFirstInteraction, { once:true });
    window.addEventListener("click",      handleFirstInteraction, { once:true });
    return () => {
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("click",      handleFirstInteraction);
    };
  }, [handleFirstInteraction]);

  // ── Menú desde Firestore (solo disponible: true) ─────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      colRef("productos"),
      (snap) => {
        const grouped = {};
        snap.docs.forEach(d => {
          const data = d.data();
          // Solo muestra productos disponibles en el menú web
          if (data.disponible === false) return;
          const cat = data.categoria || "Otros";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({ id: d.id, ...data });
        });
        // Ordenar cada categoría por campo "orden"
        Object.keys(grouped).forEach(c => {
          grouped[c].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        });
        setMenu(grouped);
        setMenuLoading(false);
      },
      () => setMenuLoading(false)
    );
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = item => {
    playAddToCart();
    setCart(prev => [...prev, item]);
  };
  const removeFromCart = idx => setCart(prev => prev.filter((_,i)=>i!==idx));

  // Cuando el menú carga, asegura que cat sea una categoría válida
  useEffect(() => {
    if (categories.length > 0 && !menu[cat]) {
      setCat(categories[0]);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter items
  const filteredItems = (menu[cat] || []).filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.desc||"").toLowerCase().includes(q);
    const matchTags = activeTags.length === 0 || activeTags.every(t => (item.tags||[]).includes(t));
    return matchSearch && matchTags;
  });

  const buildMsg = ({ name, phone, delivery, address, payment, deliveryCost, total, turno, orderId }) => {
    let msg = `🔥 *NUEVO PEDIDO — SHEKINAH*\n`;
    msg += `🎫 *Turno: #${turno}*\n`;
    msg += `👤 *Cliente:* ${name}\n`;
    msg += `📱 *Teléfono:* ${phone}\n`;
    msg += delivery==="recoger"?`🏪 *Entrega:* Pasa a recoger\n`:`🛵 *Entrega:* Domicilio — ${address}\n`;
    msg += payment==="efectivo"?"💵 *Pago:* Efectivo\n"
         : payment==="transferencia"?"📲 *Pago:* Transferencia\n":"💳 *Pago:* Terminal bancaria\n";
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    cart.forEach((item,i)=>{
      msg += `\n*${i+1}. ${item.name}*`;
      if(item.bomba) msg+=` 💣 BOMBA`;
      msg += ` × ${item.qty} — $${item.totalPrice}\n`;
      if(item.protein) msg+=`   • Proteína: ${item.protein}\n`;
      if(item.sauce)   msg+=`   • Salsa: ${item.sauce}\n`;
      if(item.extras?.length) msg+=`   • Extras: ${item.extras.join(", ")}\n`;
      if(item.platExtras?.length) msg+=`   • Proteína extra: ${item.platExtras.join(", ")}\n`;
      if(item.alga !== null && item.alga !== undefined)
        msg += `   • Alga: ${item.alga ? "Con alga" : "Sin alga"}\n`;
      if(item.note) msg+=`   • Nota: ${item.note}\n`;
    });
    if(delivery==="domicilio") msg+=`\n🛵 Envío: $${deliveryCost}\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n💰 *TOTAL: ${total} MXN*\n\n📍 Sigue tu pedido en vivo aquí:\n${window.location.origin}/?rest=${tenantId}&track=${orderId}\n\n¡Gracias! 🙏`;
    return encodeURIComponent(msg);
  };

  // ── Simula pasarela de pago online (tarjeta) ─────────────────────
  const simulatePagoOnline = () =>
    new Promise((resolve, reject) =>
      setTimeout(() => (Math.random() > 0.05 ? resolve() : reject(new Error("Pago declinado"))), 2000)
    );

  // ── Lógica estricta de pagos ─────────────────────────────────────
  // tarjeta (domicilio o local) → pasarela → Firestore → cocina
  // efectivo / transferencia / terminal → WhatsApp únicamente (NO toca Firestore)
  const handleSend = async ({ name, phone, delivery, address, payment, deliveryCost, total }, setSending, mode, setConfirmedTurno) => {
    if (isDisabled) return;
    setSending(true);
    const turno = generateTurno();

    const esPagoOnline = payment === "tarjeta";

    try {
      if (esPagoOnline) {
        // ── Opción A: Pago con tarjeta → simular pasarela → guardar en Firestore ──
        await simulatePagoOnline();

        const orderId = (await addDoc(colRef("pedidos"), {
          nombre: name, telefono: phone, entrega: delivery,
          direccion: address || "", pago: "tarjeta",
          metodoPago: "tarjeta", pagado: true,
          costoEnvio: delivery === "domicilio" ? deliveryCost : 0,
          articulos: cart.map(i => ({
            nombre: i.name, cantidad: i.qty, protein: i.protein || "",
            salsa: i.sauce || "", bomba: i.bomba || false,
            extras: i.extras || [], platExtras: i.platExtras || [],
            nota: i.note || "", subtotal: i.totalPrice,
            alga: i.alga ?? null,
            preparacion: i.preparacion || ""
          })),
          total, estado: "nuevo", origen: "web",
          creadoEn: serverTimestamp(), turno, tenantId,
        })).id;

        localStorage.setItem("trackingOrderId", orderId);
        setTrackingOrderId(orderId);
        setCart([]);
        setShowModal(false);
        playOrderConfirmed();
        setConfirmedTurno(turno);
      } else {
        // ── Opción B: Efectivo / Transferencia / Terminal → SOLO WhatsApp ──
        // NO se guarda nada en Firestore. El cajero registra el pedido manualmente.
        const msgWA = buildMsg({ name, phone, delivery, address, payment, deliveryCost, total, turno, orderId: "wha" });
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msgWA}`, "_blank");
        setCart([]);
        setShowModal(false);
        playOrderConfirmed();
        setConfirmedTurno(turno);
      }
    } catch(e) {
      console.error(e);
      if (esPagoOnline) {
        alert("❌ El pago no pudo procesarse. Verifica los datos de tu tarjeta e intenta de nuevo, o elige otro método de pago.");
      } else {
        alert("No se pudo abrir WhatsApp. Por favor intenta de nuevo.");
      }
    }

    setSending(false);
  };


  if (configLoading) return (
    <div style={{ minHeight:"100vh", background:"#1C1208",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:"#C9A84C", fontFamily:"Georgia,serif", fontSize:18 }}>
        Cargando…
      </p>
    </div>
  );

  if (tenantSuspended) return (
    <div style={{ minHeight:"100vh", background:"#1C1208",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24 }}>
      <p style={{ fontSize:48, margin:"0 0 12px" }}>🚫</p>
      <p style={{ color:"#e74c3c", fontFamily:"Georgia,serif",
        fontSize:22, fontWeight:900, textAlign:"center" }}>
        Servicio no disponible
      </p>
      <p style={{ color:"#888", fontSize:13, textAlign:"center" }}>
        Este establecimiento no está activo en este momento.
      </p>
    </div>
  );

  return (
    <div
      onClick={handleFirstInteraction}
      style={{background:G.offWhite,minHeight:"100vh",
        fontFamily:"'Segoe UI',system-ui,sans-serif",maxWidth:640,margin:"0 auto"}}>

      <style>{`
        .menu-item-card:hover .menu-item-img,
        .menu-item-card:active .menu-item-img { transform: scale(1.1); }
        .menu-item-card { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* SI HAY PEDIDO ACTIVO MUESTRA EL RASTREADOR */}
      {trackingOrderId && <OrderTracker orderId={trackingOrderId} onClose={() => { setTrackingOrderId(null); localStorage.removeItem("trackingOrderId"); }} />}
      
      {/* SI NO HAY PEDIDO, MUESTRA EL MENÚ */}
      {!trackingOrderId && <>
        {isDisabled && <BannerCierre pausado={pausado} />}

        {/* Header */}
        <div style={{
          background:G.dark,padding:"18px 20px 14px",
          borderBottom:`3px solid ${G.gold}`,
          position:"sticky",top:0,zIndex:150,
          marginTop: isDisabled ? 64 : 0,
          transition:"margin-top .3s"
        }}>
          <div style={{display:"flex",alignItems:"center"}}>
            <div>
              <p style={{color:G.gold,fontFamily:"Georgia,serif",
                fontSize:22,fontWeight:900,margin:0,letterSpacing:2}}>SHEKINAH</p>
              <p style={{color:`${G.goldLight}88`,fontSize:9,margin:0,
                letterSpacing:3,fontWeight:600}}>RESTAURANT · EL SABOR A GLORIA</p>
            </div>
            {cartCount>0&&(
              <button id="btn-header-carrito" onClick={()=>setShowModal(true)} style={{
                marginLeft:"auto",background:G.gold,border:"none",borderRadius:10,
                padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:13}}>🛒</span>
                <span style={{color:G.dark,fontWeight:900,fontSize:13}}>{cartCount} · ${cartTotal}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bomba banner */}
        <div style={{background:G.dark,padding:"8px 20px",borderBottom:"1px solid #333"}}>
          <p style={{color:"#ddd",fontSize:12,margin:0}}>
            💣 <span style={{color:G.goldLight,fontWeight:700}}>Convierte cualquier rollo en BOMBA</span>
            {" "}por solo $165 · Philadelphia, aguacate y pepino
          </p>
        </div>

        {/* Tabs */}
        {menuLoading ? (
          <div style={{textAlign:"center",padding:"48px 20px"}}>
            <p style={{fontSize:28,margin:"0 0 8px"}}>🍽️</p>
            <p style={{color:G.textSub,fontSize:13}}>Cargando menú…</p>
          </div>
        ) : categories.length === 0 ? (
          <div style={{textAlign:"center",padding:"48px 20px"}}>
            <p style={{fontSize:36,margin:"0 0 8px"}}>😴</p>
            <p style={{color:G.textSub,fontSize:14,fontWeight:700}}>Menú no disponible</p>
            <p style={{color:G.textSub,fontSize:12}}>Por favor intenta más tarde o contáctanos por WhatsApp.</p>
          </div>
        ) : (
          <>
        <div style={{display:"flex",overflowX:"auto",gap:0,
          background:G.warmGray,borderBottom:`2px solid ${G.divider}`,
          scrollbarWidth:"none",padding:"0 4px"}}>
          {categories.map(c=>(
            <button key={c} id={`tab-${c}`} onClick={()=>{setCat(c);setSearch("");setActiveTags([]);}} style={{
              padding:"11px 14px",border:"none",
              borderBottom:`3px solid ${cat===c?G.gold:"transparent"}`,
              background:"transparent",color:cat===c?G.gold:G.textSub,
              fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"
            }}>{CAT_ICONS[c]} {c}</button>
          ))}
        </div>

        {/* Search + Tag pills */}
        <SearchBar value={search} onChange={setSearch} />
        <TagPills active={activeTags} onChange={setActiveTags} />

        {/* Menu */}
        <div style={{padding:"16px",paddingBottom:cartCount?100:24}}>
          <div style={{background:G.goldBg,borderRadius:6,padding:"7px 14px",
            marginBottom:14,display:"inline-block"}}>
            <p style={{color:"#fff",fontWeight:900,fontSize:17,
              fontFamily:"Georgia,serif",margin:0}}>{CAT_ICONS[cat]} {cat}</p>
          </div>
          {cat==="Sushi"&&(
            <div style={{background:"#1C1208",borderRadius:8,padding:"9px 13px",marginBottom:14}}>
              <p style={{color:"#eee",fontSize:12,margin:0}}>
                Todos los rollos incluyen <strong style={{color:G.goldLight}}>queso Philadelphia, aguacate y pepino</strong>.
                {" "}Ingrediente extra: <strong style={{color:G.goldLight}}>+${EXTRA_SUSHI}</strong>.
              </p>
            </div>
          )}
          {filteredItems.length === 0 && (
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <p style={{fontSize:32,margin:"0 0 8px"}}>🔍</p>
              <p style={{color:G.textSub,fontSize:14}}>Sin resultados para "{search}"</p>
            </div>
          )}
          {filteredItems.map(item=>(
            <MenuItem key={item.id} item={item} onAdd={addToCart} disabled={isDisabled} />
          ))}
        </div>

        <CartBar count={cartCount} total={cartTotal} onClick={()=>setShowModal(true)} />

        {showModal&&(
          <OrderModal items={cart} onClose={()=>setShowModal(false)}
            onSend={handleSend} onRemove={removeFromCart} disabled={isDisabled} />
        )}
          </>
        )}
      </>} {/* <-- ESTE ES EL CIERRE DEL FRAGMENTO QUE FALTABA */}
    </div>
  );
}