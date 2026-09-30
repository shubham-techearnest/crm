import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { fetchMe, login } from "./authApi";
import { isPlatformScope } from "./AuthContext";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setServerError(null);
    try {
      await login(values.email, values.password);
      const me = await fetchMe();
      navigate(isPlatformScope(me.dataScope) ? "/platform" : "/", { replace: true });
    } catch (error) {
      const message = isAxiosError(error) && error.response?.status === 403
        ? (error.response.data as { message?: string } | undefined)?.message
        : undefined;
      setServerError(message ?? "Invalid email or password.");
    }
  }

  return (
    <div className="auth-card">
      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="app-brand-mark">TE</span>
        <div>
          <div className="fw-semibold">TechEarnest CRM</div>
          <div className="text-muted small">Project and resource platform</div>
        </div>
      </div>
      <h1 className="h4 mb-3">Sign in</h1>
      {serverError ? <div className="alert alert-danger py-2">{serverError}</div> : null}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="username"
          required
          error={errors.email}
          {...register("email")}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password}
          {...register("password")}
        />
        <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="form-text mt-2 mb-0">Sign in with the account provided by your organization administrator.</p>
      </form>
    </div>
  );
}
