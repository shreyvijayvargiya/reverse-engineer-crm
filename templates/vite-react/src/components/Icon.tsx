import {
  Briefcase, CalendarDays, CheckSquare, Database, FileText, Globe, Handshake, LayoutDashboard, LifeBuoy,
  Mail, MessageCircle, Package, Star, Users, type LucideIcon,
} from "lucide-react";

/** Single place that imports the icon library. Swap lucide for another set by editing this map only. */
const icons: Record<string, LucideIcon> = {
  users: Users,
  handshake: Handshake,
  "check-square": CheckSquare,
  "file-text": FileText,
  mail: Mail,
  "message-circle": MessageCircle,
  star: Star,
  globe: Globe,
  calendar: CalendarDays,
  "life-buoy": LifeBuoy,
  database: Database,
  package: Package,
  briefcase: Briefcase,
  "layout-dashboard": LayoutDashboard,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = icons[name] ?? Package;
  return <Cmp className={className ?? "h-4 w-4"} aria-hidden />;
}
