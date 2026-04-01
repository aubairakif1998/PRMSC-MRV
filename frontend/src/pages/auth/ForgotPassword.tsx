import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import logo from "../../assets/prmsc-logo.png";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { forgotPassword } from "../../services";
import { getApiErrorMessage } from "../../lib/api-error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setDevToken(null);
    try {
      const res = await forgotPassword(email);
      setMessage(res.message);
      if (res.reset_token) setDevToken(res.reset_token);
      toast.success("If the account exists, reset instructions will be sent.");
    } catch (err: unknown) {
      const m = getApiErrorMessage(err, "Failed to request password reset");
      toast.error(m);
      setMessage(m);
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
              <CardTitle className="text-xl">Forgot password</CardTitle>
              <CardDescription>We’ll send reset instructions if your email exists.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={submit}>
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

            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                "Send reset instructions"
              )}
            </Button>
          </form>

          {message ? (
            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
              {message}
              {devToken ? (
                <div className="mt-3 rounded-lg border bg-background p-3">
                  <p className="text-xs font-semibold text-foreground">Dev reset token</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {devToken}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

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

