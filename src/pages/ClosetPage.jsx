import { useState, useEffect } from 'react'
import '../styles/ClosetPage.css'

function ClosetPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const categories = ['전체', '상의', '하의', '신발', '아우터']

  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('closet_items')
    return saved ? JSON.parse(saved) : []
  })

  const [showModal, setShowModal] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', category: '상의', color: '', memo: '' })

  useEffect(() => {
    localStorage.setItem('closet_items', JSON.stringify(items))
  }, [items])

  const filtered = selectedCategory === '전체'
    ? items
    : items.filter((item) => item.category === selectedCategory)

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const addItem = () => {
    if (!newItem.name || !newItem.color) return
    setItems([...items, { ...newItem, id: Date.now() }])
    setNewItem({ name: '', category: '상의', color: '', memo: '' })
    setShowModal(false)
  }

  return (
    <div className="closet-page">
      <div className="closet-header">
        <span className="closet-title">내 옷장</span>
        <button className="add-btn" onClick={() => setShowModal(true)}>+ 추가</button>
      </div>

      <div className="category-filter">
        {categories.map((c) => (
          <button
            key={c}
            className={`category-btn ${selectedCategory === c ? 'active' : ''}`}
            onClick={() => setSelectedCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="closet-list">
        {filtered.map((item) => (
          <div key={item.id} className="closet-item">
            <div>
              <div className="item-name">{item.name}</div>
              <div className="item-sub">{item.category} · {item.color}</div>
            </div>
            <button className="delete-btn" onClick={() => deleteItem(item.id)}>🗑</button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">옷 추가</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="input-group">
                <label>카테고리</label>
                <div className="modal-category-grid">
                  {['상의', '하의', '신발', '아우터'].map((c) => (
                    <button
                      key={c}
                      className={`modal-category-btn ${newItem.category === c ? 'active' : ''}`}
                      onClick={() => setNewItem({ ...newItem, category: c })}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label>이름</label>
                <input
                  type="text"
                  placeholder="예) 오버핏 맨투맨"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label>색상</label>
                <input
                  type="text"
                  placeholder="예) 네이비"
                  value={newItem.color}
                  onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label>메모 (선택)</label>
                <input
                  type="text"
                  placeholder="예) 겨울용"
                  value={newItem.memo}
                  onChange={(e) => setNewItem({ ...newItem, memo: e.target.value })}
                />
              </div>
            </div>

            <button className="modal-submit" onClick={addItem}>추가하기</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClosetPage