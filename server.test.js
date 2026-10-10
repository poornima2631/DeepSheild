import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { after, test } from 'node:test'

const port = 32000 + Math.floor(Math.random() * 1000)
const baseUrl = `http://127.0.0.1:${port}`
const serverProcess = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
})

after(async () => {
  if (serverProcess.exitCode === null) {
    serverProcess.kill()
    await once(serverProcess, 'exit')
  }
})

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  throw new Error('Analysis API did not start in time.')
}

test('unknown media stays inconclusive and cannot be published', async () => {
  await waitForServer()

  const analysisResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'face.jpg', mimeType: 'image/jpeg', size: 1234 }),
  })
  const analysis = await analysisResponse.json()

  assert.equal(analysis.riskLevel, 'INCONCLUSIVE')
  assert.equal(analysis.confidence, 0)
  assert.equal(analysis.publicationDecision.allowed, false)
  assert.equal(analysis.publicationDecision.status, 'BLOCKED')

  const publishResponse = await fetch(`${baseUrl}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: analysis.caseId, riskLevel: 'LOW' }),
  })
  const publication = await publishResponse.json()

  assert.equal(publishResponse.status, 403)
  assert.equal(publication.publicationDecision.allowed, false)
  assert.equal(publication.publicationDecision.status, 'BLOCKED')
})
