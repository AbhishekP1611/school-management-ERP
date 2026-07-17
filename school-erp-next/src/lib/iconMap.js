// Maps a stored icon NAME (string, from the Modules table) to a lucide-react icon.
// Add new icons here as needed; unknown names fall back to a generic square.
import {
  LayoutDashboard, Users, UserSquare2, BookOpen, CalendarCheck, Bus, CalendarDays,
  Award, Library, Activity, Megaphone, GraduationCap, DoorOpen, Wallet, ArrowUpCircle,
  ShieldCheck, Building2, Box, Settings, FileText, Bell, ClipboardList, Boxes,
} from 'lucide-react';

export const ICONS = {
  LayoutDashboard, Users, UserSquare2, BookOpen, CalendarCheck, Bus, CalendarDays,
  Award, Library, Activity, Megaphone, GraduationCap, DoorOpen, Wallet, ArrowUpCircle,
  ShieldCheck, Building2, Box, Settings, FileText, Bell, ClipboardList, Boxes,
};

// The names offered in the Modules window's icon picker.
export const ICON_NAMES = Object.keys(ICONS);

export function getIcon(name) {
  return ICONS[name] || Box;
}
