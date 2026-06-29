import { useState, useEffect } from 'react'
import { COLORS, COLOR_HEX } from '../api/colors'
import '../styles/ClosetPage.css'

// 카테고리별 종류 프리셋 (설정의 선호 아이템 어휘와 통일)
const CATEGORY_ITEMS = {
  '상의': ['반팔', '민소매', '셔츠', '카라티', '긴팔', '맨투맨', '후드티', '니트', '가디건', '두꺼운니트', '기모티'],
  '하의': ['반바지', '린넨바지', '슬랙스', '면바지', '청바지', '조거팬츠', '와이드팬츠', '기모바지'],
  '신발': ['샌들', '슬리퍼', '스니커즈', '운동화', '로퍼', '구두', '부츠', '어그부츠'],
  '아우터': ['바람막이', '얇은자켓', '가디건', '자켓', '트렌치코트', '코트', '가죽자켓', '패딩'],
}

const EMPTY_ITEM = { name: '', category: '상의', color: '', memo: '' }

function ClosetPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const categories = ['전체', '상의', '하의', '신발', '아우터']

  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('closet_items')
    return saved ? JSON.parse(saved) : []
  })

  const [showModal, setShowModal] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [custom, setCustom] = useState(false) // 종류 '직접 입력' 모드

  useEffect(() => {
    localStorage.setItem('closet_items', JSON.stringify(items))
  }, [items])

  const filtered = selectedCategory === '전체'
    ? items
    : items.filter((item) => item.category === selectedCategory)

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id))
  }

  // 카테고리를 바꾸면 종류 선택은 초기화(목록이 달라지므로)
  const selectCategory = (category) => {
    setCustom(false)
    setNewItem({ ...newItem, category, name: '' })
  }

  const closeModal = () => {
    setShowModal(false)
    setCustom(false)
    setNewItem(EMPTY_ITEM)
  }

  const addItem = () => {
    if (!newItem.name.trim() || !newItem.color) return
    setItems([...items, { ...newItem, name: newItem.name.trim(), id: Date.now() }])
    setCustom(false)
    setNewItem(EMPTY_ITEM)
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
            <div className="item-info">
              {COLOR_HEX[item.color] && (
                <span
                  className="item-dot"
                  style={{ background: COLOR_HEX[item.color] }}
                />
              )}
              <div>
                <div className="item-name">{item.name}</div>
                <div className="item-sub">
                  {item.category} · {item.color}{item.memo ? ` · ${item.memo}` : ''}
                </div>
              </div>
            </div>
            <button className="delete-btn" onClick={() => deleteItem(item.id)}>🗑</button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">옷 추가</span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="input-group">
                <label>카테고리</label>
                <div className="modal-category-grid">
                  {['상의', '하의', '신발', '아우터'].map((c) => (
                    <button
                      key={c}
                      className={`modal-category-btn ${newItem.category === c ? 'active' : ''}`}
                      onClick={() => selectCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label>종류</label>
                <div className="chip-grid">
                  {CATEGORY_ITEMS[newItem.category].map((name) => (
                    <button
                      key={name}
                      className={`chip ${!custom && newItem.name === name ? 'active' : ''}`}
                      onClick={() => { setCustom(false); setNewItem({ ...newItem, name }) }}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    className={`chip ${custom ? 'active' : ''}`}
                    onClick={() => { setCustom(true); setNewItem({ ...newItem, name: '' }) }}
                  >
                    + 직접 입력
                  </button>
                </div>
                {custom && (
                  <input
                    type="text"
                    placeholder="옷 이름 입력 (예: 린넨 셋업)"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    autoFocus
                  />
                )}
              </div>

              <div className="input-group">
                <label>색상</label>
                <div className="swatch-grid">
                  {COLORS.map((c) => (
                    <button
                      key={c.name}
                      className={`swatch ${newItem.color === c.name ? 'active' : ''}`}
                      onClick={() => setNewItem({ ...newItem, color: c.name })}
                      aria-label={c.name}
                    >
                      <span className="swatch-dot" style={{ background: c.hex }} />
                      <span className="swatch-label">{c.name}</span>
                    </button>
                  ))}
                </div>
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

            <button
              className="modal-submit"
              onClick={addItem}
              disabled={!newItem.name || !newItem.color}
            >
              추가하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClosetPage
