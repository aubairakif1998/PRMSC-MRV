import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { getApiErrorMessage } from "../../../lib/api-error";
import { useTehsilManagerOperatorApi, useUsersApi } from "../../../hooks";
import type { WaterSystemRow } from "../../../types/api";

export default function OnboardOperator() {
  const navigate = useNavigate();
  const { onboardOperator, onboardLoading } = useUsersApi();
  const { getWaterSystems } = useTehsilManagerOperatorApi();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Root123!");
  const [showPassword, setShowPassword] = useState(false);
  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingSystems, setLoadingSystems] = useState(true);
  const selectedCount = selected.size;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getWaterSystems();
        if (!cancelled) setSystems(Array.isArray(data) ? (data as WaterSystemRow[]) : []);
      } catch (e: unknown) {
        toast.error(getApiErrorMessage(e, "Could not load water systems"));
      } finally {
        if (!cancelled) setLoadingSystems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getWaterSystems]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(systems.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Name, email, and password are required.");
      return;
    }
    if (selected.size < 1) {
      toast.error("Select at least one water system to assign.");
      return;
    }
    try {
      await onboardOperator({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        water_system_ids: [...selected],
      });
      toast.success("Tubewell operator created.");
      setName("");
      setEmail("");
      setPassword("Root123!");
      setSelected(new Set());
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Onboarding failed"));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" />
            </Button>
            <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow">
              <UserPlus className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Onboard operator
              </h1>
              <p className="text-sm text-slate-600">
                Create a tubewell operator account and assign water systems.
              </p>
            </div>
          </div>
        </div>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Operator details</CardTitle>
            <CardDescription>
              Use a temporary password and ask the operator to change it after first login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="e.g. Ali Raza"
                  />
                  <p className="text-xs text-slate-500">
                    This is shown in submissions and audit logs.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="operator@example.com"
                  />
                  <p className="text-xs text-slate-500">
                    Used for login and password recovery.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Root123!"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Share this securely. Operator should change it immediately after login.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label>Assigned water systems</Label>
                    <p className="mt-1 text-xs text-slate-500">
                      Select one or more systems the operator can submit for.
                      {systems.length > 0 ? (
                        <span className="ml-1">
                          ({selectedCount} selected / {systems.length} total)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {!loadingSystems && systems.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                        disabled={selectedCount === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : null}
                </div>

                {loadingSystems ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading systems…
                  </p>
                ) : systems.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    No water systems found in your scope. Register water systems first.
                  </div>
                ) : (
                  <ScrollArea className="h-72 rounded-lg border border-slate-200 bg-white p-3">
                    <ul className="space-y-2">
                      {systems.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-start gap-3 rounded-lg border border-slate-200/60 bg-white px-3 py-2.5 hover:bg-slate-50"
                        >
                          <Checkbox
                            id={`ws-${s.id}`}
                            checked={selected.has(s.id)}
                            onCheckedChange={() => toggle(s.id)}
                          />
                          <label
                            htmlFor={`ws-${s.id}`}
                            className="cursor-pointer text-sm leading-snug"
                          >
                            <span className="font-medium text-slate-900">
                              {s.tehsil} — {s.village}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {s.settlement ? `${s.settlement} · ` : ""}
                              {s.unique_identifier}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Creating this account will not send an automatic email. Share credentials manually.
                </p>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={onboardLoading || loadingSystems}
                >
                  {onboardLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create operator"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
