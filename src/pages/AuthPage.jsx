// 인증 화면 — 로그인 / 회원가입 / 비밀번호 재설정을 mode 하나로 전환하는 단일 페이지.
//
// 회원가입 흐름 (가입 "전" 이메일 인증 — 오타 이메일로 계정이 선점되는 것을 방지):
//   이메일 입력 → [인증코드 받기] → 메일로 6자리 코드 → 입력·[확인]
//   → 인증 완료(이메일 잠금) → 비밀번호·이름 → 가입 → 서버가 토큰을 바로 줘서 즉시 로그인
//
// 로그인 시 "이메일 인증 필요" 403이 오면(과거 링크 방식으로 가입한 미인증 계정)
// 인증 메일 재전송 버튼을 노출한다 — 레거시 호환 경로.
import { useState } from 'react'
import { login, signup, resend, forgot, sendCode, verifyCode } from '../api/backend'
import '../styles/AuthPage.css'

// 아이콘은 라이브러리 없이 인라인 SVG — 번들 크기를 아끼고 색은 currentColor로 테마 따라감
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

  // 가입 전 이메일 인증번호 단계
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [codeVerified, setCodeVerified] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)

  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'

  const resetCodeState = () => { setCode(''); setCodeSent(false); setCodeVerified(false) }

  const switchMode = () => {
    setMode(isLogin ? 'signup' : 'login')
    setError(''); setNotice(''); setConfirm(''); setName('')
    resetCodeState()
  }

  // 이메일이 바뀌면 진행 중이던 인증은 무효
  const changeEmail = (v) => {
    setEmail(v)
    if (mode === 'signup') resetCodeState()
  }

  const doSendCode = async () => {
    setError(''); setNotice('')
    if (!email.trim()) { setError('이메일을 입력하세요.'); return }
    setCodeLoading(true)
    try {
      await sendCode(email.trim())
      setCodeSent(true)
      setCode('')
      setNotice('인증코드를 보냈어요. 메일함을 확인하세요. (10분 유효)')
    } catch (err) {
      setError(err.message || '인증코드 발송에 실패했습니다.')
    }
    setCodeLoading(false)
  }

  const doVerifyCode = async () => {
    setError(''); setNotice('')
    setCodeLoading(true)
    try {
      await verifyCode(email.trim(), code.trim())
      setCodeVerified(true)
      setNotice('')
    } catch (err) {
      setError(err.message || '인증코드 확인에 실패했습니다.')
    }
    setCodeLoading(false)
  }

  // 레거시 미인증 계정용 인증 메일 재전송 (성공/실패 관계없이 안내만 — 계정 존재 노출 방지)
  const doResend = async (target) => {
    setNotice(''); setError('')
    try {
      await resend(target)
      setNotice('인증 메일을 다시 보냈어요. 메일함을 확인하세요.')
    } catch {
      setNotice('재전송에 실패했어요. 잠시 후 다시 시도하세요.')
    }
  }

  // 폼 제출 — mode에 따라 로그인/가입/재설정 분기.
  // 가입은 서버도 인증 여부를 다시 검사하지만, 프론트에서 먼저 걸러 불필요한 요청을 줄인다.
  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice('')
    if (mode === 'signup') {
      if (!codeVerified) { setError('이메일 인증을 먼저 완료해주세요.'); return }
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
        // 인증번호 확인을 마친 이메일 → 가입 즉시 로그인
        const info = await signup(email.trim(), password, name.trim())
        onAuth(info)
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  // 로그인 에러가 "이메일 인증 필요"(403)일 때만 재전송 버튼 노출 (레거시 계정 구제)
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
            {mode === 'signup' ? (
              <>
                <div className="auth-code-row">
                  <input type="email" className="auth-input" placeholder="you@example.com"
                    value={email} onChange={(e) => changeEmail(e.target.value)}
                    autoComplete="email" required disabled={codeVerified} />
                  <button type="button" className="auth-code-btn"
                    onClick={doSendCode} disabled={codeLoading || codeVerified}>
                    {codeVerified ? '인증됨 ✓' : codeSent ? '재발송' : '인증코드 받기'}
                  </button>
                </div>
                {codeSent && !codeVerified && (
                  <div className="auth-code-row auth-code-verify">
                    <input type="text" inputMode="numeric" maxLength={6} className="auth-input"
                      placeholder="인증코드 6자리" value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                    <button type="button" className="auth-code-btn"
                      onClick={doVerifyCode} disabled={codeLoading || code.length !== 6}>
                      확인
                    </button>
                  </div>
                )}
                {codeVerified && <div className="auth-helper auth-code-done">이메일 인증 완료</div>}
              </>
            ) : (
              <input type="email" className="auth-input" placeholder="you@example.com"
                value={email} onChange={(e) => changeEmail(e.target.value)} autoComplete="email" required />
            )}
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
