import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from '../utils/toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faCheck, faBolt, faArrowRight, faWandMagicSparkles, faCopy, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, Badge, OrangeBtn, PageHeader, EmptyState, T, Modal } from '../components/UI'
import AppProcessTopBar from '../components/AppProcessTopBar'
import { ACTIONS_PAGE_FLOW } from '../constants/pageFlows'
import useProcessScrollSpy from '../hooks/useProcessScrollSpy'
import api from '../utils/api'
import MobileActionPlan from './actions-mobile/MobileActionPlan'

function impactRank(impact) {
  const i = String(impact || '').toLowerCase()
  if (i === 'critical') return 0
  if (i === 'high') return 1
  if (i === 'medium') return 2
  if (i === 'low') return 3
  return 4
}

function sortPending(list) {
  return [...list].sort((a, b) => {
    const scoreDiff = (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0)
    if (scoreDiff) return scoreDiff
    return impactRank(a.impact) - impactRank(b.impact)
  })
}

function bucketFor(impact) {
  const i = String(impact || '').toLowerCase()
  if (i === 'critical' || i === 'high') return 'first'
  if (i === 'low') return 'later'
  return 'then'
}

function priorityLabel(impact) {
  const b = bucketFor(impact)
  if (b === 'first') return { text: 'Do now', bg: '#FEE2E2', color: '#B91C1C' }
  if (b === 'later') return { text: 'Later', bg: '#F1F5F9', color: '#64748B' }
  return { text: 'Soon', bg: '#FFEDD5', color: '#C2410C' }
}

function pathForAction(action) {
  const cat = String(action?.category || '').toLowerCase()
  const text = String(action?.text || '').toLowerCase()
  if (cat === 'rankings' || text.includes('keyword') || text.includes('search console')) return 'keywords'
  if (cat === 'links' || text.includes('backlink')) return 'backlinks'
  if (cat === 'indexing' || cat === 'technical' || cat === 'on-page' || cat === 'content') return 'audit'
  return 'audit'
}

function ActionRow({ a, onToggle, onRemove, onAskAiFix, emphasize, rankNum }) {
  const pri = priorityLabel(a.impact)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 10px',
        borderBottom: emphasize ? undefined : `1px solid ${T.border}`,
        background: emphasize ? '#FFF7ED' : 'transparent',
        borderRadius: emphasize ? 10 : 0,
        border: emphasize ? '1px solid #FED7AA' : undefined,
        marginBottom: emphasize ? 8 : 0,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 99,
          flexShrink: 0,
          marginTop: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          background: emphasize ? '#EA580C' : pri.bg,
          color: emphasize ? '#fff' : pri.color,
        }}
        title={`Priority ${rankNum || ''}`}
      >
        {rankNum || '#'}
      </div>
      <div
        onClick={() => onToggle(a.id, a.done)}
        style={{
          width: 20,
          height: 20,
          marginTop: 4,
          borderRadius: '50%',
          border: '2px solid var(--dark4)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--orange)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--dark4)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: emphasize ? 700 : 500, color: T.text, lineHeight: 1.4 }}>
          {a.text}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            background: pri.bg,
            color: pri.color,
            borderRadius: 99,
            padding: '2px 8px',
          }}>
            {pri.text}
          </span>
          <Badge status={a.impact} />
          {a.category ? (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#64748B',
              background: '#F1F5F9',
              borderRadius: 99,
              padding: '2px 8px',
            }}>
              {a.category}
            </span>
          ) : null}
          {a.source === 'growth' ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>Growth</span>
          ) : null}
        </div>
        {a.why ? (
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
            Why it matters: {a.why}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onAskAiFix(a)}
        title="Get AI help to fix this"
        style={{
          background: '#FFF7ED',
          border: '1px solid #FDBA74',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: '#EA580C',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <FontAwesomeIcon icon={faWandMagicSparkles} />
        AI Fix
      </button>
      <button
        type="button"
        onClick={() => onRemove(a.id)}
        style={{ background: 'none', color: 'var(--muted)', fontSize: 18, border: 0, cursor: 'pointer' }}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  )
}

export default function Actions() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [form, setForm] = useState({ text: '', impact: 'Medium' })
  const [adding, setAdding] = useState(false)
  const [scrollFlowId, setScrollFlowId] = useProcessScrollSpy(ACTIONS_PAGE_FLOW, [loading, actions.length])
  const [siteUrl, setSiteUrl] = useState('')
  const [fixAction, setFixAction] = useState(null)
  const [aiFix, setAiFix] = useState(null)
  const [loadingAiFix, setLoadingAiFix] = useState(false)
  const [copiedFix, setCopiedFix] = useState(false)
  const aiFixCacheRef = useRef({})

  useEffect(() => {
    api.get(`/sites/${siteId}`).then((r) => {
      setSiteUrl(r.data?.url || '')
    }).catch(() => {
      try {
        const stored = JSON.parse(localStorage.getItem('activeSite') || 'null')
        if (stored?.url) setSiteUrl(stored.url)
      } catch { /* ignore */ }
    })
  }, [siteId])

  const load = () =>
    api.get(`/sites/${siteId}/actions`)
      .then(async () => {
        try {
          const synced = await api.post(`/sites/${siteId}/actions/sync-from-audit`)
          if (Array.isArray(synced.data?.actions)) {
            setActions(synced.data.actions)
            if (synced.data.completed > 0) {
              toast.success(`${synced.data.completed} issue(s) marked fixed from latest audit`)
            }
            return
          }
        } catch { /* fall through */ }
        const r = await api.get(`/sites/${siteId}/actions`)
        setActions(Array.isArray(r.data) ? r.data : [])
      })
      .finally(() => setLoading(false))
  useEffect(() => { load() }, [siteId])

  const refreshFromAudit = async () => {
    setSyncing(true)
    try {
      const synced = await api.post(`/sites/${siteId}/actions/sync-from-audit`)
      if (Array.isArray(synced.data?.actions)) setActions(synced.data.actions)
      const seeded = Number(synced.data?.seeded) || 0
      const completed = Number(synced.data?.completed) || 0
      if (seeded || completed) {
        toast.success(`Synced: ${seeded} new, ${completed} fixed`)
      } else {
        toast.success('Action Plan updated for ranking priority')
      }
    } catch {
      toast.error('Could not refresh from audit')
    }
    setSyncing(false)
  }

  const add = async () => {
    if (!form.text.trim()) {
      toast.error('Action text is required')
      return
    }
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/actions`, { text: form.text.trim(), impact: form.impact })
      setForm({ text: '', impact: 'Medium' })
      toast.success('Action added')
      load()
    } catch {
      toast.error('Failed to add action')
    }
    setAdding(false)
  }

  const toggle = async (id, done) => {
    try {
      const { data } = await api.put(`/sites/${siteId}/actions/${id}`, { done: !done })
      if (!done && data?.healthDelta) {
        toast.success(`Completed. Site Health +${data.healthDelta}`)
        if (data.health != null) {
          window.dispatchEvent(new CustomEvent('site-health-updated', { detail: { health: data.health } }))
        }
      } else {
        toast.success(done ? 'Action moved to pending' : 'Action marked complete')
      }
      load()
    } catch {
      toast.error('Failed to update action')
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/sites/${siteId}/actions/${id}`)
      toast.success('Action deleted')
      load()
    } catch {
      toast.error('Failed to delete action')
    }
  }

  const askAiFix = async (action) => {
    setFixAction(action)
    setCopiedFix(false)
    const cacheKey = String(action.id)
    if (aiFixCacheRef.current[cacheKey]) {
      setAiFix(aiFixCacheRef.current[cacheKey])
      setLoadingAiFix(false)
      return
    }
    setAiFix(null)
    setLoadingAiFix(true)
    try {
      let url = siteUrl
      if (!url) {
        const r = await api.get(`/sites/${siteId}`)
        url = r.data?.url || ''
        setSiteUrl(url)
      }
      if (!url) throw new Error('Site URL missing')
      const { data } = await api.post(`/sites/${siteId}/audit/ai-fix`, {
        siteUrl: url,
        issue: {
          message: action.text,
          category: action.category || 'On-Page SEO',
          impact: action.impact || 'Medium',
          status: 'error',
          detail: action.why || '',
        },
      })
      aiFixCacheRef.current[cacheKey] = data
      setAiFix(data)
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Could not generate AI fix'
      setAiFix({ fix: msg, why: 'AI could not generate a fix for this item right now.' })
      toast.error(msg)
    }
    setLoadingAiFix(false)
  }

  const closeAiFix = () => {
    setFixAction(null)
    setAiFix(null)
    setLoadingAiFix(false)
    setCopiedFix(false)
  }

  const copyAiFix = async () => {
    const text = aiFix?.fix || ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFix(true)
      toast.success('Fix copied')
      setTimeout(() => setCopiedFix(false), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }

  const pending = useMemo(
    () => sortPending(actions.filter((a) => !a.done)),
    [actions]
  )
  const completed = actions.filter((a) => a.done)
  const done = completed.length
  const completionPercent = actions.length
    ? Math.round((done / actions.length) * 100)
    : 0
  const next = pending[0] || null
  const doFirst = pending.filter((a) => bucketFor(a.impact) === 'first')
  const doThen = pending.filter((a) => bucketFor(a.impact) === 'then')
  const doLater = pending.filter((a) => bucketFor(a.impact) === 'later')

  const renderGroup = (title, hint, items, color) => {
    if (!items.length) return null
    return (
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            background: color,
            flexShrink: 0,
          }} />
          <SectionLabel>{title}</SectionLabel>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>{hint}</div>
        {items.map((a) => (
          <ActionRow
            key={a.id}
            a={a}
            rankNum={pending.findIndex((p) => p.id === a.id) + 1}
            emphasize={false}
            onToggle={toggle}
            onRemove={remove}
            onAskAiFix={askAiFix}
          />
        ))}
      </Card>
    )
  }

  return (
    <div className="fade-in">
        <AppProcessTopBar
          steps={ACTIONS_PAGE_FLOW.map((s) => ({
          ...s,
          done: s.id === 'pending' ? pending.length === 0 && actions.length > 0 : false,
          active: scrollFlowId === s.id,
          onClick: () => {
            setScrollFlowId(s.id)
            if (s.sectionId) {
              document.getElementById(s.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          },
        }))}
      />
      <div className="actions-desktop-layout">
      <div className="page-content">
      <PageHeader
        title="Action Plan"
        subtitle="Numbered by ranking impact - start at #1 and work down"
        action={
          <OrangeBtn onClick={refreshFromAudit} disabled={syncing || loading} style={{ height: 36 }}>
            {syncing ? 'Refreshing…' : 'Refresh priorities'}
          </OrangeBtn>
        }
      />

      <div
        id="actions-section-banner"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
          padding: '10px 12px',
          background: '#F8FAFC',
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: T.text, marginRight: 4 }}>Priority guide:</span>
        <span style={{ fontSize: 11, fontWeight: 800, background: '#FEE2E2', color: '#B91C1C', borderRadius: 99, padding: '4px 10px' }}>
          Do now ({doFirst.length})
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, background: '#FFEDD5', color: '#C2410C', borderRadius: 99, padding: '4px 10px' }}>
          Soon ({doThen.length})
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, background: '#F1F5F9', color: '#64748B', borderRadius: 99, padding: '4px 10px' }}>
          Later ({doLater.length})
        </span>
      </div>

      {!loading && actions.length > 0 ? (
        <Card
          padding="1rem 1.25rem"
          style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            border: `1px solid ${T.border}`,
          }}
        >
          <div
            role="img"
            aria-label={`${completionPercent}% completed`}
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              flexShrink: 0,
              background: `conic-gradient(#10B981 ${completionPercent * 3.6}deg, #D1FAE5 0deg)`,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1.05,
              }}
            >
              <strong style={{ fontSize: 20, color: T.text }}>{done}</strong>
              <span style={{ marginTop: 4, fontSize: 10, color: T.muted }}>
                of {actions.length}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>
              {completionPercent}% completed
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>
              Numbered by ranking impact
            </div>
            <div style={{ marginTop: 5, fontSize: 12, color: T.muted }}>
              {pending.length > 0 ? 'Start at #1 and work down' : 'All actions completed'}
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              background: '#EDE9FE',
              color: '#6D4AFF',
              fontSize: 16,
            }}
          >
            <FontAwesomeIcon icon={faCheck} />
          </div>
        </Card>
      ) : null}

      {!loading && next ? (
        <Card
          padding="1rem 1.25rem"
          style={{
            marginBottom: 14,
            border: '1px solid #FDBA74',
            background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 70%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faBolt} style={{ color: T.orange }} />
            <strong style={{ fontSize: 13, color: T.text }}>Start here - Priority #1</strong>
          </div>
          <ActionRow
            a={next}
            rankNum={1}
            emphasize
            onToggle={toggle}
            onRemove={remove}
            onAskAiFix={askAiFix}
          />
        </Card>
      ) : null}

      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Add action</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            placeholder="New action item..."
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select
            value={form.impact}
            onChange={(e) => setForm((p) => ({ ...p, impact: e.target.value }))}
            style={{ width: 140 }}
          >
            <option value="Critical">Do now (Critical)</option>
            <option value="High">Do now (High)</option>
            <option value="Medium">Soon (Medium)</option>
            <option value="Low">Later (Low)</option>
          </select>
          <OrangeBtn onClick={add} disabled={adding}>
            {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
          </OrangeBtn>
        </div>
      </Card>

      {loading ? <EmptyState message="Loading..." /> : (
        <div id="actions-section-list">
          {renderGroup(
            `Do now (${doFirst.filter((a) => a.id !== next?.id).length})`,
            'Highest ranking impact - do these before anything else.',
            doFirst.filter((a) => a.id !== next?.id),
            '#EF4444',
          )}
          {renderGroup(
            `Soon (${doThen.filter((a) => a.id !== next?.id).length})`,
            'Good improvements after Do now is clear.',
            doThen.filter((a) => a.id !== next?.id),
            '#F97316',
          )}
          {renderGroup(
            `Later (${doLater.filter((a) => a.id !== next?.id).length})`,
            'Nice polish - leave until higher priorities are done.',
            doLater.filter((a) => a.id !== next?.id),
            '#94A3B8',
          )}

          {completed.length > 0 && (
            <Card>
              <SectionLabel>Completed ({completed.length})</SectionLabel>
              {completed.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--dark4)', opacity: 0.5 }}>
                  <div
                    onClick={() => toggle(a.id, a.done)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--green-dim)',
                      border: '2px solid var(--green)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: 'var(--green)', fontSize: 11 }}><FontAwesomeIcon icon={faCheck} /></span>
                  </div>
                  <span style={{ flex: 1, fontSize: 14, textDecoration: 'line-through', color: 'var(--text2)' }}>{a.text}</span>
                  <button onClick={() => remove(a.id)} style={{ background: 'none', color: 'var(--muted)', fontSize: 18, border: 0, cursor: 'pointer' }}>
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              ))}
            </Card>
          )}
          {actions.length === 0 && (
            <EmptyState message="No open tasks. Run a site audit or refresh priorities to build your ranking plan." />
          )}
        </div>
      )}
      </div>
      </div>

      <MobileActionPlan
        actions={actions}
        pending={pending}
        completed={completed}
        next={next}
        doFirst={doFirst}
        doThen={doThen}
        doLater={doLater}
        loading={loading}
        syncing={syncing}
        form={form}
        setForm={setForm}
        adding={adding}
        onAdd={add}
        onRefresh={refreshFromAudit}
        onToggle={toggle}
        onAskAiFix={askAiFix}
      />

      <Modal
        open={Boolean(fixAction)}
        onClose={closeAiFix}
        title="AI Fix help"
        subtitle={fixAction?.text || ''}
        width={560}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={closeAiFix}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: '#fff',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            {fixAction ? (
              <button
                type="button"
                onClick={() => {
                  navigate(`/site/${siteId}/${pathForAction(fixAction)}`)
                  closeAiFix()
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Open related tool <FontAwesomeIcon icon={faArrowRight} />
              </button>
            ) : null}
          </div>
        }
      >
        {loadingAiFix ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 4px', color: T.muted, fontSize: 13 }}>
            <FontAwesomeIcon icon={faSpinner} spin />
            Generating a concrete fix with AI…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: 99,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: '#EA580C',
            }}>
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              AI-generated guidance - you still apply the change on your site
            </div>

            {aiFix?.why ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 4 }}>Why it matters</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>{aiFix.why}</div>
              </div>
            ) : null}

            {(aiFix?.before || aiFix?.after) ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {aiFix.before ? (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', marginBottom: 4 }}>Before</div>
                    <code style={{ fontSize: 12, color: '#7F1D1D', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiFix.before}</code>
                  </div>
                ) : null}
                {aiFix.after ? (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', marginBottom: 4 }}>After</div>
                    <code style={{ fontSize: 12, color: '#14532D', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiFix.after}</code>
                  </div>
                ) : null}
              </div>
            ) : null}

            {aiFix?.fix ? (
              <div style={{ background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>Exact fix</div>
                  <button
                    type="button"
                    onClick={copyAiFix}
                    style={{
                      border: `1px solid ${T.border}`,
                      background: '#fff',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: copiedFix ? '#16A34A' : T.text2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <FontAwesomeIcon icon={faCopy} />
                    {copiedFix ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{aiFix.fix}</div>
              </div>
            ) : null}

            {(aiFix?.timeToFix || aiFix?.priorityNote) ? (
              <div style={{ fontSize: 12, color: T.muted, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {aiFix.timeToFix ? <span>Estimated time: <strong style={{ color: T.text2 }}>{aiFix.timeToFix}</strong></span> : null}
                {aiFix.priorityNote ? <span>{aiFix.priorityNote}</span> : null}
              </div>
            ) : null}

            {!aiFix?.fix && !aiFix?.why && !loadingAiFix ? (
              <div style={{ fontSize: 13, color: T.muted }}>No fix details returned. Try again or open the related tool.</div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
