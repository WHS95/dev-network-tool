# DevCurl - Chrome DevTools cURL Generator & Screen Map

Chrome DevTools Network 탭에서 캡처된 HTTP 요청을 깔끔한 curl 명령어로 변환하고, 페이지별 API 매핑을 자동으로 구축하는 Chrome Extension.

## 주요 기능

### Requests 탭
- XHR/Fetch 요청 실시간 수집
- 불필요한 브라우저 헤더를 제거한 깔끔한 **curl / fetch / axios** 코드 생성
- 원클릭 복사
- 응답 요약 (Status Code, Content-Type, 응답 시간)
- 응답 헤더 및 Body 표시
- URL 검색, Method/Status 필터, 최신순/과거순 정렬
- 헤더 필터 커스텀 설정 (프리셋 지원)
- 다크/라이트 테마 자동 대응

### Screen Map 탭
- **Scan** 버튼으로 현재 페이지의 라우트 + API 호출을 한 번에 캡처
- Next.js 앱이면 `__NEXT_DATA__`에서 라우트 패턴/파라미터를 정확히 추출
- React 등 기타 프레임워크는 URL 그대로 표시 (추측하지 않음)
- 응답 데이터의 스키마(키 + 타입) 자동 추출
- 스캔 결과 누적 저장 (chrome.storage.local)
- JSON Export로 팀 공유 가능

## 설치 방법

### 1. 소스 코드 다운로드

```bash
git clone https://github.com/WHS95/dev-network-tool.git
```

### 2. Chrome에 Extension 로드

1. Chrome 브라우저에서 주소창에 `chrome://extensions` 입력
2. 우측 상단의 **개발자 모드** 토글을 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 버튼 클릭
4. 다운로드한 `dev-network-tool` 폴더 선택
5. "DevCurl - Clean cURL Generator" 확장이 목록에 나타나면 설치 완료

### 3. 사용하기

1. 아무 웹 페이지에서 **F12** (또는 `Cmd+Option+I`)로 Chrome DevTools 열기
2. 상단 탭에서 **cURL** 탭 클릭
3. 페이지에서 발생하는 API 요청이 실시간으로 좌측 목록에 수집됨
4. 요청을 클릭하면 우측에 curl / fetch / axios 코드 + 응답 표시

### 4. Screen Map 사용하기

1. DevTools의 cURL 패널에서 **Screen Map** 탭 클릭
2. 확인하고 싶은 페이지로 이동
3. 우측 상단의 **Scan** 버튼 클릭
4. 현재 페이지의 라우트 정보 + API 호출 목록 + 응답 스키마가 자동 캡처됨
5. 다른 페이지로 이동하여 반복하면 전체 앱의 API-Screen 매핑이 구축됨
6. **Export** 버튼으로 JSON 파일로 내보내기 가능

## 프로젝트 구조

```
devcurl/
├── manifest.json              # Chrome Extension 설정 (Manifest V3)
├── devtools.html              # DevTools 진입점
├── devtools.js                # "cURL" 패널 등록
├── panel/
│   ├── panel.html             # 패널 UI (Requests + Screen Map)
│   ├── panel.js               # UI 로직, 이벤트 핸들링
│   └── panel.css              # 스타일 (다크/라이트 테마)
├── lib/
│   ├── curl-generator.js      # HAR → curl 변환
│   ├── code-generator.js      # HAR → fetch/axios 변환 + 응답 추출
│   ├── header-filter.js       # 헤더 필터 설정 관리
│   └── screen-scanner.js      # Screen Map 스캔 로직
├── settings/
│   ├── settings.html          # 헤더 필터 설정 UI
│   ├── settings.js            # 설정 저장/불러오기
│   └── settings.css           # 설정 페이지 스타일
├── icons/                     # Extension 아이콘
├── store/                     # Chrome Web Store 등록 자료
└── docs/plans/                # 설계 문서
```

## 기술 스택

- **Manifest V3** - Chrome Extension 최신 표준
- **Vanilla JS** - 외부 의존성 없음, 번들러 불필요
- **CSS 변수** - 다크/라이트 테마 자동 대응
- **chrome.storage.sync** - 헤더 필터 설정 동기화
- **chrome.storage.local** - Screen Map 데이터 저장
- **chrome.devtools.network** - 요청 캡처
- **chrome.devtools.inspectedWindow** - 페이지 컨텍스트 접근

## 지원 환경

- Chrome 88 이상
- 권한: `storage`만 사용 (네트워크 요청, 쿠키 등 민감 권한 없음)
