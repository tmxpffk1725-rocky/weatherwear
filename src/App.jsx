import { useState } from 'react'
import './App.css'
import HomePage from './pages/HomePage'
import ClosetPage from './pages/ClosetPage'
import SettingPage from './pages/SettingPage'
import BottomNav from './components/BottomNav'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [settings, setSettings] = useState({
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
  }
})

  const renderPage = () => {
    if (currentPage === 'home') return <HomePage settings={settings} />
    if (currentPage === 'closet') return <ClosetPage />
    if (currentPage === 'setting') return <SettingPage settings={settings} setSettings={setSettings} />
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