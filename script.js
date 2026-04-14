const photoInput = document.querySelector('#photoInput');
const previewContainer = document.querySelector('#previewContainer');
const previewImage = document.querySelector('#previewImage');
const verifyButton = document.querySelector('#verifyButton');
const verificationModal = document.querySelector('#verificationModal');
const closeModal = document.querySelector('#closeModal');
const captureButton = document.querySelector('#captureButton');
const webcamVideo = document.querySelector('#webcamVideo');
const cameraRing = document.querySelector('#cameraRing');
const modalStatus = document.querySelector('#modalStatus');
const statusAvatar = document.querySelector('#statusAvatar');
const resultToast = document.querySelector('#resultToast');
const toastIcon = document.querySelector('#toastIcon');
const toastTitle = document.querySelector('#toastTitle');
const toastMessage = document.querySelector('#toastMessage');
const retryButton = document.querySelector('#retryButton');
const closeToast = document.querySelector('#closeToast');
const captureCanvas = document.querySelector('#captureCanvas');

let currentStream = null;
let isVerifying = false;

function setPreview(file) {
  const reader = new FileReader();
  reader.onload = () => {
    previewImage.src = reader.result;
    previewContainer.classList.remove('hidden');
    verifyButton.disabled = false;
  };
  reader.readAsDataURL(file);
}

photoInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setPreview(file);
  hideToast();
});

verifyButton.addEventListener('click', () => {
  if (!previewImage.src) return;
  openModal();
});

closeModal.addEventListener('click', closeVerificationModal);

function openModal() {
  verificationModal.classList.remove('hidden');
  modalStatus.textContent = 'Preparing camera...';
  resetRing();
  startWebcam();
}

function closeVerificationModal() {
  verificationModal.classList.add('hidden');
  stopWebcam();
  if (!isVerifying) {
    resetRing();
  }
}

async function startWebcam() {
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    webcamVideo.srcObject = currentStream;
    await webcamVideo.play();
    modalStatus.textContent = 'Live preview active. Ready to verify.';
  } catch (error) {
    modalStatus.textContent = 'Webcam unavailable. Allow camera access and retry.';
    console.error(error);
  }
}

function stopWebcam() {
  if (!currentStream) return;
  currentStream.getTracks().forEach((track) => track.stop());
  currentStream = null;
  webcamVideo.srcObject = null;
}

function resetRing() {
  cameraRing.classList.remove('ring-success', 'ring-fail');
  cameraRing.classList.add('ring-loading');
}

function captureFrame() {
  if (!webcamVideo || !webcamVideo.videoWidth) return null;
  captureCanvas.width = webcamVideo.videoWidth;
  captureCanvas.height = webcamVideo.videoHeight;
  const context = captureCanvas.getContext('2d');
  context.drawImage(webcamVideo, 0, 0, captureCanvas.width, captureCanvas.height);
  return captureCanvas.toDataURL('image/png');
}

function playTone(frequency, duration = 230) {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.value = 0.12;
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration / 1000);
  oscillator.onended = () => audioCtx.close();
}

captureButton.addEventListener('click', async () => {
  if (isVerifying) return;
  if (!currentStream) {
    modalStatus.textContent = 'Camera not ready. Please retry.';
    return;
  }

  isVerifying = true;
  modalStatus.textContent = 'Verifying face...';
  cameraRing.classList.add('ring-loading');
  cameraRing.classList.remove('ring-success', 'ring-fail');

  const uploadedSrc = previewImage.src;
  const liveSrc = captureFrame();
  console.log('Mock compare:', { uploadedSrc, liveSrc });

  await new Promise((resolve) => setTimeout(resolve, 1800));

  const matched = Math.random() > 0.4;
  if (matched) {
    verificationSuccess();
  } else {
    verificationFail();
  }
});

function verificationSuccess() {
  playTone(660, 160);
  cameraRing.classList.remove('ring-loading');
  cameraRing.classList.add('ring-success');
  modalStatus.textContent = 'Face matched successfully.';
  setTimeout(() => {
    closeVerificationModal();
    showToast(true, 'Face is matched.', 'Live face matched successfully.');
    isVerifying = false;
  }, 1000);
}

function verificationFail() {
  playTone(240, 260);
  cameraRing.classList.remove('ring-loading');
  cameraRing.classList.add('ring-fail');
  modalStatus.textContent = 'Face does not match. Please retry.';
  setTimeout(() => {
    closeVerificationModal();
    showToast(false, 'Face does not match. Retry.', 'Please try again with a clearer face view.');
    isVerifying = false;
  }, 1500);
}

function showToast(success, title, message) {
  toastIcon.textContent = success ? '✅' : '❌';
  toastTitle.textContent = title;
  toastMessage.textContent = message;
  resultToast.classList.remove('hidden');
  resultToast.style.pointerEvents = 'auto';
  if (success) {
    retryButton.classList.add('hidden');
  } else {
    retryButton.classList.remove('hidden');
  }
}

function hideToast() {
  resultToast.classList.add('hidden');
  resultToast.style.pointerEvents = 'none';
}

retryButton.addEventListener('click', () => {
  hideToast();
  openModal();
});

closeToast.addEventListener('click', hideToast);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeVerificationModal();
    hideToast();
  }
});
