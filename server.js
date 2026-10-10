import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'degraded',
    service: 'DeepShield analysis API',
    detector: 'not-configured',
    timestamp: new Date().toISOString(),
  })
})

app.post('/api/analyze', (req, res) => {
  const body = req.body || {}
  const fileName = String(body.fileName || 'unknown-media')
  const mimeType = String(body.mimeType || 'application/octet-stream')
  const caseId = `DS-${Math.floor(1000 + Math.random() * 9000)}`
  const isVideo = mimeType.includes('video/')
  const mediaKind = isVideo ? 'video' : 'image'
  const reason = 'No validated morph/deepfake detection model is connected. The media cannot be cleared for publication.'
  const response = 'Keep the media blocked from publication until a validated detector or an authorized human review clears it.'

  const result = {
    caseId,
    riskLevel: 'INCONCLUSIVE',
    riskScore: null,
    confidence: 0,
    analysisStatus: 'DETECTOR_UNAVAILABLE',
    summary: 'No deepfake or morph verdict was produced',
    explanation: [
      `The selected ${mediaKind} was not classified by a trained morph/deepfake detector.`,
      'File metadata and pixel differences are not sufficient to decide whether content is morphed or deepfaked.',
      reason,
    ],
    fingerprint: null,
    trace: {
      origin: `${mediaKind} upload`,
      path: 'upload → detector unavailable → publication blocked',
    },
    response,
    publicationDecision: {
      status: 'BLOCKED',
      allowed: false,
      reason,
    },
    workflow: [
      { name: 'Receive', detail: `${fileName} was received for review.`, status: 'complete' },
      { name: 'Detect', detail: 'No validated morph/deepfake model is configured.', status: 'blocked' },
      { name: 'Decide', detail: 'Unknown detector results are not treated as safe.', status: 'blocked' },
      { name: 'Respond', detail: response, status: 'active' },
    ],
    evidence: {
      source: 'Analysis unavailable',
      hash: null,
      chain: 'upload → detector unavailable → publication blocked',
      location: 'not stored by this demo API',
    },
  }

  res.json(result)
})

app.post('/api/publish', (req, res) => {
  res.status(403).json({
    code: 'PUBLICATION_BLOCKED',
    publicationDecision: {
      status: 'BLOCKED',
      allowed: false,
      reason: 'Publication is disabled until a validated morph/deepfake detector and server-verified review workflow are configured.',
    },
  })
})

app.listen(port, () => {
  console.log(`DeepShield API listening on http://localhost:${port}`)
})
