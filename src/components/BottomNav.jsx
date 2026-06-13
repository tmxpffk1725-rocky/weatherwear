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