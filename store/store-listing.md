# DevCurl - Chrome Web Store Listing

> 이 문서는 Chrome Web Store 등록 시 입력할 내용을 정리한 참고 문서입니다.
> 실제 등록은 https://chrome.google.com/webstore/devconsole 에서 진행합니다.

---

## 기본 정보

- **이름**: DevCurl - Clean cURL Generator
- **요약 (Summary)**: Generate clean curl commands from Chrome DevTools network requests.
- **카테고리**: Developer Tools
- **언어**: English (한국어 설명도 아래에 포함)

---

## 상세 설명 (English)

```
DevCurl - Clean cURL Generator

Tired of Chrome's messy "Copy as cURL"? DevCurl generates clean, readable curl commands by automatically stripping unnecessary browser headers.

✨ Features:
• Clean curl output — Removes sec-ch-ua, sec-fetch-*, and other browser noise
• Real-time capture — Monitors XHR/Fetch requests as they happen
• One-click copy — Copy curl to clipboard instantly
• Smart filtering — Filter by URL, HTTP method, or status code
• Response summary — See status code, content-type, and response time at a glance
• Customizable headers — Choose exactly which headers to include or exclude
• Presets — Essential, Default, or Include All modes
• Dark/Light theme — Matches your DevTools theme
• Zero dependencies — Lightweight, fast, no external requests

🔧 How to use:
1. Open Chrome DevTools (F12)
2. Click the "cURL" tab
3. Browse any website — requests appear automatically
4. Click a request to see the clean curl command
5. Hit "Copy" and paste into your terminal

📋 Before (Chrome's Copy as cURL):
curl 'https://api.example.com/users' \
  -H 'sec-ch-ua: "Chromium";v="131"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'User-Agent: Mozilla/5.0 ...(long string)'

✅ After (DevCurl):
curl 'https://api.example.com/users' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer eyJhbG...'

Perfect for frontend/backend debugging, API testing, and sharing clean requests with teammates.

No data collection. No external network requests. Everything runs locally in your browser.
```

---

## 상세 설명 (한국어)

```
DevCurl - 깔끔한 cURL 생성기

Chrome의 지저분한 "Copy as cURL"에 지치셨나요? DevCurl은 불필요한 브라우저 헤더를 자동으로 제거하여 깔끔하고 읽기 쉬운 curl 명령어를 생성합니다.

✨ 주요 기능:
• 깔끔한 curl 출력 — sec-ch-ua, sec-fetch-* 등 브라우저 노이즈 자동 제거
• 실시간 캡처 — XHR/Fetch 요청을 실시간으로 수집
• 원클릭 복사 — curl을 즉시 클립보드에 복사
• 스마트 필터 — URL, HTTP 메서드, 상태 코드별 필터링
• 응답 요약 — 상태 코드, Content-Type, 응답 시간을 한눈에 확인
• 커스텀 헤더 설정 — 포함/제외할 헤더를 직접 선택
• 프리셋 — 최소, 기본, 전체 포함 모드 제공
• 다크/라이트 테마 — DevTools 테마와 자동 연동
• 제로 의존성 — 가볍고 빠르며, 외부 요청 없음

🔧 사용법:
1. Chrome DevTools (F12) 열기
2. "cURL" 탭 클릭
3. 웹사이트 탐색 — 요청이 자동으로 수집됨
4. 요청 클릭 → 깔끔한 curl 명령어 확인
5. "Copy" 클릭 → 터미널에 붙여넣기

프론트/백엔드 디버깅, API 테스트, 팀원과 요청 공유에 최적화되어 있습니다.

데이터 수집 없음. 외부 네트워크 요청 없음. 모든 것이 브라우저 내에서 로컬로 동작합니다.
```

---

## 스크린샷 가이드

Chrome Web Store에 최소 1장, 최대 5장의 스크린샷이 필요합니다.

**필요한 스크린샷** (1280x800 또는 640x400 권장):

1. **메인 화면** - DevTools에서 cURL 탭이 열린 모습, 좌측 요청 목록 + 우측 curl 명령어
2. **필터 기능** - Method/Status 필터가 활성화된 상태
3. **설정 화면** - 헤더 필터 커스텀 설정 모달
4. **Before/After 비교** - Chrome Copy as cURL vs DevCurl 결과 비교
5. **다크 모드** - 다크 테마 적용 모습

### 스크린샷 촬영 방법:
1. Chrome에서 익스텐션을 로드한 상태에서 아무 웹사이트 접속
2. DevTools 열고 cURL 탭으로 이동
3. 몇 가지 API 요청이 있는 사이트에서 요청 캡처
4. macOS: `Cmd + Shift + 4` → 영역 선택 캡처
5. 1280x800 또는 640x400으로 리사이즈

---

## 프로모션 타일 (선택사항)

- **Small tile**: 440x280px
- 배경: 다크 (#1a1a2e) 또는 그라데이션
- 로고 + 간단한 태그라인: "Clean curl from DevTools"

---

## 등록 시 선택 항목

| 항목 | 값 |
|------|-----|
| Category | Developer Tools |
| Language | English (추가: Korean) |
| Visibility | Public |
| Distribution | All regions |
| Pricing | Free |
| Mature content | No |
| Single purpose | DevTools에서 네트워크 요청을 깔끔한 curl 명령어로 변환 |
