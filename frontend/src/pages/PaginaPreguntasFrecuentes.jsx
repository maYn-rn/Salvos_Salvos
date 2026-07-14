import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest, formatDateShort } from '../shared/appCore'

export default function PaginaPreguntasFrecuentes({ user, isAdmin }) {
  const [faqs, setFaqs] = useState([])
  const [newQuestion, setNewQuestion] = useState('')
  const [answerTexts, setAnswerTexts] = useState({})
  const [editingAnswerId, setEditingAnswerId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await apiRequest('/api/faqs/', { method: 'GET' })
        if (!resp.ok || !Array.isArray(resp.data?.results)) {
          setError('No se pudieron cargar las preguntas en este momento.')
          setFaqs([])
          return
        }
        setFaqs(resp.data.results)
      } catch {
        setError('No se pudieron cargar las preguntas en este momento.')
        setFaqs([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleSubmitQuestion(e) {
    e.preventDefault()
    if (!newQuestion.trim() || !user) return
    setSubmitBusy(true)
    setError('')
    try {
      const resp = await apiRequest('/api/faqs/', {
        method: 'POST',
        body: { question: newQuestion.trim() },
      })
      if (!resp.ok || !resp.data?.id) {
        setError(resp.data?.detail || 'No se pudo publicar la pregunta.')
        return
      }
      setFaqs((prev) => [resp.data, ...prev])
      setNewQuestion('')
    } catch {
      setError('No se pudo publicar la pregunta.')
    } finally {
      setSubmitBusy(false)
    }
  }

  function startAnswerEdit(faq) {
    setEditingAnswerId(faq.id)
    setAnswerTexts((prev) => ({ ...prev, [faq.id]: faq.answer || '' }))
  }

  function cancelAnswerEdit(id) {
    setEditingAnswerId((current) => (current === id ? null : current))
    setAnswerTexts((prev) => ({ ...prev, [id]: '' }))
  }

  async function handleSubmitAnswer(id) {
    const text = answerTexts[id]
    if (!text || !text.trim()) return
    setSubmitBusy(true)
    setError('')
    try {
      const resp = await apiRequest(`/api/faqs/${id}/`, {
        method: 'PATCH',
        body: { answer: text.trim() },
      })
      if (!resp.ok || !resp.data?.id) {
        setError(resp.data?.detail || 'No se pudo guardar la respuesta.')
        return
      }
      setFaqs((prev) => prev.map((f) => (f.id === id ? resp.data : f)))
      setAnswerTexts((prev) => ({ ...prev, [id]: '' }))
      setEditingAnswerId(null)
    } catch {
      setError('No se pudo guardar la respuesta.')
    } finally {
      setSubmitBusy(false)
    }
  }

  return (
    <div className="mainInner">
      <div style={{ marginBottom: '16px' }}>
        <Link className="miniBtn" to="/">← Volver al mapa de inicio</Link>
      </div>

      <section className="card">
        <h2 className="cardTitle" style={{ fontSize: '2rem', color: '#064a55', marginBottom: '8px' }}>Preguntas Frecuentes</h2>
        <p className="mutedText" style={{ marginBottom: '24px' }}>
          Consulta las dudas recurrentes de la comunidad o publica tu propia pregunta. Los administradores e integrantes responderán a tu duda.
        </p>
        {error ? <div className="errorBanner" style={{ marginBottom: '16px' }}>{error}</div> : null}

        <form onSubmit={handleSubmitQuestion} style={{ marginBottom: '40px', background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e3e6e8' }}>
          <label className="field" style={{ marginBottom: '12px' }}>
            <span style={{ fontWeight: 'bold', color: '#064a55' }}>
              {isAdmin ? '🛡️ Publicar Pregunta Oficial (Modo Administrador)' : '✍️ Escribe tu pregunta'}
            </span>
            <input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder={user ? 'Escribe tu consulta con el mayor detalle posible' : 'Inicia sesión para enviar una consulta'}
              disabled={!user}
              style={{ padding: '12px' }}
            />
          </label>
          <button type="submit" className="primaryBtn" disabled={!user || !newQuestion.trim() || submitBusy}>
            Enviar Pregunta
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div className="mutedText">Cargando preguntas...</div>
          ) : null}
          {faqs.map((f) => (
            <div key={f.id} className="card" style={{ borderLeft: f.user_type === 'admin' ? '6px solid var(--teal-500)' : '6px solid #f4a340', padding: '24px', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="boPill" style={{
                  background: f.user_type === 'admin' ? '#e6fcf5' : '#fff9db',
                  color: f.user_type === 'admin' ? '#19a6b6' : '#f4a340',
                  fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem',
                }}>
                  {f.user_type === 'admin' ? '🛡️ Admin' : '👤 Usuario'} · {f.username}
                </span>
                <span className="mutedText" style={{ fontSize: '0.85rem' }}>{formatDateShort(f.created_at)}</span>
              </div>

              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: '#064a55', lineHeight: '1.4' }}>{f.question}</h3>

              {f.answer ? (
                <div style={{ background: '#f1f3f5', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #19a6b6', marginTop: '10px' }}>
                  <strong style={{ color: 'var(--teal-500)', display: 'block', marginBottom: '6px', fontSize: '0.9rem' }}> Respuesta del Equipo:</strong>
                  <p style={{ margin: 0, color: '#333', lineHeight: '1.5' }}>{f.answer}</p>
                  {f.answered_by || f.answered_at ? (
                    <div className="mutedText" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                      {f.answered_by ? `Respondido por ${f.answered_by}` : 'Respuesta publicada'}
                      {f.answered_at ? ` · ${formatDateShort(f.answered_at)}` : ''}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ marginTop: '10px' }}>
                  <span className="mutedText" style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>Esperando respuesta oficial...</span>
                </div>
              )}

              {isAdmin ? (
                <div style={{ marginTop: '14px' }}>
                  {editingAnswerId === f.id || !f.answer ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        rows={3}
                        placeholder="Escribe una respuesta clara y útil para el usuario"
                        value={answerTexts[f.id] || ''}
                        onChange={(e) => setAnswerTexts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        {f.answer ? (
                          <button className="miniBtn" type="button" onClick={() => cancelAnswerEdit(f.id)}>
                            Cancelar
                          </button>
                        ) : null}
                        <button className="miniBtn" type="button" onClick={() => handleSubmitAnswer(f.id)} disabled={!answerTexts[f.id]?.trim() || submitBusy}>
                          {f.answer ? 'Guardar respuesta' : 'Responder'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="miniBtn" type="button" onClick={() => startAnswerEdit(f)}>
                        Editar respuesta
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
