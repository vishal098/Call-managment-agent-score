import { Activity, BarChart3, ChevronDown, CircleAlert, ShieldCheck, Users } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate, initials } from '../utils/formatters.js';

function AgentDashboard({
  agents,
  selectedAgent,
  setSelectedAgent,
  analytics,
  rangeDays,
  setRangeDays,
}) {
  const selected = agents.find((agent) => agent.id === selectedAgent);

  return (
    <>
      <div className="page-heading agent-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            PEOPLE & PERFORMANCE
          </div>
          <h1>Agent performance</h1>
          <p>Spot the patterns. Make every coaching moment count.</p>
        </div>
        <label className="agent-picker">
          <Users size={16} />
          <select
            aria-label="Select agent"
            value={selectedAgent}
            onChange={(event) => setSelectedAgent(event.target.value)}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.id}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      {!analytics ? (
        <div className="dashboard-empty">Choose an agent to see their performance trend.</div>
      ) : (
        <>
          <div className="agent-overview">
            <div className="agent-identity">
              <div className="avatar avatar-large avatar-2">{initials(analytics.agentName)}</div>
              <span>
                <strong>{analytics.agentName}</strong>
                <small>
                  {selected?.id} <span className="crumb-slash">·</span> {analytics.callCount} calls
                  in period
                </small>
              </span>
            </div>
            <span className="agent-status">
              <span className="live-dot" />
              ACTIVE AGENT
            </span>
          </div>
          <section className="metric-grid agent-metrics">
            <div className="metric-card">
              <div className="metric-top">
                <span>AI average</span>
                <span className="metric-icon">
                  <Activity size={17} />
                </span>
              </div>
              <div className="metric-number">
                {analytics.averageAiScore}
                <span>/ 100</span>
              </div>
              <div className="metric-foot">
                <span className="metric-swatch swatch-blue" />
                Across {analytics.callCount} scored calls
              </div>
            </div>
            <div className="metric-card metric-primary">
              <div className="metric-top">
                <span>Manager average</span>
                <span className="metric-icon metric-icon-green">
                  <ShieldCheck size={17} />
                </span>
              </div>
              <div className="metric-number">
                {analytics.averageManagerScore ?? '—'}
                <span>/ 100</span>
              </div>
              <div className="metric-foot">
                <span className="metric-swatch swatch-green" />
                {analytics.reviewedCount} human-reviewed calls
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-top">
                <span>Score adjustment</span>
                <span className="metric-icon">
                  <BarChart3 size={17} />
                </span>
              </div>
              <div className="metric-number">
                {analytics.averageManagerScore === null
                  ? '—'
                  : `${analytics.averageManagerScore - analytics.averageAiScore > 0 ? '+' : ''}${analytics.averageManagerScore - analytics.averageAiScore}`}
                <span> pts</span>
              </div>
              <div className="metric-foot">
                <span className="metric-line" />
                Manager vs AI average
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-top">
                <span>Issues confirmed</span>
                <span className="metric-icon metric-icon-warn">
                  <CircleAlert size={17} />
                </span>
              </div>
              <div className="metric-number">
                {analytics.issueCounts.reduce((sum, issue) => sum + issue.count, 0)}
                <span> total</span>
              </div>
              <div className="metric-foot">
                <span className="metric-swatch swatch-coral" />
                After manager review
              </div>
            </div>
          </section>
          <div className="analytics-grid">
            <section className="chart-panel">
              <div className="list-heading">
                <div>
                  <span className="section-kicker">SCORE HISTORY</span>
                  <h2>Quality over time</h2>
                  <p>Call-by-call scores, oldest to newest.</p>
                </div>
                <label className="chart-period">
                  <select
                    aria-label="Agent date range"
                    value={rangeDays}
                    onChange={(event) => setRangeDays(event.target.value)}
                  >
                    <option value="30">LAST 30 DAYS</option>
                    <option value="90">LAST 90 DAYS</option>
                    <option value="all">ALL TIME</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analytics.trend}
                    margin={{ top: 12, right: 16, left: -17, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#e8ece8" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => formatDate(date)}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#8d9691', fontSize: 11 }}
                      minTickGap={32}
                    />
                    <YAxis
                      domain={[40, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#8d9691', fontSize: 11 }}
                    />
                    <Tooltip
                      labelFormatter={(date) => formatDate(date, { month: 'long', day: 'numeric' })}
                      formatter={(value, name) => [
                        value === null ? 'Not reviewed' : `${value} / 100`,
                        name === 'aiScore' ? 'AI score' : 'Manager score',
                      ]}
                      contentStyle={{ border: '1px solid #e3e8e3', borderRadius: 6, fontSize: 12 }}
                    />
                    <Legend
                      formatter={(value) => (value === 'aiScore' ? 'AI score' : 'Manager score')}
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ paddingTop: 12, fontSize: 11 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="aiScore"
                      stroke="#5384c5"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="managerScore"
                      stroke="#2c9b71"
                      strokeWidth={2.5}
                      dot={{ r: 2, fill: '#2c9b71', strokeWidth: 0 }}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="issues-panel">
              <div className="list-heading">
                <div>
                  <span className="section-kicker">COACHING SIGNALS</span>
                  <h2>Top issue types</h2>
                  <p>Confirmed flags in this period.</p>
                </div>
              </div>
              {analytics.issueCounts.length ? (
                <div className="issue-type-list">
                  {analytics.issueCounts.slice(0, 6).map((issue, index) => {
                    const max = analytics.issueCounts[0].count;
                    return (
                      <div className="issue-type-row" key={issue.type}>
                        <div className="issue-type-name">
                          <span className={`issue-rank rank-${index + 1}`}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span>{issue.type}</span>
                          <strong>{issue.count}</strong>
                        </div>
                        <div className="issue-bar-track">
                          <span style={{ width: `${Math.max(8, (issue.count / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-issues dashboard-no-issues">
                  <ShieldCheck size={20} />
                  <span>
                    <strong>No confirmed flags</strong>
                    <small>Nothing to coach on for this period.</small>
                  </span>
                </div>
              )}
              <div className="issue-panel-foot">ISSUE COUNTS REFLECT LATEST MANAGER REVIEW</div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

export default AgentDashboard;
