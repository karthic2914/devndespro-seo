// frontend/src/components/AIVisibilitySections3to7.jsx
// Matches your actual dashboard palette (Overview page):
// orange primary #F97316, purple accent #7C3AED, teal #14B8A6,
// dark navy banner #0F172A, green success #16A34A, uppercase gray labels.

import { useState, useEffect } from 'react';

const COLORS = {
  orange: '#F97316',
  orangeLight: '#FFF1E6',
  orangeBorder: '#FED7AA',
  purple: '#7C3AED',
  teal: '#14B8A6',
  navy: '#0F172A',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  red: '#DC2626',
  redLight: '#FEF2F2',
  amber: '#D97706',
  amberLight: '#FFFBEB',
  gray: '#6B7280',
  border: '#E5E7EB',
};

const ENGINE_META = {
  chatgpt: { label: 'ChatGPT', color: COLORS.green },
  claude: { label: 'Claude', color: COLORS.orange },
  gemini: { label: 'Gemini', color: COLORS.purple },
  perplexity: { label: 'Perplexity', color: COLORS.teal },
};

const SEVERITY_STYLE = {
  High: { bg: COLORS.redLight, text: COLORS.red },
  Medium: { bg: COLORS.amberLight, text: COLORS.amber },
  Low: { bg: COLORS.greenLight, text: COLORS.green },
};

const Label = ({ children }) => (
  <div className="text-xs font-semibold tracking-wide uppercase" style={{ color: COLORS.gray }}>{children}</div>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border p-5 ${className}`} style={{ borderColor: COLORS.border }}>
    {children}
  </div>
);

// ---------- Section 3: Multi-engine comparison table ----------
export function VisibilityResultsCard({ questions, scanResults }) {
  const [selectedQuestion, setSelectedQuestion] = useState(questions?.[0] || '');
  const rowsForQuestion = scanResults?.[selectedQuestion] || {};
  const engines = Object.keys(rowsForQuestion).length ? Object.keys(rowsForQuestion) : ['chatgpt', 'claude'];

  const rowsByRank = Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1;
    const row = { rank };
    engines.forEach(engine => {
      const top10 = rowsForQuestion[engine]?.top10 || [];
      const hit = top10.find(r => r.rank === rank);
      row[engine] = hit?.name || null;
    });
    return row;
  });

  return (
    <Card>
      <Label>AI Visibility Results (SEO Platform)</Label>
      <select
        className="border rounded-lg px-3 py-2 text-sm w-full mt-3 mb-4"
        style={{ borderColor: COLORS.border }}
        value={selectedQuestion}
        onChange={e => setSelectedQuestion(e.target.value)}
      >
        {(questions || []).map(q => <option key={q} value={q}>{q}</option>)}
      </select>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: COLORS.border }}>
              <th className="py-2 pr-4" style={{ color: COLORS.gray }}>RANK</th>
              {engines.map(e => (
                <th key={e} className="py-2 pr-4 font-semibold" style={{ color: ENGINE_META[e]?.color }}>
                  {ENGINE_META[e]?.label || e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsByRank.map(row => (
              <tr key={row.rank} className="border-b last:border-0" style={{ borderColor: COLORS.border }}>
                <td className="py-2 pr-4" style={{ color: COLORS.gray }}>{row.rank}</td>
                {engines.map(e => (
                  <td key={e} className="py-2 pr-4 font-medium">{row[e] || <span style={{ color: '#D1D5DB' }}> - </span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- Section 4: Summary score card (styled like your SITE HEALTH gauge card) ----------
export function VisibilitySummaryCard({ siteId }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetch(`/api/${siteId}/ai-visibility/summary`).then(r => r.json()).then(setSummary).catch(() => {});
  }, [siteId]);

  if (!summary) return null;

  const status = summary.label === 'Strong'
    ? { color: COLORS.green, bg: COLORS.greenLight, tag: 'Strong' }
    : summary.label === 'Moderate'
      ? { color: COLORS.amber, bg: COLORS.amberLight, tag: 'Needs Work' }
      : { color: COLORS.orange, bg: COLORS.orangeLight, tag: 'Needs Work' };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <Label>AI Visibility Summary (SEO Platform)</Label>
      </div>

      <div className="flex items-center gap-5 mb-4">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke={COLORS.border} strokeWidth="10" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke={status.color} strokeWidth="10"
              strokeDasharray={`${(summary.overallScore / 100) * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute text-2xl font-bold" style={{ color: COLORS.navy }}>{summary.overallScore}%</div>
        </div>
        <div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: status.bg, color: status.color }}>
            {status.tag}
          </span>
          <div className="text-sm mt-1" style={{ color: COLORS.gray }}>Overall Visibility Score</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><Label>Top 10 Presence</Label><div className="font-semibold text-lg">{summary.top10Presence}</div></div>
        <div><Label>Average Rank</Label><div className="font-semibold text-lg">{summary.averageRank}</div></div>
        <div><Label>Questions Tested</Label><div className="font-semibold text-lg">{summary.questionsTested}</div></div>
        <div><Label>Total Mentions</Label><div className="font-semibold text-lg">{summary.totalMentions}</div></div>
      </div>

      {summary.label === 'Low' && (
        <div className="mt-4 text-sm rounded-lg p-3" style={{ background: COLORS.orangeLight, color: '#9A3412' }}>
          Not consistently recommended by AI engines.
        </div>
      )}
    </Card>
  );
}

// ---------- Section 5: Reasoning panel ----------
export function VisibilityReasoningCard({ siteId, siteName }) {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = () => {
    setLoading(true);
    fetch(`/api/${siteId}/ai-visibility/reasoning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteName }),
    })
      .then(r => r.json())
      .then(d => setReasons(d.reasoning || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { generate(); }, [siteId]); // eslint-disable-line

  return (
    <Card>
      <Label>Why is {siteName} not in the Top 10?</Label>
      {loading && <div className="text-sm mt-3" style={{ color: '#9CA3AF' }}>Analyzing...</div>}
      <ul className="space-y-2 mt-3">
        {reasons.map((r, i) => {
          const s = SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.Low;
          return (
            <li key={i} className="flex items-center justify-between text-sm py-1">
              <span style={{ color: COLORS.navy }}>{r.issue}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.text }}>
                {r.severity}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Section 6: Recommendations (styled like your Action Plan card) ----------
export function VisibilityRecommendationsCard({ siteId, siteName, reasoning }) {
  const [recs, setRecs] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!reasoning?.length) return;
    fetch(`/api/${siteId}/ai-visibility/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteName, reasoning }),
    })
      .then(r => r.json())
      .then(d => setRecs(d.recommendations || []));
  }, [siteId, siteName, reasoning]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <Label>Actionable Recommendations</Label>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: COLORS.orangeLight, color: COLORS.orange }}>
          Top {Math.min(3, recs.length)}
        </span>
      </div>
      <div className="space-y-3">
        {recs.slice(0, 3).map((r, i) => {
          const s = SEVERITY_STYLE[r.priority] || SEVERITY_STYLE.Low;
          return (
            <div key={i} className="flex items-start justify-between border rounded-xl p-3" style={{ borderColor: COLORS.border }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm" style={{ color: COLORS.navy }}>{i + 1}. {r.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.text }}>
                    {r.priority}
                  </span>
                </div>
                <div className="text-sm mt-1" style={{ color: COLORS.gray }}>{r.detail}</div>
                {expanded === i && (
                  <ol className="list-decimal list-inside text-sm mt-2 space-y-1" style={{ color: COLORS.gray }}>
                    {(r.plan || []).map((step, si) => <li key={si}>{step}</li>)}
                  </ol>
                )}
              </div>
              <button
                className="text-sm border rounded-lg px-3 py-1 whitespace-nowrap font-medium"
                style={{ color: COLORS.orange, borderColor: COLORS.orangeBorder }}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                {expanded === i ? 'Hide' : 'View Plan'}
              </button>
            </div>
          );
        })}
      </div>
      {recs.length > 3 && (
        <button className="text-sm font-medium mt-3" style={{ color: COLORS.purple }}>
          View all {recs.length} recommendations ->
        </button>
      )}
    </Card>
  );
}

// ---------- Section 7: History trend ----------
export function VisibilityHistoryCard({ siteId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`/api/${siteId}/ai-visibility/history`).then(r => r.json()).then(d => setHistory(d.history || []));
  }, [siteId]);

  const bucketOrder = { top3: 0, top10: 1, top20: 2, not_in_top20: 3 };
  const dates = [...new Set(history.map(h => h.snapshot_date))].sort();
  const engines = [...new Set(history.map(h => h.engine))];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <Label>AI Visibility History (SEO Platform)</Label>
        <button className="text-sm font-medium" style={{ color: COLORS.purple }}>View History</button>
      </div>
      {!history.length && <div className="text-sm" style={{ color: '#9CA3AF' }}>No history yet  -  run a scan weekly to build the trend.</div>}
      {!!history.length && (
        <svg viewBox={`0 0 ${dates.length * 80 + 40} 160`} className="w-full h-40">
          {engines.map((engine) => {
            const points = dates.map((d, i) => {
              const point = history.find(h => h.snapshot_date === d && h.engine === engine);
              const y = point ? bucketOrder[point.bucket] * 40 + 10 : 130;
              return `${i * 80 + 20},${y}`;
            }).join(' ');
            return (
              <polyline
                key={engine}
                points={points}
                fill="none"
                stroke={ENGINE_META[engine]?.color || COLORS.gray}
                strokeWidth="2.5"
              />
            );
          })}
        </svg>
      )}
      <div className="flex gap-4 mt-2 text-xs">
        {engines.map(e => (
          <span key={e} className="flex items-center gap-1" style={{ color: COLORS.gray }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: ENGINE_META[e]?.color }} />
            {ENGINE_META[e]?.label || e}
          </span>
        ))}
      </div>
    </Card>
  );
}

