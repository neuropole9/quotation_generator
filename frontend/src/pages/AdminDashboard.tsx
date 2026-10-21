import { useState, type ReactNode } from "react";
import {
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/react";
import "./AdminDashboard.css";

interface AdminDashboardProps {
  isAdmin?: boolean;
  onManageUsers: () => void;
  onOpenQuotation: () => void;
  onOpenSavedQuotations: () => void;
}

type IconName =
  | "dashboard"
  | "document"
  | "users"
  | "arrow"
  | "plus"
  | "menu"
  | "close"
  | "shield"
  | "sparkles"
  | "logout";

function DashboardIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const drawing: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></>,
    document: <><path d="M8 3h7l5 5v12a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2Z" /><path d="M15 3v6h5M8 13h8M8 17h6" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 14a5 5 0 0 1 2 4v2" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="M5 5l14 14M19 5 5 19" /></>,
    shield: <><path d="m12 2 8 4v6c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkles: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z" /></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M15 8l4 4-4 4M8 12h11" /></>,
  };

  return <svg {...shared}>{drawing[name]}</svg>;
}

export default function AdminDashboard({
  onManageUsers,
  isAdmin = true,
  onOpenQuotation,
  onOpenSavedQuotations,
}: AdminDashboardProps) {
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName =
    user?.firstName ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Admin";

  const goToUsers = () => {
    setMobileMenuOpen(false);
    onManageUsers();
  };

  const goToSavedQuotations = () => {
    setMobileMenuOpen(false);
    onOpenSavedQuotations();
  };

  const goToQuotation = () => {
    setMobileMenuOpen(false);
    onOpenQuotation();
  };

  return (
    <div className="qd-shell">
      {mobileMenuOpen && (
        <button
          type="button"
          className="qd-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside className={`qd-sidebar${mobileMenuOpen ? " qd-sidebar--open" : ""}`} aria-label="Main navigation">
        <div className="qd-sidebar-head">
          <div className="qd-brand-icon">Q<span>.</span></div>
          <div className="qd-brand-copy">
            <strong>QuoteDesk</strong>
            <span>ALPHANUMERIC</span>
          </div>
          <button className="qd-close-menu" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
            <DashboardIcon name="close" />
          </button>
        </div>

        <div className="qd-nav-label">WORKSPACE</div>
        <nav className="qd-nav">
          <div className="qd-nav-current" aria-current="page"><DashboardIcon name="dashboard" /> <span>Overview</span></div>
          <button type="button" onClick={goToQuotation}><DashboardIcon name="plus" /> <span>Create Quotation</span><DashboardIcon name="arrow" size={15} /></button>
          <button type="button" onClick={goToSavedQuotations}><DashboardIcon name="document" /> <span>{isAdmin ? "Saved Quotations" : "My Quotations"}</span><DashboardIcon name="arrow" size={15} /></button>
          {isAdmin && <button type="button" onClick={goToUsers}><DashboardIcon name="users" /> <span>User Management</span><DashboardIcon name="arrow" size={15} /></button>}
        </nav>

        <div className="qd-sidebar-bottom">
          <div className="qd-secure-note"><DashboardIcon name="shield" size={18} /><div><strong>Secure workspace</strong><span>Account access powered by Clerk</span></div></div>
          <span className="qd-sidebar-footer">© {new Date().getFullYear()} Alphanumeric Innovations</span>
        </div>
      </aside>

      <div className="qd-content-area">
        <header className="qd-topbar">
          <div className="qd-topbar-left">
            <button className="qd-mobile-menu" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation menu"><DashboardIcon name="menu" /></button>
            <span className="qd-breadcrumb">Workspace <span>/</span> <strong>Overview</strong></span>
          </div>
          <div className="qd-profile">
            <span className="qd-profile-name">{displayName}</span>
            <UserButton />
            <SignOutButton>
              <button type="button" className="qd-signout"><DashboardIcon name="logout" size={17} /><span>Sign out</span></button>
            </SignOutButton>
          </div>
        </header>

        <main className="qd-main">
          <div className="qd-title-row">
            <div>
              <div className="qd-eyebrow">{isAdmin ? "ADMINISTRATION / OVERVIEW" : "MY WORKSPACE / OVERVIEW"}</div>
              <h1>Welcome back, {displayName}</h1>
              <p>{isAdmin ? "Manage quotations and user access from one workspace." : "Create, edit and manage your quotations."}</p>
            </div>
            <button type="button" className="qd-primary-action" onClick={goToQuotation}><DashboardIcon name="plus" size={18} /> New quotation</button>
          </div>

          <section className="qd-hero" aria-label="Quotation management">
            <div className="qd-hero-copy">
              <span className="qd-hero-tag"><DashboardIcon name="sparkles" size={15} /> YOUR WORKSPACE</span>
              <h2>Business quotations, simplified.</h2>
              <p>{isAdmin ? "Create polished quotations, manage saved records and keep your team organized with QuoteDesk." : "Create polished quotations and manage your saved records with QuoteDesk."}</p>
              <button type="button" className="qd-hero-button" onClick={goToQuotation}>Open quotation builder <DashboardIcon name="arrow" size={17} /></button>
            </div>
            <div className="qd-hero-art" aria-hidden="true"><div className="qd-art-page"><div className="qd-art-top"/><div className="qd-art-line qd-art-line--wide"/><div className="qd-art-line"/><div className="qd-art-table"><span/><span/><span/><span/><span/><span/></div><div className="qd-art-total"/></div><div className="qd-art-check">✓</div></div>
          </section>

          <div className="qd-main-footer">Alphanumeric QuoteDesk <span>•</span> Quotation Management Platform</div>
        </main>
      </div>
    </div>
  );
}
