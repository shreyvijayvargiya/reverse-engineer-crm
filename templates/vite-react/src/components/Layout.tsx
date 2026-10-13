import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Menu, Moon, Plug, Sun } from "lucide-react";
import { blueprint } from "../generated/blueprint";
import { cn, modulePath } from "../lib/utils";
import { Icon } from "./Icon";

function useDark() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("rcrm:theme") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("rcrm:theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);
  return [dark, setDark] as const;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

export function Layout() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useDark();

  const nav = (
    <nav className="flex flex-col gap-1 p-3" onClick={() => setOpen(false)}>
      <NavLink to="/" end className={linkClass}><LayoutDashboard className="h-4 w-4" /> Dashboard</NavLink>
      {blueprint.modules.map((m) => (
        <NavLink key={m.id} to={modulePath(m.id)} className={linkClass}><Icon name={m.icon} /> {m.label}</NavLink>
      ))}
      <div className="my-2 border-t border-border" />
      <NavLink to="/settings" className={linkClass}><Plug className="h-4 w-4" /> Settings</NavLink>
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border px-5 py-4 text-sm font-semibold">{blueprint.name}</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-4 text-sm font-semibold">{blueprint.name}</div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <button className="rounded p-1.5 hover:bg-muted md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="text-sm text-muted-foreground md:hidden">{blueprint.name}</span>
          <button className="ml-auto rounded p-1.5 hover:bg-muted" onClick={() => setDark(!dark)} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
