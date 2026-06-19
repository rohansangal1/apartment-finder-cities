import { NavLink, Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DATA_SOURCE } from '../lib/dataClient';

/**
 * App shell: a top bar (logo + desktop nav) and a mobile bottom tab bar. Most
 * apartment hunting happens on a phone, so navigation is thumb-reachable on
 * small screens and inline on larger ones.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 sm:pb-10">{children}</main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Search', icon: SearchIcon, end: true },
  { to: '/results', label: 'Results', icon: ListIcon },
  { to: '/saved', label: 'Saved', icon: HeartIcon },
  { to: '/account', label: 'Account', icon: UserIcon },
];

function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <HomeGlyph />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">Nestle</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function MobileTabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white sm:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {NAV.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                active ? 'text-brand-600' : 'text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
      Nestle helps you discover apartments — we link out to each source, we don't host
      listings or handle transactions.
      {DATA_SOURCE === 'mock' && (
        <span className="mt-1 block font-medium text-amber-500">
          Running on demo data (Phase 0). Real sources drop in behind the same interface.
        </span>
      )}
    </footer>
  );
}

// ---- icons ----
function HomeGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}
function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7.5-4.6-10-9.2C.5 8.5 2 5 5.5 5 7.6 5 9 6.2 12 9c3-2.8 4.4-4 6.5-4C22 5 23.5 8.5 22 11.8 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
