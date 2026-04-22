"use client";
import { clsx } from "clsx";
import {
  Bell, Calendar, ChevronRight, FileText, Heart,
  Home, Lock, LogOut, Pill, Settings, Shield, Users,
} from "lucide-react";
import type { Screen } from "@/types";

interface SidebarProps {
  screen: Screen;
  sidebarOpen: boolean;
  badges: { analyzing?: number; deadlines?: number; medications?: number };
  onNavigate: (s: Screen) => void;
  onToggle: () => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: Screen; label: string; icon: React.ElementType; badgeKey?: keyof SidebarProps["badges"] }[] = [
  { id: "dashboard",  label: "Dashboard",       icon: Home },
  { id: "documents",  label: "Documents",        icon: FileText,  badgeKey: "analyzing" },
  { id: "medications",label: "Medications",      icon: Pill,      badgeKey: "medications" },
  { id: "reminders",  label: "Reminders",        icon: Bell,      badgeKey: "deadlines" },
  { id: "caregiver",  label: "Caregiver",        icon: Users },
  { id: "vault",      label: "Emergency Vault",  icon: Lock },
  { id: "timeline",   label: "Timeline",         icon: Calendar },
  { id: "benefits",   label: "Benefits",         icon: Heart },
  { id: "settings",   label: "Settings",         icon: Settings },
  { id: "admin",      label: "Admin",            icon: Shield },
];

export function Sidebar({ screen, sidebarOpen, badges, onNavigate, onToggle, onLogout }: SidebarProps) {
  return (
    <aside className={clsx(
      "bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
      sidebarOpen ? "w-64" : "w-16"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <div>
            <p className="font-bold text-gray-900 text-sm">Paperwork</p>
            <p className="text-xs text-gray-500">AI Assistant</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1 hover:bg-gray-100 rounded-lg"
          aria-label="Toggle sidebar"
        >
          <ChevronRight className={clsx(
            "w-4 h-4 text-gray-400 transition-transform",
            sidebarOpen && "rotate-180"
          )} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey ? badges[badgeKey] : undefined;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                screen === id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
              {badge !== undefined && badge > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {sidebarOpen && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
