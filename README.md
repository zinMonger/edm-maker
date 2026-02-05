# 🎵 EDM Beep Maker - Refactored

Alan Walker 스타일의 EDM 신디사이저 웹 앱 (모듈화된 구조)

## 📁 프로젝트 구조

```
edm-beep-maker/
├── index.html                 # 메인 HTML 파일
├── css/                       # 스타일 모듈
│   ├── main.css              # 기본 스타일 및 레이아웃
│   ├── keyboard.css          # 키보드 스타일
│   ├── sheet-music.css       # 악보 스타일
│   ├── loop-system.css       # 루프 시스템 스타일
│   └── social-share.css      # SNS 공유 스타일
├── js/                        # JavaScript 모듈
│   ├── main.js               # 메인 앱 오케스트레이터
│   ├── core/                 # 코어 시스템
│   │   ├── audioEngine.js    # Web Audio API 엔진
│   │   └── keyboardController.js  # 키보드 입력 관리
│   ├── features/             # 기능 모듈
│   │   ├── sheetMusic.js     # 악보 표시 기능
│   │   ├── recorder.js       # 녹음/재생 기능
│   │   ├── loopSystem.js     # 루프 레이어 시스템
│   │   ├── backgroundMusic.js  # 배경음악
│   │   └── socialShare.js    # SNS 공유 (새 기능!)
│   └── utils/                # 유틸리티
│       ├── constants.js      # 상수 정의
│       └── visualEffects.js  # 시각 효과
└── README.md                  # 프로젝트 문서
```

## 🎯 주요 기능

### 1. **코어 시스템** (`js/core/`)
- **AudioEngine**: Web Audio API를 사용한 신디사이저 엔진
  - Alan Walker 스타일의 레이어드 사운드
  - Sustain 및 Release 엔벨로프
  - 딜레이 효과
  
- **KeyboardController**: 키보드 입력 관리
  - 이벤트 리스너 패턴으로 다른 모듈에 키 입력 전파
  - 키 repeat 방지

### 2. **기능 모듈** (`js/features/`)

#### SheetMusic (악보 시스템)
- 실시간 음표 표시
- 화음 감지 (100ms 이내 동시 입력)
- 자동 스크롤
- 최대 음표 수 제한

#### Recorder (녹음/재생)
- 타임스탬프 기반 녹음
- 재생 시 타이밍 정확도 유지
- 시각 피드백

#### LoopSystem (루프 레이어)
- Ed Sheeran 스타일 루프 스테이션
- 4초 자동 녹음
- 다중 레이어 관리
- 개별 레이어 ON/OFF
- 레이어 삭제

#### BackgroundMusic (배경음악)
- 킥, 하이햇, 베이스 라인
- 독립적인 오디오 컨텍스트

#### SocialShare (SNS 공유) - **새 기능!**
- Twitter, Facebook 공유
- 링크 복사 기능
- 실시간 통계 표시
- 반응형 UI (모바일 하단, 데스크탑 왼쪽)

### 3. **유틸리티** (`js/utils/`)
- **constants.js**: 모든 상수를 한 곳에서 관리
- **visualEffects.js**: 파동 효과, 키 활성화 등

## 🔧 아키텍처 특징

### 모듈화
각 기능이 독립적인 클래스로 분리되어 있어:
- ✅ 유지보수 용이
- ✅ 새 기능 추가 간편
- ✅ 테스트 가능
- ✅ 코드 재사용성 높음

### 이벤트 기반 통신
```javascript
// KeyboardController가 이벤트를 발생시키면
keyboardController.addListener((key, eventType) => {
    // 여러 모듈이 동시에 반응
    sheetMusic.addNote(key);
    recorder.recordNote(key);
    loopSystem.recordLoopNote(key);
});
```

### 의존성 주입
```javascript
// 각 모듈은 필요한 의존성을 생성자에서 받음
constructor(audioEngine, keyboardController) {
    this.audioEngine = audioEngine;
    this.keyboardController = keyboardController;
}
```

## 🚀 새로운 기능 추가 방법

### 1. 새 기능 모듈 생성
```javascript
// js/features/myNewFeature.js
export class MyNewFeature {
    constructor(audioEngine, keyboardController) {
        this.audioEngine = audioEngine;
        this.keyboardController = keyboardController;
        this.init();
    }

    init() {
        // 이벤트 리스너 등록
        this.keyboardController.addListener((key, eventType) => {
            if (eventType === 'press') {
                this.handleKeyPress(key);
            }
        });
    }

    handleKeyPress(key) {
        // 기능 구현
    }
}
```

### 2. 메인에서 초기화
```javascript
// js/main.js
import { MyNewFeature } from './features/myNewFeature.js';

// init() 메서드 내부에서
this.myNewFeature = new MyNewFeature(this.audioEngine, this.keyboardController);
```

### 3. 필요시 CSS 추가
```css
/* css/my-new-feature.css */
.my-feature-panel {
    /* 스타일 */
}
```

## 📱 반응형 디자인

- **데스크탑**: SNS 공유 패널이 왼쪽에 고정
- **태블릿**: SNS 공유 패널이 하단에 위치
- **모바일**: 모든 요소가 세로로 배치

## 🎹 사용 방법

1. **연주**: Q W E R A S D F 키로 연주
2. **녹음**: "녹음" 버튼 클릭 → 연주 → "녹음 중지"
3. **재생**: "재생" 버튼으로 녹음된 음 재생
4. **루프**: "루프 녹음" → 4초간 연주 → 자동 반복
5. **레이어**: 여러 루프를 쌓아 풍부한 사운드 생성
6. **공유**: 왼쪽(또는 하단) 패널에서 SNS 공유

## 💡 확장 가능성

이 구조로 쉽게 추가할 수 있는 기능들:
- 📊 **Visualizer**: 실시간 오디오 시각화
- 💾 **SaveLoad**: 작곡 저장/불러오기
- 🎚️ **Effects**: 리버브, 코러스, 필터 등
- 🎼 **MusicTheory**: 코드 추천, 스케일 가이드
- 🎤 **MicInput**: 마이크 입력 분석
- 🤝 **Collaboration**: 실시간 협업 기능

## 🛠️ 기술 스택

- **Web Audio API**: 오디오 생성 및 처리
- **ES6 Modules**: 모듈 시스템
- **CSS3**: 애니메이션 및 스타일
- **Vanilla JavaScript**: 프레임워크 없이 순수 JS

## 📝 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능
