import { createContext, useContext, useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, onSnapshot, setDoc,
} from "firebase/firestore";

// ── Firebase singleton ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// ── Paleta por defecto (fallback para todos los tenants) ─────────────
export const G_DEFAULT = {
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

const DEFAULT_BRAND = {
  nombre:   "Shekinah",
  slogan:   "RESTAURANT · EL SABOR A GLORIA",
  whatsapp: "526441234567",
  logoUrl:  null,
};

const DEFAULT_CONFIG = {
  colors:      G_DEFAULT,
  brand:       DEFAULT_BRAND,
  isSuspended: false,
  loading:     true,
};
// ────────────────────────────────────────────────────────────────────

/** Extrae el tenantId desde ?rest= en la URL, con fallback a "shekinah" */
function resolveTenantId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("rest") || "shekinah";
}

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const tenantId = resolveTenantId();

  /** Colección path helper: /tenants/{tenantId}/{name} */
  const colRef = (name) => collection(db, "tenants", tenantId, name);

  /** Doc path helper: /tenants/{tenantId}/config/{docId} */
  const configDocRef = (docId) => doc(db, "tenants", tenantId, "config", docId);

  // Operational state from Firestore
  const [pausado, setPausado] = useState(false);
  const [horario] = useState({ abre: "12:00", cierra: "23:30" });

  // ── Configuración dinámica del tenant (branding + estado) ────────────
const [tenantConfig, setTenantConfig] = useState(DEFAULT_CONFIG);

useEffect(() => {
  // Escucha el documento raíz del tenant: /tenants/{tenantId}
  const tenantDocRef = doc(db, "tenants", tenantId);
  const unsub = onSnapshot(
    tenantDocRef,
    (snap) => {
      if (!snap.exists()) {
        // El documento no existe → usar defaults, pero ya no está "loading"
        setTenantConfig({ ...DEFAULT_CONFIG, loading: false });
        return;
      }
      const data     = snap.data();
      const branding = data.branding || {};

      setTenantConfig({
        loading:     false,
        isSuspended: data.status === "suspendido",
        brand: {
          nombre:   data.nombre   || DEFAULT_BRAND.nombre,
          slogan:   data.slogan   || DEFAULT_BRAND.slogan,
          whatsapp: data.whatsapp || DEFAULT_BRAND.whatsapp,
          logoUrl:  data.logoUrl  || null,
        },
        // Cada clave de G_DEFAULT puede ser sobreescrita desde Firestore;
        // si no está, cae al valor por defecto.
        colors: Object.fromEntries(
          Object.keys(G_DEFAULT).map((key) => [
            key,
            branding[key] || G_DEFAULT[key],
          ])
        ),
      });
    },
    () => {
      // Error de permisos u offline → fallback silencioso
      setTenantConfig({ ...DEFAULT_CONFIG, loading: false });
    }
  );
  return unsub;
}, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = onSnapshot(
      configDocRef("general"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.pausado != null) setPausado(!!data.pausado);
        }
      },
      () => {} // silently ignore permission errors
    );
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPausa = async (val) => {
    try {
      await setDoc(configDocRef("general"), { pausado: val }, { merge: true });
    } catch (e) {
      console.warn("No se pudo actualizar pausa:", e);
    }
  };

  // ── Audio Context singleton ───────────────────────────────────────
  const audioCtxRef = useRef(null);
  const audioUnlocked = useRef(false);

  const unlockAudio = () => {
    if (audioUnlocked.current) return;
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      audioUnlocked.current = true;
    } catch (_) {}
  };

  const _playTone = (freq, duration, gain = 0.3, type = "sine", startTime = 0) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
    gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration + 0.05);
  };

  /** Satisfying "pop/click" when adding to cart */
  const playAddToCart = () => _playTone(880, 0.06, 0.25, "sine");

  /** Harmonic bell (Do-Mi) when order is confirmed */
  const playOrderConfirmed = () => {
    _playTone(523.25, 0.18, 0.3, "sine", 0);     // Do4
    _playTone(659.25, 0.22, 0.25, "sine", 0.16); // Mi4
  };

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
  };

  return (
    <TenantContext.Provider value={{
      tenantId, db, colRef, configDocRef,
      pausado, setPausa, horario,
      unlockAudio, playAddToCart, playOrderConfirmed, playNewOrderBeep,
      tenantConfig,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

/** Calcula si el establecimiento está cerrado según hora local */
export function useIsClosedHours(horario) {
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      const mins = h * 60 + m;
      const [ah, am] = horario.abre.split(":").map(Number);
      const [ch, cm] = horario.cierra.split(":").map(Number);
      const abreMins = ah * 60 + am;
      const cierraMins = ch * 60 + cm;
      setIsClosed(mins < abreMins || mins > cierraMins);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [horario.abre, horario.cierra]);

  return isClosed;
}

// ── useTenantConfig ──────────────────────────────────────────────────
/**
 * Retorna { colors, brand, isSuspended, loading }
 *
 * colors   → objeto compatible con el actual `const G` (drop-in replacement)
 * brand    → { nombre, slogan, whatsapp, logoUrl }
 * isSuspended → true si el tenant está en status:"suspendido"
 * loading  → true mientras se espera la primera respuesta de Firestore
 *
 * Estructura esperada en Firestore  /tenants/{tenantId}:
 * {
 *   status:   "activo" | "suspendido",
 *   nombre:   "Mi Restaurante",
 *   slogan:   "El mejor sabor",
 *   whatsapp: "521234567890",
 *   logoUrl:  "https://...",
 *   branding: {
 *     gold: "#B8892A", dark: "#1C1208", offWhite: "#F5F1EA",
 *     // cualquier clave de G_DEFAULT es sobreescribible
 *   }
 * }
 */
export function useTenantConfig() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenantConfig debe usarse dentro de <TenantProvider>");
  return ctx.tenantConfig;
}