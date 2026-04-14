const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

const photoInput = document.querySelector("#photoInput");
const previewContainer = document.querySelector("#previewContainer");
const previewImage = document.querySelector("#previewImage");
const verifyButton = document.querySelector("#verifyButton");
const verificationModal = document.querySelector("#verificationModal");
const closeModal = document.querySelector("#closeModal");
const captureButton = document.querySelector("#captureButton");
const webcamVideo = document.querySelector("#webcamVideo");
const capturedPhoto = document.querySelector("#capturedPhoto");
const cameraRing = document.querySelector("#cameraRing");
const modalStatus = document.querySelector("#modalStatus");
const statusRing = document.querySelector("#statusRing");
const statusAvatar = document.querySelector("#statusAvatar");
const statusText = document.querySelector("#statusText");
const resultToast = document.querySelector("#resultToast");
const toastIcon = document.querySelector("#toastIcon");
const toastTitle = document.querySelector("#toastTitle");
const toastMessage = document.querySelector("#toastMessage");
const retryButton = document.querySelector("#retryButton");
const closeToast = document.querySelector("#closeToast");
const captureCanvas = document.querySelector("#captureCanvas");

let currentStream = null;
let isModelsLoaded = false;
let isVerifying = false;
let lastCaptureData = null;

async function loadModels() {
  try {
    updateModalStatus("Loading face recognition models...");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    isModelsLoaded = true;
    setInfoText("Upload a photo to start verification.");
    verifyButton.disabled = !previewImage.src;
  } catch (error) {
    console.error("Face model load failed:", error);
    updateModalStatus("Unable to load face models. Check network and refresh.");
  }
}

function setInfoText(message) {
  statusText.textContent = message;
}

function updateStatusCard(icon, text, variant) {
  statusAvatar.textContent = icon;
  setInfoText(text);
  statusRing.classList.remove(
    "status-loading",
    "status-success",
    "status-fail",
  );
  statusRing.classList.add(variant);
}

function updateModalStatus(message) {
  modalStatus.textContent = message;
}

function setPreview(file) {
  const reader = new FileReader();
  reader.onload = () => {
    previewImage.src = reader.result;
    previewContainer.classList.remove("hidden");
    verifyButton.disabled = !isModelsLoaded;
    updateStatusCard(
      "👤",
      "Face image uploaded. Ready to verify.",
      "status-loading",
    );
    hideToast();
  };
  reader.readAsDataURL(file);
}

photoInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setPreview(file);
});

verifyButton.addEventListener("click", () => {
  if (!previewImage.src || !isModelsLoaded) return;
  openModal();
});

closeModal.addEventListener("click", closeVerificationModal);

function openModal() {
  verificationModal.classList.remove("hidden");
  resetModal();
  updateModalStatus("Preparing camera...");
  startWebcam();
}

function closeVerificationModal() {
  verificationModal.classList.add("hidden");
  stopWebcam();
  if (!isVerifying) {
    resetModal();
  }
}

async function startWebcam() {
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    webcamVideo.srcObject = currentStream;
    await webcamVideo.play();
    updateModalStatus("Live preview active. Capture your face to compare.");
  } catch (error) {
    console.error("Webcam error:", error);
    updateModalStatus("Webcam unavailable. Allow camera access and retry.");
  }
}

function stopWebcam() {
  if (!currentStream) return;
  currentStream.getTracks().forEach((track) => track.stop());
  currentStream = null;
  webcamVideo.srcObject = null;
}

function resetModal() {
  isVerifying = false;
  captureButton.disabled = false;
  captureButton.textContent = "Capture & Compare";
  cameraRing.classList.remove("ring-success", "ring-fail");
  cameraRing.classList.add("ring-loading");
  capturedPhoto.classList.add("hidden");
  webcamVideo.classList.remove("hidden");
  updateModalStatus("Preparing camera...");
}

function captureFrame() {
  if (!webcamVideo || !webcamVideo.videoWidth) return null;
  captureCanvas.width = webcamVideo.videoWidth;
  captureCanvas.height = webcamVideo.videoHeight;
  const context = captureCanvas.getContext("2d");
  context.drawImage(
    webcamVideo,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height,
  );
  return captureCanvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function detectFaceDescriptor(source) {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  });
  const detections = await faceapi
    .detectAllFaces(source, options)
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (detections.length === 0) {
    const error = new Error("No face detected. Try again.");
    error.code = "NO_FACE";
    throw error;
  }
  if (detections.length > 1) {
    const error = new Error("Multiple faces detected. Use a single face.");
    error.code = "MULTIPLE_FACES";
    throw error;
  }
  return detections[0].descriptor;
}

function compareDescriptors(descriptorA, descriptorB) {
  const distance = faceapi.euclideanDistance(descriptorA, descriptorB);
  return { matched: distance < 0.5, distance };
}

function showCapturedPreview(src) {
  capturedPhoto.src = src;
  capturedPhoto.classList.remove("hidden");
  webcamVideo.classList.add("hidden");
}

function showResult(success, title, message, statusIcon, statusTextValue) {
  cameraRing.classList.remove("ring-loading", "ring-success", "ring-fail");
  cameraRing.classList.add(success ? "ring-success" : "ring-fail");
  updateModalStatus(message);
  updateStatusCard(
    statusIcon,
    statusTextValue,
    success ? "status-success" : "status-fail",
  );
  showToast(success, title, message);
}

function showToast(success, title, message) {
  toastIcon.textContent = success ? "✅" : "❌";
  toastTitle.textContent = title;
  toastMessage.textContent = message;
  resultToast.classList.remove("hidden");
  retryButton.classList.toggle("hidden", success);
}

function hideToast() {
  resultToast.classList.add("hidden");
}

function handleDetectionError(error) {
  stopWebcam();
  captureButton.disabled = false;
  if (lastCaptureData) {
    showCapturedPreview(lastCaptureData);
  } else {
    webcamVideo.classList.add("hidden");
    capturedPhoto.classList.add("hidden");
  }
  if (error.code === "NO_FACE") {
    showResult(
      false,
      "Verification Failed",
      "No face detected. Try again.",
      "❌",
      "No face detected. Try again.",
    );
    return;
  }
  if (error.code === "MULTIPLE_FACES") {
    showResult(
      false,
      "Verification Failed",
      "Multiple faces detected. Use a single face.",
      "❌",
      "Multiple faces detected. Use a single face.",
    );
    return;
  }
  console.error(error);
  showResult(
    false,
    "Verification Failed",
    "An error occurred during verification. Please retry.",
    "❌",
    "Verification failed. Please try again.",
  );
}

captureButton.addEventListener("click", async () => {
  if (isVerifying) return;
  if (!currentStream) {
    updateModalStatus("Camera not ready. Please retry.");
    return;
  }

  isVerifying = true;
  captureButton.disabled = true;
  captureButton.textContent = "Scanning...";
  updateModalStatus("Capturing frame and comparing faces...");
  updateStatusCard("🔎", "Scanning... Verifying", "status-loading");

  try {
    await previewImage.decode();
    const uploadedDescriptor = await detectFaceDescriptor(previewImage);
    const captureData = captureFrame();
    lastCaptureData = captureData;
    if (!captureData) {
      throw new Error("Camera capture failed.");
    }
    stopWebcam();
    const capturedImage = await loadImage(captureData);
    const liveDescriptor = await detectFaceDescriptor(capturedImage);
    const { matched, distance } = compareDescriptors(
      uploadedDescriptor,
      liveDescriptor,
    );
    showCapturedPreview(captureData);

    if (matched) {
      showResult(
        true,
        "Verified",
        "Face verification successful.",
        "✅",
        "Face is matched",
      );
    } else {
      showResult(
        false,
        "Verification Failed",
        "Image and face do not match. Please retry.",
        "❌",
        "Image and face do not match",
      );
    }
  } catch (error) {
    handleDetectionError(error);
  } finally {
    isVerifying = false;
    captureButton.disabled = true;
    captureButton.textContent = "Capture & Compare";
  }
});

retryButton.addEventListener("click", () => {
  hideToast();
  openModal();
});

closeToast.addEventListener("click", hideToast);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVerificationModal();
    hideToast();
  }
});

loadModels();
