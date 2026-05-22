'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

type Props = {
  label: string;
  items: NavItem[];
  badge?: number;
};

export default function NavDropdown({ label, items, badge }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const isActive = items.some((i) => pathname === i.href);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="nav-dropdown" ref={ref}>
      <button
        type="button"
        className={`nav-link nav-dropdown-btn ${isActive ? 'is-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {badge != null && badge > 0 && (
          <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>
        )}
        <span className={`nav-dropdown-arrow ${open ? 'is-open' : ''}`}>↓</span>
      </button>

      {open && (
        <div className="nav-dropdown-list">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-dropdown-item ${pathname === item.href ? 'is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {pathname === item.href && <span className="nav-dropdown-dot">●</span>}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
