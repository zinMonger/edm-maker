(function(window) {
    'use strict';

    // 네임스페이스 생성
    window.EDM = window.EDM || {};

    // 음계 주파수 매핑 (C5부터 시작)
    window.EDM.noteFrequencies = {
        'q': 523.25,  // C5
        'w': 587.33,  // D5
        'e': 659.25,  // E5
        'r': 698.46,  // F5
        'a': 783.99,  // G5
        's': 880.00,  // A5
        'd': 987.77,  // B5
        'f': 1046.50  // C6
    };

    // 음표 이름
    window.EDM.noteNames = {
        'q': 'C',
        'w': 'D',
        'e': 'E',
        'r': 'F',
        'a': 'G',
        's': 'A',
        'd': 'B',
        'f': 'C'
    };

    // 오선지 위치 매핑 (위에서부터의 거리, px)
    window.EDM.staffPositions = {
        'q': 145,  // C5
        'w': 130,  // D5
        'e': 115,  // E5
        'r': 100,  // F5
        'a': 85,   // G5
        's': 70,   // A5
        'd': 55,   // B5
        'f': 40    // C6
    };

    // 색상 매핑
    window.EDM.keyColors = {
        'q': '#ff6b6b',
        'w': '#feca57',
        'e': '#48dbfb',
        'r': '#ff9ff3',
        'a': '#54a0ff',
        's': '#00d2d3',
        'd': '#ff6348',
        'f': '#1dd1a1'
    };

    // 설정값
    window.EDM.CHORD_THRESHOLD = 100;  // ms (화음 판정 임계값)
    window.EDM.LOOP_DURATION = 4000;   // ms (루프 지속 시간)

    console.log('✅ EDM Constants 모듈 로드 완료');

})(window);
