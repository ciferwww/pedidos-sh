const fs = require('fs');

// --- TenantContext.jsx ---
let tenant = fs.readFileSync('src/TenantContext.jsx', 'utf8');
tenant = tenant.replace(
  `  /** Admin new-order beep */\r\n  const playNewOrderBeep = () => _playTone(440, 0.09, 0.35, "square");`,
  `  /** Admin new-order beep */
  const playNewOrderBeep = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    
    const duration = 3.0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    
    for (let i = 0; i < duration * 10; i++) {
      const time = ctx.currentTime + (i * 0.1);
      osc.frequency.setValueAtTime(i % 2 === 0 ? 600 : 400, time);
    }
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.5, ctx.currentTime + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  };`
);
fs.writeFileSync('src/TenantContext.jsx', tenant);

// --- Admin.jsx ---
let admin = fs.readFileSync('src/Admin.jsx', 'utf8');

admin = admin.replace(
  `const [tempAlga, setTempAlga] = useState(true);`,
  `const [tempAlga, setTempAlga] = useState(true);
  const [tempPrep, setTempPrep] = useState(null);`
);

admin = admin.replace(
  `      setTempAlga(true);\r\n    } else {`,
  `      setTempAlga(true);
      setTempPrep(null);
    } else {`
);

admin = admin.replace(
  `      alga: showQuick.isSushi ? tempAlga : null\r\n    }]);`,
  `      alga: showQuick.isSushi ? tempAlga : null,
      preparacion: showQuick.isSushi ? tempPrep : null
    }]);`
);

admin = admin.replace(
  `    if(item.sauce&&!tempSauce){ alert("Elige salsa"); return; }`,
  `    if(item.sauce&&!tempSauce){ alert("Elige salsa"); return; }
    if(item.isSushi&&!tempPrep){ alert("Elige preparación (Natural/Empanizado/Mitad y Mitad)"); return; }`
);

admin = admin.replace(
  `            {showQuick.isSushi && (\r\n              <div style={{marginBottom:12}}>\r\n                <p style={{color:G.textSub,fontSize:11,fontWeight:800,margin:"0 0 6px",letterSpacing:1}}>ALGA</p>`,
  `            {showQuick.isSushi && (
              <div style={{marginBottom:12}}>
                <p style={{color:G.textSub,fontSize:11,fontWeight:800,margin:"0 0 6px",letterSpacing:1}}>PREPARACIÓN</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                  {["Natural","Empanizado","Mitad y Mitad"].map(prep=>(
                    <button key={prep} id={\`quick-prep-\${prep}\`} onClick={()=>setTempPrep(prep)} style={{
                      padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                      border:\`1.5px solid \${tempPrep===prep?G.gold:G.divider}\`,
                      background:tempPrep===prep?G.gold:"transparent",
                      color:tempPrep===prep?G.dark:G.textSub}}>{prep}</button>
                  ))}
                </div>
                <p style={{color:G.textSub,fontSize:11,fontWeight:800,margin:"0 0 6px",letterSpacing:1}}>ALGA</p>`
);

admin = admin.replace(
  `          articulos:cart.map(i=>({\r\n            nombre:i.nombre,cantidad:i.cantidad,protein:i.protein||"",\r\n            salsa:i.salsa||"",bomba:false,extras:[],platExtras:[],nota:"",subtotal:i.subtotal,\r\n            alga: i.alga ?? null\r\n          })),`,
  `          articulos:cart.map(i=>({
            nombre:i.nombre,cantidad:i.cantidad,protein:i.protein||"",
            salsa:i.salsa||"",bomba:false,extras:[],platExtras:[],nota:"",subtotal:i.subtotal,
            alga: i.alga ?? null, preparacion: i.preparacion ?? null
          })),`
);

admin = admin.replace(
  `                  {a.extras?.length>0&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>+{a.extras.join(",")}</span>}`,
  `                  {a.preparacion&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>({a.preparacion})</span>}
                  {a.extras?.length>0&&<span style={{color:G.textSub,fontSize:11,marginLeft:5}}>+{a.extras.join(",")}</span>}`
);

fs.writeFileSync('src/Admin.jsx', admin);

// --- App.jsx ---
let app = fs.readFileSync('src/App.jsx', 'utf8');

app = app.replace(
  `const [alga, setAlga] = useState(true);`,
  `const [alga, setAlga] = useState(true);
  const [preparacion, setPreparacion] = useState(null);`
);

app = app.replace(
  `onAdd({ ...item, protein, sauce, bomba, extras, platExtras, alga: item.isSushi ? alga : null, note, qty, totalPrice:total });`,
  `onAdd({ ...item, protein, sauce, bomba, extras, platExtras, alga: item.isSushi ? alga : null, preparacion: item.isSushi ? preparacion : null, note, qty, totalPrice:total });`
);

app = app.replace(
  `    setBomba(false); setExtras([]); setPlatExtras([]); setAlga(true); setNote(""); setQty(1);`,
  `    setBomba(false); setExtras([]); setPlatExtras([]); setAlga(true); setPreparacion(null); setNote(""); setQty(1);`
);

app = app.replace(
  `    if (item.sauceOptions && !sauce)       { alert("Elige una salsa."); return; }`,
  `    if (item.sauceOptions && !sauce)       { alert("Elige una salsa."); return; }
    if (item.isSushi && !preparacion)      { alert("Elige una preparación para tu sushi."); return; }`
);

app = app.replace(
  `{item.isSushi && (
            <div style={{marginTop:12}}>
              <Label>Ingredientes extra (+$20 c/u)</Label>`,
  `{item.isSushi && (
            <div style={{marginTop:12}}>
              <Label>Preparación</Label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                {["Natural","Empanizado","Mitad y Mitad"].map(prep=>(
                  <Chip key={prep} label={prep} active={preparacion===prep} onClick={()=>setPreparacion(prep)} />
                ))}
              </div>
              <Label>Ingredientes extra (+$20 c/u)</Label>`
);

app = app.replace(
  `                  {item.alga !== null && item.alga !== undefined &&\r\n                   <p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>\r\n                    Alga: {item.alga ? "Con alga 🌿" : "Sin alga"}\r\n                   </p>}`,
  `                  {item.alga !== null && item.alga !== undefined &&
                   <p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>
                    Alga: {item.alga ? "Con alga 🌿" : "Sin alga"}
                   </p>}
                  {item.preparacion&&<p style={{color:G.textSub,fontSize:12,margin:"2px 0 0"}}>Prep: {item.preparacion}</p>}`
);

app = app.replace(
  `          alga: i.alga ?? null,\r\n        })),`,
  `          alga: i.alga ?? null,
          preparacion: i.preparacion || null,
        })),`
);

app = app.replace(
  `      if(item.alga !== null && item.alga !== undefined)\r\n        msg += \`   • Alga: \${item.alga ? "Con alga" : "Sin alga"}\\n\`;`,
  `      if(item.alga !== null && item.alga !== undefined)
        msg += \`   • Alga: \${item.alga ? "Con alga" : "Sin alga"}\\n\`;
      if(item.preparacion) msg+= \`   • Prep: \${item.preparacion}\\n\`;`
);

app = app.replace(
  `    msg += \`\\n━━━━━━━━━━━━━━━━━━━━\\n💰 *TOTAL: $\${total} MXN*\\n\\n¡Gracias! 🙏\`;`,
  `    msg += \`\\n━━━━━━━━━━━━━━━━━━━━\\n💰 *TOTAL: $\${total} MXN*\\n\\n📍 Sigue tu pedido en vivo aquí:\\n\${window.location.origin}/?rest=\${resolveTenantId()}&track=\${orderId}\\n\\n¡Gracias! 🙏\`;`
);

app = app.replace(
  `const buildMsg = ({ name, phone, delivery, address, payment, deliveryCost, total, turno }) => {`,
  `const buildMsg = ({ name, phone, delivery, address, payment, deliveryCost, total, turno, orderId }) => {`
);

app = app.replace(
  `window.open(\`https://wa.me/\${WHATSAPP_NUMBER}?text=\${buildMsg({name,phone,delivery,address,payment,deliveryCost,total,turno})}\`,"_blank");`,
  `window.open(\`https://wa.me/\${WHATSAPP_NUMBER}?text=\${buildMsg({name,phone,delivery,address,payment,deliveryCost,total,turno,orderId})}\`,"_blank");`
);

app = app.replace(
  `const tenantId = resolveTenantId();`,
  `const tenantId = resolveTenantId();` // no-op but lets see
);

// We need OrderTracker component
const trackerComponent = `
// ── OrderTracker ───────────────────────────────────────────────────────
function OrderTracker({ orderId, onClose }) {
  const { docRef } = useTenant ? useTenant() : { docRef: (n,id)=>doc(db,"tenants",resolveTenantId(),n,id) };
  const [pedido, setPedido] = useState(null);
  
  useEffect(() => {
    const unsub = onSnapshot(doc(db,"tenants",resolveTenantId(),"pedidos",orderId), (snap) => {
      if(snap.exists()) setPedido({id:snap.id, ...snap.data()});
    });
    return unsub;
  }, [orderId]);

  if(!pedido) return <div style={{padding:40,textAlign:"center",color:G.textSub}}>Cargando estado...</div>;

  const est = pedido.estado;
  const stages = [
    {key:"nuevo", label:"Recibido", icon:"📥"},
    {key:"en_proceso", label:"Preparando", icon:"🍳"},
    {key:"listo", label:pedido.entrega==="domicilio"?"En Camino":"Listo para recoger", icon:pedido.entrega==="domicilio"?"🛵":"🏪"},
    {key:"entregado", label:"Entregado", icon:"✅"}
  ];
  
  const currentIdx = stages.findIndex(s=>s.key===est);

  return (
    <div style={{background:G.offWhite,minHeight:"100vh",padding:20,maxWidth:640,margin:"0 auto",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:G.dark,borderRadius:16,padding:24,color:"#fff",border:\`2px solid \${G.gold}\`,marginBottom:24,textAlign:"center"}}>
        <p style={{color:G.goldLight,fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>ESTADO DE TU PEDIDO</p>
        <p style={{fontSize:40,fontWeight:900,margin:"0 0 4px",fontFamily:"Georgia,serif"}}>#{pedido.turno}</p>
        <p style={{color:"#aaa",fontSize:13,margin:0}}>{pedido.nombre}</p>
      </div>
      
      <div style={{background:G.cardBg,borderRadius:16,padding:24,border:\`1px solid \${G.divider}\`}}>
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
          Volver al Menú
        </button>
      )}
    </div>
  );
}
`;

app = app.replace(
  `// ── Field ────────────────────────────────────────────────────────────`,
  trackerComponent + `\n// ── Field ────────────────────────────────────────────────────────────`
);

// Add trackingOrderId to App
app = app.replace(
  `  const [sending,  setSending]  = useState(false);`,
  `  const [sending,  setSending]  = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState(null);`
);

app = app.replace(
  `  const [cartCount, setCartCount] = useState(0);`,
  `  const [cartCount, setCartCount] = useState(0);
  const [trackingOrderId, setTrackingOrderId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("track") || localStorage.getItem("trackingOrderId") || null;
  });`
);

app = app.replace(
  `        tenantId,
      });
    } catch(e){ console.error(e); }`,
  `        tenantId,
      });
      const orderId = docRef.id;
      localStorage.setItem("trackingOrderId", orderId);
      setTrackingOrderId(orderId);
      if(mode==="whatsapp"){
        window.open(\`https://wa.me/\${WHATSAPP_NUMBER}?text=\${buildMsg({name,phone,delivery,address,payment,deliveryCost,total,turno,orderId})}\`,"_blank");
      }
    } catch(e){ console.error(e); }`
);

app = app.replace(
  `    if(mode==="whatsapp"){
      window.open(\`https://wa.me/\${WHATSAPP_NUMBER}?text=\${buildMsg({name,phone,delivery,address,payment,deliveryCost,total,turno,orderId})}\`,"_blank");
    }`,
  ``
);

app = app.replace(
  `function resolveTenantId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("rest") || "shekinah";
}`,
  `function resolveTenantId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("rest") || "shekinah";
}`
);

// If trackingOrderId exists, return <OrderTracker> early in App render
app = app.replace(
  `      {isDisabled && <BannerCierre pausado={pausado} />}`,
  `      {trackingOrderId && <OrderTracker orderId={trackingOrderId} onClose={() => { setTrackingOrderId(null); localStorage.removeItem("trackingOrderId"); }} />}
      {!trackingOrderId && <>
      {isDisabled && <BannerCierre pausado={pausado} />}`
);

app = app.replace(
  `      {cartCount>0&&!showModal&&<CartBar count={cartCount} total={cartTotal} onClick={()=>setShowModal(true)} />}
    </div>
  );
}`,
  `      {cartCount>0&&!showModal&&<CartBar count={cartCount} total={cartTotal} onClick={()=>setShowModal(true)} />}
      </>}
    </div>
  );
}`
);

fs.writeFileSync('src/App.jsx', app);
console.log("Done");
