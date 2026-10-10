export function computeDifferenceSummary(referencePixels, suspectPixels, width, height) {
  let changedPixels = 0
  let totalDiff = 0
  let centralDiff = 0
  let edgeDiff = 0
  const gridSize = 8
  const blockDiffs = Array.from({ length: gridSize * gridSize }, () => ({ diff: 0, reference: 0, suspect: 0, count: 0 }))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const referenceRed = referencePixels[index]
      const referenceGreen = referencePixels[index + 1]
      const referenceBlue = referencePixels[index + 2]
      const suspectRed = suspectPixels[index]
      const suspectGreen = suspectPixels[index + 1]
      const suspectBlue = suspectPixels[index + 2]

      const redDelta = Math.abs(referenceRed - suspectRed)
      const greenDelta = Math.abs(referenceGreen - suspectGreen)
      const blueDelta = Math.abs(referenceBlue - suspectBlue)
      const colorDelta = redDelta + greenDelta + blueDelta
      const referenceLuminance = 0.299 * referenceRed + 0.587 * referenceGreen + 0.114 * referenceBlue
      const suspectLuminance = 0.299 * suspectRed + 0.587 * suspectGreen + 0.114 * suspectBlue

      totalDiff += colorDelta

      const blockX = Math.min(gridSize - 1, Math.floor((x / width) * gridSize))
      const blockY = Math.min(gridSize - 1, Math.floor((y / height) * gridSize))
      const block = blockDiffs[blockY * gridSize + blockX]
      block.diff += colorDelta / 3
      block.reference += referenceLuminance
      block.suspect += suspectLuminance
      block.count += 1

      if (colorDelta > 90) {
        changedPixels += 1
      }

      const isCentralRegion = x > width * 0.25 && x < width * 0.75 && y > height * 0.2 && y < height * 0.8
      const isEdgeRegion = x < width * 0.15 || x > width * 0.85 || y < height * 0.15 || y > height * 0.85

      if (isCentralRegion) {
        centralDiff += colorDelta
      }

      if (isEdgeRegion) {
        edgeDiff += colorDelta
      }
    }
  }

  const totalPixels = width * height
  const differencePercent = (changedPixels / totalPixels) * 100
  const averageDelta = totalDiff / totalPixels
  const sceneMismatchPercent = (blockDiffs.filter((block) => block.count > 0 && block.diff / block.count > 55).length / (gridSize * gridSize)) * 100
  const validBlocks = blockDiffs.filter((block) => block.count > 0)
  const referenceBlocks = validBlocks.map((block) => block.reference / block.count)
  const suspectBlocks = validBlocks.map((block) => block.suspect / block.count)
  const referenceMean = referenceBlocks.reduce((sum, value) => sum + value, 0) / referenceBlocks.length
  const suspectMean = suspectBlocks.reduce((sum, value) => sum + value, 0) / suspectBlocks.length
  const covariance = referenceBlocks.reduce((sum, value, index) => sum + (value - referenceMean) * (suspectBlocks[index] - suspectMean), 0)
  const referenceVariance = referenceBlocks.reduce((sum, value) => sum + (value - referenceMean) ** 2, 0)
  const suspectVariance = suspectBlocks.reduce((sum, value) => sum + (value - suspectMean) ** 2, 0)
  const sceneCorrelation = referenceVariance > 0.01 && suspectVariance > 0.01
    ? covariance / Math.sqrt(referenceVariance * suspectVariance)
    : null
  const comparable = sceneMismatchPercent < 50 && (sceneCorrelation === null || sceneCorrelation >= 0.2)
  const region = centralDiff > edgeDiff * 1.12 ? 'central image region' : 'wide-frame and edge areas'
  const riskScore = Math.min(97, Math.round(18 + differencePercent * 2.2 + averageDelta * 0.9 + (centralDiff > edgeDiff ? 12 : 0)))
  const riskLevel = !comparable ? 'INCONCLUSIVE' : riskScore >= 80 ? 'HIGH' : riskScore >= 58 ? 'MEDIUM' : 'LOW'
  const likelihood = riskLevel === 'HIGH'
    ? 'Strong visual difference signal; manipulation requires verification'
    : riskLevel === 'MEDIUM'
      ? 'Moderate visual difference signal; review recommended'
      : riskLevel === 'LOW'
        ? 'Low visual difference signal'
        : 'Images do not appear to show the same underlying scene'

  return {
    differencePercent,
    averageDelta,
    sceneMismatchPercent,
    sceneCorrelation,
    comparable,
    region,
    riskScore,
    riskLevel,
    likelihood,
    changedPixels,
    totalPixels,
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read the selected image file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('One of the files could not be decoded as an image.'))
    image.src = src
  })
}

export async function analyzeImageDifference(referenceFile, suspectFile) {
  if (!referenceFile || !suspectFile) {
    throw new Error('Both the original and suspect images are required for comparison.')
  }

  const referenceUrl = await readFileAsDataUrl(referenceFile)
  const suspectUrl = await readFileAsDataUrl(suspectFile)

  const [referenceImage, suspectImage] = await Promise.all([
    loadImage(referenceUrl),
    loadImage(suspectUrl),
  ])

  const maxDimension = 320
  const referenceScale = Math.min(1, maxDimension / Math.max(referenceImage.naturalWidth, referenceImage.naturalHeight))
  const suspectScale = Math.min(1, maxDimension / Math.max(suspectImage.naturalWidth, suspectImage.naturalHeight))

  const referenceWidth = Math.max(1, Math.round(referenceImage.naturalWidth * referenceScale))
  const referenceHeight = Math.max(1, Math.round(referenceImage.naturalHeight * referenceScale))
  const suspectWidth = Math.max(1, Math.round(suspectImage.naturalWidth * suspectScale))
  const suspectHeight = Math.max(1, Math.round(suspectImage.naturalHeight * suspectScale))

  const referenceCanvas = document.createElement('canvas')
  referenceCanvas.width = referenceWidth
  referenceCanvas.height = referenceHeight
  const referenceContext = referenceCanvas.getContext('2d')
  referenceContext.drawImage(referenceImage, 0, 0, referenceWidth, referenceHeight)
  const referencePixels = referenceContext.getImageData(0, 0, referenceWidth, referenceHeight).data

  const suspectCanvas = document.createElement('canvas')
  suspectCanvas.width = suspectWidth
  suspectCanvas.height = suspectHeight
  const suspectContext = suspectCanvas.getContext('2d')
  suspectContext.drawImage(suspectImage, 0, 0, suspectWidth, suspectHeight)
  const suspectPixels = suspectContext.getImageData(0, 0, suspectWidth, suspectHeight).data

  const targetWidth = Math.max(referenceWidth, suspectWidth)
  const targetHeight = Math.max(referenceHeight, suspectHeight)

  const referenceScaled = new Uint8ClampedArray(targetWidth * targetHeight * 4)
  const suspectScaled = new Uint8ClampedArray(targetWidth * targetHeight * 4)

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const referenceIndex = ((Math.min(y, referenceHeight - 1) * referenceWidth) + Math.min(x, referenceWidth - 1)) * 4
      const suspectIndex = ((Math.min(y, suspectHeight - 1) * suspectWidth) + Math.min(x, suspectWidth - 1)) * 4
      const targetIndex = (y * targetWidth + x) * 4

      referenceScaled[targetIndex] = referencePixels[referenceIndex]
      referenceScaled[targetIndex + 1] = referencePixels[referenceIndex + 1]
      referenceScaled[targetIndex + 2] = referencePixels[referenceIndex + 2]
      referenceScaled[targetIndex + 3] = 255

      suspectScaled[targetIndex] = suspectPixels[suspectIndex]
      suspectScaled[targetIndex + 1] = suspectPixels[suspectIndex + 1]
      suspectScaled[targetIndex + 2] = suspectPixels[suspectIndex + 2]
      suspectScaled[targetIndex + 3] = 255
    }
  }

  return computeDifferenceSummary(referenceScaled, suspectScaled, targetWidth, targetHeight)
}

export function buildImageComparisonReport(diffData) {
  const differencePercent = Number(diffData.differencePercent || 0)
  const confidence = 0
  const riskLevel = 'INCONCLUSIVE'
  const changeSummary = !diffData.comparable
    ? 'These images differ broadly across most of the frame, so this comparison cannot reliably separate scene changes from edits. Use a reference showing the same scene and framing.'
    : 'The images show measurable visual differences, but this pixel comparison is not a trained morph/deepfake detector and cannot determine whether the changes are synthetic.'

  const explanation = !diffData.comparable
    ? [
      'The images differ across most of their 8 × 8 comparison regions, indicating they likely show different content or scenes.',
      `Coarse spatial structure ${diffData.sceneCorrelation === null ? 'could not be matched' : `correlation was ${diffData.sceneCorrelation.toFixed(2)}`}; pixel differences cannot be attributed to manipulation without a reliable scene match.`,
      'No deepfake or edit verdict is made. Select the original of this same image, with similar crop and orientation.',
    ]
    : [
      `The comparison found ${differencePercent.toFixed(1)}% of pixels with a large color difference from the reference.`,
      `The strongest mismatch is concentrated in the ${diffData.region}.`,
      'Pixel differences cannot establish whether changes came from a deepfake, ordinary editing, lighting, or image processing.',
    ]

  const breakdown = [
    `Pixels with large color differences: ${differencePercent.toFixed(1)}%.`,
    `Comparison coverage: ${diffData.sceneMismatchPercent.toFixed(1)}% of image regions show broad mismatch.`,
    diffData.comparable
      ? `Spatial structure match: ${diffData.sceneCorrelation === null ? 'insufficient texture to score' : diffData.sceneCorrelation.toFixed(2)}; most changed area: ${diffData.region}.`
      : 'Scene match: not established; manipulation scoring was withheld.',
  ]

  return {
    hash: `${Math.round(differencePercent * 1000)}-${diffData.region.replace(/\s+/g, '-').toLowerCase()}`,
    differencePercent,
    confidence,
    riskLevel,
    riskScore: diffData.riskScore,
    summary: `Original and suspect media differ by ${differencePercent.toFixed(1)}%`,
    region: diffData.region,
    likelihood: 'No trained morph/deepfake verdict available',
    changeSummary,
    explanation,
    breakdown,
    response: 'Keep the media blocked from publication until a validated detector or authorized human review clears it.',
    publicationDecision: {
      status: 'BLOCKED',
      allowed: false,
      reason: 'A visual-difference heuristic cannot clear media for publication.',
    },
  }
}
