import { NavLink, Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DATA_SOURCE } from '../lib/data-client';
import CompareTray from './compare-tray';
import WelcomeModal from './welcome-modal';
import FeedbackWidget from './feedback-widget';

/**
 * App shell: a top bar (logo + desktop nav) and a mobile bottom tab bar. Most
 * apartment hunting happens on a phone, so navigation is thumb-reachable on
 * small screens and inline on larger ones.
 */
export default function Layout({ children }: { children: ReactNode }) {
  // The Results and Compare views need room for a side-by-side map / comparison
  // table on desktop, so they widen the shell past the reading-width default.
  // This couples Layout to two specific routes — accepted as a deliberate, small
  // exception rather than a w-screen breakout hack. Keep TopBar's width in sync.
  const { pathname } = useLocation();
  const wide = pathname.startsWith('/results') || pathname.startsWith('/compare');
  const maxW = wide ? 'max-w-4xl lg:max-w-[88rem]' : 'max-w-4xl';

  return (
    <div className="flex min-h-full flex-col">
      <TopBar maxW={maxW} />
      <main className={`mx-auto w-full flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pb-14 sm:pt-8 ${maxW}`}>
        {children}
      </main>
      <Footer />
      <CompareTray />
      <WelcomeModal />
      <FeedbackWidget />
      <MobileTabBar />
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  end?: boolean;
  /** Show only on the desktop top bar (keeps the mobile tab bar uncrowded). */
  desktopOnly?: boolean;
  /** Show only on the mobile bottom bar (the grouped "Connect" tab). */
  mobileOnly?: boolean;
  /** Built, but with no inventory behind it yet — flagged in the desktop nav. */
  soon?: boolean;
}

// Roommates + Agents get their own desktop links, but fold behind one "Connect"
// tab on mobile so the bottom bar stays at five thumb-reachable tabs.
const NAV: NavItem[] = [
  { to: '/', label: 'Search', icon: SearchIcon, end: true },
  { to: '/results', label: 'Results', icon: ListIcon },
  { to: '/saved', label: 'Saved', icon: HeartIcon },
  { to: '/roommates', label: 'Roommates', icon: PeopleIcon, desktopOnly: true, soon: true },
  { to: '/agents', label: 'Agents', icon: BadgeIcon, desktopOnly: true, soon: true },
  { to: '/connect', label: 'Connect', icon: PeopleIcon, mobileOnly: true },
  { to: '/account', label: 'Account', icon: UserIcon },
];

const DESKTOP_NAV = NAV.filter((i) => !i.mobileOnly);
const MOBILE_NAV = NAV.filter((i) => !i.desktopOnly);
// Account is the one nav item that reads as an action, so it leaves the link
// row and becomes the outlined button on the right.
const DESKTOP_LINKS = DESKTOP_NAV.filter((i) => i.to !== '/account');

function TopBar({ maxW }: { maxW: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-600 bg-ink-950/[0.88] backdrop-blur-[10px]">
      <div className={`mx-auto flex w-full items-center justify-between px-4 py-3.5 sm:px-6 ${maxW}`}>
        <Link to="/" className="flex items-center gap-2.5">
          {/* The mark is the one place the accent is allowed to fill: a small
              gradient tile with a glow, glyph knocked out in the ground colour. */}
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-200 text-ink-950"
            style={{
              boxShadow:
                '0 0 0 1px color-mix(in srgb, #9184d9 40%, transparent), 0 4px 16px color-mix(in srgb, #9184d9 35%, transparent)',
            }}
          >
            <HomeGlyph />
          </span>
          <span className="text-xl font-medium tracking-[-0.02em] text-slate-900">Nester</span>
        </Link>
        <nav className="hidden items-center gap-7 sm:flex">
          {DESKTOP_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link text-sm transition-colors ${
                  isActive ? 'text-brand-700' : 'text-slate-700 hover:text-brand-700'
                }`
              }
            >
              {item.label}
              {/* Sets expectation before the click, so the Coming Soon banner on
                  the other side is a confirmation rather than a surprise. */}
              {item.soon && (
                <span className="ml-1.5 align-middle text-[9px] uppercase tracking-[0.1em] text-slate-400">
                  Soon
                </span>
              )}
            </NavLink>
          ))}
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `btn-outline ${isActive ? 'bg-brand-600/[0.14]' : ''}`
            }
          >
            Account
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function MobileTabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-ink-600/70 bg-ink-950/90 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {MOBILE_NAV.map((item) => {
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
    <footer className="border-t border-ink-600 px-4 py-6 text-center text-[12.5px] text-slate-400">
      <Link to="/how-it-works" className="text-slate-500 underline-offset-4 hover:text-brand-700 hover:underline">
        How matching works
      </Link>
      <span className="mx-2.5 text-ink-600">·</span>
      Nester helps you find a place that fits your life — we link out to each source, we don't
      host listings or handle transactions.
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
    <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1v-9" />
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
function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M17.5 14.4c2.6.5 4 2.1 4 4.6" />
    </svg>
  );
}
function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}
