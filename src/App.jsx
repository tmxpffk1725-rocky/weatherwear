import { useState, useEffect } from 'react'
import './App.css'
import HomePage from './pages/HomePage'
import ClosetPage from './pages/ClosetPage'
import SettingPage from './pages/SettingPage'
import AuthPage from './pages/AuthPage'
import BottomNav from './components/BottomNav'
import { getToken, clearToken, me, fetchState, saveSettings, saveCloset, saveFavorites, deleteAccount } from './api/backend'

const DEFAULT_SETTINGS = {
  gender: '남성',
  tone: '쿨톤',
  topSize: 'L',
  bottomSize: '34',
  fit: '오버핏',
  preferredItems: {
    top: ['반팔', '니트', '맨투맨', '두꺼운니트', '기모티셔츠'],
    bottom: ['반바지', '슬랙스', '치노팬츠', '기모바지'],
    outer: ['얇은자켓', '트렌치코트', '코트', '패딩'],
    shoes: ['스니커즈', '부츠'],
  },
}

function App() {
  const [authed, setAuthed] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [currentPage, setCurrentPage] = useState('home')

  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS)
  const [closet, setClosetState] = useState([])
  const [favorites, setFavoritesState] = useState([])

  const loadState = async () => {
    const state = await fetchState()
    if (state.settings) setSettingsState(state.settings)
    setClosetState(Array.isArray(state.closet) ? state.closet : [])
    setFavoritesState(Array.isArray(state.favorites) ? state.favorites : [])
  }

  // 앱 시작: 토큰 검증 + 계정 데이터 로드
  useEffect(() => {
    if (!getToken()) { setAuthLoading(false); return }
    me()
      .then(async (info) => { setEmail(info.email); setName(info.name); await loadState(); setAuthed(true) })
      .catch(() => clearToken())
      .finally(() => setAuthLoading(false))
  }, [])

  const handleAuth = async (info) => {
    setEmail(info.email)
    setName(info.name)
    try { await loadState() } catch { /* 신규 계정은 빈 상태 */ }
    setAuthed(true)
  }

  // 탈퇴 성공 시 로그아웃과 동일하게 초기화 (실패는 SettingPage가 표시)
  const handleDeleteAccount = async (password) => {
    await deleteAccount(password)
    logout()
  }

  const logout = () => {
    clearToken()
    setAuthed(false)
    setEmail('')
    setName('')
    setSettingsState(DEFAULT_SETTINGS)
    setClosetState([])
    setFavoritesState([])
    setCurrentPage('home')
  }

  // 상태 업데이트 + 백엔드 동기화 (저장 실패는 조용히 무시)
  const setSettings = (next) => { setSettingsState(next); saveSettings(next).catch(() => {}) }
  const setCloset = (next) => { setClosetState(next); saveCloset(next).catch(() => {}) }
  const setFavorites = (next) => { setFavoritesState(next); saveFavorites(next).catch(() => {}) }

  if (authLoading) return <div className="app-loading">불러오는 중...</div>
  if (!authed) return <AuthPage onAuth={handleAuth} />

  const renderPage = () => {
    if (currentPage === 'home') {
      return <HomePage settings={settings} closet={closet} favorites={favorites} setFavorites={setFavorites} />
    }
    if (currentPage === 'closet') return <ClosetPage closet={closet} setCloset={setCloset} />
    if (currentPage === 'setting') {
      return <SettingPage settings={settings} setSettings={setSettings} email={email} name={name} onLogout={logout} onDeleteAccount={handleDeleteAccount} />
    }
  }

  return (
    <div className="app">
      <div className="page-content">
        {renderPage()}
      </div>
      <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  )
}

export default App
