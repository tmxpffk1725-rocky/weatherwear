// 설정 화면 — 추천 개인화 입력(성별·피부톤·사이즈·핏·선호 아이템) + 계정 관리.
// 여기서 고른 값들이 추천 프롬프트에 그대로 들어간다 (예: 쿨톤 → 푸른 계열 색 우선).
// 변경 즉시 App의 setSettings 래퍼를 통해 계정 DB에 저장된다.
import { useState } from 'react'
import '../styles/SettingPage.css'

const ALL_ITEMS = {
  top: ['반팔', '니트', '맨투맨', '두꺼운니트', '기모티셔츠', '후드티', '가디건'],
  bottom: ['반바지', '슬랙스', '치노팬츠', '기모바지', '청바지', '조거팬츠'],
  outer: ['얇은자켓', '트렌치코트', '코트', '패딩', '가죽자켓', '바람막이'],
  shoes: ['스니커즈', '부츠', '로퍼', '샌들', '구두', '어그부츠'],
}

const LABEL = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  shoes: '신발',
}

function SettingPage({ settings, setSettings, email, name, onLogout, onDeleteAccount }) {
  const topSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const bottomSizes = ['24', '26', '28', '30', '32', '34', '36']
  const fits = ['슬림핏', '오버핏', '와이드']

  // 회원 탈퇴: 버튼 → 비밀번호 확인 단계 → 영구 삭제
  const [deleting, setDeleting] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const doDelete = async () => {
    if (!deletePw) { setDeleteError('비밀번호를 입력하세요.'); return }
    setDeleteError(''); setDeleteBusy(true)
    try {
      await onDeleteAccount(deletePw)
    } catch (err) {
      setDeleteError(err.message || '탈퇴에 실패했습니다.')
      setDeleteBusy(false)
    }
  }

  const update = (key, value) => {
    setSettings({ ...settings, [key]: value })
  }

  const toggleItem = (category, item) => {
    const current = settings.preferredItems[category]
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item]
    setSettings({
      ...settings,
      preferredItems: {
        ...settings.preferredItems,
        [category]: updated,
      }
    })
  }

  return (
    <div className="setting-page">
      <div className="setting-header">설정</div>

      <div className="setting-section">
        <div className="setting-label">성별</div>
        <div className="setting-grid">
          {['남성', '여성'].map((g) => (
            <button
              key={g}
              className={`setting-btn ${settings.gender === g ? 'active' : ''}`}
              onClick={() => update('gender', g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-section">
        <div className="setting-label">피부톤</div>
        <div className="setting-grid">
          {['쿨톤', '웜톤'].map((t) => (
            <button
              key={t}
              className={`setting-btn ${settings.tone === t ? 'active' : ''}`}
              onClick={() => update('tone', t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-section">
        <div className="setting-row">
          <div className="setting-col">
            <div className="setting-label">상의 사이즈</div>
            <select
              className="setting-select"
              value={settings.topSize}
              onChange={(e) => update('topSize', e.target.value)}
            >
              {topSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="setting-col">
            <div className="setting-label">하의 사이즈</div>
            <select
              className="setting-select"
              value={settings.bottomSize}
              onChange={(e) => update('bottomSize', e.target.value)}
            >
              {bottomSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="setting-section">
        <div className="setting-label">선호 핏</div>
        <div className="setting-grid">
          {fits.map((f) => (
            <button
              key={f}
              className={`setting-btn ${settings.fit === f ? 'active' : ''}`}
              onClick={() => update('fit', f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(ALL_ITEMS).map((category) => (
        <div className="setting-section" key={category}>
          <div className="setting-label">선호 {LABEL[category]}</div>
          <div className="checkbox-grid">
            {ALL_ITEMS[category].map((item) => (
              <button
                key={item}
                className={`checkbox-btn ${settings.preferredItems[category].includes(item) ? 'active' : ''}`}
                onClick={() => toggleItem(category, item)}
              >
                {settings.preferredItems[category].includes(item) ? '✓ ' : ''}{item}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="setting-section">
        <div className="setting-label">계정</div>
        {name && <div className="account-name">{name}</div>}
        <div className="account-email">{email}</div>
        <button className="logout-btn" onClick={onLogout}>로그아웃</button>
        <button className="delete-account-link" onClick={() => { setDeleting(!deleting); setDeletePw(''); setDeleteError('') }}>
          회원 탈퇴
        </button>
        {deleting && (
          <div className="delete-confirm">
            <div className="delete-warning">
              탈퇴하면 옷장·찜·설정이 <b>모두 삭제</b>되며 되돌릴 수 없어요.<br />
              계속하려면 비밀번호를 입력하세요.
            </div>
            <input type="password" className="delete-pw" placeholder="비밀번호"
              value={deletePw} onChange={(e) => setDeletePw(e.target.value)} autoComplete="current-password" />
            {deleteError && <div className="delete-error">{deleteError}</div>}
            <button className="delete-confirm-btn" onClick={doDelete} disabled={deleteBusy}>
              {deleteBusy ? '처리 중...' : '영구 삭제'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingPage