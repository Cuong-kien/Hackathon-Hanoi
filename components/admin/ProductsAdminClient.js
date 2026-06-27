"use client";
import { useEffect, useState } from "react";

const CATEGORIES = ["chair", "table", "lamp", "rug", "art", "decor", "plant", "shelf"];
const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + "₫";
const EMPTY = { name: "", price: "", category: "decor", realWidthCm: "", placementHint: "", material: "", dims: "", desc: "", thumbnail: "", cutoutImage: "", tags: {} };

export default function ProductsAdmin() {
  const [shops, setShops] = useState(null);
  const [active, setActive] = useState(null);
  const [editing, setEditing] = useState(null); // null | {mode:'new'|'edit', form, id}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const r = await fetch("/api/admin/products");
    const j = await r.json();
    if (j.ok) {
      setShops(j.shops);
      setActive((a) => a || j.shops[0]?.slug);
    } else setErr(j.error || "Lỗi tải");
  }
  useEffect(() => {
    load();
  }, []);

  const shop = shops?.find((s) => s.slug === active);

  function openNew() {
    setErr("");
    setEditing({ mode: "new", id: null, form: { ...EMPTY } });
  }
  function openEdit(p) {
    setErr("");
    setEditing({
      mode: "edit",
      id: p.id,
      form: {
        name: p.name, price: p.price, category: p.category, realWidthCm: p.realWidthCm || "",
        placementHint: p.placementHint || "", material: p.material || "", dims: p.dims || "",
        desc: p.desc || "", thumbnail: p.thumbnail || "", cutoutImage: p.cutoutImage || "",
        tags: stripDerived(p.tags),
      },
    });
  }
  function stripDerived(tags) {
    const t = { ...(tags || {}) };
    delete t.kichThuoc;
    delete t.tamGia;
    return t;
  }

  function setField(k, v) {
    setEditing((e) => ({ ...e, form: { ...e.form, [k]: v } }));
  }

  async function uploadImage(file) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("shop", active);
    fd.append("name", editing.form.name || "anh");
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await r.json();
    setBusy(false);
    if (j.ok) {
      setField("thumbnail", j.path);
      setField("cutoutImage", j.path);
    } else setErr(j.error || "Upload lỗi");
  }

  async function autotag() {
    setBusy(true);
    const r = await fetch("/api/admin/autotag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: editing.form.name, desc: editing.form.desc, material: editing.form.material, placementHint: editing.form.placementHint }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) setField("tags", { ...editing.form.tags, ...j.tags });
  }

  async function save() {
    setBusy(true);
    setErr("");
    const f = editing.form;
    const payload = { ...f, price: Number(f.price) || 0, realWidthCm: f.realWidthCm ? Number(f.realWidthCm) : null };
    let r;
    if (editing.mode === "new") {
      r = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop: active, ...payload }),
      });
    } else {
      r = await fetch(`/api/admin/products/${editing.id}?shop=${active}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const j = await r.json();
    setBusy(false);
    if (j.ok) {
      setEditing(null);
      load();
    } else setErr(j.error || "Lưu lỗi");
  }

  async function remove(p) {
    if (!confirm(`Xoá "${p.name}"?`)) return;
    await fetch(`/api/admin/products/${p.id}?shop=${active}`, { method: "DELETE" });
    load();
  }

  if (!shops) return <p className="text-neutral-500">Đang tải…</p>;

  const tagChips = editing ? Object.values(stripDerived(editing.form.tags)).flat().filter(Boolean) : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <button onClick={openNew} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Thêm sản phẩm
        </button>
      </div>

      {/* Tabs shop */}
      <div className="mt-5 flex flex-wrap gap-2">
        {shops.map((s) => (
          <button
            key={s.slug}
            onClick={() => setActive(s.slug)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${active === s.slug ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50"}`}
          >
            {s.name} <span className="opacity-60">({s.products.length})</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Sản phẩm</th>
              <th className="px-4 py-3 font-medium">Giá</th>
              <th className="px-4 py-3 font-medium">Tag</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shop?.products.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnail} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-black/5" />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-400">{p.category} · {p.dims || "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">{fmt(p.price)}</td>
                <td className="px-4 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {(p.tagList || []).slice(0, 5).map((t, i) => (
                      <span key={i} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(p)} className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">Sửa</button>
                  <button onClick={() => remove(p)} className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50">Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.mode === "new" ? "Thêm sản phẩm" : "Sửa sản phẩm"}</h2>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-900">✕</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Tên sản phẩm" className="col-span-2">
                <input value={editing.form.name} onChange={(e) => setField("name", e.target.value)} className="inp" />
              </Field>
              <Field label="Giá (VND)">
                <input type="number" value={editing.form.price} onChange={(e) => setField("price", e.target.value)} className="inp" />
              </Field>
              <Field label="Danh mục">
                <select value={editing.form.category} onChange={(e) => setField("category", e.target.value)} className="inp">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Chiều rộng thật (cm)">
                <input type="number" value={editing.form.realWidthCm} onChange={(e) => setField("realWidthCm", e.target.value)} className="inp" />
              </Field>
              <Field label="Kích thước (mô tả)">
                <input value={editing.form.dims} onChange={(e) => setField("dims", e.target.value)} className="inp" placeholder="vd: 120 × 60 × cao 75 cm" />
              </Field>
              <Field label="Chất liệu" className="col-span-2">
                <input value={editing.form.material} onChange={(e) => setField("material", e.target.value)} className="inp" />
              </Field>
              <Field label="Gợi ý bài trí (placement)" className="col-span-2">
                <input value={editing.form.placementHint} onChange={(e) => setField("placementHint", e.target.value)} className="inp" />
              </Field>
              <Field label="Mô tả" className="col-span-2">
                <textarea rows={3} value={editing.form.desc} onChange={(e) => setField("desc", e.target.value)} className="inp" />
              </Field>

              {/* Ảnh */}
              <Field label="Ảnh sản phẩm" className="col-span-2">
                <div className="flex items-center gap-3">
                  {editing.form.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.form.thumbnail} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/5" />
                  )}
                  <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0])} className="text-sm" />
                  <input value={editing.form.thumbnail} onChange={(e) => { setField("thumbnail", e.target.value); setField("cutoutImage", e.target.value); }} className="inp flex-1" placeholder="hoặc dán URL ảnh" />
                </div>
              </Field>

              {/* Tags + auto-tag */}
              <Field label="Tag (auto-tag từ mô tả)" className="col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={autotag} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    Auto-tag
                  </button>
                  {tagChips.length === 0 && <span className="text-sm text-neutral-400">Chưa có tag — bấm Auto-tag</span>}
                  {tagChips.map((t, i) => (
                    <span key={i} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{t}</span>
                  ))}
                </div>
              </Field>
            </div>

            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100">Huỷ</button>
              <button onClick={save} disabled={busy || !editing.form.name} className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {busy ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 0.6rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        :global(.inp:focus) { border-color: #171717; }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
