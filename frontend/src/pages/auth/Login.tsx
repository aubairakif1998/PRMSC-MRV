import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import logo from "../../assets/prmsc-logo.png";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { useAuth } from "../../contexts/AuthContext";

type LoginLocationState = { message?: string };

const readApiErrorMessage = (error: unknown) => {
  if (typeof error !== "object" || error === null) return null;
  const maybeResponse = (error as Record<string, unknown>).response;
  if (typeof maybeResponse !== "object" || maybeResponse === null) return null;
  const maybeData = (maybeResponse as Record<string, unknown>).data;
  if (typeof maybeData !== "object" || maybeData === null) return null;
  const maybeMessage = (maybeData as Record<string, unknown>).message;
  return typeof maybeMessage === "string" ? maybeMessage : null;
};

const getErrorMessage = (error: unknown, fallback = "Login failed") => {
  const apiMessage = readApiErrorMessage(error);
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getRedirectPathFromStorage = () => {
  const savedUserRaw = localStorage.getItem("mrv_user");
  if (!savedUserRaw) return "/submissions";
  try {
    const savedUser = JSON.parse(savedUserRaw) as { role?: string };
    return savedUser?.role === "operator" ? "/operator" : "/submissions";
  } catch {
    return "/submissions";
  }
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as LoginLocationState | null)?.message;

  useEffect(() => {
    if (!successMessage) return;
    toast.success(successMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, successMessage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        const message = result.message || "Invalid email or password";
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      setErrorMessage("");
      navigate(getRedirectPathFromStorage(), { replace: true });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Login failed");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-4xl overflow-hidden shadow-lg">
        <div className="grid md:grid-cols-5">
          {/* Branding panel */}
          <div className="hidden flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary to-primary/80 px-8 py-12 text-primary-foreground md:col-span-2 md:flex">
            <img
              src={logo}
              alt="PRMSC logo"
              className="h-28 w-auto object-contain drop-shadow-lg"
            />
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold tracking-tight">MRV Portal</h2>
              <p className="text-sm leading-relaxed text-primary-foreground/80">
                Monitoring, Reporting &amp; Verification System for Punjab Rural
                Municipal Services Company
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {["Water Systems", "Solar Energy", "Carbon Offsets"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary-foreground/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Form panel */}
          <CardContent className="flex flex-col justify-center space-y-6 p-8 md:col-span-3 md:p-10">
            {/* Mobile-only logo */}
            <div className="flex flex-col items-center gap-2 md:hidden">
              <img
                src={logo}
                alt="PRMSC logo"
                className="h-20 w-auto object-contain"
              />
              <h1 className="text-lg font-bold text-primary">MRV Portal</h1>
              <Separator className="mt-2" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to your account to continue
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@prmsc.org.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              {errorMessage ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}

              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-primary hover:underline"
              >
                Create one
              </Link>
            </p>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default Login;
