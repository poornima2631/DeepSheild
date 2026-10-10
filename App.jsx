import { useEffect, useRef, useState } from 'react'
import './App.css'
import { analyzeImageDifference, buildImageComparisonReport } from './diffAnalysis'
import { validateHumanFaceImage, validateHumanFaceMedia } from './faceValidation'

const API_BASE_URL = 'http://localhost:3001'

const initialStats = [
  { label: 'Files Analyzed', value: '—', tone: 'neutral' },
  { label: 'Likely Authentic', value: '—', tone: 'good' },
  { label: 'Suspicious Files', value: '—', tone: 'warn' },
  { label: 'Likely Deepfakes', value: '—', tone: 'critical' },
  { label: 'High-Risk Cases', value: '—', tone: 'critical' },
]

function getDashboardStats(data) {
  const riskLevel = String(data?.riskLevel || 'MEDIUM').toUpperCase()
  const isHighRisk = riskLevel.includes('HIGH') || riskLevel === 'CRITICAL'
  const isMediumRisk = riskLevel === 'MEDIUM'
  const isLowRisk = riskLevel === 'LOW'

  return [
    { label: 'Files Analyzed', value: '1', tone: 'neutral' },
    { label: 'Likely Authentic', value: isLowRisk ? '1' : '0', tone: 'good' },
    { label: 'Suspicious Files', value: isMediumRisk ? '1' : '0', tone: 'warn' },
    { label: 'Likely Deepfakes', value: isHighRisk ? '1' : '0', tone: 'critical' },
    { label: 'High-Risk Cases', value: isHighRisk ? '1' : '0', tone: 'critical' },
  ]
}

const investigations = [
  { caseId: 'DS-1024', media: 'image.jpg', risk: 'HIGH', status: 'Reviewing' },
  { caseId: 'DS-1023', media: 'video.mp4', risk: 'CRITICAL', status: 'Escalated' },
  { caseId: 'DS-1022', media: 'image.png', risk: 'LOW', status: 'Resolved' },
  { caseId: 'DS-1021', media: 'audio.wav', risk: 'MEDIUM', status: 'New' },
]

const activity = [
  { label: 'Authentic', value: 62, color: '#3FA66B' },
  { label: 'Suspicious', value: 28, color: '#D69E2E' },
  { label: 'Deepfake', value: 17, color: '#E04455' },
  { label: 'Critical', value: 9, color: '#A1A1AA' },
]

const alerts = [
  { type: 'MEDIA MATCH', time: '08:13 UTC', message: 'Re-encoded clip matched a previously flagged source.' },
  { type: 'IDENTITY RISK', time: '07:54 UTC', message: 'Facial alignment anomaly exceeds review threshold.' },
  { type: 'SYSTEM HEALTH', time: '07:22 UTC', message: 'Inference queue recovering from transient spike.' },
]

const health = [
  { name: 'AI Detection Engine', status: 'Online', value: 92 },
  { name: 'Fingerprinting', status: 'Healthy', value: 88 },
  { name: 'Trace Correlation', status: 'Stable', value: 81 },
  { name: 'Storage Sync', status: 'Nominal', value: 96 },
]

const riskDistribution = [
  { name: 'LOW', count: 482, width: '58%' },
  { name: 'MEDIUM', count: 319, width: '39%' },
  { name: 'HIGH', count: 142, width: '21%' },
  { name: 'CRITICAL', count: 23, width: '8%' },
]

const supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi']

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analyze', label: 'Analyze Media' },
  { id: 'cases', label: 'Cases' },
  { id: 'risk', label: 'Risk Engine' },
  { id: 'forensics', label: 'Forensics' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'reports', label: 'Reports' },
  { id: 'admin', label: 'Admin Profile' },
]

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function getVerdictMeta(riskLevel = 'MEDIUM', confidence = 0) {
  const level = String(riskLevel).toUpperCase()

  if (level.includes('HIGH') || level === 'CRITICAL') {
    return {
      label: 'LIKELY MANIPULATED',
      tone: 'critical',
      summary: 'This file shows several signs of editing, synthesis, or other tampering.',
      note: 'High-confidence indicators suggest possible manipulation or a synthetic source.',
    }
  }

  if (level === 'LOW') {
    return {
      label: 'LIKELY AUTHENTIC',
      tone: 'good',
      summary: 'The file looks consistent with a typical original capture.',
      note: 'The available evidence does not show strong signs of tampering.',
    }
  }

  if (level === 'MEDIUM') {
    return {
      label: 'SUSPICIOUS',
      tone: 'warn',
      summary: 'DeepShield found signs that should be reviewed more closely.',
      note: 'The file shows mixed indicators and may need human review.',
    }
  }

  return {
    label: 'INCONCLUSIVE',
    tone: 'neutral',
    summary: 'The available evidence is not strong enough to reach a clear conclusion.',
    note: 'Insufficient or conflicting signal quality for a definitive verdict.',
  }
}

function buildHumanExplanation(explanation = []) {
  if (!Array.isArray(explanation) || explanation.length === 0) {
    return [
      'Some parts of the image show signs of editing or repeated compression.',
      'The file information contains unusual patterns that do not match a typical original capture.',
      'The combined signals suggest that this media may have been created or significantly altered. Further review is recommended.',
    ]
  }

  return explanation.map((item) => {
    const message = String(item)

    if (message.toLowerCase().includes('artifacts')) {
      return 'Some parts of the image show signs of editing or repeated compression.'
    }

    if (message.toLowerCase().includes('metadata')) {
      return 'The file information contains unusual patterns that do not match a typical original capture.'
    }

    if (message.toLowerCase().includes('synthetic') || message.toLowerCase().includes('manipulated')) {
      return 'The combined signals suggest that this media may have been created or significantly altered. Further review is recommended.'
    }

    return message
  }).slice(0, 3)
}

function App() {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [referenceFile, setReferenceFile] = useState(null)
  const [suspectFile, setSuspectFile] = useState(null)
  const [error, setError] = useState('')
  const [isValidatingMedia, setIsValidatingMedia] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(38)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [stats, setStats] = useState(initialStats)
  const [reviewStatus, setReviewStatus] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [voiceStatus, setVoiceStatus] = useState('Voice assistance is ready.')
  const [adminProfile, setAdminProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('deepshield-admin-profile')) || {
        name: 'DeepShield Administrator',
        email: 'admin@deepshield.local',
        role: 'System Administrator',
        department: 'Security Operations',
      }
    } catch {
      return { name: 'DeepShield Administrator', email: 'admin@deepshield.local', role: 'System Administrator', department: 'Security Operations' }
    }
  })
  const [reports, setReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deepshield-reports')) || [] } catch { return [] }
  })
  const [reportForm, setReportForm] = useState({ category: 'Suspicious media', title: '', description: '', contact: '' })
  const [reportMessage, setReportMessage] = useState('')
  const [reportFilter, setReportFilter] = useState('All')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (navItems.some((item) => item.id === hash)) {
      setActiveTab(hash)
    }
  }, [])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    window.history.pushState(null, '', `#${tabId}`)
  }

  const handleAnalyzeNewMedia = () => {
    setActiveTab('analyze')
    window.history.pushState(null, '', '#analyze')
    fileInputRef.current?.click()
  }

  const compareOriginalToSuspect = async () => {
    if (!referenceFile || !suspectFile) {
      setError('Upload both the original image and the suspected edited image to compare them.')
      return
    }

    setError('')
    setIsAnalyzing(true)
    setAnalysisProgress(24)

    try {
      const diff = await analyzeImageDifference(referenceFile, suspectFile)
      const comparisonReport = buildImageComparisonReport(diff)

      setAnalysisResult({
        caseId: `DS-${Math.floor(1000 + Math.random() * 9000)}`,
        riskLevel: comparisonReport.riskLevel,
        riskScore: comparisonReport.riskScore,
        confidence: comparisonReport.confidence,
        summary: comparisonReport.summary,
        explanation: comparisonReport.explanation,
        fingerprint: `sha256:${comparisonReport.hash}`,
        trace: {
          origin: 'reference image comparison',
          path: 'original capture → edited image inspection → pixel delta analysis → forensic verdict',
        },
        response: comparisonReport.response,
        publicationDecision: comparisonReport.publicationDecision,
        workflow: [
          { name: 'Detect', detail: 'Reference and suspect images were compared using pixel-level forensic analysis.', status: 'complete' },
          { name: 'Explain', detail: 'The largest mismatch appears in the facial or focal region of the suspect image.', status: 'complete' },
          { name: 'Fingerprint', detail: 'Signature mismatch confirms that the suspect image differs from the original reference.', status: 'complete' },
          { name: 'Trace', detail: 'The modified areas were isolated by brightness and edge delta comparison.', status: 'complete' },
          { name: 'Assess Risk', detail: `Difference score ${comparisonReport.differencePercent.toFixed(1)}% indicates ${comparisonReport.riskLevel.toLowerCase()} risk.`, status: 'complete' },
          { name: 'Respond', detail: comparisonReport.response, status: 'active' },
        ],
        evidence: {
          source: 'Original image versus edited image comparison',
          hash: `sha256:${comparisonReport.hash}`,
          chain: 'reference → compare → delta map → anomaly classification',
          location: 'evidence-store/forensics/reference-compare',
        },
        comparison: comparisonReport,
      })
      setStats([
        { label: 'Files Analyzed', value: '2', tone: 'neutral' },
        { label: 'Likely Authentic', value: comparisonReport.riskLevel === 'LOW' ? '1' : '0', tone: 'good' },
        { label: 'Suspicious Files', value: comparisonReport.riskLevel === 'MEDIUM' ? '1' : '0', tone: 'warn' },
        { label: 'Likely Deepfakes', value: comparisonReport.riskLevel === 'HIGH' ? '1' : '0', tone: 'critical' },
        { label: 'High-Risk Cases', value: comparisonReport.riskLevel === 'HIGH' ? '1' : '0', tone: 'critical' },
      ])
      setAnalysisProgress(100)
    } catch (requestError) {
      setError(requestError.message || 'Unable to compare the reference and suspect images.')
      setAnalysisResult(null)
      setStats(initialStats)
      setAnalysisProgress(44)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const downloadReport = () => {
    if (!analysisResult) return

    const payload = JSON.stringify({
      caseId: analysisResult.caseId,
      riskLevel: analysisResult.riskLevel,
      confidence: analysisResult.confidence,
      summary: analysisResult.summary,
      explanation: analysisResult.explanation,
      fingerprint: analysisResult.fingerprint,
      trace: analysisResult.trace,
      evidence: analysisResult.evidence,
      response: analysisResult.response,
      publicationDecision: analysisResult.publicationDecision,
    }, null, 2)

    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${analysisResult.caseId || 'deepshield-report'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSendForReview = () => {
    setReviewStatus(selectedFile ? `${selectedFile.name} has been sent for human review.` : 'This file has been sent for human review.')
  }

  const handleViewRelatedMedia = () => {
    setReviewStatus('Related media is being checked for matching source, edits, and provenance comparison.')
  }

  const handleFile = async (file) => {
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    const allowedType = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
    ]

    if (!allowedType.includes(file.type) && !supportedFormats.includes(extension)) {
      setError('Unsupported file type. Please upload JPG, PNG, WEBP, MP4, MOV, or AVI.')
      setSelectedFile(null)
      setAnalysisResult(null)
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds the 50MB limit. Please choose a smaller media file.')
      setSelectedFile(null)
      setAnalysisResult(null)
      return
    }

    setError('')
    setSelectedFile(null)
    setAnalysisResult(null)
    setStats(initialStats)
    setIsValidatingMedia(true)

    try {
      await validateHumanFaceMedia(file)
      setSelectedFile(file)
      setAnalysisProgress(44)
    } catch (validationError) {
      setAnalysisProgress(0)
      setError(validationError.message || 'This media could not be validated.')
    } finally {
      setIsValidatingMedia(false)
    }
  }

  const handleReferenceFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds the 50MB limit. Please choose a smaller image.')
      setReferenceFile(null)
      return
    }

    setReferenceFile(null)
    setAnalysisResult(null)
    setError('')
    setIsValidatingMedia(true)

    try {
      await validateHumanFaceImage(file)
      setReferenceFile(file)
    } catch (validationError) {
      setError(`Original image rejected. ${validationError.message}`)
    } finally {
      setIsValidatingMedia(false)
    }
  }

  const handleSuspectFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds the 50MB limit. Please choose a smaller image.')
      setSuspectFile(null)
      return
    }

    setSuspectFile(null)
    setAnalysisResult(null)
    setError('')
    setIsValidatingMedia(true)

    try {
      await validateHumanFaceImage(file)
      setSuspectFile(file)
    } catch (validationError) {
      setError(`Suspect image rejected. ${validationError.message}`)
    } finally {
      setIsValidatingMedia(false)
    }
  }

  const handleInputChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    handleFile(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    handleFile(file)
  }

  const analyzeMedia = async () => {
    if (!selectedFile) return

    setIsAnalyzing(true)
    setError('')
    setAnalysisProgress(52)

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          size: selectedFile.size,
          lastModified: selectedFile.lastModified,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Analysis failed')
      }

      setAnalysisResult(data)
      setStats(getDashboardStats(data))
      setAnalysisProgress(100)
    } catch (requestError) {
      setError(requestError.message || 'Unable to reach the analysis service.')
      setStats(initialStats)
      setAnalysisProgress(44)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const speak = (text) => {
    if (!('speechSynthesis' in window)) {
      setVoiceStatus('This browser does not support spoken audio. Use the on-screen navigation and analysis controls.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onstart = () => setVoiceStatus('Reading aloud.')
    utterance.onend = () => setVoiceStatus('Voice assistance is ready.')
    utterance.onerror = () => setVoiceStatus('Spoken audio could not be played. Check your device audio settings.')
    window.speechSynthesis.speak(utterance)
  }

  const readAnalysisResult = () => {
    if (!analysisResult) {
      speak('There is no analysis result to read yet. Choose media and run an analysis first.')
      return
    }

    const explanation = Array.isArray(analysisResult.explanation)
      ? analysisResult.explanation.join(' ')
      : ''
    const publication = analysisResult.publicationDecision?.allowed
      ? 'Publication is allowed.'
      : `Publication is blocked. ${analysisResult.publicationDecision?.reason || 'This result does not clear the media for publication.'}`

    speak(`${analysisResult.summary}. Result: ${analysisResult.riskLevel}. ${explanation} ${publication}`)
  }

  useEffect(() => {
    localStorage.setItem('deepshield-admin-profile', JSON.stringify(adminProfile))
  }, [adminProfile])

  useEffect(() => {
    localStorage.setItem('deepshield-reports', JSON.stringify(reports))
  }, [reports])

  const submitReport = (event) => {
    event.preventDefault()
    if (!reportForm.title.trim() || !reportForm.description.trim()) {
      setReportMessage('Please provide a title and report details.')
      return
    }
    const item = {
      id: `RPT-${Date.now().toString().slice(-8)}`,
      ...reportForm,
      title: reportForm.title.trim(),
      description: reportForm.description.trim(),
      status: 'New',
      createdAt: new Date().toISOString(),
    }
    setReports((current) => [item, ...current])
    setReportForm({ category: 'Suspicious media', title: '', description: '', contact: '' })
    setReportMessage(`Report ${item.id} submitted successfully on this browser.`)
  }

  const updateReportStatus = (reportId, status) => {
    setReports((current) => current.map((item) => item.id === reportId ? { ...item, status } : item))
  }

  const exportReports = () => {
    const columns = ['id', 'category', 'title', 'description', 'contact', 'status', 'createdAt']
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.join(','), ...reports.map((item) => columns.map((key) => quote(item[key])).join(','))].join('\\r\\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'deepshield-reports.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredReports = reportFilter === 'All' ? reports : reports.filter((item) => item.status === reportFilter)

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const previewUrl = selectedFile && selectedFile.type.startsWith('image/')
    ? URL.createObjectURL(selectedFile)
    : null

  const referencePreviewUrl = referenceFile && referenceFile.type.startsWith('image/')
    ? URL.createObjectURL(referenceFile)
    : null

  const suspectPreviewUrl = suspectFile && suspectFile.type.startsWith('image/')
    ? URL.createObjectURL(suspectFile)
    : null

  const stages = [
    { label: 'File uploaded', done: !!selectedFile },
    { label: 'File checked', done: !!selectedFile },
    { label: 'Detecting manipulation', done: !!analysisResult, active: isAnalyzing && !analysisResult },
    { label: 'Creating file fingerprint', done: !!analysisResult },
    { label: 'Assessing risk', done: !!analysisResult },
    { label: 'Preparing report', done: !!analysisResult },
  ]

  const verdict = getVerdictMeta(analysisResult?.riskLevel, analysisResult?.confidence)
  const humanExplanation = buildHumanExplanation(analysisResult?.explanation)
  const sourceStatus = analysisResult?.trace?.origin?.includes('source')
    ? 'Original source not verified'
    : analysisResult?.trace?.origin || 'Original source not verified'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">DS</div>
          <div>
            <div className="brand-name">DEEPSHIELD</div>
            <div className="brand-tag">Detect. Trace. Respond.</div>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="mini-label">System Status</div>
          <div className="status-row">
            <span className="dot success" />
            Monitoring online
          </div>
          <div className="status-row">
            <span className="dot warning" />
            3 alerts pending
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Threat Overview</p>
            <h1>DeepShield Dashboard</h1>
            <p className="header-subtitle">Analyze suspicious images and videos, understand the evidence, and manage security incidents.</p>
          </div>
          <div className="topbar-actions">
            <span className="demo-badge">Demo Mode</span>
            <button type="button" className="primary-btn" onClick={() => handleTabChange('analyze')}>Analyze Media</button>
          </div>
        </header>

        <section className="voice-assistant-bar" aria-label="Voice assistance">
          <div className="voice-actions">
            <button type="button" className="secondary-btn" onClick={readAnalysisResult}>Read Result Aloud</button>
          </div>
          <p>Hear the current assessment and publication decision aloud.</p>
          <span className="voice-status" role="status" aria-live="polite">{voiceStatus}</span>
        </section>

        {activeTab === 'dashboard' && (
          <section className="stats-grid">
            {stats.map((stat) => (
              <article key={stat.label} className={`stat-card ${stat.tone}`}>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{stat.value}</div>
              </article>
            ))}
          </section>
        )}

        {activeTab === 'analyze' && (
          <section className="upload-shell panel">
            <div className="panel-header">
              <h2>Analyze Media</h2>
              <button type="button" className="panel-button" onClick={downloadReport} disabled={!analysisResult}>Download Report</button>
            </div>

            <div
              className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.avi"
                onChange={handleInputChange}
                disabled={isValidatingMedia || isAnalyzing}
              />

              <div className="drop-graphic">⭳</div>
              <h3>Upload a face image or video</h3>
              <p>DeepShield checks images and samples 12 video frames for at least one detectable human face before accepting media.</p>
              <p className="formats-copy">Images: JPG, JPEG, PNG, WEBP<br />Videos: MP4, MOV, AVI</p>
              <button type="button" className="primary-btn inline-btn" onClick={handleAnalyzeNewMedia} disabled={isValidatingMedia || isAnalyzing}>Choose File</button>
              <p className="privacy-copy">Face detection runs in your browser. The first check downloads the detector model.</p>
              {isValidatingMedia && <p className="face-check-status" role="status">Checking for a human face...</p>}
            </div>

            <div className="compare-pair-panel">
              <div className="compare-inputs">
                <label className="file-picker">
                  <span>Original image</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleReferenceFile} disabled={isValidatingMedia || isAnalyzing} />
                </label>

                <label className="file-picker">
                  <span>Deepfake / edited image</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleSuspectFile} disabled={isValidatingMedia || isAnalyzing} />
                </label>
              </div>

              {(referenceFile || suspectFile) && (
                <div className="compare-preview-grid">
                  {referencePreviewUrl && (
                    <div className="compare-preview-card">
                      <span>Original</span>
                      <img src={referencePreviewUrl} alt="Original reference" />
                      <small>{referenceFile.name}</small>
                    </div>
                  )}

                  {suspectPreviewUrl && (
                    <div className="compare-preview-card">
                      <span>Suspect</span>
                      <img src={suspectPreviewUrl} alt="Suspect image" />
                      <small>{suspectFile.name}</small>
                    </div>
                  )}
                </div>
              )}

              <button type="button" className="primary-btn compare-btn" onClick={compareOriginalToSuspect} disabled={!referenceFile || !suspectFile || isAnalyzing || isValidatingMedia}>
                {isAnalyzing ? 'Comparing...' : 'Compare original vs suspect'}
              </button>
            </div>

            {error && <div className="upload-error">{error}</div>}

            {selectedFile && (
              <div className="analysis-preview">
                <div className="preview-panel">
                  {previewUrl ? (
                    <img src={previewUrl} alt={selectedFile.name} className="media-preview" />
                  ) : (
                    <div className="video-placeholder">VIDEO</div>
                  )}
                </div>

                <div className="analysis-meta">
                  <div className="meta-row">
                    <span className="meta-label">File name</span>
                    <strong>{selectedFile.name}</strong>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">File size</span>
                    <strong>{formatBytes(selectedFile.size)}</strong>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">File type</span>
                    <strong>{selectedFile.type || 'Unknown'}</strong>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Status</span>
                    <strong>{isAnalyzing ? 'Analyzing' : 'Ready for review'}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="selected-actions">
              <button type="button" className="primary-btn" onClick={analyzeMedia} disabled={!selectedFile || isAnalyzing || isValidatingMedia}>
                {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
              </button>
            </div>

            <div className="progress-box">
              <div className="progress-header">
                <strong>Analysis Progress</strong>
                <span>{analysisProgress}%</span>
              </div>
              <div className="progress-track">
                <span className="analysis-fill" style={{ width: `${analysisProgress}%` }} />
              </div>

              <div className="stage-list">
                {stages.map((stage) => (
                  <div key={stage.label} className={`stage-item ${stage.done ? 'done' : ''} ${stage.active ? 'active' : ''}`}>
                    <span className="stage-dot" />
                    <span>{stage.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="tab-panel feature-panel">
            <div className="feature-heading">
              <div><p className="eyebrow small">Report Center</p><h2>Submit a Report</h2><p className="panel-copy">Report suspicious media, incorrect results, or a system issue for administrator review.</p></div>
              <span className="feature-count">{reports.length} total</span>
            </div>
            <form className="feature-form" onSubmit={submitReport}>
              <label>Report category
                <select value={reportForm.category} onChange={(event) => setReportForm({ ...reportForm, category: event.target.value })}>
                  <option>Suspicious media</option><option>Incorrect analysis</option><option>Abuse or impersonation</option><option>Technical issue</option><option>Other</option>
                </select>
              </label>
              <label>Report title
                <input value={reportForm.title} maxLength={120} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} placeholder="Briefly describe the issue" required />
              </label>
              <label>Details
                <textarea value={reportForm.description} maxLength={3000} rows={5} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} placeholder="Include what happened and any relevant case ID. Do not include passwords or sensitive personal information." required />
              </label>
              <label>Contact email (optional)
                <input type="email" value={reportForm.contact} maxLength={200} onChange={(event) => setReportForm({ ...reportForm, contact: event.target.value })} placeholder="you@example.com" />
              </label>
              <button className="primary-btn" type="submit">Submit Report</button>
              {reportMessage && <p className="feature-message" role="status">{reportMessage}</p>}
            </form>
            <div className="feature-note">Demo storage: reports are saved in this browser's local storage, not sent to a server. Use a secured backend before deployment.</div>
          </section>
        )}

        {activeTab === 'admin' && (
          <section className="tab-panel feature-panel">
            <div className="feature-heading">
              <div><p className="eyebrow small">Account Settings</p><h2>Admin Profile</h2><p className="panel-copy">Update the administrator's display profile and review report activity.</p></div>
              <div className="admin-avatar">{(adminProfile.name || 'A').trim().charAt(0).toUpperCase()}</div>
            </div>
            <form className="feature-form" onSubmit={(event) => { event.preventDefault(); setReportMessage('Administrator profile saved on this browser.') }}>
              <label>Full name
                <input value={adminProfile.name} maxLength={120} onChange={(event) => setAdminProfile({ ...adminProfile, name: event.target.value })} required />
              </label>
              <label>Email address
                <input type="email" value={adminProfile.email} maxLength={200} onChange={(event) => setAdminProfile({ ...adminProfile, email: event.target.value })} required />
              </label>
              <label>Role
                <input value={adminProfile.role} maxLength={120} onChange={(event) => setAdminProfile({ ...adminProfile, role: event.target.value })} required />
              </label>
              <label>Department
                <input value={adminProfile.department} maxLength={120} onChange={(event) => setAdminProfile({ ...adminProfile, department: event.target.value })} required />
              </label>
              <button className="primary-btn" type="submit">Save Profile</button>
              {reportMessage && <p className="feature-message" role="status">{reportMessage}</p>}
            </form>
            <div className="admin-summary-grid">
              <div className="fact-tile"><span>Total reports</span><strong>{reports.length}</strong></div>
              <div className="fact-tile"><span>New</span><strong>{reports.filter((item) => item.status === 'New').length}</strong></div>
              <div className="fact-tile"><span>Resolved</span><strong>{reports.filter((item) => item.status === 'Resolved').length}</strong></div>
            </div>
            <div className="feature-note warning-note">Profile editing is not authentication. This demo does not verify administrator identity or enforce role-based access.</div>
          </section>
        )}

        {activeTab === 'incidents' && (
          <section className="tab-panel feature-panel">
            <h2>Incidents</h2><p>Track escalations, approvals, and active response actions.</p>
            <div className="feature-heading"><h3>Submitted Reports</h3><button type="button" className="secondary-btn" onClick={exportReports} disabled={!reports.length}>Export CSV</button></div>
            <div className="report-toolbar">
              <label>Filter status <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)}><option>All</option><option>New</option><option>In Review</option><option>Resolved</option><option>Rejected</option></select></label>
              <span>{filteredReports.length} shown</span>
            </div>
            {filteredReports.length === 0 ? <p className="empty-state">No reports match this filter yet. New submissions will appear here.</p> : (
              <div className="report-list">
                {filteredReports.map((item) => (
                  <article className="report-card" key={item.id}>
                    <div className="report-card-top"><div><span className="report-id">{item.id} · {item.category}</span><h4>{item.title}</h4></div><span className={`report-status status-${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span></div>
                    <p>{item.description}</p>
                    <div className="report-meta"><span>{new Date(item.createdAt).toLocaleString()}</span>{item.contact && <span>{item.contact}</span>}</div>
                    <label>Update status <select value={item.status} onChange={(event) => updateReportStatus(item.id, event.target.value)}><option>New</option><option>In Review</option><option>Resolved</option><option>Rejected</option></select></label>
                  </article>
                ))}
              </div>
            )}
            <div className="feature-note">Reports and status changes are stored locally in this browser for the prototype. They are not shared across devices.</div>
          </section>
        )}

        {activeTab === 'cases' && (
          <section className="tab-panel">
            <h2>Cases</h2>
            <p>Open case review queue and investigation timelines.</p>
          </section>
        )}

        {activeTab === 'risk' && (
          <section className="tab-panel">
            <h2>Risk Engine</h2>
            <p>Review risk scoring, confidence, and response thresholds.</p>
          </section>
        )}

        {activeTab === 'forensics' && (
          <section className="tab-panel">
            <h2>Forensics</h2>
            <p>Examine fingerprinting, source validation, and technical evidence.</p>
          </section>
        )}

        {analysisResult && activeTab !== 'cases' && activeTab !== 'risk' && activeTab !== 'forensics' && activeTab !== 'incidents' && activeTab !== 'reports' && activeTab !== 'admin' && (
          <section className="result-panel">
            <div className="result-header">
              <div className="result-title-block">
                <p className="eyebrow small">Assessment</p>
                <h3>{verdict.label}</h3>
                <p className="verdict-summary">{verdict.summary}</p>
              </div>
              <button type="button" className="secondary-btn read-result-button" onClick={readAnalysisResult}>
                Read Result Aloud
              </button>
              <span className={`risk-pill ${analysisResult.riskLevel.toLowerCase()}`}>
                {analysisResult.riskLevel}
              </span>
            </div>

            {analysisResult.comparison && (
              <div className="comparison-panel">
                <div className="comparison-header">
                  <h4>Original vs edited image difference analysis</h4>
                  <span className={`risk-pill ${analysisResult.riskLevel.toLowerCase()}`}>
                    {analysisResult.riskLevel}
                  </span>
                </div>

                <div className="comparison-stats">
                  <div className="fact-tile">
                    <span>Difference score</span>
                    <strong>{analysisResult.comparison.differencePercent.toFixed(1)}%</strong>
                  </div>
                  <div className="fact-tile">
                    <span>Edited region</span>
                    <strong>{analysisResult.comparison.region}</strong>
                  </div>
                  <div className="fact-tile">
                    <span>Likelihood</span>
                    <strong>{analysisResult.comparison.likelihood}</strong>
                  </div>
                </div>

                <div className="comparison-grid">
                  <div className="result-card">
                    <h4>Difference breakdown</h4>
                    <ul className="simple-list">
                      {analysisResult.comparison.breakdown.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="result-card">
                    <h4>What changed</h4>
                    <p className="simple-copy">{analysisResult.comparison.changeSummary}</p>
                    <div className="quick-actions">
                      <button type="button" className="secondary-btn" onClick={handleSendForReview}>Send for Review</button>
                      <button type="button" className="secondary-btn" onClick={handleViewRelatedMedia}>View Related Media</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="fact-grid">
              <div className="fact-tile">
                <span>Detection confidence</span>
                <strong>{Math.round(analysisResult.confidence * 100)}%</strong>
              </div>
              <div className="fact-tile">
                <span>Risk level</span>
                <strong>{analysisResult.riskLevel}</strong>
              </div>
              <div className="fact-tile">
                <span>Case ID</span>
                <strong>{analysisResult.caseId}</strong>
              </div>
            </div>

            <div className="result-grid">
              <div className="result-card">
                <h4>What DeepShield found</h4>
                <ul className="simple-list">
                  {humanExplanation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="result-card">
                <h4>Why this matters</h4>
                <p className="simple-copy">{verdict.note}</p>
                <div className="quick-actions">
                  <button type="button" className="secondary-btn" onClick={handleSendForReview}>Send for Review</button>
                  <button type="button" className="secondary-btn" onClick={handleViewRelatedMedia}>View Related Media</button>
                </div>
                {reviewStatus && (
                  <p className="simple-copy" style={{ marginTop: '12px', color: '#dfeaf7' }}>{reviewStatus}</p>
                )}
              </div>
            </div>

            <div className="response-box">
              <div className="publication-status">
                <span className="publication-indicator" aria-hidden="true" />
                <div>
                  <strong>Publication blocked</strong>
                  <p>{analysisResult.publicationDecision?.reason || 'This result cannot clear media for publication.'}</p>
                </div>
              </div>
              <span className="meta-label">Review required</span>
              <p>{analysisResult.response}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
