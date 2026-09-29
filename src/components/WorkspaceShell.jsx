import {
  AudioLines,
  Check,
  ChevronDown,
  CircleAlert,
  Headphones,
  Search,
  Users,
  X,
} from 'lucide-react';
import { formatDate } from '../utils/formatters.js';

function WorkspaceShell({
  view,
  callsCount,
  query,
  onQueryChange,
  error,
  notice,
  onDismissError,
  onDismissNotice,
  onShowCalls,
  onShowAgents,
  children,
  overlays,
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#calls" onClick={onShowCalls}>
          <span className="brand-mark">
            <AudioLines size={21} strokeWidth={2.3} />
          </span>
          <span>
            fieldnote<small>QUALITY DESK</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={view === 'calls' ? 'active' : ''} onClick={onShowCalls}>
            <Headphones size={18} />
            Calls<span className="nav-count">{callsCount || '—'}</span>
          </button>
          <button className={view === 'agents' ? 'active' : ''} onClick={onShowAgents}>
            <Users size={18} />
            Agent performance
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-card">
            <span className="workspace-dot" />
            <span>
              <strong>Northstar Support</strong>
              <small>Quality team</small>
            </span>
            <ChevronDown size={15} />
          </div>
          <div className="profile-row">
            <div className="avatar avatar-dark">QA</div>
            <span>
              <strong>Quality Admin</strong>
              <small>Manager</small>
            </span>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{view === 'calls' ? 'Call reviews' : 'Agent performance'}</strong>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search agents or customers"
              placeholder="Search agent or customer"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <span className="topbar-date">
            {formatDate(new Date(), {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </header>

        <div className="page-content">
          {error && (
            <div className="alert-banner">
              <CircleAlert size={18} />
              <span>
                {error}{' '}
                <small>
                  Check your MongoDB connection and run <code>npm run seed</code>.
                </small>
              </span>
              <button onClick={onDismissError} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success-banner">
              <Check size={16} />
              {notice}
              <button onClick={onDismissNotice} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}
          {children}
        </div>
        <footer className="page-footer">
          <span>
            FIELDNOTE <span className="footer-separator">/</span> QUALITY INTELLIGENCE
          </span>
          <span>Review carefully. Coach kindly.</span>
        </footer>
      </main>
      {overlays}
    </div>
  );
}

export default WorkspaceShell;
