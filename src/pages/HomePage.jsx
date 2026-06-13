import { useState, useEffect } from 'react'
import { fetchWeather } from '../api/weather'
import { fetchOutfitPresets } from '../api/shop'
import '../styles/HomePage.css'

function HomePage({ settings }) {
  const [weather, setWeather] = useState({
    location: '현재 위치',
    temp: '--',
    feel: '--',
    desc: '--'
  })

  const [situation, setSituation] = useState('출근')
  const situations = ['출근', '데이트', '캐주얼', '운동']
  const [presets, setPresets] = useState([])
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchWeather()
      .then((data) => {
        setWeather({
  location: data.location,
  temp: data.temp,
  feel: data.feel,
  desc: data.desc,
})
      })
      .catch((err) => {
        console.error('날씨 불러오기 실패:', err)
      })
  }, [])

  useEffect(() => {
    if (weather.temp === '--') return
    setLoading(true)
    fetchOutfitPresets(weather.temp, situation, settings.gender, settings.preferredItems)
      .then((data) => {
        setPresets(data)
        setSelectedPreset(0)
        setLoading(false)
      })
      .catch((err) => {
        console.error('쇼핑 불러오기 실패:', err)
        setLoading(false)
      })
  }, [weather.temp, situation, settings.gender])

  const preset = presets[selectedPreset]

  const renderItem = (item, label) => {
    if (!item) return null
    return (
      <div className="outfit-card">
        <div className="outfit-image">
          {item.image
            ? <img src={item.image} alt={item.title} />
            : <span className="image-placeholder">상품 이미지</span>
          }
        </div>
        <div className="outfit-info">
          <div className="outfit-category">{label}</div>
          <div className="outfit-name">{item.title.replace(/<[^>]+>/g, '')}</div>
          <div className="outfit-sub">{item.mallName} · {parseInt(item.lprice).toLocaleString()}원</div>
          <a href={item.link} target="_blank" rel="noreferrer" className="buy-btn">구매하기 →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="home-page">
      <div className="weather-card">
        <div className="weather-location">📍 {weather.location} · 자동</div>
        <div className="weather-temp">{weather.temp}°C</div>
        <div className="weather-desc">{weather.desc} · 체감 {weather.feel}°C</div>
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

        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : preset ? (
          <div className="outfit-list">
            {renderItem(preset.top, '상의')}
            {renderItem(preset.bottom, '하의')}
            {renderItem(preset.outer, '아우터')}
            {renderItem(preset.shoes, '신발')}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default HomePage