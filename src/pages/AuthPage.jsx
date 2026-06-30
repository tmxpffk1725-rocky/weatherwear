import { useState } from 'react'
import { login, signup } from '../api/backend'
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

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isLogin = mode === 'login'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = isLogin ? login : signup
      const userEmail = await fn(email.trim(), password)
      onAuth(userEmail)
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo-tile"><TShirtIcon /></span>
          <span className="auth-wordmark">WeatherWear</span>
        </div>

        <div className="auth-head">
          <div className="auth-title">{isLogin ? '로그인' : '회원가입'}</div>
          <div className="auth-sub">
            {isLogin ? '날씨에 맞는 코디를 추천받으세요' : '이메일로 가입하고 시작하세요'}
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">이메일</label>
          <input
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label className="auth-label">비밀번호</label>
          <div className="auth-pw">
            <input
              type={showPw ? 'text' : 'password'}
              className="auth-input"
              placeholder={isLogin ? '비밀번호' : '6자 이상'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
            >
              <EyeIcon off={showPw} />
            </button>
          </div>
          {!isLogin && <div className="auth-helper">6자 이상 입력하세요</div>}

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
          <button
            className="auth-switch-btn"
            onClick={() => { setMode(isLogin ? 'signup' : 'login'); setError('') }}
          >
            {isLogin ? '회원가입' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
