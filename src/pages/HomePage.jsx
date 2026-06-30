import { useState, useEffect } from 'react'
import { fetchWeather } from '../api/weather'
import { fetchOutfitPresets } from '../api/shop'
import { toggleFavorite, isFavorite, removeFavorite } from '../api/favorites'
import { getSolarTerm } from '../api/season'
import { COLOR_HEX } from '../api/colors'
import { closetForAI } from '../api/closet'
import '../styles/HomePage.css'

function HomePage({ settings, closet, favorites, setFavorites }) {
  const [weather, setWeather] = useState({
    location: '현재 위치',
    temp: '--',
    feel: '--',
    desc: '--',
    rain: false
  })

  const [situation, setSituation] = useState('출근')
  const situations = ['출근', '데이트', '캐주얼', '운동']
  const [presets, setPresets] = useState([])
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [loading, setLoading] = useState(false)
  const solarTerm = getSolarTerm() // 오늘 24절기 (표시 + 추천 시즌 키워드)

  useEffect(() => {
    fetchWeather()
      .then((data) => {
        setWeather({
          location: data.location,
          temp: data.temp,
          feel: data.feel,
          desc: data.desc,
          rain: data.rain,
        })
      })
      .catch((err) => {
        console.error('날씨 불러오기 실패:', err)
      })
  }, [])

  useEffect(() => {
    if (weather.feel === '--') return
    setLoading(true)
    // 추천은 실제 기온이 아니라 체감온도(feel) 기준 + 강수 여부 반영
    // 옷장은 탭 전환 시 HomePage가 재마운트되므로 호출 시점에 최신을 읽는다
    fetchOutfitPresets(weather.feel, situation, settings.gender, settings.preferredItems, weather.rain, settings.tone, settings.fit, closetForAI(closet))
      .then((data) => {
        setPresets(data)
        setSelectedPreset(0)
        setLoading(false)
      })
      .catch((err) => {
        console.error('쇼핑 불러오기 실패:', err)
        setLoading(false)
      })
  }, [weather.feel, weather.rain, situation, settings.gender, settings.tone, settings.fit])

  const preset = presets[selectedPreset]
  const saved = preset ? isFavorite(favorites, preset) : false

  const handleToggleFavorite = () => {
    if (!preset) return
    setFavorites(toggleFavorite(favorites, preset, { situation, temp: weather.temp }))
  }

  const handleRemoveFavorite = (id) => {
    setFavorites(removeFavorite(favorites, id))
  }

  const renderColorChip = (color) =>
    color && COLOR_HEX[color] ? (
      <span className="outfit-color">
        <span className="outfit-color-dot" style={{ background: COLOR_HEX[color] }} />
        {color}
      </span>
    ) : null

  const renderItem = (item, label, color) => {
    if (!item) return null
    // 옷장 보유 옷: 구매 버튼 없이 '내 옷' 배지로 표시
    if (item.owned) {
      return (
        <div className="outfit-card outfit-card-owned">
          <div className="outfit-image owned-image">
            <span className="owned-badge">내 옷</span>
          </div>
          <div className="outfit-info">
            <div className="outfit-category">
              {label}
              {renderColorChip(color)}
            </div>
            <div className="outfit-name">{item.name}</div>
            <div className="outfit-sub">옷장에 있는 옷</div>
          </div>
        </div>
      )
    }
    return (
      <div className="outfit-card">
        <div className="outfit-image">
          {item.image
            ? <img src={item.image} alt={item.title} />
            : <span className="image-placeholder">상품 이미지</span>
          }
        </div>
        <div className="outfit-info">
          <div className="outfit-category">
            {label}
            {renderColorChip(color)}
          </div>
          <div className="outfit-name">{item.title.replace(/<[^>]+>/g, '')}</div>
          <div className="outfit-sub">{item.mallName} · {parseInt(item.lprice).toLocaleString()}원</div>
          <a href={item.link} target="_blank" rel="noreferrer" className="buy-btn">구매하기 →</a>
        </div>
      </div>
    )
  }

  const favItemImages = (items) =>
    ['top', 'bottom', 'outer', 'shoes']
      .map((cat) => items[cat])
      .filter(Boolean)

  return (
    <div className="home-page">
      <div className="weather-card">
        <div className="weather-location">📍 {weather.location} · {solarTerm.name}</div>
        <div className="weather-temp">{weather.temp}°</div>
        <div className="weather-desc">{weather.desc} · 체감 {weather.feel}°</div>
      </div>

      <div className="situation-section">
        <div className="section-label">상황 선택</div>
        <div className="situation-grid">
          {situations.map((s) => (
            <button
              key={s}
              className={`situation-btn ${situation === s ? 'active' : ''}`}
              onClick={() => setSituation(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="outfit-section">
        <div className="outfit-section-header">
          <div className="section-label">추천 코디</div>
          <div className="outfit-header-right">
            {preset && (
              <button
                className={`fav-toggle ${saved ? 'active' : ''}`}
                onClick={handleToggleFavorite}
                aria-label="찜하기"
              >
                {saved ? '♥' : '♡'}
              </button>
            )}
            <div className="preset-tabs">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  className={`preset-tab ${selectedPreset === i ? 'active' : ''}`}
                  onClick={() => setSelectedPreset(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : preset ? (
          <>
            {preset.reason && (
              <div className="outfit-reason">
                {preset.concept && <span className="outfit-concept">{preset.concept}</span>}
                {preset.reason}
                {preset.tip && <div className="outfit-tip">💡 {preset.tip}</div>}
              </div>
            )}
            <div className="outfit-list">
              {renderItem(preset.top, '상의', preset.colors?.top)}
              {renderItem(preset.bottom, '하의', preset.colors?.bottom)}
              {renderItem(preset.outer, '아우터', preset.colors?.outer)}
              {renderItem(preset.shoes, '신발', preset.colors?.shoes)}
            </div>
          </>
        ) : null}
      </div>

      <div className="fav-section">
        <div className="section-label">찜한 코디</div>
        {favorites.length === 0 ? (
          <div className="fav-empty">마음에 드는 코디를 ♡ 로 저장해보세요</div>
        ) : (
          <div className="fav-scroll">
            {favorites.map((fav) => (
              <div key={fav.id} className="fav-card">
                <button
                  className="fav-remove"
                  onClick={() => handleRemoveFavorite(fav.id)}
                  aria-label="삭제"
                >
                  ✕
                </button>
                <div className="fav-thumbs">
                  {favItemImages(fav.items).map((item, idx) => (
                    <div key={idx} className="fav-thumb">
                      {item.image
                        ? <img src={item.image} alt={item.title} />
                        : <span className="fav-thumb-ph" />
                      }
                    </div>
                  ))}
                </div>
                <div className="fav-meta">
                  {fav.situation && <span className="fav-tag">{fav.situation}</span>}
                  {fav.temp !== '' && fav.temp !== '--' && (
                    <span className="fav-temp">{fav.temp}°</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
