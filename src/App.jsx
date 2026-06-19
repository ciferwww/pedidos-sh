import { useState } from "react";

// ── Brand tokens matching the physical menu ──────────────────────────
const G = {
  gold:      "#B8892A",
  goldLight: "#C9A84C",
  goldBg:    "#7a4f1e",
  dark:      "#1C1208",
  offWhite:  "#F5F1EA",
  warmGray:  "#E8E2D8",
  textMain:  "#1C1208",
  textSub:   "#5a4a2a",
  divider:   "#D4C4A0",
  cardBg:    "#FDFAF4",
  green:     "#25D366",
};

const PROTEINS   = ["Camarón","Res","Pollo","Tocino","Surimi","Tampico"];
const SAUCES     = ["BBQ","Búfalo","Mixto"];
const BOMBA_PRICE = 25;

const MENU = {
  Botanas: [
    { id:"b1",  name:"Gohan",              price:150, desc:"Base de arroz, mix de camarón, res, pollo, pepino, cubierto de zanahoria, con abanico de aguacate, tampico y philadelphia." },
    { id:"b2",  name:"Rocachicken",        price:140, desc:"Tiras de pollo crujientes, acompañado con arroz, Tampico, aguacate y zanahoria." },
    { id:"b3",  name:"Boneless",           price:140, desc:"300g de tiras de pollo en salsa a elegir (Bbq, Búfalo, Mixto).", sauceOptions:true },
    { id:"b4",  name:"Alitas",             price:140, desc:"500g de alitas en salsa a elegir (Bbq, Búfalo, Mixto).", sauceOptions:true },
    { id:"b5",  name:"Tortuguita",         price:95,  desc:"Milanesa de camarón cubierta de Philadelphia, Tampico y aguacate sobre zanahoria." },
    { id:"b6",  name:"Tempura veggies",    price:120, desc:"Mix de vegetales capeados con aderezo ranch." },
    { id:"b7",  name:"Chile hot",          price:105, desc:"Chile verde relleno de res, gratinado, acompañado de arroz, tampico y aguacate." },
    { id:"b8",  name:"Hot bite",           price:95,  desc:"Chile caribe con Philadelphia, queso gratinado, tampico, camarón y envuelto en tocino." },
    { id:"b9",  name:"Salchipulpos",       price:85,  desc:"Papas a la francesa con salchichas, cubiertas de queso amarillo y tocino." },
    { id:"b10", name:"Nuguets de pollo",   price:85,  desc:"Con papas fritas, aderezo ranch y catsup." },
    { id:"b11", name:"Aros de cebolla",    price:80,  desc:"10 piezas con aderezo ranch." },
    { id:"b12", name:"Papas sazonadas",    price:85,  desc:"300g con queso amarillo." },
    { id:"b13", name:"Papas a la francesa",price:70,  desc:"Con catsup." },
    { id:"b14", name:"Dedos de queso",     price:80,  desc:"6 pz de queso mozzarella empanizados sobre zanahoria." },
    { id:"b15", name:"Dedos de queso sazonados",price:80, desc:"6 pz de queso mozzarella empanizados con salsa de ponmodoro y queso parmezano." },
    { id:"b16", name:"Bolitas Philadelphia",price:80, desc:"8 pz sobre zanahoria." },
    { id:"b17", name:"Tocibolitas",        price:85,  desc:"8 pz sobre zanahoria." },
    { id:"b18", name:"Sampler",            price:320, desc:"Sushi a elegir del menu, ½ orden de: boneless, papas sazonadas, dedos queso, aros cebolla, tampico, ranch y queso amarillo." },
  ],
  Sushi: [
    { id:"s1",  name:"Vegetariano roll",   price:90,  desc:"D: Zanahoria, pepino y aguacate.", hasProtein:false, isSushi:true },
    { id:"s2",  name:"California roll",    price:105, desc:"Ingrediente a elegir (camarón, res, pollo, tocino, surimi o tampico).", hasProtein:true, isSushi:true },
    { id:"s3",  name:"Nevado roll",        price:120, desc:"D: Camarón · F: Queso Philadelphia.", hasProtein:true, isSushi:true },
    { id:"s4",  name:"Chipotle roll",      price:120, desc:"D: Camarón empanizado · F: Gratinado con salsa chipotle.", hasProtein:true, isSushi:true },
    { id:"s5",  name:"Torito roll",        price:130, desc:"D: Camarón, tocino, chile caribe y salsa chipotle especial · F: Gratinado.", hasProtein:true, isSushi:true },
    { id:"s6",  name:"Subarachi roll",     price:125, desc:"D: Camarón · F: Cubierto de Philadelphia y tampico.", hasProtein:true, isSushi:true },
    { id:"s7",  name:"Coso roll",          price:125, desc:"D: Camarón, chile caribe · F: Zanahoria capeada y aderezo serrano.", hasProtein:true, isSushi:true },
    { id:"s8",  name:"Almond roll",        price:125, desc:"D: Camarón capeado · F: Philadelphia, almendras y aderezo de piña picosa.", hasProtein:true, isSushi:true },
    { id:"s9",  name:"Bacon roll",         price:130, desc:"D: Camarón, tocino · F: Tampico especial.", hasProtein:true, isSushi:true },
    { id:"s10", name:"Boston roll",        price:130, desc:"D: Camarón empanizado · F: Philadelphia y tocino.", hasProtein:true, isSushi:true },
    { id:"s11", name:"Cielo mar y tierra", price:135, desc:"D: Camarón, Res y pollo.", hasProtein:false, isSushi:true },
    { id:"s12", name:"Sparrow roll",       price:135, desc:"D: Res, tocino · F: Philadelphia y chile verde.", hasProtein:true, isSushi:true },
    { id:"s13", name:"Sonora roll",        price:135, desc:"D: Res, tocino, cebolla asada, chile carive y verde · F: Philadelphia y aguacate.", hasProtein:true, isSushi:true },
    { id:"s14", name:"Supremo roll",       price:135, desc:"D: Arroz amasado con Philadelphia, res, tocino, chile caribe · F: Queso gratinado.", hasProtein:true, isSushi:true },
    { id:"s15", name:"Bonneles roll",      price:140, desc:"D: Pollo · F: Boneless, salsa a elegir (Bbq, Búfalo o mixto).", hasProtein:true, sauceOptions:true, isSushi:true },
    { id:"s16", name:"Tocino roll",        price:140, desc:"D: Camarón, res, tocino, chile caribe · F: Philadelphia con tocino.", hasProtein:true, isSushi:true },
    { id:"s17", name:"Especial roll",      price:140, desc:"D: Camarón y surimi empanizado · F: Topping especial y aderezo cilantro.", hasProtein:true, isSushi:true },
    { id:"s18", name:"Philip roll",        price:140, desc:"D: Res, pollo, tocino · F: Queso gratinado con tocino.", hasProtein:true, isSushi:true },
    { id:"s19", name:"3 Quesos roll",      price:140, desc:"D: Camarón, res, pollo empanizado · F: Philadelphia, queso americano y gratinado.", hasProtein:true, isSushi:true },
    { id:"s20", name:"Shekinah roll",      price:145, desc:"D: Arroz amasado con Philadelphia, cebollín, chile serrano, camarón, res y pollo · F: Philadelphia, gratinado y tocino.", hasProtein:true, isSushi:true },
  ],
  Platillos: [
    { id:"p1", name:"Teriyaki",              price:170, desc:"Camarón, res y pollo salteados con trozos de piña en nuestra salsa de la casa, servidos sobre una cama de arroz blanco y vegetales salteados." },
    { id:"p2", name:"Tepanyaki",             price:170, desc:"Camarón, res y pollo salteados en nuestra salsa de la casa, servidos sobre una cama de arroz blanco con vegetales salteados." },
    { id:"p3", name:"Yakimeshi",             price:170, desc:"Deliciosa mezcla de arroz frito con camarón, res y pollo, acompañada de topping de tampico, abanico de aguacate y bolitas de queso Philadelphia." },
    { id:"p4", name:"Kung pao",              price:170, desc:"Tiras de pollo bañadas en salsa agridulce picosa, acompañadas de vegetales salteados, cacahuates, chile de árbol y elotes baby." },
    { id:"p5", name:"Pechuga tokiyaki",      price:170, desc:"Pechuga de pollo en tiras (a la plancha o empanizada), bañada en aderezo cilantro, servida sobre vegetales salteados y una cama de arroz frito." },
    { id:"p6", name:"Pechuga en crema chipotle", price:170, desc:"Tiras de pollo en crema chipotle, acompañadas de vegetales salteados, servidas sobre una cama de arroz frito." },
    { id:"p7", name:"Chicken roll",          price:170, desc:"Pechuga de pollo rellena de camarón, tocino, pimientos y queso Philadelphia, calabaza, zanahoria, servido sobre arroz frito y ensalada de la casa." },
    { id:"p8", name:"Gohan especial",        price:170, desc:"Base de arroz empanizado y gratinado, con vegetales salteados, camarón, res y pollo, coronado con abanico de aguacate, tampico y queso Philadelphia, con aderezo serrano." },
  ],
  Entradas: [
    { id:"e1", name:"Ensalada César",    price:135, desc:"Base de lechuga fresca con crotones, queso parmesano, orégano, pimienta y sal, acompañada de aderezo César de la casa, láminas de parmesano y un toque cítrico." },
    { id:"e2", name:"Ensalada bonneles", price:150, desc:"Tiras de pollo bañadas en salsa BBQ, Búfalo o Mixta, acompañadas de lechuga fresca, pepino, zanahoria, tomate cherry, cebolla morada, rábano y vinagreta de la casa." },
    { id:"e3", name:"Ensalada light",    price:160, desc:"Pechuga de pollo a la plancha acompañada de lechuga, arúgula, espinaca, pepino, zanahoria, aceitunas verdes y negras, alcaparras, rábano y cebolla morada." },
  ],
  Hamburguesas: [
    { id:"h1", name:"Sensilla",          price:130, desc:"Carne a elección con queso americano. Incluye aderezo especial, tomate, lechuga, cebolla y papas.", hasProtein:true },
    { id:"h2", name:"Doble",             price:155, desc:"2 pz de Res, queso americano, queso gratinado con tocino. Incluye aderezo especial, tomate, lechuga, cebolla y papas." },
    { id:"h3", name:"Mushroom",          price:140, desc:"Carne a elección con queso americano, tocino, queso gratinado y champiñones salteados.", hasProtein:true },
    { id:"h4", name:"Guacamole",         price:140, desc:"Carne a elección, tocino con queso americano y guacamole.", hasProtein:true },
    { id:"h5", name:"Norteña",           price:175, desc:"Carne a elección con queso americano, piña y cebolla salteadas, chile verde tatemado, queso gratinado con tocino y salchicha.", hasProtein:true },
    { id:"h6", name:"Bonneless",         price:140, desc:"Tiras de pollo bañadas en salsa de tu elección (BBQ, Búfalo o Mixta).", sauceOptions:true },
    { id:"h7", name:"Cielo, Mar y Tierra",price:175, desc:"Carne de Res, Camarón y Pollo. Con queso americano." },
  ],
  Paquetes: [
    { id:"pk1", name:"Paquete 1", price:225, desc:"1 rollo California + orden de boneless + 1 litro de té." },
    { id:"pk2", name:"Paquete 2", price:275, desc:"3 rollos California + 1 litro de té." },
    { id:"pk3", name:"Paquete 3", price:305, desc:"2 rollos California + orden de boneless + 1 litro de té." },
  ],
  Bebidas: [
    { id:"bv1", name:"Té Oolong 1 Litro",  price:35,  desc:"1 litro de té Oolong." },
    { id:"bv2", name:"Té Oolong ½ Litro",  price:25,  desc:"½ litro de té Oolong." },
    { id:"bv3", name:"Refresco",            price:30,  desc:"Familia Pepsi 600 ml." },
  ],
};

const CAT_ICONS = {
  Botanas:"🍟", Sushi:"🍣", Platillos:"🍱", Entradas:"🥗",
  Hamburguesas:"🍔", Paquetes:"📦", Bebidas:"🧋"
};

// ── Tiny shared UI pieces ────────────────────────────────────────────
const Chip = ({ label, active, onClick, danger }) => (
  <button onClick={onClick} style={{
    padding:"5px 13px", borderRadius:20, cursor:"pointer",
    border:`1.5px solid ${active ? (danger?"#c0392b":G.gold) : G.divider}`,
    background: active ? (danger?"#c0392b":G.gold) : "transparent",
    color: active ? (danger?"#fff":G.dark) : G.textSub,
    fontSize:12, fontWeight:700, transition:"all .15s", whiteSpace:"nowrap"
  }}>{label}</button>
);

const Divider = () => (
  <div style={{borderTop:`1px solid ${G.divider}`, margin:"10px 0"}} />
);

const Label = ({ children }) => (
  <p style={{color:G.gold, fontSize:11, fontWeight:800, letterSpacing:1.5,
    textTransform:"uppercase", margin:"0 0 6px"}}>{children}</p>
);

// ── MenuItem ────────────────────────────────────────────────────────
function MenuItem({ item, onAdd }) {
  const [open, setOpen]       = useState(false);
  const [protein, setProtein] = useState(null);
  const [sauce, setSauce]     = useState(null);
  const [bomba, setBomba]     = useState(false);
  const [note, setNote]       = useState("");
  const [qty, setQty]         = useState(1);

  const price = item.price + (bomba ? BOMBA_PRICE : 0);
  const total = price * qty;

  const doAdd = () => {
    if (item.hasProtein && !protein) { alert("Elige una proteína para continuar."); return; }
    if (item.sauceOptions && !sauce) { alert("Elige una salsa para continuar."); return; }
    onAdd({ ...item, protein, sauce, bomba, note, qty, totalPrice: total });
    setOpen(false); setProtein(null); setSauce(null);
    setBomba(false); setNote(""); setQty(1);
  };

  return (
    <div style={{
      background: G.cardBg, borderRadius:10,
      border:`1px solid ${open ? G.gold : G.divider}`,
      marginBottom:8, overflow:"hidden",
      boxShadow: open ? `0 2px 12px ${G.gold}22` : "0 1px 3px #0001",
      transition:"border-color .2s, box-shadow .2s"
    }}>
      {/* Row */}
      <div style={{display:"flex", alignItems:"flex-start", padding:"13px 14px", gap:10}}>
        <div style={{flex:1}}>
          <p style={{color:G.gold, fontWeight:800, fontSize:14.5, margin:"0 0 3px",
            fontFamily:"Georgia, serif"}}>{item.name}</p>
          <p style={{color:G.textSub, fontSize:12, margin:0, lineHeight:1.45}}>{item.desc}</p>
        </div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, minWidth:66}}>
          <p style={{color:G.dark, fontWeight:900, fontSize:15.5, margin:0,
            fontFamily:"Georgia, serif"}}>${item.price}</p>
          <button onClick={() => setOpen(!open)} style={{
            padding:"5px 13px", borderRadius:8,
            border:`1.5px solid ${G.gold}`,
            background: open ? G.gold : "transparent",
            color: open ? G.dark : G.gold,
            fontSize:12, fontWeight:800, cursor:"pointer"
          }}>{open ? "Cerrar" : "+ Pedir"}</button>
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{padding:"0 14px 14px", borderTop:`1px solid ${G.divider}`}}>
          {item.hasProtein && (
            <div style={{marginTop:12}}>
              <Label>Proteína</Label>
              <div style={{display:"flex", flexWrap:"wrap", gap:5}}>
                {PROTEINS.map(p => (
                  <Chip key={p} label={p} active={protein===p} onClick={()=>setProtein(p)} />
                ))}
              </div>
            </div>
          )}

          {item.sauceOptions && (
            <div style={{marginTop:12}}>
              <Label>Salsa</Label>
              <div style={{display:"flex", gap:5}}>
                {SAUCES.map(s => (
                  <Chip key={s} label={s} active={sauce===s} onClick={()=>setSauce(s)} />
                ))}
              </div>
            </div>
          )}

          {item.isSushi && (
            <div style={{marginTop:12}}>
              <Chip
                label={`💣 Convertir en Bomba +$${BOMBA_PRICE}`}
                active={bomba}
                onClick={()=>setBomba(!bomba)}
                danger
              />
              {bomba && <p style={{color:G.textSub, fontSize:11, marginTop:4}}>
                + Philadelphia, aguacate y pepino por fuera
              </p>}
            </div>
          )}

          <div style={{marginTop:12}}>
            <Label>Nota especial</Label>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Sin picante, extra queso, sin cebolla…"
              rows={2} style={{
                width:"100%", background:"#fff",
                border:`1px solid ${G.divider}`, borderRadius:8,
                color:G.textMain, fontSize:13, padding:"8px 10px",
                resize:"none", boxSizing:"border-box", fontFamily:"inherit"
              }} />
          </div>

          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12}}>
            {/* Qty */}
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <button onClick={()=>setQty(Math.max(1,qty-1))} style={qBtn}>−</button>
              <span style={{fontWeight:800, color:G.dark, minWidth:18, textAlign:"center"}}>{qty}</span>
              <button onClick={()=>setQty(qty+1)} style={qBtn}>+</button>
            </div>
            {/* Total */}
            <div style={{textAlign:"center"}}>
              <p style={{color:G.textSub, fontSize:10, margin:0}}>TOTAL</p>
              <p style={{color:G.gold, fontWeight:900, fontSize:17, margin:0,
                fontFamily:"Georgia, serif"}}>${total}</p>
            </div>
            {/* Add */}
            <button onClick={doAdd} style={{
              padding:"9px 18px", borderRadius:9, border:"none",
              background:G.gold, color:G.dark, fontWeight:900,
              fontSize:13, cursor:"pointer"
            }}>✓ Agregar</button>
          </div>
        </div>
      )}
    </div>
  );
}
const qBtn = {
  width:28, height:28, borderRadius:"50%",
  border:`1.5px solid ${G.divider}`, background:"#fff",
  color:G.dark, fontSize:16, cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center"
};

// ── CartBar ─────────────────────────────────────────────────────────
function CartBar({ count, total, onClick }) {
  if (!count) return null;
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0,
      background:G.dark, borderTop:`2px solid ${G.gold}`,
      padding:"12px 20px", zIndex:200,
      maxWidth:640, margin:"0 auto",
      display:"flex", alignItems:"center", justifyContent:"space-between"
    }}>
      <div>
        <p style={{color:"#aaa", fontSize:11, margin:0}}>{count} artículo{count!==1?"s":""}</p>
        <p style={{color:G.goldLight, fontWeight:900, fontSize:19, margin:0,
          fontFamily:"Georgia, serif"}}>${total}</p>
      </div>
      <button onClick={onClick} style={{
        background:G.gold, border:"none", borderRadius:11,
        color:G.dark, fontWeight:900, fontSize:14,
        padding:"10px 22px", cursor:"pointer",
        display:"flex", alignItems:"center", gap:8
      }}>Ver pedido →</button>
    </div>
  );
}

// ── OrderModal ───────────────────────────────────────────────────────
function OrderModal({ items, onClose, onSend }) {
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [delivery, setDelivery] = useState(null);   // "recoger" | "domicilio"
  const [address,  setAddress]  = useState("");
  const [payment,  setPayment]  = useState(null);   // "efectivo" | "transferencia" | "terminal"
  const [step,     setStep]     = useState(1);       // 1=items 2=datos 3=confirmar

  const total = items.reduce((s,i)=>s+i.totalPrice,0);
  const canNext2 = name.trim() && phone.trim() && delivery &&
                   (delivery==="recoger" || address.trim()) && payment;

  const doSend = () => onSend({ name, phone, delivery, address, payment });

  // Step labels
  const STEPS = ["Pedido","Datos","Confirmar"];

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(28,18,8,.82)",
      zIndex:300, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"flex-end"
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:G.offWhite, borderRadius:"20px 20px 0 0",
        width:"100%", maxWidth:640,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        borderTop:`3px solid ${G.gold}`,
      }}>
        {/* Modal header */}
        <div style={{
          padding:"16px 20px 12px",
          borderBottom:`1px solid ${G.divider}`,
          display:"flex", alignItems:"center", gap:12
        }}>
          <span style={{fontFamily:"Georgia,serif", color:G.gold, fontSize:13, fontWeight:700}}>
            SHEKINAH
          </span>
          {/* Step indicator */}
          <div style={{display:"flex", gap:6, marginLeft:"auto", alignItems:"center"}}>
            {STEPS.map((s,i)=>(
              <div key={s} style={{display:"flex", alignItems:"center", gap:4}}>
                <div style={{
                  width:22, height:22, borderRadius:"50%", fontSize:11, fontWeight:800,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: step===i+1 ? G.gold : step>i+1 ? G.goldBg : G.divider,
                  color: step>i ? "#fff" : G.textSub
                }}>{step>i+1?"✓":i+1}</div>
                <span style={{fontSize:10, color: step===i+1?G.gold:G.textSub, fontWeight:700}}>{s}</span>
                {i<2 && <span style={{color:G.divider, fontSize:11}}>›</span>}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{
            background:"none", border:"none", color:G.textSub,
            fontSize:20, cursor:"pointer", marginLeft:8
          }}>✕</button>
        </div>

        <div style={{overflowY:"auto", padding:"16px 20px", flex:1}}>

          {/* STEP 1 — Items */}
          {step===1 && (
            <>
              <h3 style={{color:G.dark, fontFamily:"Georgia,serif", marginTop:0}}>Tu pedido</h3>
              {items.map((item,i)=>(
                <div key={i} style={{
                  background:G.cardBg, borderRadius:9,
                  border:`1px solid ${G.divider}`, padding:"10px 12px",
                  marginBottom:8
                }}>
                  <div style={{display:"flex", justifyContent:"space-between"}}>
                    <p style={{color:G.gold, fontWeight:800, margin:0, fontSize:14,
                      fontFamily:"Georgia,serif"}}>
                      {item.qty>1 && <span style={{color:G.goldBg}}>{item.qty}× </span>}
                      {item.name}
                      {item.bomba && <span style={{color:"#c0392b", fontSize:10,
                        marginLeft:4, fontWeight:900}}>BOMBA</span>}
                    </p>
                    <p style={{color:G.dark, fontWeight:900, margin:0,
                      fontFamily:"Georgia,serif"}}>${item.totalPrice}</p>
                  </div>
                  {item.protein && <p style={{color:G.textSub,fontSize:12,margin:"3px 0 0"}}>
                    Proteína: {item.protein}</p>}
                  {item.sauce   && <p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>
                    Salsa: {item.sauce}</p>}
                  {item.note    && <p style={{color:G.textSub,fontSize:12,margin:"2px 0 0",
                    fontStyle:"italic"}}>📝 {item.note}</p>}
                </div>
              ))}
              <div style={{
                display:"flex", justifyContent:"space-between",
                borderTop:`2px solid ${G.divider}`, paddingTop:10, marginTop:4
              }}>
                <p style={{color:G.dark,fontWeight:800,fontSize:15,margin:0}}>Total</p>
                <p style={{color:G.gold,fontWeight:900,fontSize:20,margin:0,
                  fontFamily:"Georgia,serif"}}>${total}</p>
              </div>
              <button onClick={()=>setStep(2)} style={nextBtn}>
                Continuar →
              </button>
            </>
          )}

          {/* STEP 2 — Datos + entrega + pago */}
          {step===2 && (
            <>
              <h3 style={{color:G.dark, fontFamily:"Georgia,serif", marginTop:0}}>Tus datos</h3>

              <Field label="Nombre completo" value={name} onChange={setName}
                placeholder="Ej. Juan García" />
              <Field label="WhatsApp / Teléfono" value={phone} onChange={setPhone}
                placeholder="644 123 4567" type="tel" />

              <Divider />
              <Label>¿Cómo quieres recibir tu pedido?</Label>
              <div style={{display:"flex", gap:8, marginBottom:12}}>
                {[
                  {val:"recoger",  icon:"🏪", label:"Recoger en restaurante"},
                  {val:"domicilio",icon:"🛵", label:"Entrega a domicilio"},
                ].map(o=>(
                  <button key={o.val} onClick={()=>setDelivery(o.val)} style={{
                    flex:1, padding:"12px 8px", borderRadius:10, cursor:"pointer",
                    border:`2px solid ${delivery===o.val ? G.gold : G.divider}`,
                    background: delivery===o.val ? `${G.gold}18` : G.cardBg,
                    textAlign:"center", transition:"all .15s"
                  }}>
                    <p style={{fontSize:22, margin:"0 0 4px"}}>{o.icon}</p>
                    <p style={{color: delivery===o.val?G.gold:G.textSub,
                      fontWeight:700, fontSize:12, margin:0, lineHeight:1.3}}>{o.label}</p>
                  </button>
                ))}
              </div>

              {delivery==="domicilio" && (
                <Field label="Dirección de entrega" value={address} onChange={setAddress}
                  placeholder="Calle, número, colonia…" />
              )}

              <Divider />
              <Label>Método de pago</Label>
              <div style={{display:"flex", flexDirection:"column", gap:7}}>
                {[
                  {val:"efectivo",      icon:"💵", label:"Efectivo",
                    sub:"Paga al recibir o recoger"},
                  {val:"transferencia", icon:"📲", label:"Transferencia",
                    sub:"Te enviamos los datos por WhatsApp"},
                  {val:"terminal",      icon:"💳", label:"Terminal bancaria",
                    sub:"Débito o crédito al recoger / en puerta"},
                ].map(o=>(
                  <button key={o.val} onClick={()=>setPayment(o.val)} style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"11px 14px", borderRadius:10, cursor:"pointer",
                    border:`2px solid ${payment===o.val ? G.gold : G.divider}`,
                    background: payment===o.val ? `${G.gold}15` : G.cardBg,
                    textAlign:"left", transition:"all .15s"
                  }}>
                    <span style={{fontSize:22}}>{o.icon}</span>
                    <div>
                      <p style={{color: payment===o.val?G.gold:G.dark,
                        fontWeight:800, fontSize:13, margin:0}}>{o.label}</p>
                      <p style={{color:G.textSub, fontSize:11, margin:"2px 0 0"}}>{o.sub}</p>
                    </div>
                    <div style={{
                      marginLeft:"auto", width:18, height:18, borderRadius:"50%",
                      border:`2px solid ${payment===o.val?G.gold:G.divider}`,
                      background: payment===o.val ? G.gold : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      {payment===o.val && <span style={{color:G.dark, fontSize:9}}>✓</span>}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={()=>{ if(canNext2) setStep(3); else alert("Completa todos los campos."); }}
                style={{...nextBtn, marginTop:20, opacity: canNext2?1:.5}}
              >
                Revisar pedido →
              </button>
            </>
          )}

          {/* STEP 3 — Confirm */}
          {step===3 && (
            <>
              <h3 style={{color:G.dark, fontFamily:"Georgia,serif", marginTop:0}}>
                Confirmar pedido
              </h3>

              <SummaryRow label="Cliente" value={name} />
              <SummaryRow label="Teléfono" value={phone} />
              <SummaryRow label="Entrega"
                value={delivery==="recoger"?"🏪 Recoger en restaurante":`🛵 Domicilio: ${address}`} />
              <SummaryRow label="Pago"
                value={payment==="efectivo"?"💵 Efectivo"
                      :payment==="transferencia"?"📲 Transferencia"
                      :"💳 Terminal bancaria"} />

              <Divider />
              <p style={{color:G.textSub, fontWeight:700, fontSize:12, margin:"0 0 6px"}}>
                ARTÍCULOS ({items.reduce((s,i)=>s+i.qty,0)})
              </p>
              {items.map((item,i)=>(
                <div key={i} style={{display:"flex", justifyContent:"space-between",
                  marginBottom:4}}>
                  <span style={{color:G.dark, fontSize:13}}>
                    {item.qty>1 && `${item.qty}× `}{item.name}
                    {item.bomba&&" 💣"}{item.protein&&` (${item.protein})`}
                  </span>
                  <span style={{color:G.gold, fontWeight:800, fontSize:13}}>${item.totalPrice}</span>
                </div>
              ))}

              <Divider />
              <div style={{display:"flex", justifyContent:"space-between"}}>
                <p style={{color:G.dark,fontWeight:800,fontSize:16,margin:0}}>Total a pagar</p>
                <p style={{color:G.gold,fontWeight:900,fontSize:22,margin:0,
                  fontFamily:"Georgia,serif"}}>${total}</p>
              </div>

              <button onClick={doSend} style={{
                ...nextBtn,
                background:G.green, marginTop:20,
                display:"flex", alignItems:"center",
                justifyContent:"center", gap:10
              }}>
                <span style={{fontSize:18}}>💬</span> Enviar por WhatsApp
              </button>

              <button onClick={()=>setStep(2)} style={{
                width:"100%", marginTop:8, padding:"10px",
                borderRadius:9, border:`1.5px solid ${G.divider}`,
                background:"transparent", color:G.textSub,
                fontWeight:700, fontSize:13, cursor:"pointer"
              }}>← Editar datos</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const nextBtn = {
  width:"100%", marginTop:16, padding:"13px",
  borderRadius:10, border:"none",
  background:G.gold, color:G.dark,
  fontWeight:900, fontSize:15, cursor:"pointer"
};

function Field({ label, value, onChange, placeholder, type="text" }) {
  return (
    <div style={{marginBottom:12}}>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} style={{
          width:"100%", background:"#fff",
          border:`1px solid ${G.divider}`, borderRadius:8,
          color:G.textMain, fontSize:14, padding:"9px 12px",
          boxSizing:"border-box", fontFamily:"inherit"
        }} />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{display:"flex", gap:8, marginBottom:6}}>
      <span style={{color:G.textSub, fontSize:12, minWidth:70, fontWeight:700}}>{label}</span>
      <span style={{color:G.dark, fontSize:13, fontWeight:600}}>{value}</span>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = "526442049243"; // ← cambia por el número del restaurante

export default function App() {
  const [cat,        setCat]        = useState("Botanas");
  const [cart,       setCart]       = useState([]);
  const [showModal,  setShowModal]  = useState(false);
  const categories = Object.keys(MENU);

  const cartCount = cart.reduce((s,i)=>s+i.qty,0);
  const cartTotal = cart.reduce((s,i)=>s+i.totalPrice,0);

  const addToCart = item => setCart(prev=>[...prev,item]);

  const buildMsg = ({ name, phone, delivery, address, payment }) => {
    const total = cart.reduce((s,i)=>s+i.totalPrice,0);
    let msg = `🔥 *NUEVO PEDIDO — SHEKINAH*\n`;
    msg += `👤 *Cliente:* ${name}\n`;
    msg += `📱 *Teléfono:* ${phone}\n`;
    msg += delivery==="recoger"
      ? `🏪 *Entrega:* Pasa a recoger\n`
      : `🛵 *Entrega:* Domicilio — ${address}\n`;
    msg += payment==="efectivo"   ? `💵 *Pago:* Efectivo\n`
         : payment==="transferencia" ? `📲 *Pago:* Transferencia\n`
         : `💳 *Pago:* Terminal bancaria\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    cart.forEach((item,i)=>{
      msg += `\n*${i+1}. ${item.name}*`;
      if(item.bomba) msg += ` 💣 BOMBA`;
      msg += ` × ${item.qty} — $${item.totalPrice}\n`;
      if(item.protein) msg += `   • Proteína: ${item.protein}\n`;
      if(item.sauce)   msg += `   • Salsa: ${item.sauce}\n`;
      if(item.note)    msg += `   • Nota: ${item.note}\n`;
    });
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *TOTAL: $${total} MXN*\n`;
    msg += `\n¡Gracias por tu pedido! 🙏`;
    return encodeURIComponent(msg);
  };

  const handleSend = (data) => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${buildMsg(data)}`,"_blank");
    setShowModal(false);
    setCart([]);
  };

  return (
    <div style={{
      background:G.offWhite, minHeight:"100vh",
      fontFamily:"'Segoe UI', system-ui, sans-serif",
      maxWidth:640, margin:"0 auto", position:"relative"
    }}>

      {/* ── Header ── */}
      <div style={{
        background:G.dark, padding:"18px 20px 14px",
        borderBottom:`3px solid ${G.gold}`,
        position:"sticky", top:0, zIndex:150
      }}>
        <div style={{display:"flex", alignItems:"center"}}>
          <div>
            <p style={{
              color:G.gold, fontFamily:"Georgia,serif",
              fontSize:22, fontWeight:900, margin:0, letterSpacing:2
            }}>SHEKINAH</p>
            <p style={{
              color:`${G.goldLight}88`, fontSize:9, margin:0,
              letterSpacing:3, fontWeight:600
            }}>RESTAURANT · EL SABOR A GLORIA</p>
          </div>
          {cartCount>0 && (
            <button onClick={()=>setShowModal(true)} style={{
              marginLeft:"auto",
              background:G.gold, border:"none", borderRadius:10,
              padding:"6px 14px", cursor:"pointer",
              display:"flex", alignItems:"center", gap:7
            }}>
              <span style={{fontSize:13}}>🛒</span>
              <span style={{color:G.dark, fontWeight:900, fontSize:13}}>{cartCount}</span>
              <span style={{color:G.dark, fontWeight:900, fontSize:13}}>· ${cartTotal}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Bomba promo banner ── */}
      <div style={{
        background:G.dark, padding:"8px 20px",
        borderBottom:`1px solid #333`
      }}>
        <p style={{color:"#ddd", fontSize:12, margin:0}}>
          💣 <span style={{color:G.goldLight, fontWeight:700}}>Convierte cualquier rollo en BOMBA</span>
          {" "}por solo $165 · Philadelphia, aguacate y pepino
        </p>
      </div>

      {/* ── Category tabs ── */}
      <div style={{
        display:"flex", overflowX:"auto", gap:0,
        background:G.warmGray, borderBottom:`2px solid ${G.divider}`,
        scrollbarWidth:"none", padding:"0 4px"
      }}>
        {categories.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            padding:"11px 14px", border:"none", borderBottom:`3px solid ${cat===c?G.gold:"transparent"}`,
            background:"transparent", color: cat===c?G.gold:G.textSub,
            fontWeight:700, fontSize:12, cursor:"pointer", whiteSpace:"nowrap",
            transition:"all .15s", letterSpacing:.3
          }}>
            {CAT_ICONS[c]} {c}
          </button>
        ))}
      </div>

      {/* ── Menu list ── */}
      <div style={{padding:"16px 16px", paddingBottom: cartCount?100:24}}>

        {/* Section header — matches menu style */}
        <div style={{
          background:G.goldBg, borderRadius:6,
          padding:"7px 14px", marginBottom:14,
          display:"inline-block"
        }}>
          <p style={{color:"#fff", fontWeight:900, fontSize:17,
            fontFamily:"Georgia,serif", margin:0, letterSpacing:.5}}>
            {CAT_ICONS[cat]} {cat}
          </p>
        </div>

        {cat==="Sushi" && (
          <div style={{
            background:"#1C1208", borderRadius:8,
            padding:"9px 13px", marginBottom:14
          }}>
            <p style={{color:"#eee", fontSize:12, margin:0}}>
              Todos los rollos incluyen <strong style={{color:G.goldLight}}>queso Philadelphia, aguacate y pepino</strong>.
              {" "}Ingrediente extra: <strong style={{color:G.goldLight}}>+$20</strong> en rollos · <strong style={{color:G.goldLight}}>+$30</strong> en platillos.
            </p>
          </div>
        )}

        {MENU[cat].map(item=>(
          <MenuItem key={item.id} item={item} onAdd={addToCart} />
        ))}
      </div>

      {/* ── Cart bar ── */}
      <CartBar count={cartCount} total={cartTotal} onClick={()=>setShowModal(true)} />

      {/* ── Order modal ── */}
      {showModal && (
        <OrderModal
          items={cart}
          onClose={()=>setShowModal(false)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}
