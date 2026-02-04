// Web Audio API 초기화
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let bgmPlaying = false;
let recording = false;
let recordedNotes = [];
let recordStartTime = 0;
let noteIdCounter = 0;

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

// Alan Walker 스타일 신디사이저 비프음 재생
function playBeep(frequency, key) {
    const now = audioContext.currentTime;
    const duration = 0.6;

    // 마스터 게인 (전체 볼륨 조절)
    const masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);

    // === 레이어 1: 메인 Saw Wave (풍부한 하모닉스) ===
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    const filter1 = audioContext.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(frequency, now);

    // 디튠으로 풍부함 추가
    osc1.detune.setValueAtTime(5, now);

    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(300, now);
    filter1.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
    filter1.frequency.exponentialRampToValueAtTime(800, now + duration);
    filter1.Q.setValueAtTime(8, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(masterGain);

    // === 레이어 2: 두 번째 Saw Wave (약간 디튠) ===
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    const filter2 = audioContext.createBiquadFilter();

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(frequency, now);
    osc2.detune.setValueAtTime(-5, now); // 반대 방향 디튠

    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(300, now);
    filter2.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
    filter2.frequency.exponentialRampToValueAtTime(800, now + duration);
    filter2.Q.setValueAtTime(8, now);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.08, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(masterGain);

    // === 레이어 3: Square Wave (하모닉 풍부함) ===
    const osc3 = audioContext.createOscillator();
    const gain3 = audioContext.createGain();
    const filter3 = audioContext.createBiquadFilter();

    osc3.type = 'square';
    osc3.frequency.setValueAtTime(frequency * 2, now); // 1옥타브 위

    filter3.type = 'bandpass';
    filter3.frequency.setValueAtTime(2000, now);
    filter3.Q.setValueAtTime(2, now);

    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain3.gain.exponentialRampToValueAtTime(0.04, now + 0.1);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc3.connect(filter3);
    filter3.connect(gain3);
    gain3.connect(masterGain);

    // === 레이어 4: Sub Bass (깊이 추가) ===
    const oscSub = audioContext.createOscillator();
    const gainSub = audioContext.createGain();

    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(frequency * 0.5, now); // 1옥타브 아래

    gainSub.gain.setValueAtTime(0, now);
    gainSub.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainSub.gain.exponentialRampToValueAtTime(0.1, now + 0.15);
    gainSub.gain.exponentialRampToValueAtTime(0.001, now + duration);

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

    delay.delayTime.setValueAtTime(0.125, now); // 1/8 박자 딜레이
    delayGain.gain.setValueAtTime(0.3, now);
    delayFeedback.gain.setValueAtTime(0.4, now);

    // 딜레이 라우팅
    masterGain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(audioContext.destination);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);

    // 모든 오실레이터 시작/종료
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    oscSub.start(now);
    noiseSource.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
    oscSub.stop(now + duration);

    // 시각 효과
    createVisualEffect(key);

    // 악보에 음표 추가
    addNoteToStaff(key);
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

    // 음표 위치 설정
    const topPosition = staffPositions[key];
    const leftPosition = notesContainer.children.length * 50; // 50px 간격

    note.style.top = `${topPosition}px`;
    note.style.left = `${leftPosition}px`;
    note.style.background = keyColors[key];

    // 음표 이름 툴팁
    note.title = noteNames[key];

    notesContainer.appendChild(note);

    // 활성화 애니메이션
    setTimeout(() => note.classList.add('active'), 10);
    setTimeout(() => note.classList.remove('active'), 300);

    // 악보가 가득 차면 스크롤
    notesContainer.scrollLeft = notesContainer.scrollWidth;

    // 최대 50개 음표만 유지
    if (notesContainer.children.length > 50) {
        notesContainer.removeChild(notesContainer.firstChild);
    }
}

// 악보 초기화
function clearStaff() {
    const notesContainer = document.querySelector('.notes-container');
    notesContainer.innerHTML = '';
    noteIdCounter = 0;
}

// 배경음악 (드럼 + 베이스)
let bgmIntervals = [];
function startBackgroundMusic() {
    if (bgmPlaying) return;
    bgmPlaying = true;
    document.getElementById('bgmBtn').classList.add('active');

    // 킥 드럼 (4/4 비트)
    const kickInterval = setInterval(() => {
        playKick();
    }, 500);

    // 하이햇
    const hihatInterval = setInterval(() => {
        playHihat();
    }, 250);

    // 베이스 라인
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

// 킥 드럼 사운드
function playKick() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// 하이햇 사운드
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
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 0.1);
}

// 베이스 라인
let bassIndex = 0;
function playBass(pattern) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(pattern[bassIndex % pattern.length], audioContext.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);

    bassIndex++;
}

// 키보드 이벤트
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
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key]) {
        keyMap[key].classList.remove('active');
    }
});

function activateKey(key) {
    if (keyMap[key]) {
        keyMap[key].classList.add('active');
        setTimeout(() => {
            keyMap[key].classList.remove('active');
        }, 200);
    }
}

// 컨트롤 버튼
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
            playBeep(noteFrequencies[note.key], note.key);
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

// 시작 메시지
window.addEventListener('load', () => {
    setTimeout(() => {
        alert('🎵 EDM Beep Maker에 오신 것을 환영합니다!\n\n키보드의 Q W E R A S D F 키를 눌러보세요.\n배경음악을 켜고 녹음도 해보세요!\n\n악보에서 실시간으로 음표가 표시됩니다!');
    }, 500);
});
