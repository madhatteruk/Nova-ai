'use strict';

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let timerInterval = null;
let elapsedSeconds = 0;
let totalBytes = 0;
let selectedSource = 'screen';
let isRecording = false;

const recordBtn = document.getElementById('recordBtn');
const statusArea = document.getElementById('statusArea');
const recTimer = document.getElementById('recTimer');
const recSize = document.getElementById('recSize');
const recordingsList = document.getElementById('recordingsList');

// Load saved recordings from storage
let recordings = [];
chrome.storage.local.get(['recordings'], (d) => {
  recordings = d.recordings || [];
  renderRecordings();
});

function selectSource(el, source) {
  document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedSource = source;
}

async function startRecording() {
  try {
    const audio = document.getElementById('audioToggle').checked;
    const mic = document.getElementById('micToggle').checked;
    const quality = document.getElementById('qualitySelect').value;

    const height = parseInt(quality);
    const constraints = {
      video: {
        height: { ideal: height },
        frameRate: { ideal: 30 }
      },
      audio: audio
    };

    let stream;
    if (selectedSource === 'cam') {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { height: { ideal: height }, facingMode: 'user' },
        audio: mic
      });
    } else {
      const displayConstraints = {
        video: { height: { ideal: height }, frameRate: { ideal: 30 } },
        audio: audio
      };
      stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
    }

    // Add microphone track if requested
    if (mic && selectedSource !== 'cam') {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch (e) {
        console.warn('Mic access denied:', e);
      }
    }

    recordingStream = stream;
    recordedChunks = [];
    totalBytes = 0;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
        totalBytes += e.data.size;
        recSize.textContent = `${(totalBytes / 1024 / 1024).toFixed(1)} MB recorded`;
      }
    };

    mediaRecorder.onstop = () => {
      saveRecording();
    };

    // Stop recording if user stops sharing
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (isRecording) stopRecording();
    });

    mediaRecorder.start(1000); // chunk every second
    isRecording = true;
    elapsedSeconds = 0;

    // Update UI
    recordBtn.className = 'record-btn stop';
    recordBtn.innerHTML = '<span class="stop-square"></span> Stop Recording';
    statusArea.classList.add('visible');

    timerInterval = setInterval(() => {
      elapsedSeconds++;
      const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
      const s = (elapsedSeconds % 60).toString().padStart(2, '0');
      recTimer.textContent = `${m}:${s}`;
    }, 1000);

  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      alert(`Recording failed: ${err.message}`);
    }
  }
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  clearInterval(timerInterval);

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (recordingStream) {
    recordingStream.getTracks().forEach(t => t.stop());
    recordingStream = null;
  }

  recordBtn.className = 'record-btn start';
  recordBtn.innerHTML = '<span class="record-dot"></span> Start Recording';
  statusArea.classList.remove('visible');
}

function saveRecording() {
  if (recordedChunks.length === 0) return;
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const size = (blob.size / 1024 / 1024).toFixed(1);
  const duration = formatTime(elapsedSeconds);
  const name = `Recording_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  // Save metadata (not the blob — too large for storage)
  const meta = { name, size, duration, url, timestamp: Date.now() };
  recordings.unshift(meta);
  if (recordings.length > 10) recordings = recordings.slice(0, 10);

  renderRecordings();

  // Auto-download
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.webm`;
  a.click();
}

function renderRecordings() {
  if (recordings.length === 0) {
    recordingsList.innerHTML = '<div class="no-recordings">No recordings yet. Start recording!</div>';
    return;
  }
  recordingsList.innerHTML = '';
  recordings.forEach((rec, i) => {
    const item = document.createElement('div');
    item.className = 'recording-item';
    const date = new Date(rec.timestamp).toLocaleDateString();
    item.innerHTML = `
      <div class="recording-icon">🎬</div>
      <div class="recording-info">
        <div class="recording-name">${escapeHtml(rec.name)}</div>
        <div class="recording-meta">${rec.duration} · ${rec.size} MB · ${date}</div>
      </div>
      ${rec.url ? `<button class="download-btn" data-i="${i}">⬇ Download</button>` : ''}
      <button class="del-btn" data-i="${i}" title="Delete">✕</button>
    `;
    if (rec.url) {
      item.querySelector('.download-btn').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = rec.url;
        a.download = `${rec.name}.webm`;
        a.click();
      });
    }
    item.querySelector('.del-btn').addEventListener('click', () => {
      if (rec.url) URL.revokeObjectURL(rec.url);
      recordings.splice(i, 1);
      renderRecordings();
    });
    recordingsList.appendChild(item);
  });
}

recordBtn.addEventListener('click', () => {
  if (isRecording) stopRecording();
  else startRecording();
});

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
