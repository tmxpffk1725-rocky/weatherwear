// 위치 처리 — GPS 위경도를 기상청 격자 좌표(nx, ny)로 변환한다.
//
// 왜 변환이 필요한가: 기상청 단기예보 API는 위경도가 아니라 한반도를
// 5km × 5km 칸으로 나눈 자체 격자 좌표(nx, ny)로만 조회할 수 있다.
// 예: 서울 시청 (37.56, 126.97) → (nx 60, ny 127)

// 위경도 → 기상청 격자 좌표 변환.
// 기상청이 쓰는 람베르트 정각원추도법(Lambert Conformal Conic) 투영 공식으로,
// 아래 상수들은 기상청 공식 가이드 문서에 정의된 값을 그대로 옮긴 것이다.
// (공식 자체는 지도 투영 수학이라 외울 필요 없고, "기상청 표준 상수를 쓴
//  표준 변환식"이라는 점과 결과가 5km 격자 인덱스라는 점이 핵심)
export const convertToGrid = (lat, lon) => {
  const RE = 6371.00877 // 지구 반경(km)
  const GRID = 5.0      // 격자 한 칸 크기(km)
  const SLAT1 = 30.0    // 투영 표준 위도 1
  const SLAT2 = 60.0    // 투영 표준 위도 2
  const OLON = 126.0    // 기준점 경도
  const OLAT = 38.0     // 기준점 위도
  const XO = 43         // 기준점의 격자 X 좌표
  const YO = 136        // 기준점의 격자 Y 좌표

  const DEGRAD = Math.PI / 180.0 // 도(°) → 라디안 변환 계수
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD
  const slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD
  const olat = OLAT * DEGRAD

  // sn·sf·ro: 표준 위도 2개로 원뿔 투영의 축척을 정하는 중간 계수들 (공식 그대로)
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = re * sf / Math.pow(ro, sn)

  // 입력 위경도를 같은 투영면 위의 극좌표(ra, theta)로 변환
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = re * sf / Math.pow(ra, sn)
  let theta = lon * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn

  // 극좌표 → 격자 인덱스 (+0.5 후 내림 = 반올림해서 가장 가까운 칸)
  const x = Math.floor(ra * Math.sin(theta) + XO + 0.5)
  const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)

  return { nx: x, ny: y }
}

// 브라우저 GPS로 현재 위치를 얻고 격자 좌표까지 붙여 반환.
// 위경도는 역지오코딩(동네 이름 표시)에, nx/ny는 날씨 조회에 쓰인다.
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS 미지원'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const grid = convertToGrid(latitude, longitude)
        resolve({ lat: latitude, lon: longitude, ...grid })
      },
      (err) => reject(err),
      { timeout: 10000 } // 10초 안에 위치를 못 얻으면 실패 처리(무한 대기 방지)
    )
  })
}