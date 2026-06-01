import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

const SCORE_LABEL = s => s >= 80 ? 'Excellent' : s >= 50 ? 'Average' : s > 0 ? 'Below average' : 'Poor'
const SCORE_COLOR = s => s >= 80 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626'
const SCORE_BG = s => s >= 80 ? '#DCFCE7' : s >= 50 ? '#FEF3C7' : '#FEE2E2'

export default function PublicAIVisibility() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const reportRef = useRef(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/audit/public/ai-visibility/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Failed to load report'))
  }, [token])

  async function downloadImage() {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const link = document.createElement('a')
    link.download = `ai-visibility-${data?.url?.replace(/https?:\/\//, '').replace(/\//g, '-') || 'report'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#6B7280' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>404</div>
        <div>Report not found or link has expired.</div>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui,sans-serif', color: '#6B7280' }}>
      Loading report...
    </div>
  )

  const domain = (() => { try { return new URL(data.url).hostname.replace('www.', '') } catch { return data.url } })()
  const results = data.results || []
  const cited = results.filter(r => r.cited).length
  const total = results.length
  const score = total > 0 ? Math.round((cited / total) * 100) : data.chatgpt_cited || 0

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', background: '#F9FAFB', minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Download button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 10 }}>
          <button onClick={downloadImage} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB',
            background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, color: '#374151',
          }}>
            Download as Image
          </button>
        </div>

        <div ref={reportRef} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 32 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>AI Visibility Report</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>{domain}</h1>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {data.created_at ? `Last tested: ${new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Not yet tested'}
              </div>
            </div>
            <div style={{ textAlign: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 20px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Powered by</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F97316' }}>devndespro</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>seo.devndespro.com</div>
            </div>
          </div>

          {/* Engine scores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'ChatGPT', bg: '#000', initial: 'G', score },
              { label: 'Claude', bg: '#D85A30', initial: 'C', score: null, soon: true },
              { label: 'Perplexity', bg: '#20808D', initial: 'P', soon: true },
              { label: 'Gemini', bg: '#4285F4', initial: 'G', soon: true },
            ].map(e => (
              <div key={e.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, opacity: e.soon ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 42, borderRadius: 5, background: e.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{e.initial}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{e.label}</span>
                </div>
                {e.soon ? (
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Coming soon</div>
                ) : e.score != null ? (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 800, color: SCORE_COLOR(e.score) }}>{e.score}<span style={{ fontSize: 12, fontWeight: 400 }}>/100</span></div>
                    <div style={{ background: '#E5E7EB', borderRadius: 3, height: 4, margin: '8px 0 6px', overflow: 'hidden' }}>
                      <div style={{ width: e.score + '%', height: '100%', background: SCORE_COLOR(e.score), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: SCORE_BG(e.score), color: SCORE_COLOR(e.score) }}>{SCORE_LABEL(e.score)}</span>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>Not tested</div>
                )}
              </div>
            ))}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Query results — {cited}/{total} cited</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ border: `1px solid ${r.cited ? '#BBF7D0' : '#FECACA'}`, borderRadius: 10, padding: 14, borderLeft: `4px solid ${r.cited ? '#16A34A' : '#DC2626'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.excerpt ? 8 : 0 }}>
                      <span style={{ fontSize: 16 }}>{r.cited ? '✅' : '❌'}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>{r.query}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: r.cited ? '#DCFCE7' : '#FEE2E2', color: r.cited ? '#16A34A' : '#DC2626' }}>
                        {r.cited ? 'CITED' : 'NOT CITED'}
                      </span>
                    </div>
                    {r.excerpt && (
                      <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', borderRadius: 6, padding: '8px 10px', lineHeight: 1.6 }}>
                        <span style={{ fontWeight: 600, color: '#9CA3AF', fontSize: 10, display: 'block', marginBottom: 2 }}>ChatGPT said:</span>
                        {r.excerpt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What this means */}
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>What this means for {domain}</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7 }}>
              {score === 0
                ? `ChatGPT currently does not cite ${domain} when answering questions in your industry. This is fixable — the most impactful steps are submitting your sitemap to Bing Webmaster Tools and getting listed on Trustpilot.`
                : score < 50
                ? `ChatGPT occasionally cites ${domain} but inconsistently. Improving your Bing indexing, author schema and review platform presence will increase citation frequency.`
                : `ChatGPT regularly cites ${domain}. Focus on maintaining content quality and expanding to Reddit and industry publications to sustain this.`
              }
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Generated by devndespro SEO Tool</div>
            <a href="https://seo.devndespro.com" style={{ fontSize: 11, color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>seo.devndespro.com</a>
          </div>
        </div>
      </div>
    </div>
  )
}
