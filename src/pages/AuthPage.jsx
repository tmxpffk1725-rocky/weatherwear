import { useState } from 'react'
import { login, signup, resend, forgot } from '../api/backend'
import '../styles/AuthPage.css'

const TShirtIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3 4 7l3 3v10h10V10l3-3-4-4c0 2-2.2 3-4 3S8 5 8 3Z" />
  </svg>
)

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)

const Brand = () => (
  <div className="auth-brand">
    <span className="auth-logo-tile"><TShirtIcon /></span>
    <span className="auth-wordmark">WeatherWear</span>
  </div>
)

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState('') // 가입 후 인증 메일 보낸 이메일

  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'

  const switchMode = () => {
    setMode(isLogin ? 'signup' : 'login')
    setError(''); setNotice(''); setConfirm(''); setName('')
  }

  const doResend = async (target) => {
    setNotice(''); setError('')
    try {
      await resend(target)
      setNotice('인증 메일을 다시 보냈어요. 메일함을 확인하세요.')
    } catch {
      setNotice('재전송에 실패했어요. 잠시 후 다시 시도하세요.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice('')
    if (mode === 'signup') {
      if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
      if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }
      if (!name.trim()) { setError('이름을 입력하세요.'); return }
    }
    setLoading(true)
    try {
      if (isForgot) {
        await forgot(email.trim())
        setNotice('가입된 이메일이라면 재설정 메일을 보냈어요. 메일함을 확인하세요.')
        setLoading(false)
      } else if (isLogin) {
        const info = await login(email.trim(), password)
        onAuth(info)
      } else {
        await signup(email.trim(), password, name.trim())
        setSent(email.trim())
        setLoading(false)
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  // 가입 후: 메일 확인 안내 화면
  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Brand />
          <div className="auth-head">
            <div className="auth-title">메일을 확인하세요</div>
            <div className="auth-sub">{sent}로 인증 메일을 보냈어요.<br />링크를 클릭한 뒤 로그인하세요.</div>
          </div>
          <button className="auth-submit" onClick={() => { setSent(''); setMode('login'); setPassword(''); setError(''); setNotice('') }}>
            로그인하러 가기
          </button>
          {notice && <div className="auth-notice">{notice}</div>}
          <div className="auth-switch">
            메일을 못 받으셨나요? <button className="auth-switch-btn" onClick={() => doResend(sent)}>재전송</button>
          </div>
        </div>
      </div>
    )
  }

  const showResend = isLogin && error.includes('인증')

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />

        <div className="auth-head">
          <div className="auth-title">{isLogin ? '로그인' : isForgot ? '비밀번호 재설정' : '회원가입'}</div>
          <div className="auth-sub">
            {isLogin ? '날씨에 맞는 코디를 추천받으세요'
              : isForgot ? '가입한 이메일로 재설정 링크를 보내드려요'
              : '이메일로 가입하고 시작하세요'}
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label className="auth-label">이메일</label>
            <input type="email" className="auth-input" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>

          {!isForgot && (
          <div className="auth-field">
            <label className="auth-label">비밀번호</label>
            <div className="auth-pw">
              <input type={showPw ? 'text' : 'password'} className="auth-input"
                placeholder={isLogin ? '비밀번호' : '6자 이상'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'} required />
              <button type="button" className="auth-eye" onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}><EyeIcon off={showPw} /></button>
            </div>
            {mode === 'signup' && <div className="auth-helper">6자 이상 입력하세요</div>}
            {isLogin && (
              <button type="button" className="auth-forgot"
                onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>
                비밀번호를 잊으셨나요?
              </button>
            )}
          </div>
          )}

          {mode === 'signup' && (
            <div className="auth-field">
              <label className="auth-label">비밀번호 확인</label>
              <div className="auth-pw">
                <input type={showConfirm ? 'text' : 'password'} className="auth-input"
                  placeholder="비밀번호 다시 입력" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                <button type="button" className="auth-eye" onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? '비밀번호 숨기기' : '비밀번호 표시'}><EyeIcon off={showConfirm} /></button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="auth-field">
              <label className="auth-label">이름</label>
              <input type="text" className="auth-input" placeholder="예: 홍길동"
                value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {showResend && (
            <button type="button" className="auth-resend" onClick={() => doResend(email.trim())}>
              인증 메일 재전송
            </button>
          )}
          {notice && <div className="auth-notice">{notice}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? '처리 중...' : isLogin ? '로그인' : isForgot ? '재설정 메일 보내기' : '회원가입'}
          </button>
        </form>

        <div className="auth-switch">
          {isForgot ? (
            <button className="auth-switch-btn" onClick={() => { setMode('login'); setError(''); setNotice('') }}>
              로그인으로 돌아가기
            </button>
          ) : (
            <>
              {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
              <button className="auth-switch-btn" onClick={switchMode}>
                {isLogin ? '회원가입' : '로그인'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthPage
