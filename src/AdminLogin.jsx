import { useState, useEffect, useCallback } from "react";
import { query, where, getDocs } from "firebase/firestore";
import { useTenant } from "./TenantContext";

// ── AdminLogin ───────────────────────────────────────────────────────
// Numpad táctil de 4 dígitos. Busca el PIN en la colección "empleados"
// del tenant actual y devuelve el documento del empleado (incluye `rol`)
// vía onLogin. No requiere import de estilos externos: usa G (paleta)
// pasada como prop para mantenerse alineado con el resto del admin.
//
// Props:
//   onLogin(empleado)  → llamado con { id, nombre, pin, rol } al validar
//   G                  → objeto de colores del tenant (igual que en App.jsx)
export default function AdminLogin({ onLogin, G }) {
  const { colRef, unlockAudio } = useTenant();
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState(false);
  const [checking, setChecking] = useState(false);

  const palette = G || {
    dark:"#1C1208", gold:"#B8892A", goldLight:"#C9A84C",
    offWhite:"#F5F1EA", divider:"#D4C4A0", textSub:"#5a4a2a", textMain:"#1C1208",
  };

  const validar = useCallback(async (codigo) => {
    setChecking(true);
    try {
      const snap = await getDocs(
        query(colRef("empleados"), where("pin", "==", codigo))
      );
      if (snap.empty) {
        setError(true);
        setPin("");
      } else {
        const empleadoDoc = snap.docs[0];
        unlockAudio();
        onLogin({ id: empleadoDoc.id, ...empleadoDoc.data() });
      }
    } catch (e) {
      console.error("[AdminLogin] error validando PIN:", e);
      setError(true);
      setPin("");
    }
    setChecking(false);
  }, [colRef, unlockAudio, onLogin]);

  useEffect(() => {
    if (pin.length === 4 && !checking) validar(pin);
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (d) => {
    if (checking) return;
    setError(false);
    setPin(prev => (prev.length >= 4 ? prev : prev + d));
  };
  const del = () => { if (!checking) { setError(false); setPin(prev => prev.slice(0, -1)); } };
  const clear = () => { if (!checking) { setError(false); setPin(""); } };

  const KEYS = ["1","2","3","4","5","6","7","8","9","C","0","⌫"];

  return (
    <div style={{minHeight:"100vh", background:palette.dark,
      display:"flex", alignItems:"center", justifyContent:"center"}}>
      <div style={{background:palette.offWhite, borderRadius:18, padding:"32px 28px",
        width:"100%", maxWidth:320, textAlign:"center", border:`2px solid ${palette.gold}`}}>

        <p style={{fontSize:30, margin:"0 0 4px"}}>🔥</p>
        <p style={{fontFamily:"Georgia,serif", color:palette.gold, fontSize:20,
          fontWeight:900, margin:"0 0 2px", letterSpacing:2}}>SHEKINAH</p>
        <p style={{color:palette.textSub, fontSize:11, margin:"0 0 22px", letterSpacing:2}}>
          INGRESA TU PIN
        </p>

        {/* Indicador de dígitos */}
        <div style={{display:"flex", justifyContent:"center", gap:10, marginBottom:8}}>
          {[0,1,2,3].map(i=>(
            <span key={i} style={{
              width:16, height:16, borderRadius:"50%",
              border:`2px solid ${error ? "#e74c3c" : palette.gold}`,
              background: i < pin.length ? (error ? "#e74c3c" : palette.gold) : "transparent",
              transition:"all .15s",
              animation: error ? "shake .25s" : "none",
            }} />
          ))}
        </div>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`}</style>

        <p style={{minHeight:16, color:"#e74c3c", fontSize:12, margin:"0 0 14px"}}>
          {error ? "PIN incorrecto" : (checking ? "Verificando…" : "\u00A0")}
        </p>

        {/* Numpad */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10}}>
          {KEYS.map(k=>{
            const isAction = k === "C" || k === "⌫";
            return (
              <button
                key={k}
                id={`pin-key-${k}`}
                disabled={checking}
                onClick={() => k === "C" ? clear() : k === "⌫" ? del() : press(k)}
                style={{
                  padding:"16px 0", borderRadius:12, cursor: checking ? "not-allowed" : "pointer",
                  border:`1.5px solid ${palette.divider}`,
                  background: isAction ? "#fff" : "#fff",
                  color: isAction ? palette.textSub : palette.textMain,
                  fontSize:18, fontWeight:800, fontFamily:"inherit",
                  opacity: checking ? .5 : 1,
                }}>
                {k}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}