(function(window) {
    'use strict';

    const EDM = window.EDM;
    const audioContext = EDM.audioContext;
    const globalGain = EDM.globalGain;
    const keyColors = EDM.keyColors;

    // Sustain 관련 변수
    let activeOscillators = {};
    let oscillatorIdCounter = 0;

    // Alan Walker 스타일 신디사이저 비프음 재생 (Sustain 버전)
    function playBeep(frequency, key) {
        const now = audioContext.currentTime;

        // 이미 재생 중이면 기존 것을 먼저 정리
        if (activeOscillators[key]) {
            const { oscillators } = activeOscillators[key];
            oscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {}
            });
            delete activeOscillators[key];
        }

        // 마스터 게인 (전체 볼륨 조절)
        const masterGain = audioContext.createGain();
        masterGain.connect(globalGain);

        // === 레이어 1: 메인 Saw Wave (풍부한 하모닉스) ===
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        const filter1 = audioContext.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(frequency, now);
        osc1.detune.setValueAtTime(5, now);

        filter1.type = 'lowpass';
        filter1.frequency.setValueAtTime(300, now);
        filter1.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
        filter1.frequency.setValueAtTime(1500, now + 0.2); // Sustain
        filter1.Q.setValueAtTime(8, now);

        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gain1.gain.setValueAtTime(0.1, now + 0.15); // Sustain level

        osc1.connect(filter1);
        filter1.connect(gain1);
        gain1.connect(masterGain);

        // === 레이어 2: 두 번째 Saw Wave (약간 디튠) ===
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        const filter2 = audioContext.createBiquadFilter();

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(frequency, now);
        osc2.detune.setValueAtTime(-5, now);

        filter2.type = 'lowpass';
        filter2.frequency.setValueAtTime(300, now);
        filter2.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
        filter2.frequency.setValueAtTime(1500, now + 0.2);
        filter2.Q.setValueAtTime(8, now);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gain2.gain.setValueAtTime(0.1, now + 0.15);

        osc2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(masterGain);

        // === 레이어 3: Square Wave (하모닉 풍부함) ===
        const osc3 = audioContext.createOscillator();
        const gain3 = audioContext.createGain();
        const filter3 = audioContext.createBiquadFilter();

        osc3.type = 'square';
        osc3.frequency.setValueAtTime(frequency * 2, now);

        filter3.type = 'bandpass';
        filter3.frequency.setValueAtTime(2000, now);
        filter3.Q.setValueAtTime(2, now);

        gain3.gain.setValueAtTime(0, now);
        gain3.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain3.gain.setValueAtTime(0.05, now + 0.1);

        osc3.connect(filter3);
        filter3.connect(gain3);
        gain3.connect(masterGain);

        // === 레이어 4: Sub Bass (깊이 추가) ===
        const oscSub = audioContext.createOscillator();
        const gainSub = audioContext.createGain();

        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(frequency * 0.5, now);

        gainSub.gain.setValueAtTime(0, now);
        gainSub.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gainSub.gain.setValueAtTime(0.12, now + 0.15);

        oscSub.connect(gainSub);
        gainSub.connect(masterGain);

        // === 노이즈 레이어 (어택에 펀치감 추가) ===
        const bufferSize = audioContext.sampleRate * 0.05;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSource = audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const noiseFilter = audioContext.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(frequency * 4, now);
        noiseFilter.Q.setValueAtTime(5, now);

        const noiseGain = audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);

        // === 딜레이 효과 (공간감) ===
        const delay = audioContext.createDelay();
        const delayGain = audioContext.createGain();
        const delayFeedback = audioContext.createGain();

        delay.delayTime.setValueAtTime(0.125, now);
        delayGain.gain.setValueAtTime(0.3, now);
        delayFeedback.gain.setValueAtTime(0.4, now);

        masterGain.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(globalGain);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);

        // 모든 오실레이터 시작
        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        oscSub.start(now);
        noiseSource.start(now);

        // 활성 오실레이터 저장 (고유 ID 부여)
        const oscillatorId = ++oscillatorIdCounter;
        activeOscillators[key] = {
            id: oscillatorId,
            oscillators: [osc1, osc2, osc3, oscSub],
            gains: [gain1, gain2, gain3, gainSub, masterGain],
            filters: [filter1, filter2]
        };

        // 시각 효과
        createVisualEffect(key);

        // 악보에 음표 추가 (main.js 함수 호출)
        if (typeof addNoteToStaff === 'function') {
            addNoteToStaff(key);
        }
    }

    // 음 종료 (키를 뗄 때)
    function stopBeep(key) {
        if (!activeOscillators[key]) return;

        const now = audioContext.currentTime;
        const { id, oscillators, gains } = activeOscillators[key];

        // Release 엔벨로프
        gains.forEach(gain => {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        });

        // 0.3초 후 정리 (단, ID가 같을 때만 - 새로운 음이 시작되지 않았을 때만)
        setTimeout(() => {
            if (activeOscillators[key] && activeOscillators[key].id === id) {
                oscillators.forEach(osc => {
                    try {
                        osc.stop();
                    } catch (e) {}
                });
                delete activeOscillators[key];
            }
        }, 350);
    }

    // 시각 효과
    function createVisualEffect(key) {
        const wave = document.createElement('div');
        wave.className = 'wave animate';
        wave.style.background = `radial-gradient(circle, ${keyColors[key]}55 0%, transparent 70%)`;
        document.getElementById('visualizer').appendChild(wave);

        setTimeout(() => wave.remove(), 500);
    }

    // One-shot 비프음 (루프용, sustain 없음)
    function playOneShotBeep(frequency, key) {
        const now = audioContext.currentTime;
        const duration = 0.4;

        const masterGain = audioContext.createGain();
        masterGain.connect(globalGain);

        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        const filter1 = audioContext.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(frequency, now);
        osc1.detune.setValueAtTime(5, now);

        filter1.type = 'lowpass';
        filter1.frequency.setValueAtTime(300, now);
        filter1.frequency.exponentialRampToValueAtTime(2500, now + 0.1);
        filter1.frequency.exponentialRampToValueAtTime(800, now + duration);
        filter1.Q.setValueAtTime(8, now);

        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.12, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.connect(filter1);
        filter1.connect(gain1);
        gain1.connect(masterGain);

        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(frequency * 0.5, now);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc2.connect(gain2);
        gain2.connect(masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    }

    // 네임스페이스에 노출
    window.EDM.playBeep = playBeep;
    window.EDM.stopBeep = stopBeep;
    window.EDM.createVisualEffect = createVisualEffect;
    window.EDM.playOneShotBeep = playOneShotBeep;
    window.EDM.activeOscillators = activeOscillators;

    console.log('✅ EDM Synth 모듈 로드 완료');

})(window);
