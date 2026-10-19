"use client";

import { useState, type FormEvent } from "react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || (mode === "login" ? "登录失败" : "注册失败"));
      window.location.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请重试"); setBusy(false); }
  };
  return <main className="login-shell"><div className="login-brand"><span className="brand-mark">图</span><span>销售图片工作台</span></div><section className="login-card"><p className="eyebrow">销售专属工作区</p><h1>{mode === "login" ? "登录账号" : "注册账号"}</h1><p className="subtle">用手机号和密码访问。每位销售只查看自己创建的图片记录。</p><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }} type="button">登录</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }} type="button">注册</button></div><form onSubmit={event => void submit(event)}><label className="field">手机号<input inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="请输入中国大陆手机号" maxLength={20} required /></label><label className="field">密码<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "login" ? "请输入密码" : "设置至少 8 位密码"} minLength={mode === "login" ? 1 : 8} maxLength={128} required /></label>{error && <p className="notice" role="alert">{error}</p>}<button className="primary generate" disabled={busy} type="submit">{busy ? "正在处理…" : mode === "login" ? "登录" : "注册并进入"}</button></form><p className="login-note">手机号仅作为账号名使用，当前不发送短信验证码。请妥善保管密码。</p></section></main>;
}
