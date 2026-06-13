/**
 * Icon — the single icon surface for the app. Semantic, domain-named wrappers
 * over a consistent outline set (lucide), so call sites never reach for raw
 * icon imports (which drift into mixed-weight "soup") and we never use emoji
 * as UI. One style, one stroke weight, `currentColor` — tint via text color.
 */

import {
  Archive,
  ArrowRightLeft,
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Clock,
  FileText,
  Flag,
  Info,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Magnet,
  Paperclip,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SquarePen,
  Star,
  Tag,
  Target,
  TriangleAlert,
  Trash2,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  // brand / nav
  dashboard: LayoutDashboard,
  candidates: Users,
  matchmaker: Magnet,
  jobs: Briefcase,
  calendar: CalendarDays,
  settings: Settings,
  // activity types (activity_log.type)
  stage: ArrowRightLeft,
  note: SquarePen,
  email: Mail,
  doc: Paperclip,
  interview: CalendarDays,
  tag: Tag,
  flag: Flag,
  scorecard: ClipboardList,
  system: Settings,
  // status / meta
  visa: ShieldCheck,
  stalled: TriangleAlert,
  warning: TriangleAlert,
  star: Star,
  target: Target,
  bolt: Zap,
  clock: Clock,
  inbox: Inbox,
  empty: Inbox,
  archive: Archive,
  verified: BadgeCheck,
  bell: Bell,
  logout: LogOut,
  // generic ui
  search: Search,
  close: X,
  check: Check,
  plus: Plus,
  trash: Trash2,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  info: Info,
  alert: CircleAlert,
  success: CircleCheck,
  document: FileText,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  /** Pixel size (width = height). Default 16. */
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Solid fill (e.g. an active priority star). */
  fill?: boolean;
  /** Decorative by default (aria-hidden). Pass a label to expose to AT. */
  label?: string;
}

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
  fill = false,
  label,
}: IconProps) {
  const LucideGlyph = ICONS[name];
  return (
    <LucideGlyph
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={className}
      fill={fill ? "currentColor" : "none"}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
