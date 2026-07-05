// 하단 탭 내비게이션 — 라우터 없이 App의 currentPage 상태로 화면을 전환한다.
// (화면이 3개뿐이라 URL 라우팅이 주는 이점이 없어 react-router를 쓰지 않았다)
function BottomNav({ currentPage, setCurrentPage }) {
  return (
    <nav className="bottom-nav">
      <button
        className={currentPage === 'home' ? 'active' : ''}
        onClick={() => setCurrentPage('home')}
      >
        <span className="nav-icon">🏠</span>
        <span className="nav-label">홈</span>
      </button>
      <button
        className={currentPage === 'closet' ? 'active' : ''}
        onClick={() => setCurrentPage('closet')}
      >
        <span className="nav-icon">👕</span>
        <span className="nav-label">옷장</span>
      </button>
      <button
        className={currentPage === 'setting' ? 'active' : ''}
        onClick={() => setCurrentPage('setting')}
      >
        <span className="nav-icon">⚙️</span>
        <span className="nav-label">설정</span>
      </button>
    </nav>
  )
}

export default BottomNav