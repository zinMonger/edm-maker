// Web Audio API 초기화
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// 전역 오디오 라우팅
const globalDestination = audioContext.createMediaStreamDestination();
const globalGain = audioContext.createGain();
globalGain.gain.value = 1.0;
globalGain.connect(audioContext.destination);
globalGain.connect(globalDestination);

let bgmPlaying = false;
let recording = false;
let recordedNotes = [];
let recordStartTime = 0;
let noteIdCounter = 0;

// Sustain 관련 변수
let activeOscillators = {};

// 루프 시스템 변수
let loopRecording = false;
let loopLayers = []; // 녹음된 루프 레이어들
let loopStartTime = 0;
let loopDuration = 4000; // 4초 루프
let currentLoop = [];
let loopPlaybackIntervals = [];
let activeLoopLayers = new Set(); // 현재 재생 중인 레이어

// 악보 화음 표시 관련 변수
let lastNoteTime = 0;
let currentColumn = 0;
const CHORD_THRESHOLD = 100; // 100ms 이내에 누른 키는 같은 열로 간주

// 오실레이터 고유 ID
let oscillatorIdCounter = 0;

// 음계 주파수 매핑 (C5부터 시작)
const noteFrequencies = {
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
const noteNames = {
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
const staffPositions = {
    'q': 145,  // C5 - 첫 번째 줄 아래
    'w': 130,  // D5 - 첫 번째 줄 위
    'e': 115,  // E5 - 첫 번째 간
    'r': 100,  // F5 - 두 번째 줄
    'a': 85,   // G5 - 두 번째 간
    's': 70,   // A5 - 세 번째 줄
    'd': 55,   // B5 - 세 번째 간
    'f': 40    // C6 - 네 번째 줄
};

// 색상 매핑
const keyColors = {
    'q': '#ff6b6b',
    'w': '#feca57',
    'e': '#48dbfb',
    'r': '#ff9ff3',
    'a': '#54a0ff',
    's': '#00d2d3',
    'd': '#ff6348',
    'f': '#1dd1a1'
};

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

    // 악보에 음표 추가
    addNoteToStaff(key);
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

// 악보에 음표 추가
function addNoteToStaff(key) {
    const notesContainer = document.querySelector('.notes-container');
    const note = document.createElement('div');
    note.className = 'note';
    note.id = `note-${noteIdCounter++}`;

    const topPosition = staffPositions[key];

    // 동시에 누른 키들은 같은 열에 표시
    const now = Date.now();
    const timeSinceLastNote = now - lastNoteTime;

    if (timeSinceLastNote > CHORD_THRESHOLD) {
        // 새로운 열 시작
        currentColumn++;
    }
    // 같은 열에 추가 (100ms 이내)

    lastNoteTime = now;

    const leftPosition = currentColumn * 50;

    note.style.top = `${topPosition}px`;
    note.style.left = `${leftPosition}px`;
    note.style.background = keyColors[key];
    note.title = noteNames[key];

    notesContainer.appendChild(note);

    setTimeout(() => note.classList.add('active'), 10);
    setTimeout(() => note.classList.remove('active'), 300);

    notesContainer.scrollLeft = notesContainer.scrollWidth;

    // 최대 음표 수 제한 (열 기준으로 조정)
    const maxColumns = 30;
    const columns = new Set();
    Array.from(notesContainer.children).forEach(n => {
        const left = parseInt(n.style.left);
        columns.add(left);
    });

    if (columns.size > maxColumns) {
        // 가장 오래된 열의 모든 음표 삭제
        const oldestColumn = Math.min(...columns);
        Array.from(notesContainer.children).forEach(n => {
            if (parseInt(n.style.left) === oldestColumn) {
                notesContainer.removeChild(n);
            }
        });
    }
}

// 악보 초기화
function clearStaff() {
    const notesContainer = document.querySelector('.notes-container');
    notesContainer.innerHTML = '';
    noteIdCounter = 0;
}

// ========== 루프 시스템 ==========

// 루프 녹음 시작/중지
function toggleLoopRecording() {
    if (!loopRecording) {
        // 녹음 시작
        loopRecording = true;
        currentLoop = [];
        loopStartTime = Date.now();

        document.getElementById('loopRecBtn').classList.add('active');
        document.getElementById('loopRecBtn').textContent = '⏹ 녹음 중지';

        // 4초 후 자동으로 녹음 종료 및 재생 시작
        setTimeout(() => {
            if (loopRecording) {
                stopLoopRecording();
            }
        }, loopDuration);
    } else {
        stopLoopRecording();
    }
}

// 루프 녹음 중지 및 레이어 추가
function stopLoopRecording() {
    loopRecording = false;
    document.getElementById('loopRecBtn').classList.remove('active');
    document.getElementById('loopRecBtn').textContent = '🔴 루프 녹음';

    if (currentLoop.length > 0) {
        // 새로운 레이어 추가
        const layerId = loopLayers.length;
        loopLayers.push({
            id: layerId,
            notes: [...currentLoop],
            active: true
        });

        // UI에 레이어 추가
        addLayerToUI(layerId);

        // 레이어 재생 시작
        activeLoopLayers.add(layerId);
        startLoopPlayback(layerId);
    }

    currentLoop = [];
}

// 레이어 UI 추가
function addLayerToUI(layerId) {
    const layersContainer = document.getElementById('loopLayers');
    const layer = document.createElement('div');
    layer.className = 'loop-layer active';
    layer.id = `layer-${layerId}`;
    layer.innerHTML = `
        <span>레이어 ${layerId + 1} (${loopLayers[layerId].notes.length}음)</span>
        <div class="layer-controls">
            <button class="layer-btn toggle-btn" onclick="toggleLayer(${layerId})">ON</button>
            <button class="layer-btn delete-btn" onclick="deleteLayer(${layerId})">🗑️</button>
        </div>
    `;
    layersContainer.appendChild(layer);
}

// 레이어 재생
function startLoopPlayback(layerId) {
    const layer = loopLayers[layerId];
    if (!layer) return;

    const playLoop = () => {
        if (!activeLoopLayers.has(layerId)) return;

        layer.notes.forEach(note => {
            setTimeout(() => {
                if (activeLoopLayers.has(layerId)) {
                    playOneShotBeep(noteFrequencies[note.key], note.key);
                    activateKey(note.key);
                }
            }, note.time);
        });
    };

    // 즉시 재생
    playLoop();

    // 루프 반복
    const interval = setInterval(() => {
        if (!activeLoopLayers.has(layerId)) {
            clearInterval(interval);
            return;
        }
        playLoop();
    }, loopDuration);

    loopPlaybackIntervals[layerId] = interval;
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

// 레이어 토글
function toggleLayer(layerId) {
    const layer = document.getElementById(`layer-${layerId}`);
    const toggleBtn = layer.querySelector('.toggle-btn');

    if (activeLoopLayers.has(layerId)) {
        // 비활성화
        activeLoopLayers.delete(layerId);
        if (loopPlaybackIntervals[layerId]) {
            clearInterval(loopPlaybackIntervals[layerId]);
        }
        layer.classList.remove('active');
        toggleBtn.textContent = 'OFF';
    } else {
        // 활성화
        activeLoopLayers.add(layerId);
        startLoopPlayback(layerId);
        layer.classList.add('active');
        toggleBtn.textContent = 'ON';
    }
}

// 레이어 삭제
function deleteLayer(layerId) {
    activeLoopLayers.delete(layerId);
    if (loopPlaybackIntervals[layerId]) {
        clearInterval(loopPlaybackIntervals[layerId]);
    }
    document.getElementById(`layer-${layerId}`).remove();
}

// 모든 레이어 삭제
function clearAllLayers() {
    loopLayers.forEach((_, id) => {
        if (loopPlaybackIntervals[id]) {
            clearInterval(loopPlaybackIntervals[id]);
        }
    });
    loopLayers = [];
    activeLoopLayers.clear();
    loopPlaybackIntervals = [];
    document.getElementById('loopLayers').innerHTML = '';
}

// ========== 배경음악 ==========

let bgmIntervals = [];
function startBackgroundMusic() {
    if (bgmPlaying) return;
    bgmPlaying = true;
    document.getElementById('bgmBtn').classList.add('active');

    const kickInterval = setInterval(() => {
        playKick();
    }, 500);

    const hihatInterval = setInterval(() => {
        playHihat();
    }, 250);

    const bassInterval = setInterval(() => {
        playBass([80, 80, 100, 120]);
    }, 2000);

    bgmIntervals = [kickInterval, hihatInterval, bassInterval];
}

function stopBackgroundMusic() {
    bgmPlaying = false;
    document.getElementById('bgmBtn').classList.remove('active');
    bgmIntervals.forEach(interval => clearInterval(interval));
    bgmIntervals = [];
}

function playKick() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(globalGain);

    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function playHihat() {
    const bufferSize = audioContext.sampleRate * 0.1;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(globalGain);

    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 0.1);
}

let bassIndex = 0;
function playBass(pattern) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(globalGain);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(pattern[bassIndex % pattern.length], audioContext.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);

    bassIndex++;
}

// ========== 키보드 이벤트 ==========

const keyElements = document.querySelectorAll('.key');
const keyMap = {};

keyElements.forEach(keyEl => {
    const key = keyEl.dataset.key;
    keyMap[key] = keyEl;

    keyEl.addEventListener('click', () => {
        playBeep(noteFrequencies[key], key);
        activateKey(key);
        if (recording) {
            recordedNotes.push({
                key: key,
                time: Date.now() - recordStartTime
            });
        }
        if (loopRecording) {
            currentLoop.push({
                key: key,
                time: Date.now() - loopStartTime
            });
        }
        // 클릭 후 바로 놓기
        setTimeout(() => stopBeep(key), 100);
    });
});

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (noteFrequencies[key] && !e.repeat) {
        playBeep(noteFrequencies[key], key);
        activateKey(key);
        if (recording) {
            recordedNotes.push({
                key: key,
                time: Date.now() - recordStartTime
            });
        }
        if (loopRecording) {
            currentLoop.push({
                key: key,
                time: Date.now() - loopStartTime
            });
        }
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key]) {
        keyMap[key].classList.remove('active');
        stopBeep(key);
    }
});

function activateKey(key) {
    if (keyMap[key]) {
        keyMap[key].classList.add('active');
        setTimeout(() => {
            if (!activeOscillators[key]) {
                keyMap[key].classList.remove('active');
            }
        }, 200);
    }
}

// ========== 컨트롤 버튼 ==========

document.getElementById('bgmBtn').addEventListener('click', () => {
    if (bgmPlaying) {
        stopBackgroundMusic();
    } else {
        startBackgroundMusic();
    }
});

document.getElementById('recordBtn').addEventListener('click', () => {
    if (!recording) {
        recording = true;
        recordedNotes = [];
        recordStartTime = Date.now();
        document.getElementById('recordingIndicator').classList.add('active');
        document.getElementById('recordBtn').classList.add('active');
        document.getElementById('recordBtn').textContent = '⏹ 녹음 중지';
    } else {
        recording = false;
        document.getElementById('recordingIndicator').classList.remove('active');
        document.getElementById('recordBtn').classList.remove('active');
        document.getElementById('recordBtn').textContent = '⏺ 녹음';
        alert(`${recordedNotes.length}개의 음이 녹음되었습니다!`);
    }
});

document.getElementById('playBtn').addEventListener('click', () => {
    if (recordedNotes.length === 0) {
        alert('녹음된 음이 없습니다!');
        return;
    }

    document.getElementById('playBtn').classList.add('active');
    recordedNotes.forEach(note => {
        setTimeout(() => {
            playOneShotBeep(noteFrequencies[note.key], note.key);
            activateKey(note.key);
        }, note.time);
    });

    setTimeout(() => {
        document.getElementById('playBtn').classList.remove('active');
    }, recordedNotes[recordedNotes.length - 1].time + 500);
});

document.getElementById('clearBtn').addEventListener('click', () => {
    clearStaff();
});

document.getElementById('loopRecBtn').addEventListener('click', () => {
    toggleLoopRecording();
});

document.getElementById('clearLayersBtn').addEventListener('click', () => {
    if (confirm('모든 루프 레이어를 삭제하시겠습니까?')) {
        clearAllLayers();
    }
});

// ========== SNS 공유 기능 ==========

// MediaRecorder 변수
let mediaRecorder = null;
let audioChunks = [];
let isRecordingAudio = false;
let audioStream = null;

// 오디오 녹음 시작
async function startAudioRecording() {
    try {
        // 전역 destination의 스트림 사용
        audioStream = globalDestination.stream;

        // 지원되는 MIME 타입 찾기
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }

        mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
        });

        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            downloadAudio(audioBlob, mimeType);
        };

        mediaRecorder.start();
        isRecordingAudio = true;

        showShareStatus('🎙️ 오디오 녹음 시작! 음악을 연주하세요...', 'info');
        document.getElementById('downloadAudioBtn').innerHTML = '⏹<br>녹음<br>중지';
        document.getElementById('downloadAudioBtn').classList.add('active');

    } catch (error) {
        console.error('오디오 녹음 시작 실패:', error);
        showShareStatus('❌ 오디오 녹음을 시작할 수 없습니다.', 'error');
    }
}

// 오디오 녹음 중지
function stopAudioRecording() {
    if (mediaRecorder && isRecordingAudio) {
        mediaRecorder.stop();
        isRecordingAudio = false;
        document.getElementById('downloadAudioBtn').innerHTML = '🎵<br>오디오<br>다운로드';
        document.getElementById('downloadAudioBtn').classList.remove('active');
        showShareStatus('✅ 오디오가 다운로드됩니다!', 'success');
    }
}

// 오디오 다운로드
function downloadAudio(blob, mimeType) {
    // MIME 타입에 따라 확장자 결정
    let extension = 'webm';
    if (mimeType.includes('ogg')) {
        extension = 'ogg';
    } else if (mimeType.includes('mp4')) {
        extension = 'm4a';
    } else if (mimeType.includes('webm')) {
        extension = 'webm';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edm-beep-maker-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 악보 이미지 캡처
async function captureSheetMusic() {
    try {
        showShareStatus('📸 악보를 캡처하는 중...', 'info');

        const sheetSection = document.querySelector('.sheet-music-section');

        // html2canvas 라이브러리 사용 (CDN에서 동적 로드)
        if (typeof html2canvas === 'undefined') {
            await loadHtml2Canvas();
        }

        const canvas = await html2canvas(sheetSection, {
            backgroundColor: '#ffffff',
            scale: 2
        });

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edm-sheet-music-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showShareStatus('✅ 악보 이미지가 다운로드되었습니다!', 'success');
        });

    } catch (error) {
        console.error('악보 캡처 실패:', error);
        showShareStatus('❌ 악보를 캡처할 수 없습니다.', 'error');
    }
}

// html2canvas 라이브러리 동적 로드
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Web Share API로 공유
async function shareContent() {
    try {
        if (!navigator.share) {
            showShareStatus('❌ 이 브라우저는 공유 기능을 지원하지 않습니다.', 'error');
            return;
        }

        const shareData = {
            title: '🎵 EDM Beep Maker',
            text: '나만의 EDM 비트를 만들어봤어요! 여러분도 한번 만들어보세요!',
            url: window.location.href
        };

        await navigator.share(shareData);
        showShareStatus('✅ 공유되었습니다!', 'success');

    } catch (error) {
        if (error.name === 'AbortError') {
            showShareStatus('공유가 취소되었습니다.', 'info');
        } else {
            console.error('공유 실패:', error);
            // 대체 방법: 클립보드에 URL 복사
            fallbackShare();
        }
    }
}

// 공유 대체 방법 (클립보드 복사)
async function fallbackShare() {
    try {
        await navigator.clipboard.writeText(window.location.href);
        showShareStatus('✅ 링크가 클립보드에 복사되었습니다!', 'success');
    } catch (error) {
        showShareStatus('❌ 공유에 실패했습니다.', 'error');
    }
}

// 공유 상태 메시지 표시
function showShareStatus(message, type) {
    const statusDiv = document.getElementById('shareStatus');
    statusDiv.textContent = message;
    statusDiv.className = `share-status ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// 공유 버튼 이벤트 리스너
document.getElementById('downloadAudioBtn').addEventListener('click', () => {
    if (isRecordingAudio) {
        stopAudioRecording();
    } else {
        startAudioRecording();
    }
});

document.getElementById('captureSheetBtn').addEventListener('click', () => {
    captureSheetMusic();
});

document.getElementById('shareBtn').addEventListener('click', () => {
    shareContent();
});

// 시작 메시지
window.addEventListener('load', () => {
    setTimeout(() => {
        alert('🎵 EDM Beep Maker에 오신 것을 환영합니다!\n\n✨ 새로운 기능:\n- 키를 꾹 누르고 있으면 음이 계속 나옵니다!\n- 루프 녹음으로 Ed Sheeran처럼 레이어를 쌓아보세요!\n- SNS 공유 기능: 음악을 녹음하고 공유하세요!\n\n사용법:\n1. 키보드로 연주하기: Q W E R A S D F\n2. 루프 녹음: 4초 동안 녹음되며 자동으로 반복됩니다\n3. 여러 레이어를 쌓아서 풍부한 사운드를 만드세요!\n4. 오디오 다운로드로 작품을 저장하고 공유하세요!');
    }, 500);
});
