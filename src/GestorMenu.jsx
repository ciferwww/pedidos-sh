import { useState, useEffect, useMemo } from "react";
import {
  onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { useTenant, useTenantConfig } from "./TenantContext";

// ── Esquema de un paquete en /tenants/{tenantId}/paquetes:
// {
//   nombre: "Paquete familiar",
//   descripcion: "Para 4 personas",
//   precio: 450,
//   disponible: true,
//   orden: 0,
//   items: [
//     { nombre: "Shekinah Roll", cantidad: 2, descripcion: "" },
//     { nombre: "Boneless", cantidad: 1, descripcion: "500g" },
//   ],
//   creadoEn, actualizadoEn
// }

// ── GestorMenu ──────────────────────────────────────────────────────────
// Panel del admin (rol "jefe") para administrar el catálogo real de
// productos que consumen tanto el menú del cliente (App.jsx) como el
// punto de venta (POS, en Admin.jsx). Ambos leen en vivo de:
//   /tenants/{tenantId}/productos/{productId}
//
// Esquema de un producto (mismo que ya espera App.jsx):
// {
//   name, desc, price, categoria, orden, disponible,
//   tags: ["Picante","Popular","Individual"],
//   hasProtein, hasBurgerProtein, sauceOptions("roll"|"boneless"|null),
//   isSushi, hasExtras,
//   imagen (URL de la foto — sube la imagen a un servicio gratuito como
//     Imgur, Postimages o Cloudinary, y pega aquí el link directo.
//     No usamos Firebase Storage porque requiere el plan de pago Blaze).
// }

const CATEGORIAS_SUGERIDAS = ["Botanas","Sushi","Platillos","Entradas","Hamburguesas","Paquetes","Bebidas"];
const ALL_TAGS = ["Picante","Popular","Individual"];
const TAG_COLORS = { Picante:"#e74c3c", Popular:"#B8892A", Individual:"#2980b9" };
const TAG_ICONS  = { Picante:"🌶", Popular:"⭐", Individual:"👤" };

// Descripciones genéricas de respaldo por categoría — útiles como punto de
// partida mientras se escribe el texto definitivo de cada platillo desde
// aquí mismo. Edítalas libremente en el campo "Descripción" del producto.
export const GENERIC_DESC_BY_CATEGORY = {
  Botanas:      "Preparado fresco al momento, ideal para compartir.",
  Sushi:        "Elaborado con ingredientes frescos, al estilo de la casa.",
  Platillos:    "Receta de la casa, preparada con ingredientes frescos del día.",
  Entradas:     "Para abrir el apetito, preparado con ingredientes frescos.",
  Hamburguesas: "Carne jugosa y pan suave, armada al momento de tu pedido.",
  Paquetes:     "Combinación pensada para compartir, con lo mejor de la casa.",
  Bebidas:      "Bebida preparada al momento, servida bien fría.",
};
export const GENERIC_DESC_DEFAULT = "Preparado con ingredientes frescos de la casa.";

export const genericDescFor = (categoria) =>
  GENERIC_DESC_BY_CATEGORY[categoria] || GENERIC_DESC_DEFAULT;

const EMPTY_PRODUCT = {
  name: "", desc: "", price: "", categoria: "", orden: 0, disponible: true,
  tags: [], hasProtein: false, hasBurgerProtein: false, sauceOptions: "",
  isSushi: false, hasExtras: false, imagen: null,
};

export default function GestorMenu() {
  const { colRef, tenantId } = useTenant();
  const { colors: G } = useTenantConfig();

  const [vistaTab, setVistaTab] = useState("productos"); // "productos" | "paquetes"
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [editing, setEditing] = useState(null); // producto en edición (o null)
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Estado de paquetes ──
  const [paquetes, setPaquetes] = useState([]);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [editingPkg, setEditingPkg] = useState(null);
  const [creatingPkg, setCreatingPkg] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(colRef("paquetes"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      setPaquetes(list);
      setLoadingPkgs(false);
    }, () => setLoadingPkgs(false));
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePaquete = async (data) => {
    try {
      const payload = {
        nombre: data.nombre.trim(),
        descripcion: (data.descripcion || "").trim(),
        precio: Number(data.precio) || 0,
        orden: Number(data.orden) || 0,
        disponible: !!data.disponible,
        items: (data.items || []).filter(it => it.nombre.trim()),
        actualizadoEn: serverTimestamp(),
      };
      if (data.id) {
        await updateDoc(doc(colRef("paquetes"), data.id), payload);
        showToast("Paquete actualizado ✓");
      } else {
        payload.creadoEn = serverTimestamp();
        await addDoc(colRef("paquetes"), payload);
        showToast("Paquete creado ✓");
      }
      setEditingPkg(null);
      setCreatingPkg(false);
    } catch (e) {
      console.error(e);
      showToast("Error al guardar paquete.", false);
    }
  };

  const deletePaquete = async (pkg) => {
    if (!window.confirm(`¿Eliminar el paquete "${pkg.nombre}"?`)) return;
    try {
      await deleteDoc(doc(colRef("paquetes"), pkg.id));
      showToast("Paquete eliminado");
    } catch (e) {
      showToast("No se pudo eliminar.", false);
    }
  };

  const toggleDisponiblePkg = async (pkg) => {
    try {
      await updateDoc(doc(colRef("paquetes"), pkg.id), { disponible: !pkg.disponible });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const unsub = onSnapshot(colRef("productos"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || (a.orden ?? 999) - (b.orden ?? 999));
      setProductos(list);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const categorias = useMemo(() => {
    const set = new Set(productos.map(p => p.categoria).filter(Boolean));
    CATEGORIAS_SUGERIDAS.forEach(c => set.add(c));
    return Array.from(set);
  }, [productos]);

  const visibles = productos.filter(p => {
    const matchCat = catFiltro === "Todas" || p.categoria === catFiltro;
    const q = busqueda.trim().toLowerCase();
    const matchQ = !q || p.name?.toLowerCase().includes(q) || p.desc?.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2400);
  };

  const handleSave = async (data) => {
    try {
      const isNew = !data.id;

      const payload = {
        name: data.name.trim(),
        desc: data.desc.trim(),
        price: Number(data.price) || 0,
        categoria: data.categoria.trim() || "Otros",
        orden: Number(data.orden) || 0,
        disponible: !!data.disponible,
        tags: data.tags || [],
        hasProtein: !!data.hasProtein,
        hasBurgerProtein: !!data.hasBurgerProtein,
        sauceOptions: data.sauceOptions || "",
        isSushi: !!data.isSushi,
        hasExtras: !!data.hasExtras,
        imagen: data.imagen?.trim() || null,
        actualizadoEn: serverTimestamp(),
      };

      if (isNew) {
        payload.creadoEn = serverTimestamp();
        await addDoc(colRef("productos"), payload);
        showToast("Producto creado ✓");
      } else {
        await updateDoc(doc(colRef("productos"), data.id), payload);
        showToast("Cambios guardados ✓");
      }
      setEditing(null);
      setCreating(false);
    } catch (e) {
      console.error("[GestorMenu] error guardando:", e);
      showToast("Error al guardar. Intenta de nuevo.", false);
    }
  };

  const handleDelete = async (producto) => {
    if (!window.confirm(`¿Eliminar "${producto.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(colRef("productos"), producto.id));
      showToast("Producto eliminado");
    } catch (e) {
      console.error("[GestorMenu] error eliminando:", e);
      showToast("No se pudo eliminar.", false);
    }
  };

  const toggleDisponible = async (producto) => {
    try {
      await updateDoc(doc(colRef("productos"), producto.id), { disponible: !producto.disponible });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: "18px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @keyframes toastIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .gm-card { transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s; }
        .gm-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px #00000022; }
        .gm-card img { transition: transform .4s ease; }
        .gm-card:hover img { transform: scale(1.08); }
        .gm-add-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .gm-chip:hover { filter: brightness(1.05); }
        .gm-cat-btn:hover { color: ${G.gold} !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ color: G.dark, fontFamily: "Georgia,serif", margin: "0 0 2px" }}>🍽️ Gestor de Menú</h2>
          <p style={{ color: G.textSub, fontSize: 12, margin: 0 }}>
            Edita productos, precios, fotos y disponibilidad. Se refleja al instante en el menú del cliente y en el punto de venta.
          </p>
        </div>
        <button
          id={vistaTab === "productos" ? "btn-nuevo-producto" : "btn-nuevo-paquete"}
          className="gm-add-btn"
          onClick={() => vistaTab === "productos" ? setCreating(true) : setCreatingPkg(true)}
          style={{
            padding: "11px 20px", borderRadius: 10, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg,${G.gold},${G.goldLight})`, color: G.dark,
            fontWeight: 900, fontSize: 14, boxShadow: `0 4px 16px ${G.gold}44`, transition: "all .15s",
            whiteSpace: "nowrap",
          }}>
          {vistaTab === "productos" ? "+ Nuevo producto" : "+ Nuevo paquete"}
        </button>
      </div>

      {/* Tabs: Productos / Paquetes */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f5f1ea",
        borderRadius: 10, padding: 4, width: "fit-content", border: `1px solid ${G.divider}` }}>
        {[
          { key: "productos", label: "🍽️ Productos" },
          { key: "paquetes",  label: "📦 Paquetes" },
        ].map(t => (
          <button key={t.key} onClick={() => setVistaTab(t.key)} style={{
            padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, transition: "all .15s",
            background: vistaTab === t.key ? G.gold : "transparent",
            color: vistaTab === t.key ? G.dark : G.textSub,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 18, right: 18, zIndex: 9999,
          background: toast.ok ? "#1a7a40" : "#c0392b", color: "#fff",
          padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
          boxShadow: "0 8px 24px #0004", animation: "toastIn .2s ease",
        }}>
          {toast.ok ? "✓ " : "⚠ "}{toast.msg}
        </div>
      )}

      {/* ── VISTA PRODUCTOS ── */}
      {vistaTab === "productos" && (<>
        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            id="gm-busqueda"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar producto…"
            style={{
              flex: "1 1 220px", padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${G.divider}`,
              fontSize: 13, fontFamily: "inherit", color: G.dark, outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
            {["Todas", ...categorias].map(c => (
              <button key={c} className="gm-cat-btn" onClick={() => setCatFiltro(c)} style={{
                padding: "7px 14px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
                border: `1.5px solid ${catFiltro === c ? G.gold : G.divider}`,
                background: catFiltro === c ? G.gold : "#fff",
                color: catFiltro === c ? G.dark : G.textSub,
                fontWeight: 700, fontSize: 12, transition: "all .15s",
              }}>{c}</button>
            ))}
          </div>
        </div>

        {loading && <p style={{ textAlign: "center", color: G.textSub, padding: 40 }}>Cargando productos…</p>}

        {!loading && visibles.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <p style={{ fontSize: 38, margin: "0 0 8px" }}>🍱</p>
            <p style={{ color: G.textSub, margin: "0 0 16px" }}>
              {productos.length === 0 ? "Todavía no hay productos en el menú." : "Nada coincide con tu búsqueda."}
            </p>
            {productos.length === 0 && (
              <button onClick={() => setCreating(true)} style={{
                padding: "10px 20px", borderRadius: 9, border: "none", cursor: "pointer",
                background: G.gold, color: G.dark, fontWeight: 800, fontSize: 13,
              }}>+ Agregar el primer producto</button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
          {visibles.map(p => (
            <ProductCard
              key={p.id}
              producto={p}
              G={G}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
              onToggleDisponible={() => toggleDisponible(p)}
            />
          ))}
        </div>

        {(editing || creating) && (
          <ProductEditor
            producto={editing || EMPTY_PRODUCT}
            categoriasSugeridas={categorias}
            G={G}
            onClose={() => { setEditing(null); setCreating(false); }}
            onSave={handleSave}
          />
        )}
      </>)}

      {/* ── VISTA PAQUETES ── */}
      {vistaTab === "paquetes" && (<>
        <div style={{ background: "#fff8ee", borderRadius: 10, padding: "10px 14px",
          border: `1px solid ${G.divider}`, marginBottom: 16 }}>
          <p style={{ color: G.textSub, fontSize: 12, margin: 0 }}>
            Los paquetes combinan varios platillos a un precio especial. Aparecen en la pestaña
            <strong> 📦 Paquetes</strong> del Punto de Venta y pueden mostrarse en el menú del cliente.
          </p>
        </div>

        {loadingPkgs && <p style={{ color: G.textSub, textAlign: "center", padding: 40 }}>Cargando paquetes…</p>}

        {!loadingPkgs && paquetes.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <p style={{ fontSize: 38, margin: "0 0 8px" }}>📦</p>
            <p style={{ color: G.textSub, margin: "0 0 16px" }}>Todavía no hay paquetes.</p>
            <button onClick={() => setCreatingPkg(true)} style={{
              padding: "10px 20px", borderRadius: 9, border: "none", cursor: "pointer",
              background: G.gold, color: G.dark, fontWeight: 800, fontSize: 13,
            }}>+ Crear el primer paquete</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {paquetes.map(pkg => (
            <div key={pkg.id} className="gm-card" style={{
              background: G.cardBg, borderRadius: 14, overflow: "hidden",
              border: `1.5px solid ${G.divider}`, boxShadow: "0 2px 10px #0001",
              opacity: pkg.disponible === false ? 0.6 : 1,
            }}>
              <div style={{ background: `${G.gold}14`, padding: "14px 16px 10px",
                borderBottom: `1px solid ${G.divider}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>📦</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: G.dark, fontWeight: 900, fontSize: 15, margin: 0,
                      fontFamily: "Georgia,serif" }}>{pkg.nombre}</p>
                    {pkg.descripcion && <p style={{ color: G.textSub, fontSize: 12, margin: "2px 0 0" }}>{pkg.descripcion}</p>}
                  </div>
                  <p style={{ color: G.gold, fontWeight: 900, fontSize: 20, margin: 0,
                    fontFamily: "Georgia,serif" }}>${pkg.precio}</p>
                </div>
                {pkg.disponible === false && (
                  <span style={{ background: "#c0392b", color: "#fff", fontSize: 10,
                    fontWeight: 800, padding: "2px 8px", borderRadius: 8 }}>OCULTO</span>
                )}
              </div>
              <div style={{ padding: "12px 16px" }}>
                <p style={{ color: G.textSub, fontSize: 10, fontWeight: 800, margin: "0 0 7px",
                  letterSpacing: 1 }}>INCLUYE</p>
                {(pkg.items || []).map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between",
                    padding: "4px 0", borderBottom: i < pkg.items.length - 1 ? `1px solid ${G.divider}44` : "none" }}>
                    <span style={{ color: G.dark, fontSize: 13, fontWeight: 700 }}>
                      {it.cantidad > 1 ? `${it.cantidad}× ` : ""}{it.nombre}
                    </span>
                    {it.descripcion && <span style={{ color: G.textSub, fontSize: 11 }}>{it.descripcion}</span>}
                  </div>
                ))}
                {(!pkg.items || pkg.items.length === 0) && (
                  <p style={{ color: G.textSub, fontSize: 12, fontStyle: "italic" }}>Sin items definidos</p>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button onClick={() => toggleDisponiblePkg(pkg)} title={pkg.disponible===false?"Mostrar":"Ocultar"} style={{
                    border: `1.5px solid ${G.divider}`, background: "#fff", borderRadius: 8,
                    cursor: "pointer", padding: "5px 8px", fontSize: 13,
                  }}>{pkg.disponible === false ? "🙈" : "👁️"}</button>
                  <button onClick={() => setEditingPkg(pkg)} style={{
                    flex: 1, border: `1.5px solid ${G.gold}`, background: "transparent", color: G.gold,
                    borderRadius: 8, cursor: "pointer", padding: "5px 8px", fontSize: 13, fontWeight: 700,
                  }}>✏️ Editar</button>
                  <button onClick={() => deletePaquete(pkg)} style={{
                    border: "1.5px solid #e74c3c44", background: "transparent", color: "#c0392b",
                    borderRadius: 8, cursor: "pointer", padding: "5px 8px", fontSize: 13,
                  }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(editingPkg || creatingPkg) && (
          <PaqueteEditor
            paquete={editingPkg || { nombre:"", descripcion:"", precio:"", orden:0, disponible:true, items:[] }}
            G={G}
            onClose={() => { setEditingPkg(null); setCreatingPkg(false); }}
            onSave={savePaquete}
          />
        )}
      </>)}
    </div>
  );
}

// ── ProductCard ──────────────────────────────────────────────────────
function ProductCard({ producto, G, onEdit, onDelete, onToggleDisponible }) {
  const p = producto;
  return (
    <div className="gm-card" style={{
      background: G.cardBg, borderRadius: 14, overflow: "hidden",
      border: `1.5px solid ${G.divider}`, boxShadow: "0 2px 10px #0001",
      opacity: p.disponible === false ? 0.6 : 1, display: "flex", flexDirection: "column",
    }}>
      <div style={{ position: "relative", width: "100%", height: 130, background: G.warmGray, overflow: "hidden" }}>
        {p.imagen ? (
          <img src={p.imagen} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, color: G.divider }}>
            🍽️
          </div>
        )}
        {p.disponible === false && (
          <span style={{
            position: "absolute", top: 8, left: 8, background: "#c0392b", color: "#fff",
            fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 8,
          }}>OCULTO</span>
        )}
        <span style={{
          position: "absolute", top: 8, right: 8, background: G.dark, color: G.goldLight,
          fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 8, letterSpacing: .5,
        }}>{p.categoria}</span>
      </div>

      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        <p style={{ color: G.gold, fontWeight: 800, fontSize: 14.5, margin: "0 0 3px", fontFamily: "Georgia,serif" }}>{p.name}</p>
        <p style={{ color: G.textSub, fontSize: 12, margin: "0 0 6px", lineHeight: 1.4, flex: 1 }}>{p.desc}</p>

        {p.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {p.tags.map(t => (
              <span key={t} style={{
                background: `${TAG_COLORS[t]}18`, color: TAG_COLORS[t], borderRadius: 10,
                padding: "1px 7px", fontSize: 10, fontWeight: 800, border: `1px solid ${TAG_COLORS[t]}33`,
              }}>{TAG_ICONS[t]} {t}</span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <p style={{ color: G.dark, fontWeight: 900, fontSize: 17, margin: 0, fontFamily: "Georgia,serif" }}>${p.price}</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onToggleDisponible} title={p.disponible === false ? "Mostrar en menú" : "Ocultar del menú"} style={{
              border: `1.5px solid ${G.divider}`, background: "#fff", borderRadius: 8, cursor: "pointer",
              padding: "5px 8px", fontSize: 13,
            }}>{p.disponible === false ? "🙈" : "👁️"}</button>
            <button onClick={onEdit} style={{
              border: `1.5px solid ${G.gold}`, background: "transparent", color: G.gold, borderRadius: 8,
              cursor: "pointer", padding: "5px 8px", fontSize: 13, fontWeight: 700,
            }}>✏️</button>
            <button onClick={onDelete} style={{
              border: "1.5px solid #e74c3c44", background: "transparent", color: "#c0392b", borderRadius: 8,
              cursor: "pointer", padding: "5px 8px", fontSize: 13,
            }}>🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ProductEditor (modal crear/editar) ────────────────────────────────
function ProductEditor({ producto, categoriasSugeridas, G, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, ...producto });
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleTag = (t) => set("tags", form.tags.includes(t) ? form.tags.filter(x => x !== t) : [...form.tags, t]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { alert("Ingresa el nombre del producto."); return; }
    if (!form.price || Number(form.price) <= 0) { alert("Ingresa un precio válido."); return; }
    if (!form.categoria.trim()) { alert("Ingresa o elige una categoría."); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const isSushiCat = form.categoria === "Sushi" || form.isSushi;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,6,2,.7)", zIndex: 9998,
      display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)",
      padding: 16,
    }}>
      <div style={{
        background: G.offWhite, borderRadius: 18, width: "100%", maxWidth: 520,
        maxHeight: "92vh", overflowY: "auto", border: `1.5px solid ${G.gold}55`,
        boxShadow: "0 24px 60px #0008",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${G.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: G.offWhite, zIndex: 1,
        }}>
          <p style={{ margin: 0, fontWeight: 900, color: G.dark, fontSize: 16, fontFamily: "Georgia,serif" }}>
            {producto.id ? "✏️ Editar producto" : "+ Nuevo producto"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: G.textSub }}>✕</button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Imagen */}
          <div>
            <FieldLabel G={G}>Foto del producto (link)</FieldLabel>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 90, height: 90, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                background: G.warmGray, display: "flex", alignItems: "center", justifyContent: "center",
                border: `1.5px solid ${G.divider}`,
              }}>
                {form.imagen && !imgError
                  ? <img src={form.imagen} alt="preview" onError={() => setImgError(true)}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 28, color: G.divider }}>🍽️</span>}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  id="gm-field-imagen"
                  value={form.imagen || ""}
                  onChange={e => { set("imagen", e.target.value); setImgError(false); }}
                  placeholder="https://i.imgur.com/xxxxx.jpg"
                  style={inputStyle(G)}
                />
                {imgError && form.imagen && (
                  <p style={{ color: "#c0392b", fontSize: 11, margin: "5px 0 0" }}>
                    No se pudo cargar esa imagen. Revisa que el link sea directo a la foto.
                  </p>
                )}
                <p style={{ color: G.textSub, fontSize: 11, margin: "5px 0 0", lineHeight: 1.4 }}>
                  Sube tu foto a <strong>imgur.com</strong> o <strong>postimages.org</strong> (gratis, sin cuenta)
                  y pega aquí el link directo a la imagen. Déjalo vacío si no tienes foto.
                </p>
                {form.imagen && (
                  <button onClick={() => { set("imagen", ""); setImgError(false); }} style={{ ...smallBtnStyle(G), color: "#c0392b", borderColor: "#e74c3c55", marginTop: 6 }}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nombre / descripción */}
          <div>
            <FieldLabel G={G}>Nombre</FieldLabel>
            <input id="gm-field-name" value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle(G)} placeholder="Ej. Torito roll" />
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <FieldLabel G={G}>Descripción</FieldLabel>
              <button
                type="button"
                onClick={() => set("desc", genericDescFor(form.categoria))}
                style={{ background:"none", border:"none", color:G.gold, fontSize:11, fontWeight:700,
                  cursor:"pointer", padding:"0 0 6px", textDecoration:"underline" }}>
                Usar descripción genérica
              </button>
            </div>
            <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={2}
              style={{ ...inputStyle(G), resize: "none" }} placeholder="Ingredientes o detalle breve" />
          </div>

          {/* Precio / categoría / orden */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel G={G}>Precio ($)</FieldLabel>
              <input id="gm-field-price" type="number" min="0" value={form.price} onChange={e => set("price", e.target.value)} style={inputStyle(G)} />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel G={G}>Orden</FieldLabel>
              <input type="number" value={form.orden} onChange={e => set("orden", e.target.value)} style={inputStyle(G)} />
            </div>
          </div>

          <div>
            <FieldLabel G={G}>Categoría</FieldLabel>
            <input id="gm-field-categoria" value={form.categoria} onChange={e => set("categoria", e.target.value)} style={inputStyle(G)}
              placeholder="Ej. Sushi" list="gm-categorias-sugeridas" />
            <datalist id="gm-categorias-sugeridas">
              {categoriasSugeridas.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Disponible */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={form.disponible} onChange={e => set("disponible", e.target.checked)} />
            <span style={{ fontSize: 13, color: G.dark, fontWeight: 700 }}>Visible en el menú del cliente</span>
          </label>

          {/* Tags */}
          <div>
            <FieldLabel G={G}>Etiquetas</FieldLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ALL_TAGS.map(t => (
                <button key={t} className="gm-chip" onClick={() => toggleTag(t)} style={{
                  padding: "5px 13px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  border: `1.5px solid ${form.tags.includes(t) ? TAG_COLORS[t] : G.divider}`,
                  background: form.tags.includes(t) ? TAG_COLORS[t] : "transparent",
                  color: form.tags.includes(t) ? "#fff" : G.textSub, transition: "all .15s",
                }}>{TAG_ICONS[t]} {t}</button>
              ))}
            </div>
          </div>

          {/* Opciones de personalización */}
          <div style={{ background: "#fff8ee", borderRadius: 10, padding: "12px 14px", border: `1px solid ${G.divider}` }}>
            <FieldLabel G={G}>Opciones de personalización</FieldLabel>
            <CheckRow G={G} label="Pide proteína (sushi)" checked={form.hasProtein} onChange={v => set("hasProtein", v)} />
            <CheckRow G={G} label="Pide carne (hamburguesa)" checked={form.hasBurgerProtein} onChange={v => set("hasBurgerProtein", v)} />
            <CheckRow G={G} label="Es un rollo de sushi (preparación, alga, extras, bomba)" checked={form.isSushi} onChange={v => set("isSushi", v)} />
            <CheckRow G={G} label="Permite proteína extra (platillos)" checked={form.hasExtras} onChange={v => set("hasExtras", v)} />
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 12, color: G.textSub, margin: "0 0 6px", fontWeight: 700 }}>Opciones de salsa</p>
              <div style={{ display: "flex", gap: 6 }}>
                {[["", "Ninguna"], ["roll", "Salsas de roll"], ["boneless", "Salsas de boneless"]].map(([val, label]) => (
                  <button key={val} onClick={() => set("sauceOptions", val)} style={{
                    flex: 1, padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700,
                    border: `1.5px solid ${form.sauceOptions === val ? G.gold : G.divider}`,
                    background: form.sauceOptions === val ? G.gold : "#fff",
                    color: form.sauceOptions === val ? G.dark : G.textSub,
                  }}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: `1.5px solid ${G.divider}`,
              background: "transparent", color: G.textSub, fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Cancelar</button>
            <button id="gm-btn-guardar" onClick={handleSubmit} disabled={saving} style={{
              flex: 2, padding: "12px", borderRadius: 10, border: "none",
              background: saving ? "#d4cfc6" : `linear-gradient(135deg,${G.gold},${G.goldLight})`,
              color: G.dark, fontWeight: 900, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : `0 4px 16px ${G.gold}44`,
            }}>{saving ? "Guardando…" : "Guardar producto"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children, G }) {
  return <p style={{ color: G.textSub, fontSize: 10, fontWeight: 800, margin: "0 0 5px", letterSpacing: 1 }}>{children.toString().toUpperCase()}</p>;
}

function CheckRow({ label, checked, onChange, G }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span style={{ fontSize: 12.5, color: G.dark }}>{label}</span>
    </label>
  );
}

const inputStyle = (G) => ({
  width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8,
  border: `1.5px solid ${G.divider}`, fontSize: 13, fontFamily: "inherit",
  background: "#fff", color: G.dark, outline: "none",
});

const smallBtnStyle = (G) => ({
  padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${G.gold}`, background: "transparent",
  color: G.gold, fontWeight: 700, fontSize: 12, cursor: "pointer",
});

// ── PaqueteEditor ────────────────────────────────────────────────────
function PaqueteEditor({ paquete, G, onClose, onSave }) {
  const [form, setForm] = useState({ ...paquete });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const setItem = (i, k, v) => {
    const items = [...(form.items || [])];
    items[i] = { ...items[i], [k]: v };
    set("items", items);
  };
  const addItem = () => set("items", [...(form.items || []), { nombre: "", cantidad: 1, descripcion: "" }]);
  const removeItem = (i) => set("items", (form.items || []).filter((_, j) => j !== i));

  const handleSubmit = async () => {
    if (!form.nombre?.trim()) { alert("El nombre del paquete es obligatorio."); return; }
    if (!form.precio || Number(form.precio) <= 0) { alert("Ingresa un precio válido."); return; }
    if (!form.items?.some(it => it.nombre?.trim())) { alert("Agrega al menos un item al paquete."); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,6,2,.7)", zIndex: 9998,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(3px)", padding: 16 }}>
      <div style={{ background: G.offWhite, borderRadius: 18, width: "100%", maxWidth: 520,
        maxHeight: "92vh", overflowY: "auto", border: `1.5px solid ${G.gold}55`,
        boxShadow: "0 24px 60px #0008" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${G.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: G.offWhite, zIndex: 1 }}>
          <p style={{ margin: 0, fontWeight: 900, color: G.dark, fontSize: 16, fontFamily: "Georgia,serif" }}>
            {paquete.id ? "✏️ Editar paquete" : "📦 Nuevo paquete"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: G.textSub }}>✕</button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Nombre */}
          <div>
            <FieldLabel G={G}>Nombre del paquete</FieldLabel>
            <input value={form.nombre || ""} onChange={e => set("nombre", e.target.value)}
              style={inputStyle(G)} placeholder="Ej. Paquete familiar" />
          </div>

          {/* Descripción */}
          <div>
            <FieldLabel G={G}>Descripción (opcional)</FieldLabel>
            <input value={form.descripcion || ""} onChange={e => set("descripcion", e.target.value)}
              style={inputStyle(G)} placeholder="Ej. Para 4 personas" />
          </div>

          {/* Precio / Orden */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <FieldLabel G={G}>Precio total del paquete ($)</FieldLabel>
              <input type="number" min="0" value={form.precio || ""} onChange={e => set("precio", e.target.value)}
                style={{ ...inputStyle(G), fontFamily: "Georgia,serif", fontWeight: 900, fontSize: 18 }}
                placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel G={G}>Orden</FieldLabel>
              <input type="number" value={form.orden ?? 0} onChange={e => set("orden", e.target.value)}
                style={inputStyle(G)} />
            </div>
          </div>

          {/* Disponible */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={form.disponible !== false}
              onChange={e => set("disponible", e.target.checked)} />
            <span style={{ fontSize: 13, color: G.dark, fontWeight: 700 }}>
              Visible en el punto de venta y menú del cliente
            </span>
          </label>

          {/* Items */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <FieldLabel G={G}>Items incluidos en el paquete</FieldLabel>
              <button type="button" onClick={addItem} style={{
                background: G.gold, border: "none", borderRadius: 7, padding: "4px 12px",
                color: G.dark, fontWeight: 800, fontSize: 12, cursor: "pointer",
              }}>+ Agregar item</button>
            </div>

            {(form.items || []).map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <div style={{ width: 56, flexShrink: 0 }}>
                  <p style={{ color: G.textSub, fontSize: 9, fontWeight: 800, margin: "0 0 3px", letterSpacing: .5 }}>CANT</p>
                  <input type="number" min="1" value={it.cantidad || 1}
                    onChange={e => setItem(i, "cantidad", parseInt(e.target.value) || 1)}
                    style={{ ...inputStyle(G), padding: "7px 8px", textAlign: "center",
                      fontWeight: 900, fontSize: 14 }} />
                </div>
                <div style={{ flex: 2 }}>
                  <p style={{ color: G.textSub, fontSize: 9, fontWeight: 800, margin: "0 0 3px", letterSpacing: .5 }}>NOMBRE</p>
                  <input value={it.nombre || ""} onChange={e => setItem(i, "nombre", e.target.value)}
                    style={inputStyle(G)} placeholder="Ej. Shekinah roll" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: G.textSub, fontSize: 9, fontWeight: 800, margin: "0 0 3px", letterSpacing: .5 }}>DETALLE</p>
                  <input value={it.descripcion || ""} onChange={e => setItem(i, "descripcion", e.target.value)}
                    style={inputStyle(G)} placeholder="Ej. 500g" />
                </div>
                <button onClick={() => removeItem(i)} style={{
                  background: "none", border: "none", color: "#c0392b",
                  fontSize: 18, cursor: "pointer", padding: "0 4px", marginTop: 16, flexShrink: 0,
                }}>✕</button>
              </div>
            ))}

            {(!form.items || form.items.length === 0) && (
              <div style={{ textAlign: "center", padding: "20px 0", color: G.textSub, fontSize: 12 }}>
                Agrega los platillos o artículos que incluye este paquete.
              </div>
            )}
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: `1.5px solid ${G.divider}`,
              background: "transparent", color: G.textSub, fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={saving} style={{
              flex: 2, padding: "12px", borderRadius: 10, border: "none",
              background: saving ? "#d4cfc6" : `linear-gradient(135deg,${G.gold},${G.goldLight})`,
              color: G.dark, fontWeight: 900, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : `0 4px 16px ${G.gold}44`,
            }}>{saving ? "Guardando…" : "Guardar paquete"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}