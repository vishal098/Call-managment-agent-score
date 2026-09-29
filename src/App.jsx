import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDown, ArrowLeft, ArrowUp, AudioLines, BarChart3, Check, CheckCheck,
  ChevronDown, CircleAlert, ClipboardCheck, Clock3, Headphones, Search, ShieldCheck,
  SlidersHorizontal, Users, X,
} from 'lucide-react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const getJson = async (url, options) => {
  const response = await fetch(url, options);
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body.error || `Request failed (HTTP ${response.status}).`);
  return body;
};
const formatDate = (date, options = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en-US', options).format(new Date(date));
const formatDuration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const initials = (name) => name.split(' ').map((part) => part[0]).join('').slice(0, 2);
const scoreColor = (score) => score >= 85 ? 'good' : score >= 70 ? 'mid' : 'low';

function Score({ value, compact = false }) {
  return <span className={`score ${scoreColor(value)} ${compact ? 'score-compact' : ''}`}>{value}<small>/100</small></span>;
}

function App() {
  const [view, setView] = useState('calls');
  const [calls, setCalls] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('');
    const [rangeDays, setRangeDays] = useState('30');
  const [filters, setFilters] = useState({ agent: '', minScore: '', maxScore: '', flagged: '' });
  const [sort, setSort] = useState({ key: 'callAt', order: 'desc' });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadCalls = async () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '') params.set(key, value);
    params.set('sort', sort.key);
    params.set('order', sort.order);
    const data = await getJson(`/api/calls?${params}`);
    setCalls(data);
  };

  useEffect(() => {
    Promise.all([getJson('/api/agents'), loadCalls()])
      .then(([agentData]) => {
        setAgents(agentData);
        if (agentData[0]) setSelectedAgent(agentData[0].id);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    loadCalls().catch((reason) => setError(reason.message));
  }, [filters, sort]);

  useEffect(() => {
    if (view !== 'agents' || !selectedAgent) return;
    const params = new URLSearchParams();
    if (rangeDays !== 'all') {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - Number(rangeDays));
      params.set('from', from.toISOString().slice(0, 10));
      params.set('to', to.toISOString().slice(0, 10));
    }
    getJson(`/api/agents/${selectedAgent}/analytics?${params}`)
      .then(setAnalytics)
      .catch((reason) => setError(reason.message));
  }, [view, selectedAgent, rangeDays]);

  const visibleCalls = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? calls.filter((call) => `${call.agentName} ${call.agentId} ${call.customer}`.toLowerCase().includes(normalized)) : calls;
  }, [calls, query]);

  const openCall = async (call) => {
    try {
      setSelected(await getJson(`/api/calls/${call.id}`));
      setNotice('');
    } catch (reason) { setError(reason.message); }
  };

  const submitReview = async (review) => {
    try {
      const updated = await getJson(`/api/calls/${selected.id}/reviews`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review),
      });
      setSelected(updated);
      setNotice(`Review v${updated.reviewCount} saved. AI score preserved at ${updated.aiScore}.`);
      await loadCalls();
      if (view === 'agents') {
        const params = new URLSearchParams();
        if (rangeDays !== 'all') {
          const to = new Date();
          const from = new Date();
          from.setDate(from.getDate() - Number(rangeDays));
          params.set('from', from.toISOString().slice(0, 10));
          params.set('to', to.toISOString().slice(0, 10));
        }
        setAnalytics(await getJson(`/api/agents/${selectedAgent}/analytics?${params}`));
      }
    } catch (reason) { setError(reason.message); }
  };

  const changeSort = (key) => setSort((previous) => ({ key, order: previous.key === key && previous.order === 'desc' ? 'asc' : 'desc' }));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#calls" onClick={() => { setView('calls'); setSelected(null); }}>
          <span className="brand-mark"><AudioLines size={21} strokeWidth={2.3} /></span>
          <span>fieldnote<small>QUALITY DESK</small></span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={view === 'calls' ? 'active' : ''} onClick={() => { setView('calls'); setSelected(null); }}><Headphones size={18} />Calls<span className="nav-count">{calls.length || '—'}</span></button>
          <button className={view === 'agents' ? 'active' : ''} onClick={() => { setView('agents'); setSelected(null); }}><Users size={18} />Agent performance</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-card"><span className="workspace-dot" /><span><strong>Northstar Support</strong><small>Quality team</small></span><ChevronDown size={15} /></div>
          <div className="profile-row"><div className="avatar avatar-dark">QA</div><span><strong>Quality Admin</strong><small>Manager</small></span><span className="profile-menu">···</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{view === 'calls' ? 'Call reviews' : 'Agent performance'}</strong></div>
          <label className="search-box"><Search size={16} /><input aria-label="Search agents or customers" placeholder="Search agent or customer" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
          <span className="topbar-date">{formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </header>

        <div className="page-content">
          {error && <div className="alert-banner"><CircleAlert size={18} /><span>{error} <small>Check your MongoDB connection and run <code>npm run seed</code>.</small></span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
          {notice && <div className="success-banner"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}

          {view === 'calls' ? (
            <>
              <div className="page-heading">
                <div><div className="eyebrow"><span className="live-dot" />QUALITY OPERATIONS</div><h1>Call reviews</h1><p>Listen closer. Coach with confidence.</p></div>
                <button className="outline-button" onClick={() => { setFilters({ agent: '', minScore: '', maxScore: '', flagged: '' }); setQuery(''); }}><SlidersHorizontal size={16} />Reset filters</button>
              </div>

              <section className="metric-grid" aria-label="Call review summary">
                <div className="metric-card metric-primary"><div className="metric-top"><span>Calls reviewed</span><span className="metric-icon"><ClipboardCheck size={17} /></span></div><div className="metric-number">{calls.length}<span> this period</span></div><div className="metric-foot"><span className="metric-line" />Across {agents.length} active agents</div></div>
                <div className="metric-card"><div className="metric-top"><span>Average AI score</span><span className="metric-icon"><Activity size={17} /></span></div><div className="metric-number">{calls.length ? Math.round(calls.reduce((sum, call) => sum + call.aiScore, 0) / calls.length) : '—'}<span>/ 100</span></div><div className="metric-foot"><span className="metric-swatch swatch-blue" />AI-scored conversations</div></div>
                <div className="metric-card"><div className="metric-top"><span>Need a closer look</span><span className="metric-icon metric-icon-warn"><CircleAlert size={17} /></span></div><div className="metric-number">{calls.filter((call) => call.issues.some((issue) => issue.status === 'pending')).length}<span> calls</span></div><div className="metric-foot"><span className="metric-swatch swatch-coral" />Open flagged issues</div></div>
                <div className="metric-card"><div className="metric-top"><span>Reviewed by manager</span><span className="metric-icon metric-icon-green"><ShieldCheck size={17} /></span></div><div className="metric-number">{calls.filter((call) => call.managerScore !== null).length}<span> calls</span></div><div className="metric-foot"><span className="metric-swatch swatch-green" />Manager score recorded</div></div>
              </section>

              <section className="list-section">
                <div className="list-heading"><div><h2>Recent calls</h2><p>Review AI-scored conversations and flag coaching opportunities.</p></div><span className="record-count">{visibleCalls.length} RECORDS</span></div>
                <div className="filter-row">
                  <label className="filter-select"><Users size={15} /><select aria-label="Filter by agent" value={filters.agent} onChange={(event) => setFilters({ ...filters, agent: event.target.value })}><option value="">All agents</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><ChevronDown size={14} /></label>
                  <label className="filter-select"><span className="filter-label">Score</span><select aria-label="Minimum score" value={filters.minScore} onChange={(event) => setFilters({ ...filters, minScore: event.target.value })}><option value="">Any min</option><option value="60">60+</option><option value="70">70+</option><option value="80">80+</option><option value="90">90+</option></select><span className="filter-to">to</span><select aria-label="Maximum score" value={filters.maxScore} onChange={(event) => setFilters({ ...filters, maxScore: event.target.value })}><option value="">Any max</option><option value="69">69</option><option value="79">79</option><option value="89">89</option><option value="100">100</option></select></label>
                  <label className="filter-select"><CircleAlert size={15} /><select aria-label="Filter by flagged issues" value={filters.flagged} onChange={(event) => setFilters({ ...filters, flagged: event.target.value })}><option value="">All flags</option><option value="true">Has issues</option><option value="false">No issues</option></select><ChevronDown size={14} /></label>
                  <div className="table-search"><Search size={15} /><input placeholder="Find a call..." aria-label="Find a call" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
                </div>

                <div className="table-wrap"><table><thead><tr>
                  <th><button className="sort-button" onClick={() => changeSort('agent')}>AGENT <SortIcon active={sort.key === 'agent'} order={sort.order} /></button></th><th>CUSTOMER</th><th><button className="sort-button" onClick={() => changeSort('callAt')}>CALL DATE <SortIcon active={sort.key === 'callAt'} order={sort.order} /></button></th><th>DURATION</th><th><button className="sort-button" onClick={() => changeSort('aiScore')}>AI SCORE <SortIcon active={sort.key === 'aiScore'} order={sort.order} /></button></th><th><button className="sort-button" onClick={() => changeSort('managerScore')}>MANAGER <SortIcon active={sort.key === 'managerScore'} order={sort.order} /></button></th><th><button className="sort-button" onClick={() => changeSort('flags')}>FLAGGED <SortIcon active={sort.key === 'flags'} order={sort.order} /></button></th><th />
                </tr></thead><tbody>
                  {loading ? <tr><td colSpan="8" className="empty-state">Connecting to the quality desk…</td></tr> : visibleCalls.map((call) => <tr className={`call-row ${selected?.id === call.id ? 'row-selected' : ''}`} key={call.id} onClick={() => openCall(call)} tabIndex="0" onKeyDown={(event) => event.key === 'Enter' && openCall(call)}>
                    <td><div className="agent-cell"><div className={`avatar avatar-${(call.agentId.charCodeAt(call.agentId.length - 1) % 5) + 1}`}>{initials(call.agentName)}</div><span><strong>{call.agentName}</strong><small>{call.agentId}</small></span></div></td>
                    <td className="customer-name">{call.customer}</td><td>{formatDate(call.callAt, { month: 'short', day: 'numeric', year: 'numeric' })}<small className="cell-sub">{formatDate(call.callAt, { hour: 'numeric', minute: '2-digit' })}</small></td><td><span className="duration"><Clock3 size={13} />{formatDuration(call.durationSeconds)}</span></td>
                    <td><Score value={call.aiScore} compact /></td><td>{call.managerScore === null ? <span className="not-reviewed">Not reviewed</span> : <Score value={call.managerScore} compact />}</td>
                    <td>{call.issues.length ? <span className={`flag-count ${call.issues.some((issue) => issue.status === 'pending') ? 'flag-pending' : 'flag-done'}`}><CircleAlert size={13} />{call.issues.length}<small>issue{call.issues.length === 1 ? '' : 's'}</small></span> : <span className="no-flags">—</span>}</td>
                    <td><button className="row-action" aria-label={`Review ${call.agentName} call`} onClick={(event) => { event.stopPropagation(); openCall(call); }}><ArrowLeft size={15} /></button></td>
                  </tr>)}
                  {!loading && visibleCalls.length === 0 && <tr><td colSpan="8" className="empty-state"><Search size={20} /><strong>No calls found</strong><span>Try widening your filters or clearing your search.</span></td></tr>}
                </tbody></table></div>
                <div className="table-footer"><span>Showing <strong>{visibleCalls.length}</strong> of <strong>{calls.length}</strong> calls</span><span className="footer-legend"><span className="legend-dot legend-blue" />AI score <span className="legend-dot legend-green" />Manager reviewed</span></div>
              </section>
            </>
            ) : <AgentDashboard agents={agents} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} analytics={analytics} rangeDays={rangeDays} setRangeDays={setRangeDays} />}
        </div>
        <footer className="page-footer"><span>FIELDNOTE <span className="footer-separator">/</span> QUALITY INTELLIGENCE</span><span>Review carefully. Coach kindly.</span></footer>
      </main>

      {selected && <ReviewPanel call={selected} onClose={() => setSelected(null)} onSubmit={submitReview} />}
    </div>
  );
}

function SortIcon({ active, order }) {
  if (!active) return <ArrowDown size={12} className="sort-muted" />;
  return order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

function ReviewPanel({ call, onClose, onSubmit }) {
  const [score, setScore] = useState(call.managerScore ?? call.aiScore);
  const [note, setNote] = useState(call.reviews?.at(-1)?.note ?? '');
  const [decisions, setDecisions] = useState(() => Object.fromEntries(call.issues.map((issue) => [issue.id, issue.status === 'pending' ? 'valid' : issue.status])));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = ''; };
  }, [onClose]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ score: Number(score), note, issueDecisions: call.issues.map((issue) => ({ issueId: issue.id, status: decisions[issue.id] })) });
    } finally { setSaving(false); }
  };

  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="review-panel" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="panel-topline"><span><span className="panel-dot" />CALL REVIEW</span><button onClick={onClose} aria-label="Close review"><X size={19} /></button></div>
      <div className="panel-heading"><div><div className="eyebrow">{call.agentId} <span className="crumb-slash">/</span> {formatDate(call.callAt, { month: 'long', day: 'numeric', year: 'numeric' })}</div><h2 id="review-title">{call.agentName}</h2><p>Customer conversation with {call.customer}</p></div></div>
      <div className="call-meta-strip"><span><Clock3 size={15} />{formatDuration(call.durationSeconds)}</span><span><Headphones size={15} />Inbound call</span><span><AudioLines size={15} />Call recording</span></div>
      <div className="score-comparison"><div><span>AI QUALITY SCORE</span><div><Score value={call.aiScore} /></div><small>Original score · never overwritten</small></div><div className="comparison-divider"><ArrowLeft size={17} /></div><div><span>MANAGER SCORE</span><div>{call.managerScore === null ? <strong className="score-empty">—</strong> : <Score value={call.managerScore} />}</div><small>{call.managerScore === null ? 'Awaiting review' : `Latest of ${call.reviewCount} review${call.reviewCount === 1 ? '' : 's'}`}</small></div></div>
      <form className="review-form" onSubmit={save}>
        <section className="review-section"><div className="section-heading"><div><span className="section-kicker">01 / ISSUE CHECK</span><h3>AI-flagged moments <span>{call.issues.length}</span></h3></div><span className="issue-hint">Your call, your judgment</span></div>
          {call.issues.length === 0 ? <div className="no-issues"><ShieldCheck size={20} /><span><strong>Nothing flagged</strong><small>The AI found no issues on this call.</small></span></div> : <div className="issue-list">{call.issues.map((issue) => <div className="issue-card" key={issue.id}><div className="issue-top"><span className="issue-type">{issue.type}</span><span className="issue-time">{formatDuration(issue.timestampSeconds)}</span></div><p>{issue.note}</p><div className="decision-group"><button type="button" className={decisions[issue.id] === 'valid' ? 'decision-active decision-valid' : ''} onClick={() => setDecisions({ ...decisions, [issue.id]: 'valid' })}><Check size={14} />Confirm</button><button type="button" className={decisions[issue.id] === 'invalid' ? 'decision-active decision-invalid' : ''} onClick={() => setDecisions({ ...decisions, [issue.id]: 'invalid' })}><X size={14} />Dismiss</button></div></div>)}</div>}
        </section>
        <section className="review-section score-editor-section"><div className="section-heading"><div><span className="section-kicker">02 / YOUR ASSESSMENT</span><h3>Manager score</h3></div><span className={`score-preview ${scoreColor(Number(score))}`}>{score}<small>/100</small></span></div><div className="range-wrap"><input aria-label="Manager score" type="range" min="0" max="100" value={score} style={{ '--range-progress': `${score}%` }} onChange={(event) => setScore(event.target.value)} /><div className="range-labels"><span>0 · Needs coaching</span><span>Exceptional · 100</span></div></div></section>
        <section className="review-section note-section"><label htmlFor="review-note"><span className="section-kicker">03 / COACHING CONTEXT</span><h3>Manager note <span className="optional-label">OPTIONAL</span></h3></label><textarea id="review-note" rows="3" maxLength="2000" placeholder="Add context for the next coaching conversation..." value={note} onChange={(event) => setNote(event.target.value)} /><div className="char-count">{note.length} / 2,000</div></section>
        {call.reviews?.length > 0 && <section className="history-section"><div className="section-heading"><div><span className="section-kicker">AUDIT TRAIL</span><h3>Previous reviews</h3></div><CheckCheck size={17} /></div>{[...call.reviews].reverse().map((review) => <div className="history-row" key={review._id ?? review.version}><span className="history-version">v{review.version}</span><span><strong>{review.score}/100</strong><small>{formatDate(review.reviewedAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span></div>)}</section>}
        <div className="panel-submit"><span>AI score stays in the audit record.</span><button type="submit" disabled={saving}>{saving ? 'Saving…' : call.reviewCount ? 'Save new review' : 'Save manager review'}<ArrowLeft size={15} /></button></div>
      </form>
    </aside>
  </div>;
}

function AgentDashboard({ agents, selectedAgent, setSelectedAgent, analytics, rangeDays, setRangeDays }) {
  const selected = agents.find((agent) => agent.id === selectedAgent);
  return <>
    <div className="page-heading agent-heading"><div><div className="eyebrow"><span className="live-dot" />PEOPLE & PERFORMANCE</div><h1>Agent performance</h1><p>Spot the patterns. Make every coaching moment count.</p></div><label className="agent-picker"><Users size={16} /><select aria-label="Select agent" value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.id}</option>)}</select><ChevronDown size={15} /></label></div>
    {!analytics ? <div className="dashboard-empty">Choose an agent to see their performance trend.</div> : <>
      <div className="agent-overview"><div className="agent-identity"><div className="avatar avatar-large avatar-2">{initials(analytics.agentName)}</div><span><strong>{analytics.agentName}</strong><small>{selected?.id} <span className="crumb-slash">·</span> {analytics.callCount} calls in period</small></span></div><span className="agent-status"><span className="live-dot" />ACTIVE AGENT</span></div>
      <section className="metric-grid agent-metrics"><div className="metric-card"><div className="metric-top"><span>AI average</span><span className="metric-icon"><Activity size={17} /></span></div><div className="metric-number">{analytics.averageAiScore}<span>/ 100</span></div><div className="metric-foot"><span className="metric-swatch swatch-blue" />Across {analytics.callCount} scored calls</div></div><div className="metric-card metric-primary"><div className="metric-top"><span>Manager average</span><span className="metric-icon metric-icon-green"><ShieldCheck size={17} /></span></div><div className="metric-number">{analytics.averageManagerScore ?? '—'}<span>/ 100</span></div><div className="metric-foot"><span className="metric-swatch swatch-green" />{analytics.reviewedCount} human-reviewed calls</div></div><div className="metric-card"><div className="metric-top"><span>Score adjustment</span><span className="metric-icon"><BarChart3 size={17} /></span></div><div className="metric-number">{analytics.averageManagerScore === null ? '—' : `${analytics.averageManagerScore - analytics.averageAiScore > 0 ? '+' : ''}${analytics.averageManagerScore - analytics.averageAiScore}`}<span> pts</span></div><div className="metric-foot"><span className="metric-line" />Manager vs AI average</div></div><div className="metric-card"><div className="metric-top"><span>Issues confirmed</span><span className="metric-icon metric-icon-warn"><CircleAlert size={17} /></span></div><div className="metric-number">{analytics.issueCounts.reduce((sum, issue) => sum + issue.count, 0)}<span> total</span></div><div className="metric-foot"><span className="metric-swatch swatch-coral" />After manager review</div></div></section>
      <div className="analytics-grid"><section className="chart-panel"><div className="list-heading"><div><span className="section-kicker">SCORE HISTORY</span><h2>Quality over time</h2><p>Call-by-call scores, oldest to newest.</p></div><span className="chart-period">LAST 30 DAYS <ChevronDown size={13} /></span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.trend} margin={{ top: 12, right: 16, left: -17, bottom: 4 }}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#e8ece8" /><XAxis dataKey="date" tickFormatter={(date) => formatDate(date)} tickLine={false} axisLine={false} tick={{ fill: '#8d9691', fontSize: 11 }} minTickGap={32} /><YAxis domain={[40, 100]} tickLine={false} axisLine={false} tick={{ fill: '#8d9691', fontSize: 11 }} /><Tooltip labelFormatter={(date) => formatDate(date, { month: 'long', day: 'numeric' })} formatter={(value, name) => [value === null ? 'Not reviewed' : `${value} / 100`, name === 'aiScore' ? 'AI score' : 'Manager score']} contentStyle={{ border: '1px solid #e3e8e3', borderRadius: 6, fontSize: 12 }} /><Legend formatter={(value) => value === 'aiScore' ? 'AI score' : 'Manager score'} iconType="circle" iconSize={7} wrapperStyle={{ paddingTop: 12, fontSize: 11 }} /><Line type="monotone" dataKey="aiScore" stroke="#5384c5" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls /><Line type="monotone" dataKey="managerScore" stroke="#2c9b71" strokeWidth={2.5} dot={{ r: 2, fill: '#2c9b71', strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls /></LineChart></ResponsiveContainer></div></section>
        <section className="issues-panel"><div className="list-heading"><div><span className="section-kicker">COACHING SIGNALS</span><h2>Top issue types</h2><p>Confirmed flags in this period.</p></div></div>{analytics.issueCounts.length ? <div className="issue-type-list">{analytics.issueCounts.slice(0, 6).map((issue, index) => { const max = analytics.issueCounts[0].count; return <div className="issue-type-row" key={issue.type}><div className="issue-type-name"><span className={`issue-rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><span>{issue.type}</span><strong>{issue.count}</strong></div><div className="issue-bar-track"><span style={{ width: `${Math.max(8, issue.count / max * 100)}%` }} /></div></div>; })}</div> : <div className="no-issues dashboard-no-issues"><ShieldCheck size={20} /><span><strong>No confirmed flags</strong><small>Nothing to coach on for this period.</small></span></div>}<div className="issue-panel-foot">ISSUE COUNTS REFLECT LATEST MANAGER REVIEW</div></section></div>
    </>}
  </>;
}

export default App;