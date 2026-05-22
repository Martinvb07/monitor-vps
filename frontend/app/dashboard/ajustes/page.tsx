'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function AjustesPage() {
  const { toast } = useToast();
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [qrUrl, setQrUrl]           = useState('');
  const [secret, setSecret]         = useState('');
  const [token, setToken]           = useState('');
  const [step, setStep]             = useState<'idle' | 'setup' | 'confirm' | 'disable'>('idle');
  const [msg, setMsg]               = useState('');
  const [error, setError]           = useState('');

  // Cambio de contraseña
  const [pwCurrent, setPwCurrent]   = useState('');
  const [pwNew, setPwNew]           = useState('');
  const [pwConfirm, setPwConfirm]   = useState('');
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwError, setPwError]       = useState('');

  useEffect(() => {
    api.tfa.status().then((d) => { setTfaEnabled(d.enabled); setLoading(false); });
  }, []);

  async function handleSetup() {
    setError('');
    try {
      const d = await api.tfa.setup();
      setQrUrl(d.qrUrl);
      setSecret(d.secret);
      setStep('confirm');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function handleEnable() {
    setError('');
    try {
      await api.tfa.enable(token);
      setTfaEnabled(true);
      setStep('idle');
      setToken('');
      setMsg('✓ 2FA activado correctamente');
      toast('2FA activado correctamente');
    } catch (e) { setError(e instanceof Error ? e.message : 'Código incorrecto'); }
  }

  async function handleDisable() {
    setError('');
    try {
      await api.tfa.disable(token);
      setTfaEnabled(false);
      setStep('idle');
      setToken('');
      setMsg('✓ 2FA desactivado');
      toast('2FA desactivado', 'warn');
    } catch (e) { setError(e instanceof Error ? e.message : 'Código incorrecto'); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (pwNew !== pwConfirm) { setPwError('Las contraseñas no coinciden'); return; }
    if (pwNew.length < 8)    { setPwError('Mínimo 8 caracteres'); return; }
    setPwSaving(true);
    try {
      await api.changePassword(pwCurrent, pwNew);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      toast('Contraseña actualizada correctamente');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Error');
    } finally {
      setPwSaving(false);
    }
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace('3001', '3000')}/webhook/deploy`
    : 'http://tu-vps:3000/webhook/deploy';

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// ajustes</span>
        <span className="ttl">CONFIGURACIÓN</span>
      </div>

      {/* 2FA */}
      <div className="settings-section reveal in">
        <div className="settings-section-title">// autenticación en dos pasos (2FA)</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Estado</div>
              <div className="settings-value">
                {loading ? '—' : (
                  <span style={{ color: tfaEnabled ? 'var(--up)' : 'var(--muted)', fontWeight: 600 }}>
                    {tfaEnabled ? '● Activado' : '○ Desactivado'}
                  </span>
                )}
              </div>
            </div>
            {!loading && (
              <div>
                {!tfaEnabled && step === 'idle' && (
                  <button className="btn-deploy" onClick={handleSetup}>
                    <span>Activar 2FA</span><span>→</span>
                  </button>
                )}
                {tfaEnabled && step === 'idle' && (
                  <button className="btn-deploy" style={{ background: 'var(--down)' }} onClick={() => setStep('disable')}>
                    <span>Desactivar</span><span>→</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {step === 'confirm' && (
            <div className="settings-2fa-setup">
              <p className="settings-hint">
                Escanea el QR con tu app (Google Authenticator, Authy) o ingresa la clave manualmente.
              </p>
              {qrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="QR 2FA" className="settings-qr" />
              )}
              <div className="settings-secret">
                <span className="field-label">Clave manual</span>
                <code className="settings-secret-code">{secret}</code>
              </div>
              <div className="field-group" style={{ marginTop: 16 }}>
                <label className="field-label">Código de verificación</label>
                <input className="field-input" type="text" placeholder="123456" maxLength={6}
                  value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
              <button className="btn-deploy" style={{ marginTop: 12 }} onClick={handleEnable}>
                <span>Confirmar y activar</span><span>→</span>
              </button>
            </div>
          )}

          {step === 'disable' && (
            <div className="settings-2fa-setup">
              <div className="field-group">
                <label className="field-label">Ingresa un código 2FA para confirmar</label>
                <input className="field-input" type="text" placeholder="123456" maxLength={6}
                  value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
              <button className="btn-deploy" style={{ marginTop: 12, background: 'var(--down)' }} onClick={handleDisable}>
                <span>Confirmar desactivación</span><span>→</span>
              </button>
            </div>
          )}

          {error && <p className="login-error" style={{ marginTop: 8 }}>{error}</p>}
          {msg   && <p className="deploy-success" style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      </div>

      {/* Cambio de contraseña */}
      <div className="settings-section reveal in d1" style={{ marginTop: 40 }}>
        <div className="settings-section-title">// cambiar contraseña</div>
        <div className="settings-card">
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field-group">
              <label className="field-label">Contraseña actual</label>
              <input className="field-input" type="password" value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)} required />
            </div>
            <div className="field-group">
              <label className="field-label">Nueva contraseña</label>
              <input className="field-input" type="password" value={pwNew}
                onChange={(e) => setPwNew(e.target.value)} minLength={8} required />
            </div>
            <div className="field-group">
              <label className="field-label">Confirmar nueva contraseña</label>
              <input className="field-input" type="password" value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)} required />
            </div>
            {pwError && <p className="login-error">{pwError}</p>}
            <button className="btn-deploy" type="submit" disabled={pwSaving} style={{ alignSelf: 'flex-start' }}>
              <span>{pwSaving ? 'Guardando...' : 'Cambiar contraseña'}</span>
              <span>{pwSaving ? '⟳' : '→'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Webhook */}
      <div className="settings-section reveal in d1" style={{ marginTop: 40 }}>
        <div className="settings-section-title">// webhook de deploys (CI/CD)</div>
        <div className="settings-card">
          <div className="settings-hint">
            Usa esta URL en GitHub Actions, Bitbucket Pipelines o cualquier CI para registrar deploys automáticamente.
          </div>
          <div className="settings-code-block">
            <code>POST {webhookUrl}</code>
          </div>
          <div className="settings-hint" style={{ marginTop: 12 }}>
            Header requerido: <code>x-webhook-secret: {'{WEBHOOK_SECRET del .env}'}</code>
          </div>
          <div className="settings-hint" style={{ marginTop: 8 }}>
            Body: <code>{'{ "sitio": "cancha", "mensaje": "Deploy v1.2", "ref": "refs/heads/main", "commit": "abc1234" }'}</code>
          </div>
          <div className="settings-section-title" style={{ marginTop: 20 }}>// GitHub Actions (ejemplo)</div>
          <pre className="deploy-terminal-output" style={{ background: '#0d0d0d', padding: '16px 20px', fontSize: 11, maxHeight: 'none' }}>{`- name: Notify MartinHQ
  run: |
    curl -X POST ${webhookUrl} \\
      -H "Content-Type: application/json" \\
      -H "x-webhook-secret: \${{ secrets.WEBHOOK_SECRET }}" \\
      -d '{"sitio":"cancha","mensaje":"Deploy \${{ github.ref_name }}","commit":"\${{ github.sha }}"}'`}
          </pre>
        </div>
      </div>
    </>
  );
}
