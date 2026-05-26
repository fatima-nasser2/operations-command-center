'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Inbox, Zap, ClipboardList } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/inbox',     label: 'Event Inbox',  Icon: Inbox           },
  { href: '/simulator', label: 'Simulator',    Icon: Zap             },
  { href: '/review',    label: 'Review Queue', Icon: ClipboardList   },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
