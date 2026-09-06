import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchAccount, logoutSession } from "../lib/api";
import { clearSession, writeSession } from "../lib/session";
import { OnboardingModal } from "../components/OnboardingModal";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutGrid,
  Users,
  ShoppingBag,
  BarChart3,
  FileText,
  Settings,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  Menu,
  X,
  MessageSquare,
  Copy,
  Gamepad2,
  Sparkles,
  HelpCircle,
  Wand2,
  Radar,
  Layers3,
} from "lucide-react";

// Adminly 3-dot cluster logo mark
function AdminlyLogoMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="6" r="3" />
      <circle cx="6.5" cy="16.5" r="3" />
      <circle cx="17.5" cy="16.5" r="3" />
    </svg>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [name, setName] = useState("Conta Roblox");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [discordUser, setDiscordUser] = useState<{ id: string; name: string; avatar: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAccount()
      .then((account) => {
        if (!alive) return;
        setConnected(account.connected);
        if (account.discord?.avatar) {
          setAvatarUrl(account.discord.avatar);
        }
        if (account.discord) {
          setDiscordUser(account.discord);
          // Automatically trigger onboarding modal for Discord users if not dismissed
          const dismissed = localStorage.getItem("illusions_onboarding_dismissed");
          if (!dismissed) {
            setShowOnboarding(true);
          }
        }
        if (account.connected) {
          const label = account.displayName || account.username || account.discord?.name || "Conta Roblox";
          setName(label);
          writeSession(label);
        } else if (account.discord) {
          setName(account.discord.name);
          writeSession(account.discord.name);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  const navItemClass = (path: string, exact = false) => {
    const isActive = exact
      ? location.pathname === path
      : location.pathname.startsWith(path);

    return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
      isActive
        ? "bg-white/10 text-white font-semibold shadow-sm backdrop-blur-md border border-white/[0.08]"
        : "text-white/60 hover:text-white hover:bg-white/[0.05]"
    }`;
  };

  return (
    <div className="w-full h-screen bg-transparent flex overflow-hidden select-none font-sans relative">
      {/* Global SVG Noise Filter */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <filter id="c3-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"
          />
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>
      </svg>

      {/* Left Sidebar */}
      <aside className="w-56 lg:w-60 shrink-0 bg-transparent border-r border-white/[0.06] flex flex-col justify-between p-5 z-20">
        <div>
          {/* Adminly Logo Mark */}
          <div
            onClick={() => navigate("/painel")}
            className="flex items-center gap-3 px-1 mb-8 cursor-pointer group"
          >
              <div className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-md border border-white/[0.08] flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <AdminlyLogoMark className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-extrabold tracking-tight text-white font-sans leading-tight">
                Illusions AI
                <span className="block text-[9px] font-medium text-white/30 tracking-wider">UGC Intelligence</span>
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1.5">
              <NavLink to="/painel" end className={() => navItemClass("/painel", true)}>
                <LayoutGrid className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/painel/chat" className={() => navItemClass("/painel/chat", true)}>
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </NavLink>

              <NavLink to="/painel/ugc-creator" className={() => navItemClass("/painel/ugc-creator", true)}>
                <Wand2 className="w-4 h-4 text-purple-400" />
                <span>UGC AI</span>
              </NavLink>

              <NavLink to="/painel/mass-upload" className={() => navItemClass("/painel/mass-upload", true)}>
                <Layers3 className="w-4 h-4 text-blue-400" />
                <span>Mass Upload</span>
              </NavLink>

              <NavLink to="/painel/conta" className={() => navItemClass("/painel/conta", true)}>
                <Users className="w-4 h-4" />
                <span>Users</span>
              </NavLink>

              <NavLink to="/painel/upload" className={() => navItemClass("/painel/upload", true)}>
                <ShoppingBag className="w-4 h-4" />
                <span>Products</span>
              </NavLink>

              <NavLink to="/painel/analytics" className={() => navItemClass("/painel/analytics", true)}>
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </NavLink>

              <NavLink to="/painel/copy" className={() => navItemClass("/painel/copy", true)}>
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </NavLink>

              <NavLink to="/painel/gamepass" className={() => navItemClass("/painel/gamepass", true)}>
                <Gamepad2 className="w-4 h-4" />
                <span>Gamepass</span>
              </NavLink>

              <NavLink
                to="/painel/market-scanner"
                className={() =>
                  navItemClass(
                    location.pathname.startsWith("/painel/market-scanner") ||
                      location.pathname.startsWith("/painel/feed")
                      ? location.pathname
                      : "/painel/market-scanner",
                    true
                  )
                }
              >
                <Radar className="w-4 h-4 text-emerald-400" />
                <span>Market Scanner</span>
              </NavLink>

              <NavLink to="/painel/ajustes" className={() => navItemClass("/painel/ajustes", true)}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </NavLink>
            </nav>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 space-y-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowOnboarding(true)}
              className="w-full py-2.5 px-4 rounded-full font-semibold text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 backdrop-blur-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Guia da Plataforma</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                void logoutSession();
                clearSession();
                navigate("/login");
              }}
              className="w-full py-2.5 px-4 rounded-full font-semibold text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/[0.08] backdrop-blur-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </motion.button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent relative">
          {/* Top Header Bar */}
          <header className="h-16 shrink-0 px-6 sm:px-8 flex items-center justify-between z-10 bg-transparent border-b border-white/[0.05]">
            {/* Search Input in Rounded Pill */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search"
                className="w-60 sm:w-72 bg-white/5 border border-white/[0.08] backdrop-blur-md rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-white/35 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Right Icons: Help Guide, Notification Bell & User Avatar */}
            <div className="flex items-center gap-3">
              {/* Help & Guide Icon */}
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="w-9 h-9 rounded-full bg-white/5 border border-white/[0.08] backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Guia da Plataforma"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Notification Bell with Badge */}
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/[0.08] backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors relative cursor-pointer"
                title="Notificações"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-black/40" />
              </button>

              {/* User Profile Avatar with Gradient Ring */}
              <div
                onClick={() => navigate("/painel/conta")}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 p-[1.5px] cursor-pointer hover:scale-105 transition-transform"
              >
                <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    name.slice(0, 2).toUpperCase()
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Page Content View */}
          <main className="flex-1 min-h-0 overflow-hidden relative">
            <Outlet />
          </main>
        </div>

      {/* Onboarding & Instructions Modal for Discord Users */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        discordName={discordUser?.name}
        discordAvatar={discordUser?.avatar}
        isRobloxConnected={connected}
      />
    </div>
  );
}
