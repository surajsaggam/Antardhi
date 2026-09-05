import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  Activity,
  Server,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { getHealth } from "../services/api";

export const Layout: React.FC = () => {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const checkApi = async () => {
      try {
        const res = await getHealth();
        if (isMounted) {
          setApiOnline(res.status === "ok");
        }
      } catch {
        if (isMounted) {
          setApiOnline(false);
        }
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/applicants":
        return "Applicants Directory";
      case "/assessment":
        return "Credit Assessment & Underwriting";
      default:
        return "Underwriting Desk";
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Persistent Left Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div>
          {/* Institution Branding */}
          <div className="h-16 px-5 flex items-center border-b border-slate-200 gap-3">
            <div className="h-9 w-9 rounded-md bg-slate-900 flex items-center justify-center text-white">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                Antardhi
              </h1>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">
                Alternative Credit Engine
              </p>
            </div>
          </div>

          {/* Underwriting Navigation */}
          <div className="p-3">
            <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Underwriting Desk
            </div>
            <nav className="space-y-1">
              <NavLink
                to="/applicants"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-100 text-sky-700 font-semibold border-l-2 border-sky-600 pl-[10px]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
              >
                <Users className="h-4 w-4" />
                <span>Applicants Queue</span>
              </NavLink>

              <NavLink
                to="/assessment"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-100 text-sky-700 font-semibold border-l-2 border-sky-600 pl-[10px]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
              >
                <Activity className="h-4 w-4" />
                <span>Assessment & SHAP</span>
              </NavLink>
            </nav>
          </div>
        </div>

        {/* System & Engine Status */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-semibold text-slate-700">API Connection</span>
            {apiOnline === null ? (
              <span className="inline-flex items-center text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5 animate-pulse" />
                Checking...
              </span>
            ) : apiOnline ? (
              <span className="inline-flex items-center text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-700 font-medium">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                Offline
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3 text-slate-400" />
              localhost:8000
            </span>
            <span className="text-[10px] text-slate-400 font-sans font-semibold uppercase">
              FastAPI
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 text-center">
            NBFC Internal Underwriter v1.0
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex-shrink-0 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Portal
            </div>
            <span className="text-slate-300">/</span>
            <h2 className="text-base font-semibold text-slate-900">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-600">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Dataset: 8,000 synthetic profiles</span>
            </div>
            <div className="text-xs font-medium text-slate-600">
              Underwriter: <span className="font-semibold text-slate-900">Risk Desk #04</span>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
