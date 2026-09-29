import {
  Activity,
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';
import Score from './Score.jsx';
import SortIcon from './SortIcon.jsx';
import { formatDate, formatDuration, initials } from '../utils/formatters.js';

function CallQueue({
  calls,
  agents,
  filters,
  setFilters,
  sort,
  onChangeSort,
  query,
  setQuery,
  loading,
  selectedCallId,
  onOpenCall,
  onResetFilters,
  onUpload,
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCalls = normalizedQuery
    ? calls.filter((call) =>
        `${call.agentName} ${call.agentId} ${call.customer}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : calls;
  const scoredCalls = calls.filter((call) => Number.isFinite(call.aiScore));

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            QUALITY OPERATIONS
          </div>
          <h1>Call reviews</h1>
          <p>Listen closer. Coach with confidence.</p>
        </div>
        <div className="heading-actions">
          <button className="outline-button" onClick={onResetFilters}>
            <SlidersHorizontal size={16} />
            Reset filters
          </button>
          <button className="outline-button upload-action" onClick={onUpload}>
            <Upload size={16} />
            Upload recording
          </button>
        </div>
      </div>

      <section className="metric-grid" aria-label="Call review summary">
        <div className="metric-card metric-primary">
          <div className="metric-top">
            <span>Calls in queue</span>
            <span className="metric-icon">
              <ClipboardCheck size={17} />
            </span>
          </div>
          <div className="metric-number">
            {calls.length}
            <span> this period</span>
          </div>
          <div className="metric-foot">
            <span className="metric-line" />
            Across {agents.length} active agents
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Average AI score</span>
            <span className="metric-icon">
              <Activity size={17} />
            </span>
          </div>
          <div className="metric-number">
            {scoredCalls.length
              ? Math.round(
                  scoredCalls.reduce((sum, call) => sum + call.aiScore, 0) / scoredCalls.length,
                )
              : '—'}
            <span>/ 100</span>
          </div>
          <div className="metric-foot">
            <span className="metric-swatch swatch-blue" />
            AI-scored conversations
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Need a closer look</span>
            <span className="metric-icon metric-icon-warn">
              <CircleAlert size={17} />
            </span>
          </div>
          <div className="metric-number">
            {calls.filter((call) => call.issues.some((issue) => issue.status === 'pending')).length}
            <span> calls</span>
          </div>
          <div className="metric-foot">
            <span className="metric-swatch swatch-coral" />
            Open flagged issues
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Reviewed by manager</span>
            <span className="metric-icon metric-icon-green">
              <ShieldCheck size={17} />
            </span>
          </div>
          <div className="metric-number">
            {calls.filter((call) => call.managerScore !== null).length}
            <span> calls</span>
          </div>
          <div className="metric-foot">
            <span className="metric-swatch swatch-green" />
            Manager score recorded
          </div>
        </div>
      </section>

      <section className="list-section">
        <div className="list-heading">
          <div>
            <h2>Recent calls</h2>
            <p>Review AI-scored conversations and flag coaching opportunities.</p>
          </div>
          <span className="record-count">{visibleCalls.length} RECORDS</span>
        </div>
        <div className="filter-row">
          <label className="filter-select">
            <Users size={15} />
            <select
              aria-label="Filter by agent"
              value={filters.agent}
              onChange={(event) => setFilters({ ...filters, agent: event.target.value })}
            >
              <option value="">All agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="filter-select">
            <span className="filter-label">Score</span>
            <select
              aria-label="Minimum score"
              value={filters.minScore}
              onChange={(event) => setFilters({ ...filters, minScore: event.target.value })}
            >
              <option value="">Any min</option>
              <option value="60">60+</option>
              <option value="70">70+</option>
              <option value="80">80+</option>
              <option value="90">90+</option>
            </select>
            <span className="filter-to">to</span>
            <select
              aria-label="Maximum score"
              value={filters.maxScore}
              onChange={(event) => setFilters({ ...filters, maxScore: event.target.value })}
            >
              <option value="">Any max</option>
              <option value="69">69</option>
              <option value="79">79</option>
              <option value="89">89</option>
              <option value="100">100</option>
            </select>
          </label>
          <label className="filter-select">
            <CircleAlert size={15} />
            <select
              aria-label="Filter by flagged issues"
              value={filters.flagged}
              onChange={(event) => setFilters({ ...filters, flagged: event.target.value })}
            >
              <option value="">All flags</option>
              <option value="true">Has issues</option>
              <option value="false">No issues</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="table-search">
            <Search size={15} />
            <input
              placeholder="Find a call..."
              aria-label="Find a call"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button className="sort-button" onClick={() => onChangeSort('agent')}>
                    AGENT <SortIcon active={sort.key === 'agent'} order={sort.order} />
                  </button>
                </th>
                <th>CUSTOMER</th>
                <th>
                  <button className="sort-button" onClick={() => onChangeSort('callAt')}>
                    CALL DATE <SortIcon active={sort.key === 'callAt'} order={sort.order} />
                  </button>
                </th>
                <th>DURATION</th>
                <th>
                  <button className="sort-button" onClick={() => onChangeSort('aiScore')}>
                    AI SCORE <SortIcon active={sort.key === 'aiScore'} order={sort.order} />
                  </button>
                </th>
                <th>
                  <button className="sort-button" onClick={() => onChangeSort('managerScore')}>
                    MANAGER <SortIcon active={sort.key === 'managerScore'} order={sort.order} />
                  </button>
                </th>
                <th>
                  <button className="sort-button" onClick={() => onChangeSort('flags')}>
                    FLAGGED <SortIcon active={sort.key === 'flags'} order={sort.order} />
                  </button>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    Connecting to the quality desk…
                  </td>
                </tr>
              ) : (
                visibleCalls.map((call) => (
                  <tr
                    className={`call-row ${selectedCallId === call.id ? 'row-selected' : ''}`}
                    key={call.id}
                    onClick={() => onOpenCall(call)}
                    tabIndex="0"
                    onKeyDown={(event) => event.key === 'Enter' && onOpenCall(call)}
                  >
                    <td>
                      <div className="agent-cell">
                        <div
                          className={`avatar avatar-${(call.agentId.charCodeAt(call.agentId.length - 1) % 5) + 1}`}
                        >
                          {initials(call.agentName)}
                        </div>
                        <span>
                          <strong>{call.agentName}</strong>
                          <small>{call.agentId}</small>
                        </span>
                      </div>
                    </td>
                    <td className="customer-name">{call.customer}</td>
                    <td>
                      {formatDate(call.callAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                      <small className="cell-sub">
                        {formatDate(call.callAt, { hour: 'numeric', minute: '2-digit' })}
                      </small>
                    </td>
                    <td>
                      {call.durationSeconds ? (
                        <span className="duration">
                          <Clock3 size={13} />
                          {formatDuration(call.durationSeconds)}
                        </span>
                      ) : (
                        <span className="not-reviewed">Pending</span>
                      )}
                    </td>
                    <td>
                      {call.aiScore === null ? (
                        <span className="processing-badge">
                          {call.status === 'failed' ? 'Analysis failed' : 'Awaiting analysis'}
                        </span>
                      ) : (
                        <Score value={call.aiScore} compact />
                      )}
                    </td>
                    <td>
                      {call.managerScore === null ? (
                        <span className="not-reviewed">Not reviewed</span>
                      ) : (
                        <Score value={call.managerScore} compact />
                      )}
                    </td>
                    <td>
                      {call.issues.length ? (
                        <span
                          className={`flag-count ${call.issues.some((issue) => issue.status === 'pending') ? 'flag-pending' : 'flag-done'}`}
                        >
                          <CircleAlert size={13} />
                          {call.issues.length}
                          <small>issue{call.issues.length === 1 ? '' : 's'}</small>
                        </span>
                      ) : (
                        <span className="no-flags">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="row-action"
                        aria-label={`Review ${call.agentName} call`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenCall(call);
                        }}
                      >
                        <ArrowLeft size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && visibleCalls.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <Search size={20} />
                    <strong>No calls found</strong>
                    <span>Try widening your filters or clearing your search.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            Showing <strong>{visibleCalls.length}</strong> of <strong>{calls.length}</strong> calls
          </span>
          <span className="footer-legend">
            <span className="legend-dot legend-blue" />
            AI score
            <span className="legend-dot legend-green" />
            Manager reviewed
          </span>
        </div>
      </section>
    </>
  );
}

export default CallQueue;
