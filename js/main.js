// ========== EDM Beep Maker - Main Application ==========

// EDM 네임스페이스 사용
const audioContext = EDM.audioContext;
const globalGain = EDM.globalGain;
const globalDestination = EDM.globalDestination;
const noteFrequencies = EDM.noteFrequencies;
const noteNames = EDM.noteNames;
const staffPositions = EDM.staffPositions;
const keyColors = EDM.keyColors;

let bgmPlaying = false;
let recording = false;
let recordedNotes = [];
let recordStartTime = 0;
let noteIdCounter = 0;

// Sustain 관련 변수 (synth.js와 공유)
let activeOscillators = EDM.activeOscillators;

// 루프 시스템 변수
let loopRecording = false;
let loopLayers = []; // 녹음된 루프 레이어들
let loopStartTime = 0;
let loopDuration = EDM.LOOP_DURATION; // 4초 루프
let currentLoop = [];
let loopPlaybackIntervals = [];
let activeLoopLayers = new Set(); // 현재 재생 중인 레이어

// 악보 화음 표시 관련 변수
let lastNoteTime = 0;
let currentColumn = 0;
const CHORD_THRESHOLD = EDM.CHORD_THRESHOLD; // 100ms 이내에 누른 키는 같은 열로 간주

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
                    EDM.playOneShotBeep(noteFrequencies[note.key], note.key);
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
    console.log(`레이어 ${layerId} 삭제`);

    // 재생 중지
    activeLoopLayers.delete(layerId);
    if (loopPlaybackIntervals[layerId]) {
        clearInterval(loopPlaybackIntervals[layerId]);
    }

    // 배열에서 제거 (null로 설정하여 인덱스 유지)
    if (loopLayers[layerId]) {
        loopLayers[layerId] = null;
    }

    // UI에서 제거
    const layerEl = document.getElementById(`layer-${layerId}`);
    if (layerEl) {
        layerEl.remove();
    }
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
        EDM.playBeep(noteFrequencies[key], key);
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
        setTimeout(() => EDM.stopBeep(key), 100);
    });
});

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (noteFrequencies[key] && !e.repeat) {
        EDM.playBeep(noteFrequencies[key], key);
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
        EDM.stopBeep(key);
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
            EDM.playOneShotBeep(noteFrequencies[note.key], note.key);
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

// 공유 URL 모달 표시
function shareContent() {
    console.log('공유 시작');
    console.log('현재 상태:', {
        recordedNotes: recordedNotes.length,
        loopLayers: loopLayers.filter(l => l != null).length
    });

    // 빈 데이터 체크
    if (recordedNotes.length === 0 && loopLayers.filter(l => l != null).length === 0) {
        console.warn('공유할 음악이 없습니다');
        showShareStatus('⚠️ 먼저 음악을 만들어주세요!', 'error');
        return;
    }

    const shareUrl = generateShareURL();

    if (!shareUrl) {
        console.error('공유 URL 생성 실패');
        showShareStatus('❌ 공유 URL을 생성할 수 없습니다.', 'error');
        return;
    }

    console.log('공유 URL:', shareUrl);

    // 모달에 URL 표시
    showShareModal(shareUrl);
}

// 공유 모달 표시
function showShareModal(url) {
    console.log('=== 모달 표시 시작 ===');
    console.log('URL 길이:', url.length);
    console.log('URL 앞부분:', url.substring(0, 100));

    const modal = document.getElementById('shareModal');
    const urlInput = document.getElementById('shareUrlInput');

    if (!modal) {
        console.error('모달 요소를 찾을 수 없습니다!');
        return;
    }

    if (!urlInput) {
        console.error('URL 입력창을 찾을 수 없습니다!');
        return;
    }

    urlInput.value = url;
    console.log('입력창에 설정된 값:', urlInput.value.substring(0, 100));

    modal.classList.add('show');
    console.log('모달 클래스:', modal.className);

    // URL 입력창 클릭 시 자동 선택
    urlInput.addEventListener('click', function() {
        this.select();
    });

    console.log('=== 모달 표시 완료 ===');
}

// 공유 모달 닫기
function closeShareModal() {
    const modal = document.getElementById('shareModal');
    const copyStatus = document.getElementById('copyStatus');

    modal.classList.remove('show');
    copyStatus.classList.remove('show');
}

// 공유 대체 방법 (클립보드 복사)
async function fallbackShare() {
    try {
        const shareUrl = generateShareURL();
        if (shareUrl) {
            await navigator.clipboard.writeText(shareUrl);
            showShareStatus('✅ 링크가 클립보드에 복사되었습니다!', 'success');
        } else {
            showShareStatus('❌ 공유에 실패했습니다.', 'error');
        }
    } catch (error) {
        showShareStatus('❌ 공유에 실패했습니다.', 'error');
    }
}

// 현재 상태를 URL로 변환
function generateShareURL() {
    // undefined나 null 레이어 필터링
    const validLayers = loopLayers.filter(layer => layer != null);

    console.log('공유 데이터 생성:', {
        recordedNotes: recordedNotes.length,
        loopLayers: validLayers.length
    });

    const shareData = {
        version: "1.0",
        recordedNotes: recordedNotes,
        loopLayers: validLayers.map(layer => ({
            id: layer.id,
            notes: layer.notes,
            active: layer.active
        })),
        metadata: {
            createdAt: new Date().toISOString(),
            loopDuration: loopDuration
        }
    };

    try {
        const jsonString = JSON.stringify(shareData);
        console.log('JSON 크기:', jsonString.length, 'bytes');

        const encoded = btoa(unescape(encodeURIComponent(jsonString)));
        const shareUrl = `${window.location.origin}${window.location.pathname}?music=${encoded}`;

        console.log('공유 URL 생성 성공:', shareUrl.length, '글자');
        return shareUrl;
    } catch (error) {
        console.error('URL 생성 실패:', error);
        return null;
    }
}

// URL 파라미터에서 음악 데이터 로드
function loadMusicFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('music');

    if (!encoded) {
        console.log('URL에 음악 데이터가 없습니다.');
        return false;
    }

    console.log('공유 URL에서 음악 로드 중...', 'URL 길이:', encoded.length);

    try {
        // Base64 디코딩
        const decoded = atob(encoded);
        console.log('Base64 디코딩 완료:', decoded.length, 'bytes');

        // URL 디코딩
        const jsonString = decodeURIComponent(escape(decoded));
        console.log('URL 디코딩 완료');

        // JSON 파싱
        const data = JSON.parse(jsonString);
        console.log('JSON 파싱 완료:', data);

        // 버전 체크
        if (data.version !== "1.0") {
            console.warn('지원하지 않는 버전:', data.version);
            showShareStatus('⚠️ 지원하지 않는 버전입니다.', 'error');
            return false;
        }

        // 데이터 복원
        recordedNotes = data.recordedNotes || [];
        loopLayers = data.loopLayers || [];

        console.log('데이터 복원:', {
            recordedNotes: recordedNotes.length,
            loopLayers: loopLayers.length
        });

        // 루프 레이어 UI 복원
        restoreLoopLayers();

        // 악보에 음표 표시 (시각적 미리보기)
        if (recordedNotes.length > 0) {
            console.log('악보에 음표 표시 중...');
            const notesContainer = document.querySelector('.notes-container');
            notesContainer.innerHTML = ''; // 기존 음표 초기화

            let lastTime = 0;
            let columnIndex = 0;

            recordedNotes.forEach((note, index) => {
                const timeDiff = note.time - lastTime;

                // 100ms 이상 차이나면 새로운 열
                if (timeDiff > CHORD_THRESHOLD) {
                    columnIndex++;
                }

                const noteEl = document.createElement('div');
                noteEl.className = 'note';
                noteEl.style.top = `${staffPositions[note.key]}px`;
                noteEl.style.left = `${columnIndex * 50}px`;
                noteEl.style.background = keyColors[note.key];
                noteEl.title = noteNames[note.key];

                notesContainer.appendChild(noteEl);

                lastTime = note.time;
            });

            console.log(`악보에 ${recordedNotes.length}개 음표 표시 완료`);
        }

        showShareStatus('🎵 공유된 음악을 불러왔습니다!', 'success');
        return true;
    } catch (error) {
        console.error('음악 데이터 로드 실패:', error);
        console.error('에러 스택:', error.stack);
        showShareStatus(`❌ 로드 실패: ${error.message}`, 'error');
        return false;
    }
}

// 루프 레이어 UI 복원
function restoreLoopLayers() {
    const layersContainer = document.getElementById('loopLayers');
    layersContainer.innerHTML = '';
    activeLoopLayers.clear();

    console.log('루프 레이어 복원 시작:', loopLayers.length, '개');

    loopLayers.forEach((layer, index) => {
        // undefined나 null 레이어 건너뛰기
        if (!layer || !layer.notes) {
            console.warn(`레이어 ${index} 건너뜀 (유효하지 않음)`);
            return;
        }

        console.log(`레이어 ${layer.id} 복원 중:`, layer.notes.length, '음');

        try {
            addLayerToUI(layer.id);

            // 활성 상태 복원
            if (layer.active) {
                activeLoopLayers.add(layer.id);
                startLoopPlayback(layer.id);
                console.log(`레이어 ${layer.id} 활성화 및 재생 시작`);
            } else {
                const layerEl = document.getElementById(`layer-${layer.id}`);
                if (layerEl) {
                    layerEl.classList.remove('active');
                    const toggleBtn = layerEl.querySelector('.toggle-btn');
                    if (toggleBtn) {
                        toggleBtn.textContent = 'OFF';
                    }
                }
                console.log(`레이어 ${layer.id} 비활성 상태로 복원`);
            }
        } catch (error) {
            console.error(`레이어 ${layer.id} 복원 실패:`, error);
        }
    });

    console.log('루프 레이어 복원 완료');
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

// 모달 버튼 이벤트 리스너
document.getElementById('copyUrlBtn').addEventListener('click', () => {
    const urlInput = document.getElementById('shareUrlInput');
    const copyStatus = document.getElementById('copyStatus');

    // URL 복사
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value).then(() => {
        copyStatus.textContent = '✅ URL이 클립보드에 복사되었습니다!';
        copyStatus.className = 'copy-status show success';

        setTimeout(() => {
            copyStatus.classList.remove('show');
        }, 3000);
    }).catch(err => {
        copyStatus.textContent = '❌ 복사 실패';
        copyStatus.className = 'copy-status show';
        console.error('복사 실패:', err);
    });
});

document.getElementById('openNewTabBtn').addEventListener('click', () => {
    const urlInput = document.getElementById('shareUrlInput');
    window.open(urlInput.value, '_blank');
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    closeShareModal();
});

// 모달 배경 클릭 시 닫기
document.getElementById('shareModal').addEventListener('click', (e) => {
    if (e.target.id === 'shareModal') {
        closeShareModal();
    }
});

document.getElementById('debugBtn').addEventListener('click', () => {
    const debugInfo = `
=== 🐛 디버그 정보 ===

📊 녹음 상태:
- recordedNotes: ${recordedNotes.length}개
- loopLayers: ${loopLayers.filter(l => l != null).length}개
- recording: ${recording}

📝 상세 정보:
- recordedNotes 배열: ${JSON.stringify(recordedNotes.slice(0, 3))}${recordedNotes.length > 3 ? '...' : ''}
- loopLayers 존재: ${loopLayers.map((l, i) => l ? `Layer${i}(${l.notes.length}음)` : 'null').join(', ')}

✅ 공유 가능: ${(recordedNotes.length > 0 || loopLayers.filter(l => l != null).length > 0) ? 'YES' : 'NO'}

💡 힌트:
${recordedNotes.length === 0 && loopLayers.filter(l => l != null).length === 0 ?
  '⚠️ 녹음된 데이터가 없습니다!\n- ⏺ 녹음 버튼을 눌러서 녹음하거나\n- 🔴 루프 녹음 버튼을 눌러서 루프를 만드세요' :
  '✅ 공유 가능한 데이터가 있습니다!'}
    `;

    console.log(debugInfo);
    alert(debugInfo);
});

// 시작 메시지
window.addEventListener('load', () => {
    // URL에서 음악 데이터 로드 시도
    const loaded = loadMusicFromURL();

    // 공유된 음악이 아닌 경우에만 환영 메시지 표시
    if (!loaded) {
        setTimeout(() => {
            alert('🎵 EDM Beep Maker에 오신 것을 환영합니다!\n\n✨ 새로운 기능:\n- 키를 꾹 누르고 있으면 음이 계속 나옵니다!\n- 루프 녹음으로 Ed Sheeran처럼 레이어를 쌓아보세요!\n- SNS 공유 기능: 음악을 녹음하고 공유하세요!\n- URL로 음악 공유: 링크만으로 즉시 재생!\n\n사용법:\n1. 키보드로 연주하기: Q W E R A S D F\n2. 루프 녹음: 4초 동안 녹음되며 자동으로 반복됩니다\n3. 여러 레이어를 쌓아서 풍부한 사운드를 만드세요!\n4. 오디오 다운로드로 작품을 저장하고 공유하세요!\n5. 공유하기 버튼으로 링크를 생성하고 친구들과 공유하세요!');
        }, 500);
    } else {
        // 로드된 음악이 있으면 안내 메시지만 표시
        setTimeout(() => {
            alert('🎵 공유된 EDM 비트를 불러왔습니다!\n\n▶ 재생 버튼을 눌러 녹음된 음악을 들어보세요!\n🔁 루프 레이어가 있다면 자동으로 재생됩니다.\n\n💡 팁: 직접 키보드로 연주하거나 녹음을 추가할 수도 있습니다!');
        }, 500);
    }
});

console.log('✅ EDM Main 모듈 로드 완료');
