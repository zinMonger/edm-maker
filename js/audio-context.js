(function(window) {
    'use strict';

    window.EDM = window.EDM || {};

    // Web Audio API 초기화
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 전역 오디오 라우팅
    const globalDestination = audioContext.createMediaStreamDestination();
    const globalGain = audioContext.createGain();
    globalGain.gain.value = 1.0;
    globalGain.connect(audioContext.destination);
    globalGain.connect(globalDestination);

    // 네임스페이스에 노출
    window.EDM.audioContext = audioContext;
    window.EDM.globalGain = globalGain;
    window.EDM.globalDestination = globalDestination;

    console.log('✅ EDM AudioContext 모듈 로드 완료');

})(window);
