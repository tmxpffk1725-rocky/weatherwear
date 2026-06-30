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

function SettingPage({ settings, setSettings, email, onLogout }) {
  const topSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const bottomSizes = ['24', '26', '28', '30', '32', '34', '36']
  const fits = ['슬림핏', '오버핏', '와이드']

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
        <div className="account-email">{email}</div>
        <button className="logout-btn" onClick={onLogout}>로그아웃</button>
      </div>
    </div>
  )
}

export default SettingPage