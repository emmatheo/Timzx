import {
  Boxes,
  FileText,
  Gauge,
  Landmark,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Store,
  Terminal,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. The rest live in the drawer. */
  primary?: boolean;
}

/**
 * Single source of navigation truth, shared by the sidebar, the mobile drawer and the bottom bar,
 * so the three can never drift out of sync.
 */
export const navItems: NavItem[] = [
  {href: '/', label: 'Dashboard', icon: Gauge, primary: true},
  {href: '/marketplace', label: 'Marketplace', icon: Store, primary: true},
  {href: '/trades', label: 'My Trades', icon: Boxes, primary: true},
  {href: '/financing', label: 'Financing', icon: Landmark, primary: true},
  {href: '/credit', label: 'Credit Profile', icon: ShieldCheck},
  {href: '/messages', label: 'Messages', icon: MessagesSquare},
  {href: '/documents', label: 'Documents', icon: FileText},
  {href: '/faucet', label: 'Faucet', icon: Wallet},
  {href: '/developer', label: 'Developer', icon: Terminal},
  {href: '/settings', label: 'Settings', icon: Settings},
];
