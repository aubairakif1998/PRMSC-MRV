import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";

import logo from "../../assets/prmsc-logo.png";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useAuthApi } from "../../hooks";
import type { RegisterInput } from "../../services/authService";

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  role: string;
};

const readApiErrorMessage = (error: unknown) => {
  if (typeof error !== "object" || error === null) return null;
  const maybeResponse = (error as Record<string, unknown>).response;
  if (typeof maybeResponse !== "object" || maybeResponse === null) return null;
  const maybeData = (maybeResponse as Record<string, unknown>).data;
  if (typeof maybeData !== "object" || maybeData === null) return null;
  const maybeMessage = (maybeData as Record<string, unknown>).message;
  return typeof maybeMessage === "string" ? maybeMessage : null;
};

const getErrorMessage = (error: unknown, fallback = "Registration failed") => {
  const apiMessage = readApiErrorMessage(error);
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const ROLES = [
  {
    value: "operator",
    label: "Operator",
    desc: "Submit field data and meter readings",
  },
  {
    value: "analyst",
    label: "Analyst",
    desc: "Verify submissions and run analytics",
  },
  {
    value: "environment_manager",
    label: "Environment Manager",
    desc: "Approve verified data and oversee emissions",
  },
  {
    value: "operations_department",
    label: "Operations Department",
    desc: "Monitor program-wide operations",
  },
] as const;

const Register = () => {
  const { registerUser } = useAuthApi();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<RegisterForm>({
    name: "",
    email: "",
    password: "",
    role: "operator",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (value: string | null) => {
    if (!value) return;
    setFormData({ ...formData, role: value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const response = (await registerUser(formData as RegisterInput)) as {
        message?: string;
      };
      toast.success(
        response?.message || "Account created. You can now sign in.",
      );
      setTimeout(() => {
        navigate("/login", {
          state: { message: "Account created. Please sign in." },
        });
      }, 1200);
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, "Registration failed. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-4xl overflow-hidden shadow-lg">
        <div className="grid md:grid-cols-5">
          {/* Branding panel */}
          <div className="hidden flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary to-primary/80 px-8 py-12 text-secondary-foreground md:col-span-2 md:flex">
            <img
              src={logo}
              alt="PRMSC logo"
              className="h-28 w-auto object-contain drop-shadow-lg"
            />
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold tracking-tight">
                Join the MRV Network
              </h2>
              <p className="text-sm leading-relaxed text-secondary-foreground/80">
                Help track environmental impact across Punjab&apos;s rural water
                and solar infrastructure.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {["Field Monitoring", "Carbon Analytics", "Compliance"].map(
                (t) => (
                  <span
                    key={t}
                    className="rounded-full border border-secondary-foreground/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground/70"
                  >
                    {t}
                  </span>
                ),
              )}
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
                Create an account
              </h1>
              <p className="text-sm text-muted-foreground">
                Register as authorized staff for MRV operations
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Ahsan Ali"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@prmsc.org.pk"
                      value={formData.email}
                      onChange={handleChange}
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
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger id="role" className="h-10 w-full">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span>{r.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {r.desc}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default Register;
