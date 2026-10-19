"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderPoster } from "../lib/poster-render";
import { TEMPLATES, templateById } from "../lib/poster-templates";

type Item = { id: string; title: string; templateId: string; address: string; eventTime: string; status: string; createdAt: string; updatedAt: string };
type ApiBody = { items?: Item[]; error?: string; id?: string; status?: string };
type Editor = { id?: string; title: string; templateId: string; address: string; eventTime: string; logo: File | null; qr: File | null; oldLogo: string; oldQr: string; removeQr: boolean };
const emptyEditor = (): Editor => ({ title: "", templateId: TEMPLATES[0].id, address: "", eventTime: "", logo: null, qr: null, oldLogo: "", oldQr: "", removeQr: false });
const asset = (id: string, kind: string) => `/api/images/${encodeURIComponent(id)}/asset/${kind}`;
async function stage(file: Blob, kind: "logo" | "qr" | "image") {
  if (file.size > 12_000_000) throw new Error("单张图片不得超过 12 MB");
  const partSize = 3_000_000;
  if (file.size > partSize) {
    const uploadId = crypto.randomUUID();
    const total = Math.ceil(file.size / partSize);
    for (let part = 0; part < total; part++) {
      const chunk = file.slice(part * partSize, Math.min(file.size, (part+1) * partSize), file.type);
      const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": file.type, "x-asset-kind": kind, "x-upload-id": uploadId, "x-upload-part": String(part), "x-upload-total": String(total) }, body: chunk });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "素材分片上传失败，请重试");
    }
    const response = await fetch("/api/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId, total, kind, type: file.type }) });
    const body = await response.json().catch(() => ({})) as { uploadId?: string; error?: string };
    if (!response.ok || !body.uploadId) throw new Error(body.error || "素材合并失败，请重试");
    return body.uploadId;
  }
  const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": file.type, "x-asset-kind": kind }, body: file });
  const body = await response.json().catch(() => ({})) as { uploadId?: string; error?: string };
  if (!response.ok || !body.uploadId) throw new Error(body.error || "素材上传失败，请重试");
  return body.uploadId;
}

export default function Studio({ phone }: { phone: string }) {
  const [view, setView] = useState<"records" | "editor">("records");
  const [items, setItems] = useState<Item[]>([]);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const savedBlob = useRef<Blob | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/images", { cache: "no-store" });
      const body = await res.json() as ApiBody;
      if (res.ok) setItems(body.items || []); else setMessage(body.error || "读取记录失败");
    } catch { setMessage("网络暂时不可用，请重试"); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (view !== "editor" || !canvas.current) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const draft = document.createElement("canvas");
        await renderPoster(draft, { templateId: editor.templateId, address: editor.address, eventTime: editor.eventTime, logo: editor.logo || editor.oldLogo, qr: editor.removeQr ? null : editor.qr || editor.oldQr });
        if (!cancelled && canvas.current) {
          canvas.current.width = draft.width; canvas.current.height = draft.height;
          canvas.current.getContext("2d")?.drawImage(draft,0,0);
          setRevision(value => value + 1); setMessage("");
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "预览失败"); }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [view, editor]);
  const begin = () => { savedBlob.current = null; setEditor(emptyEditor()); setComplete(false); setMessage(""); setView("editor"); };
  const edit = (item: Item) => {
    savedBlob.current = null;
    setEditor({ id: item.id, title: item.title, templateId: templateById(item.templateId).id, address: item.address, eventTime: item.eventTime, logo: null, qr: null, oldLogo: asset(item.id, "logo") + `?v=${encodeURIComponent(item.updatedAt)}`, oldQr: item.status === "complete" ? asset(item.id, "qr") + `?v=${encodeURIComponent(item.updatedAt)}` : "", removeQr: false });
    setComplete(false); setMessage(""); setView("editor");
  };
  const update = (change: Partial<Editor>) => setEditor(current => ({ ...current, ...change }));
  const save = async () => {
    if (!editor.address.trim() || !editor.eventTime.trim() || (!editor.logo && !editor.oldLogo)) { setMessage("请填写时间、地点并上传律所 Logo。二维码可稍后补充。"); return; }
    setBusy(true); setMessage("");
    try {
      const template = templateById(editor.templateId);
      // Preview rendering is debounced and may still be active. A separate
      // canvas makes the saved JPG immune to overlapping template changes.
      const exportCanvas = document.createElement("canvas");
      await renderPoster(exportCanvas, { templateId: editor.templateId, address: editor.address, eventTime: editor.eventTime, logo: editor.logo || editor.oldLogo, qr: editor.removeQr ? null : editor.qr || editor.oldQr });
      const blob = await new Promise<Blob | null>(resolve => exportCanvas.toBlob(resolve, "image/jpeg", .98));
      if (!blob) throw new Error("JPG 生成失败");
      savedBlob.current = blob;
      const [imageUploadId, logoUploadId, qrUploadId] = await Promise.all([
        stage(blob, "image"), editor.logo ? stage(editor.logo, "logo") : Promise.resolve(""), editor.qr ? stage(editor.qr, "qr") : Promise.resolve(""),
      ]);
      const title = editor.title.trim() || `${template.title}培训海报`;
      const form = new FormData();
      form.set("title", title); form.set("address", editor.address.trim()); form.set("eventTime", editor.eventTime.trim()); form.set("templateId", template.id);
      form.set("imageUploadId", imageUploadId);
      if (logoUploadId) form.set("logoUploadId", logoUploadId);
      if (qrUploadId) form.set("qrUploadId", qrUploadId);
      if (editor.removeQr) form.set("removeQr", "1");
      const res = await fetch(editor.id ? `/api/images/${encodeURIComponent(editor.id)}` : "/api/images", { method: editor.id ? "PUT" : "POST", body: form });
      const body = await res.json().catch(() => ({ error: "保存失败" })) as ApiBody;
      if (!res.ok || !body.id) throw new Error(body.error || "保存失败");
      const id = body.id;
      setEditor(current => ({ ...current, id, title, oldLogo: asset(id, "logo") + `?v=${Date.now()}`, oldQr: body.status === "complete" ? asset(id, "qr") + `?v=${Date.now()}` : "", logo: null, qr: null, removeQr: false }));
      setComplete(true); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  };
  const download = () => { if (!savedBlob.current) return; const url = URL.createObjectURL(savedBlob.current); const link = document.createElement("a"); link.href = url; link.download = `${editor.title || "培训海报"}.jpg`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); };
  const selected = templateById(editor.templateId);
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">图</span><span>销售图片工作台</span></div><div className="account"><span className="account-name">{phone.slice(0, 3)}****{phone.slice(-4)}</span><button className="text-button" onClick={() => void logout()} type="button">退出</button></div></header>
    <main className="layout"><aside className="sidebar"><p className="sidebar-label">工作区</p><button className={view === "records" ? "nav active" : "nav"} onClick={() => { setView("records"); setComplete(false); }} type="button">图片记录</button><button className={view === "editor" ? "nav active" : "nav"} onClick={begin} type="button">创建图片</button><div className="sidebar-note"><strong>正式模板已接入</strong><span>五张培训海报可选。律所 Logo 配色会应用到标题和人物背景图形。</span></div></aside>
    <section className="content">{view === "records" ? <><div className="section-head"><div><p className="eyebrow">我的工作台</p><h1>图片记录</h1><p className="subtle">在手机和电脑上登录同一账号，即可查看自己的最新记录。</p></div><button className="primary" onClick={begin} type="button">＋ 创建图片</button></div>{message && <p className="notice" role="alert">{message}</p>}{items.length ? <div className="record-grid">{items.map(item => <article className="record-card" key={item.id}><div className="record-thumb"><img src={asset(item.id,"image") + `?v=${encodeURIComponent(item.updatedAt)}`} alt={`${item.title}的生成图片`} /></div><div className="record-body"><span className={item.status === "complete" ? "badge complete" : "badge pending"}>{item.status === "complete" ? "已完成" : "待补二维码"}</span><h2>{item.title}</h2><p>{item.address}</p><small>更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}</small><div className="record-actions"><button className="secondary" onClick={() => edit(item)} type="button">修改图片</button><a className="text-link" href={asset(item.id,"image") + `?v=${encodeURIComponent(item.updatedAt)}`} download={`${item.title}.jpg`}>查看原图</a></div></div></article>)}</div> : <div className="empty"><div className="empty-shape">＋</div><h2>还没有图片记录</h2><p>选择模板，填写活动信息，就能生成第一张图片。</p><button className="primary" onClick={begin} type="button">开始创建</button></div>}</> : <><div className="section-head"><div><p className="eyebrow">{editor.id ? "编辑已有图片" : "创建新图片"}</p><h1>{editor.id ? "修改图片" : "创建图片"}</h1><p className="subtle">选择模板后替换律所 Logo、日期地点和二维码。</p></div><button className="secondary" onClick={() => { setView("records"); setComplete(false); }} type="button">返回记录</button></div><div className="editor-grid"><div className="form-panel"><div className="step"><span>01</span><div><h2>选择模板</h2><p>五位讲师，各一张模板</p></div></div><div className="template-grid" role="group" aria-label="选择海报模板">{TEMPLATES.map(template => <button key={template.id} type="button" className={editor.templateId === template.id ? "template-card selected" : "template-card"} onClick={() => update({ templateId: template.id })} aria-pressed={editor.templateId === template.id}><img src={`/templates/${template.id}-thumb.jpg`} alt="" /><strong>{template.title}</strong></button>)}</div><div className="step"><span>02</span><div><h2>填写信息</h2><p>地点会按地名和楼层自然换行</p></div></div><label className="field">记录名称 <span className="optional">可选</span><input value={editor.title} maxLength={80} onChange={e => update({ title: e.target.value })} placeholder={`${selected.title}培训海报`} /></label><label className="field">时间<input value={editor.eventTime} maxLength={100} onChange={e => update({ eventTime: e.target.value })} placeholder="2026-10-20 14:30-17:00" /></label><label className="field">地点<textarea value={editor.address} maxLength={240} onChange={e => update({ address: e.target.value })} placeholder="填写省市区、道路门牌及楼层" rows={3} /></label><div className="step"><span>03</span><div><h2>上传素材</h2><p>Logo 建议透明 PNG；二维码建议原始清晰图</p></div></div><label className="upload-field">律所 Logo <span className="required">必填</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => update({ logo: e.target.files?.[0] || null })} /><small>{editor.logo?.name || (editor.oldLogo ? "已使用原 Logo，可重新上传替换" : "点击选择律所 Logo")}</small></label><label className="upload-field">二维码 <span className="optional">可稍后上传</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => update({ qr: e.target.files?.[0] || null, removeQr: false })} /><small>{editor.qr?.name || (editor.oldQr && !editor.removeQr ? "已使用原二维码，可重新上传替换" : "不上传时框内显示“待上传”")}</small></label>{editor.oldQr && !editor.removeQr && <button className="text-button" onClick={() => update({ qr: null, removeQr: true })} type="button">移除当前二维码</button>}{message && <p className="notice" role="alert">{message}</p>}<button className="primary generate" disabled={busy} onClick={() => void save()} type="button">{busy ? "正在生成并保存…" : editor.id ? "重新生成并覆盖" : "生成 JPG"}</button></div><div className="preview-panel"><div className="preview-title"><div><strong>实时预览</strong><p>导出 2484 × {selected.height * 2} px 高清 JPG</p></div><span>{selected.title}</span></div><canvas ref={canvas} aria-label="图片预览" data-revision={revision} /><p className="preview-hint">打印前请核对时间、地址与二维码可扫描性。</p></div></div></>}</section></main>
    {complete && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="complete-title"><button className="modal-close" aria-label="关闭完成提示" onClick={() => setComplete(false)} type="button">×</button><div className="success-mark">✓</div><h2 id="complete-title">图片已生成并保存</h2><p>已加入「图片记录」。后续可以补二维码或修改信息，并覆盖这条记录。</p><div className="modal-actions"><button className="primary" onClick={download} type="button">导出高清 JPG</button><button className="secondary" onClick={() => setComplete(false)} type="button">继续修改</button></div></div></div>}
  </div>;
}
