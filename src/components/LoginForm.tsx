"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/moderation/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return <form action={action} className="contribution-form"><div className="form-field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required /></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button></form>;
}
