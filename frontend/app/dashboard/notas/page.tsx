'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type Note } from '@/lib/api';
import { useConfirm } from '@/components/Confirm';

const MD: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  input: ({ checked, ...props }) => (
    <input type="checkbox" checked={checked} readOnly
      style={{ cursor: 'pointer', marginRight: 6, accentColor: 'var(--up)' }} {...props} />
  ),
  code: ({ children, className }) => {
    const block = className?.includes('language-');
    return block ? (
      <pre style={{ background: '#111110', color: '#f0ece2', padding: '12px 16px', fontFamily: 'monospace',
        fontSize: 12, lineHeight: 1.7, overflowX: 'auto', borderLeft: '3px solid var(--signal)', margin: '12px 0' }}>
        <code>{children}</code>
      </pre>
    ) : (
      <code style={{ background: 'var(--paper-2)', padding: '2px 6px', fontFamily: 'monospace',
        fontSize: 12, border: '1px solid var(--rule)' }}>{children}</code>
    );
  },
  h1: ({c}: any) => <h1 style={{fontSize:22,fontWeight:700,borderBottom:'1px solid var(--rule)',paddingBottom:8,marginBottom:16}}>{c}</h1>,
  h2: ({children}: any) => <h2 style={{fontSize:17,fontWeight:700,marginTop:24,marginBottom:10}}>{children}</h2>,
  h3: ({children}: any) => <h3 style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:20,marginBottom:8}}>{children}</h3>,
  p:  ({children}: any) => <p  style={{lineHeight:1.7,marginBottom:12}}>{children}</p>,
  ul: ({children}: any) => <ul style={{paddingLeft:20,marginBottom:12}}>{children}</ul>,
  ol: ({children}: any) => <ol style={{paddingLeft:20,marginBottom:12}}>{children}</ol>,
  li: ({children}: any) => <li style={{lineHeight:1.7,marginBottom:4}}>{children}</li>,
  blockquote: ({children}: any) => <blockquote style={{borderLeft:'3px solid var(--muted)',paddingLeft:16,color:'var(--muted)',margin:'12px 0',fontStyle:'italic'}}>{children}</blockquote>,
  a: ({children,href}: any) => <a href={href} style={{color:'var(--signal)',textDecoration:'underline'}} target="_blank" rel="noreferrer">{children}</a>,
  hr: () => <hr style={{border:'none',borderTop:'1px solid var(--rule)',margin:'20px 0'}} />,
};

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 001 — MARKDOWN SCRATCHPAD
// ─────────────────────────────────────────────────────────────────────────────
function Scratchpad({ note, onSave }: { note: Note; onSave: (n: Note) => void }) {
  const [content, setContent] = useState(note.content);
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState(note.updatedAt);
  const debRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async (text: string) => {
    setSaving(true);
    try { const u = await api.noteSave(note.id, text); setSavedAt(u.updatedAt); onSave(u); }
    finally { setSaving(false); }
  }, [note.id, onSave]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => save(val), 800);
  }

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 001</span>
        <span className="ttl">MARKDOWN_EDITOR</span>
        <span className="meta" style={{ color: saving ? 'var(--warn)' : 'var(--up)' }}>
          {saving ? '● guardando' : `✓ ${timeStr(savedAt)}`}
        </span>
      </div>
      <div className="markdown-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--ink)', marginBottom: 56 }}>
        <textarea value={content} onChange={handleChange} spellCheck={false}
          placeholder={'# Título\n\nEscribí en **Markdown**...\n\n- [ ] Tarea pendiente\n- [x] Completada\n\n```bash\npm2 restart app\n```'}
          style={{ resize: 'none', background: 'var(--bg)', color: 'var(--ink)',
            fontFamily: '"Cascadia Code","Fira Code",monospace', fontSize: 13, lineHeight: 1.75,
            border: 0, borderRight: '1px solid var(--ink)', outline: 'none', padding: '20px 24px', minHeight: 400 }} />
        <div style={{ padding: '20px 28px', overflowY: 'auto', fontSize: 14, lineHeight: 1.7, minHeight: 400 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
            {content || '*Empezá a escribir en el editor...*'}
          </ReactMarkdown>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 002 — NOTAS RÁPIDAS (cards + modal)
// ─────────────────────────────────────────────────────────────────────────────
function NotasRapidas({ notes, onCreate, onUpdate, onDelete }: {
  notes: Note[];
  onCreate: (n: Note) => void;
  onUpdate: (n: Note) => void;
  onDelete: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [modal, setModal]       = useState<Note | null>(null);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const note = await api.noteCreate(newTitle.trim());
    onCreate(note);
    setCreating(false);
    setNewTitle('');
    setModal(note);
  }

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 002</span>
        <span className="ttl">NOTAS_RÁPIDAS</span>
        <span className="meta">{notes.length} notas</span>
        <button className="btn-check-now" style={{ marginLeft: 'auto' }}
          onClick={() => setCreating(true)}>+ Nueva →</button>
      </div>

      <div className="notes-grid">
        {/* Card de crear */}
        {creating && (
          <div className="note-card" style={{ flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
              letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nueva nota</div>
            <input className="field-input" autoFocus placeholder="Título..."
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewTitle(''); }
              }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-deploy btn-deploy-run" onClick={handleCreate}
                style={{ flex: 1, padding: '6px 12px' }}>
                <span>Crear</span><span>→</span>
              </button>
              <button className="btn-check-now"
                onClick={() => { setCreating(false); setNewTitle(''); }}>✕</button>
            </div>
          </div>
        )}

        {notes.length === 0 && !creating && (
          <div style={{ gridColumn: '1/-1', padding: '48px 24px', textAlign: 'center',
            color: 'var(--muted)', fontSize: 13, border: '1px solid var(--ink)' }}>
            — Sin notas. Creá una con el botón + Nueva →
          </div>
        )}

        {notes.map(note => (
          <div key={note.id} className="note-card" onClick={() => setModal(note)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title}
              </span>
              <button onClick={async e => {
                e.stopPropagation();
                if (await confirm({ message: `¿Eliminar "${note.title}"?`, danger: true, confirmLabel: 'Eliminar', title: 'Eliminar nota' })) {
                  api.noteDelete(note.id).then(() => onDelete(note.id));
                }
              }} style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, flex: 1,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
              margin: 0 }}>
              {note.content.replace(/[#*`\[\]_~>]/g, '').trim() || 'Nota vacía'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16,
              paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
                {note.content.split('\n').filter(Boolean).length} líneas
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
                {timeStr(note.updatedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <NoteModal
          note={modal}
          onClose={() => setModal(null)}
          onUpdate={n => { onUpdate(n); setModal(n); }}
          onDelete={() => { onDelete(modal.id); setModal(null); }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de edición
// ─────────────────────────────────────────────────────────────────────────────
function NoteModal({ note, onClose, onUpdate, onDelete }: {
  note: Note;
  onClose: () => void;
  onUpdate: (n: Note) => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const [content, setContent] = useState(note.content);
  const [saving, setSaving]   = useState(false);
  const [tab, setTab]         = useState<'edit' | 'split' | 'preview'>('split');
  const debRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setSaving(true);
      const u = await api.noteSave(note.id, val).catch(() => note);
      onUpdate(u);
      setSaving(false);
    }, 800);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 200 }}>
      <div className="modal-box" style={{ maxWidth: 1000, maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ink)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, flex: 1 }}>
            {note.title}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
            color: saving ? 'var(--warn)' : 'var(--up)' }}>
            {saving ? '● guardando' : '✓ guardado'}
          </span>
          {/* Tabs */}
          <div style={{ display: 'flex' }}>
            {(['edit','split','preview'] as const).map((t, i) => (
              <button key={t} onClick={() => setTab(t)} style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '5px 12px',
                borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
                borderLeft: i === 0 ? '1px solid var(--rule)' : 'none',
                borderRight: '1px solid var(--rule)',
                background: tab === t ? 'var(--ink)' : 'none',
                color: tab === t ? 'var(--paper)' : 'var(--muted)', cursor: 'pointer',
              }}>
                {t === 'edit' ? 'Editor' : t === 'split' ? 'Split' : 'Preview'}
              </button>
            ))}
          </div>
          <button onClick={async () => { if (await confirm({ message: `¿Eliminar "${note.title}"?`, danger: true, confirmLabel: 'Eliminar', title: 'Eliminar nota' })) onDelete(); }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'none',
              border: 'none', cursor: 'pointer', color: 'var(--down)' }}>Eliminar</button>
          <button onClick={onClose}
            style={{ fontFamily: 'var(--font-mono)', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '0 4px' }}>✕</button>
        </div>

        {/* Body */}
        <div className={tab === 'split' ? 'note-modal-body' : ''} style={{ flex: 1, display: 'grid', overflow: 'hidden', minHeight: 460,
          gridTemplateColumns: tab === 'split' ? '1fr 1fr' : '1fr' }}>
          {(tab === 'edit' || tab === 'split') && (
            <textarea value={content} onChange={handleChange} autoFocus spellCheck={false}
              placeholder={'# Título\n\n- [ ] Tarea\n```bash\ncomando\n```'}
              style={{ resize: 'none', background: 'var(--bg)', color: 'var(--ink)',
                fontFamily: '"Cascadia Code","Fira Code",monospace', fontSize: 13, lineHeight: 1.75,
                border: 0, borderRight: tab === 'split' ? '1px solid var(--ink)' : 0,
                outline: 'none', padding: '20px 24px' }} />
          )}
          {(tab === 'preview' || tab === 'split') && (
            <div style={{ padding: '20px 28px', overflowY: 'auto', fontSize: 14, lineHeight: 1.7 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                {content || '*Nota vacía*'}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function NotasPage() {
  const [scratchpad, setScratchpad] = useState<Note | null>(null);
  const [quickNotes, setQuickNotes] = useState<Note[]>([]);

  useEffect(() => {
    api.notes().then(notes => {
      const [first, ...rest] = notes;
      if (first) setScratchpad(first);
      else api.noteCreate('Scratchpad').then(n => setScratchpad(n));
      setQuickNotes(rest);
    });
  }, []);

  return (
    <>
      {scratchpad && <Scratchpad note={scratchpad} onSave={setScratchpad} />}
      <NotasRapidas
        notes={quickNotes}
        onCreate={n => setQuickNotes(p => [...p, n])}
        onUpdate={n => setQuickNotes(p => p.map(x => x.id === n.id ? n : x))}
        onDelete={id => setQuickNotes(p => p.filter(x => x.id !== id))}
      />
    </>
  );
}
