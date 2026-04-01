import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import logo from "../../assets/prmsc-logo.png";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { resetPassword } from "../../services";
import { getApiErrorMessage } from "../../lib/api-error";

function useQueryParam(name: string): string | null {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const v = params.get(name);
    return v && v.trim() ? v : null;
  }, [location.search, name]);
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const tokenFromUrl = useQueryParam("token");

  const [token, setToken] = useState(tokenFromUrl ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await resetPassword(token, newPassword);
      toast.success(res.message || "Password reset successfully");
      navigate("/login", { replace: true, state: { message: "Password reset successfully. Please sign in." } });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg overflow-hidden shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex items-center gap-3">
            <img src={logo} alt="PRMSC logo" className="h-12 w-auto object-contain" />
            <div className="text-left">
              <CardTitle className="text-xl">Reset password</CardTitle>
              <CardDescription>Enter your reset token and choose a new password.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="token">Reset token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from email"
                required
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password">New password</Label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new_password"
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  required
                  autoComplete="new-password"
                  className="h-10 pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Resetting…
                </span>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>

          <Separator />

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

