import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm'
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const VIDEO_FRAME_SAMPLES = 12
const detectorPromises = new Map()

function getDetector(runningMode) {
  if (!detectorPromises.has(runningMode)) {
    const detectorPromise = FilesetResolver.forVisionTasks(WASM_URL)
      .then((fileset) => FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL },
        runningMode,
        minDetectionConfidence: 0.55,
      }))
      .catch((error) => {
        detectorPromises.delete(runningMode)
        throw error
      })
    detectorPromises.set(runningMode, detectorPromise)
  }

  return detectorPromises.get(runningMode)
}

function waitForMediaEvent(media, eventName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      media.removeEventListener(eventName, handleSuccess)
      media.removeEventListener('error', handleError)
    }
    const handleSuccess = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('The selected media could not be decoded by this browser.'))
    }

    media.addEventListener(eventName, handleSuccess, { once: true })
    media.addEventListener('error', handleError, { once: true })
  })
}

async function containsFaceInImage(file) {
  const detector = await getDetector('IMAGE')
  const bitmap = await createImageBitmap(file)

  try {
    return detector.detect(bitmap).detections.length > 0
  } finally {
    bitmap.close()
  }
}

async function containsFaceInVideo(file) {
  const detector = await getDetector('VIDEO')
  const video = document.createElement('video')
  const objectUrl = URL.createObjectURL(file)
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl

  try {
    if (video.readyState < 1) {
      await waitForMediaEvent(video, 'loadedmetadata')
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('The video duration could not be read.')
    }

    if (video.readyState < 2) {
      await waitForMediaEvent(video, 'loadeddata')
    }

    for (let sample = 1; sample <= VIDEO_FRAME_SAMPLES; sample += 1) {
      const time = Math.min(video.duration - 0.05, (video.duration * sample) / (VIDEO_FRAME_SAMPLES + 1))
      const sampleTime = Math.max(0, time)
      if (Math.abs(video.currentTime - sampleTime) > 0.001) {
        const seeked = waitForMediaEvent(video, 'seeked')
        video.currentTime = sampleTime
        await seeked
      }

      const timestamp = Math.round(video.currentTime * 1000)
      if (detector.detectForVideo(video, timestamp).detections.length > 0) {
        return true
      }
    }

    return false
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

export async function validateHumanFaceMedia(file) {
  if (!file) {
    throw new Error('Choose an image or video to check.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
  const videoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp']
  const videoExtensions = ['mp4', 'mov', 'avi']
  const isImage = imageTypes.includes(file.type) || imageExtensions.includes(extension)
  const isVideo = videoTypes.includes(file.type) || videoExtensions.includes(extension)

  if (!isImage && !isVideo) {
    throw new Error('Unsupported file type. Choose JPG, PNG, WEBP, MP4, MOV, or AVI media.')
  }

  try {
    const containsFace = isImage
      ? await containsFaceInImage(file)
      : await containsFaceInVideo(file)

    if (!containsFace) {
      throw new Error('No human face was detected. DeepShield only accepts images and videos with at least one detectable human face.')
    }

    return { containsFace: true, mediaType: isImage ? 'image' : 'video' }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No human face was detected')) {
      throw error
    }

    throw new Error(`Face detection could not complete. Check your internet connection and try again. ${error instanceof Error ? error.message : ''}`.trim())
  }
}

export async function validateHumanFaceImage(file) {
  const extension = file?.name.split('.').pop()?.toLowerCase()
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)
    || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)

  if (!isImage) {
    throw new Error('Choose an image file (JPG, PNG, or WEBP) for this comparison slot.')
  }

  return validateHumanFaceMedia(file)
}
