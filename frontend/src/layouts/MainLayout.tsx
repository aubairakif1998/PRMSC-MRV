import { useMemo, useState, type ReactNode } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Database,
  Droplets,
  FileCheck,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Sun,
  UserPlus,
  Users,
  User as UserIcon,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { HQ_DASHBOARD, tehsilRoutes } from "../constants/routes";
import { accountRoutes } from "../constants/routes";
import {
  canOnboardOperators,
  isExecutiveRole,
  isTehsilManager,
  roleDisplayLabel,
} from "../constants/roles";
import { useAuth } from "../contexts/AuthContext";

type MenuItem = {
  path: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
};

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const exec = user ? isExecutiveRole(user.role) : false;
  const tehsilMgr = user ? isTehsilManager(user.role) : false;
  const showOnboard = user ? canOnboardOperators(user.role) : false;

  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [];

    if (exec) {
      items.push({
        path: HQ_DASHBOARD,
        icon: <BarChart3 className="size-4" />,
        label: "Organization KPI",
        end: true,
      });
    }

    if (tehsilMgr) {
      items.push(
        {
          path: tehsilRoutes.dashboard,
          icon: <LayoutDashboard className="size-4" />,
          label: "Dashboard",
          end: true,
        },
        ...(showOnboard
          ? [
              {
                path: tehsilRoutes.onboardOperator,
                icon: <UserPlus className="size-4" />,
                label: "Onboard Operator",
              } satisfies MenuItem,
            ]
          : []),
        {
          path: tehsilRoutes.operatorAssignments,
          icon: <Users className="size-4" />,
          label: "Operator assignments",
        },
        {
          path: tehsilRoutes.waterSystems,
          icon: <Droplets className="size-4" />,
          label: "Water Systems",
        },
        {
          path: tehsilRoutes.solarSites,
          icon: <Sun className="size-4" />,
          label: "Solar Systems",
        },
        {
          path: tehsilRoutes.solarMonthlyLogging,
          icon: <ClipboardList className="size-4" />,
          label: "Solar Monthly Logging",
        },
        {
          path: tehsilRoutes.loggingCompliance,
          icon: <CalendarClock className="size-4" />,
          label: "Logging compliance",
        },

        {
          path: tehsilRoutes.waterSubmissions,
          icon: <FileCheck className="size-4" />,
          label: "Submissions",
        },
      );
    }

    // Account utilities for all portal roles
    items.push({
      path: accountRoutes.changePassword,
      icon: <KeyRound className="size-4" />,
      label: "Change Password",
    });

    return items;
  }, [exec, tehsilMgr, showOnboard]);

  const roleLabel = roleDisplayLabel(user?.role);
  const userInitials = (user?.name ?? "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="hidden h-screen shrink-0 overflow-hidden border-r border-slate-200 bg-white md:flex md:flex-col"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm">
                <Database className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-slate-900">
                  MRV <span className="text-primary">System</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Monitoring & Verification
                </p>
              </div>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
              {menuItems.map((item) => (
                <NavLink
                  key={`${item.path}-${item.label}`}
                  to={item.path}
                  end={item.end ?? false}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <Button
                type="button"
                variant="default"
                className="h-10 w-full justify-start gap-2"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 px-4 py-2 backdrop-blur md:px-6">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="border-slate-300 text-slate-600 hover:text-primary"
            >
              {isSidebarOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Card
                size="sm"
                className="hidden border-slate-200 bg-white/80 md:flex"
              >
                <CardContent className="flex items-center gap-3 px-3 py-2">
                  <Avatar size="sm" className="ring-1 ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary font-semibold text-white">
                      {userInitials || <UserIcon className="size-3" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold text-slate-900">
                    {user?.name || "User"}
                  </span>
                  <Separator
                    orientation="vertical"
                    className="h-4 bg-slate-200"
                  />
                  <Badge
                    variant="outline"
                    className="max-w-[140px] truncate text-[10px] uppercase tracking-wide text-primary"
                    title={roleLabel}
                  >
                    {roleLabel}
                  </Badge>
                </CardContent>
              </Card>
              <Avatar size="lg" className="ring-2 ring-primary/20 md:hidden">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary font-bold text-white">
                  {userInitials || <UserIcon className="size-4" />}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Separator className="mb-4 bg-transparent" />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
