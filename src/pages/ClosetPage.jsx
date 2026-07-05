// 옷장 화면 — 보유 옷 목록 + 등록(수동/사진) 모달.
//
// 등록 방법 두 가지가 같은 모달 폼을 공유한다:
//  · 수동: 카테고리·종류 칩 탭 + 색 스와치 선택
//  · 사진: 여러 장 선택 → AI(비전)가 병렬 분석 → 한 장씩 확인 스텝퍼(1/N)로
//    AI가 채운 폼을 검토·수정 후 저장. AI는 조명에 따라 색을 틀릴 수 있어
//    "자동 저장"이 아니라 반드시 사용자 확인을 거친다 (건너뛰기 가능).
//
// 여기 등록된 옷은 추천 시 LLM에 전달되어 "보유 옷 활용 + 부족분만 구매" 코디가 된다.
import { useState, useRef } from 'react'
import { COLORS, COLOR_HEX } from '../api/colors'
import { downscalePhoto, analyzeClothing } from '../api/vision'
import '../styles/ClosetPage.css'

// 카테고리별 종류 프리셋 — 타이핑 없이 탭만으로 등록하게 하는 어휘.
// 설정의 선호 아이템·비전 분석(lib/vision.js)의 어휘와 통일해, 등록된 옷 이름이
// 추천 매칭에서 그대로 인식되도록 한다 (어휘가 흩어지면 "긴팔티"="롱슬리브" 매칭 실패).
const CATEGORY_ITEMS = {
  '상의': ['반팔', '민소매', '셔츠', '카라티', '긴팔', '맨투맨', '후드티', '니트', '가디건', '두꺼운니트', '기모티'],
  '하의': ['반바지', '린넨바지', '슬랙스', '면바지', '청바지', '조거팬츠', '와이드팬츠', '기모바지'],
  '신발': ['샌들', '슬리퍼', '스니커즈', '운동화', '로퍼', '구두', '부츠', '어그부츠'],
  '아우터': ['바람막이', '얇은자켓', '가디건', '자켓', '트렌치코트', '코트', '가죽자켓', '패딩'],
}

const EMPTY_ITEM = { name: '', category: '상의', color: '', memo: '' }

function ClosetPage({ closet, setCloset }) {
  // 목록 상단 카테고리 필터 (표시용 — 저장 데이터에는 영향 없음)
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const categories = ['전체', '상의', '하의', '신발', '아우터']

  const [showModal, setShowModal] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [custom, setCustom] = useState(false) // 종류 '직접 입력' 모드

  // 사진 등록: 여러 장을 병렬 분석한 뒤 한 장씩 확인·수정하며 저장하는 스텝퍼
  const fileRef = useRef(null)
  const [photoQueue, setPhotoQueue] = useState(null) // [{dataUrl, item}] | null(수동 모드)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [analyzing, setAnalyzing] = useState(0) // 분석 중인 사진 수(0이면 꺼짐)

  const filtered = selectedCategory === '전체'
    ? closet
    : closet.filter((item) => item.category === selectedCategory)

  // setCloset은 App의 래퍼라 삭제 즉시 백엔드에도 반영된다 (별도 저장 버튼 없음)
  const deleteItem = (id) => {
    setCloset(closet.filter((item) => item.id !== id))
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
    setPhotoQueue(null)
    setPhotoIdx(0)
  }

  // 수동 등록 저장 — id는 등록 시각(ms)으로 충분히 유일 (한 사람이 1ms에 두 번 못 누름)
  const addItem = () => {
    if (!newItem.name.trim() || !newItem.color) return
    setCloset([...closet, { ...newItem, name: newItem.name.trim(), id: Date.now() }])
    setCustom(false)
    setNewItem(EMPTY_ITEM)
    setShowModal(false)
  }

  // 분석 결과를 확인 폼에 채운다 (인식 실패면 빈 폼 → 수동 입력)
  const loadPhotoEntry = (entry) => {
    const it = entry.item
    if (it && it.category) {
      setNewItem({ name: it.name || '', category: it.category, color: it.color || '', memo: '' })
      setCustom(Boolean(it.name) && !CATEGORY_ITEMS[it.category].includes(it.name))
    } else {
      setNewItem(EMPTY_ITEM)
      setCustom(false)
    }
  }

  // 사진 선택 → 축소·분석(병렬) → 스텝퍼 모달 열기
  const handlePhotoFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // 같은 사진 재선택 허용
    if (!files.length) return
    setAnalyzing(files.length)
    const entries = await Promise.all(files.map(async (f) => {
      try {
        const dataUrl = await downscalePhoto(f)
        try {
          return { dataUrl, item: await analyzeClothing(dataUrl) }
        } catch {
          return { dataUrl, item: null } // 분석 실패: 썸네일만 두고 수동 입력
        }
      } catch {
        return { dataUrl: null, item: null } // 이미지 디코딩 실패
      }
    }))
    setAnalyzing(0)
    setPhotoQueue(entries)
    setPhotoIdx(0)
    loadPhotoEntry(entries[0])
    setShowModal(true)
  }

  // 다음 사진으로 (마지막이면 종료)
  const advancePhoto = () => {
    const next = photoIdx + 1
    if (photoQueue && next < photoQueue.length) {
      setPhotoIdx(next)
      loadPhotoEntry(photoQueue[next])
    } else {
      closeModal()
    }
  }

  const savePhotoItem = () => {
    if (!newItem.name.trim() || !newItem.color) return
    setCloset([...closet, { ...newItem, name: newItem.name.trim(), id: Date.now() }])
    advancePhoto()
  }

  return (
    <div className="closet-page">
      <div className="closet-header">
        <span className="closet-title">내 옷장</span>
        <div className="closet-header-btns">
          <button className="photo-btn" onClick={() => fileRef.current?.click()}>📷 사진 등록</button>
          <button className="add-btn" onClick={() => setShowModal(true)}>+ 추가</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handlePhotoFiles}
        />
      </div>

      {analyzing > 0 && (
        <div className="analyzing-overlay">
          <div className="analyzing-box">AI가 사진 {analyzing}장을 분석하는 중...</div>
        </div>
      )}

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
              <span className="modal-title">
                {photoQueue ? `사진으로 등록 (${photoIdx + 1}/${photoQueue.length})` : '옷 추가'}
              </span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              {photoQueue && (
                <div className="photo-review">
                  {photoQueue[photoIdx].dataUrl
                    ? <img className="photo-preview" src={photoQueue[photoIdx].dataUrl} alt="선택한 옷 사진" />
                    : <div className="photo-preview photo-preview-empty">사진을 불러올 수 없어요</div>}
                  {!photoQueue[photoIdx].item && (
                    <div className="vision-note">AI 인식에 실패했어요 — 직접 입력해주세요.</div>
                  )}
                </div>
              )}
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

            {photoQueue ? (
              <div className="modal-actions">
                <button className="skip-btn" onClick={advancePhoto}>건너뛰기</button>
                <button
                  className="modal-submit"
                  onClick={savePhotoItem}
                  disabled={!newItem.name || !newItem.color}
                >
                  {photoIdx + 1 < photoQueue.length ? '저장하고 다음' : '저장하고 완료'}
                </button>
              </div>
            ) : (
              <button
                className="modal-submit"
                onClick={addItem}
                disabled={!newItem.name || !newItem.color}
              >
                추가하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClosetPage
