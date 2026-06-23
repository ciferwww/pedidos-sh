import { createContext, useContext, useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, onSnapshot, setDoc,
} from "firebase/firestore";

// ── Firebase singleton ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBDvEi4Fd-fWi3UgYrtmOq_jnKvoay4tfs",
  authDomain: "shekinah-pedidos.firebaseapp.com",
  projectId: "shekinah-pedidos",
  storageBucket: "shekinah-pedidos.firebasestorage.app",
  messagingSenderId: "665781041109",
  appId: "1:665781041109:web:2d1e566882fa2f4733ef5c",
};
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
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

  /** Admin new-order beep */
  const playNewOrderBeep = () => _playTone(440, 0.09, 0.35, "square");

  return (
    <TenantContext.Provider value={{
      tenantId, db, colRef, configDocRef,
      pausado, setPausa, horario,
      unlockAudio, playAddToCart, playOrderConfirmed, playNewOrderBeep,
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
