// React 진입점 — index.html의 #root에 App을 마운트.
// StrictMode는 개발 중 부수효과 실수를 잡기 위해 useEffect 등을 두 번 실행해본다(배포엔 영향 없음).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
