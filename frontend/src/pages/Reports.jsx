import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faProjectDiagram, faLink, faKey, faClipboardList } from '@fortawesome/free-solid-svg-icons'
import { Button } from '../components/UI'

export default function Reports() {
  const [stats, setStats] = useState({ projects: 0, keywords: 0, backlinks: 0, avgHealth: 0 })
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState([])
  const [healthTrend, setHealthTrend] = useState({ dates: [], values: [] })
  const [keywordTrend, setKeywordTrend] = useState({ dates: [], values: [] })
  const [backlinkTrend, setBacklinkTrend] = useState({ dates: [], values: [] })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/reports/summary').then(res => res.json()),
      fetch('/api/reports/health-trend').then(res => res.json()),
      fetch('/api/reports/keyword-trend').then(res => res.json()),
      fetch('/api/reports/backlink-trend').then(res => res.json()),
    ])
      .then(([summary, health, keywords, backlinks]) => {
        setStats({
          projects: summary.projects,
          keywords: summary.keywords,
          backlinks: summary.backlinks,
          avgHealth: summary.avgHealth,
        })
        setRecent(Array.isArray(summary.recent) ? summary.recent : [])
        setHealthTrend(health)
        setKeywordTrend(keywords)
        setBacklinkTrend(backlinks)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Convert trend data to recharts format
  const toChartData = (trend) =>
    (trend.dates || []).map((date, i) => ({ date, value: trend.values?.[i] ?? 0 }))

  const healthData    = toChartData(healthTrend)
  const keywordData   = toChartData(keywordTrend)
  const backlinkData  = toChartData(backlinkTrend)

  const ChartCard = ({ title, data, color }) => (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 18 }}>
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{title}</div>
      {data.length === 0 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E5E7EB' }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${color.replace('#', '')})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )

  return (
    <div className="page-content fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Reports</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Overview and analytics for all your SEO projects.</p>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Button variant="primary" onClick={() => window.location.href = '/'}>Add Project</Button>
        <Button variant="secondary" onClick={() => window.location.href = '/'}>Run Site Audit</Button>
        <Button variant="secondary" onClick={() => window.print()}>Export Dashboard</Button>
      </div>

      {/* Goal Progress Bars */}
      <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Backlink Goal</div>
          <div style={{ background: '#F3F4F6', borderRadius: 8, height: 16, position: 'relative' }}>
            <div style={{
              width: `${Math.min(100, Math.round((stats.backlinks / 200) * 100))}%`,
              background: 'linear-gradient(90deg,#FF6B2B,#FFB347)',
              height: '100%', borderRadius: 8,
            }} />
            <div style={{ position: 'absolute', left: 10, top: 0, fontSize: 12, color: '#111', height: '100%', display: 'flex', alignItems: 'center' }}>
              {stats.backlinks} / 200
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Avg. Health Goal</div>
          <div style={{ background: '#F3F4F6', borderRadius: 8, height: 16, position: 'relative' }}>
            <div style={{
              width: `${Math.min(100, Math.round((stats.avgHealth / 90) * 100))}%`,
              background: 'linear-gradient(90deg,#D97706,#FDE68A)',
              height: '100%', borderRadius: 8,
            }} />
            <div style={{ position: 'absolute', left: 10, top: 0, fontSize: 12, color: '#111', height: '100%', display: 'flex', alignItems: 'center' }}>
              {stats.avgHealth}% / 90%
            </div>
          </div>
        </div>
      </div>

      {/* Trend Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 32 }}>
        <ChartCard title="Avg. Health Trend (30d)"  data={healthData}   color="#D97706" />
        <ChartCard title="Keyword Growth (30d)"     data={keywordData}  color="#16A34A" />
        <ChartCard title="Backlink Growth (30d)"    data={backlinkData} color="#FF6B2B" />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 32 }}>
        <div className="report-card">
          <FontAwesomeIcon icon={faProjectDiagram} style={{ fontSize: 28, color: '#2563EB', marginBottom: 8 }} />
          <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? '—' : stats.projects}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Total Projects</div>
        </div>
        <div className="report-card">
          <FontAwesomeIcon icon={faKey} style={{ fontSize: 28, color: '#16A34A', marginBottom: 8 }} />
          <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? '—' : stats.keywords}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Total Keywords</div>
        </div>
        <div className="report-card">
          <FontAwesomeIcon icon={faLink} style={{ fontSize: 28, color: '#FF6B2B', marginBottom: 8 }} />
          <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? '—' : stats.backlinks}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Total Backlinks</div>
        </div>
        <div className="report-card">
          <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 28, color: '#D97706', marginBottom: 8 }} />
          <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? '—' : stats.avgHealth + '%'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Avg. Health Score</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 32, minHeight: 220 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          <FontAwesomeIcon icon={faClipboardList} style={{ marginRight: 8, color: '#2563EB' }} />
          Recent Activity & Audits
        </h2>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading...</div>
        ) : recent.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>No recent activity to display.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recent.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ fontWeight: 600, color: '#2563EB', fontSize: 15 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{item.type} &middot; {item.severity}</div>
                <div style={{ fontSize: 14, color: '#111827', margin: '4px 0' }}>{item.message}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{new Date(item.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}