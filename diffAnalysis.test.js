import test from 'node:test'
import assert from 'node:assert/strict'

import { computeDifferenceSummary } from './diffAnalysis.js'

test('flags localized visual differences without claiming they prove a deepfake', () => {
  const reference = new Uint8ClampedArray(4 * 4 * 4)
  const suspect = new Uint8ClampedArray(4 * 4 * 4)

  for (let index = 0; index < reference.length; index += 4) {
    reference[index] = 50
    reference[index + 1] = 50
    reference[index + 2] = 50
    reference[index + 3] = 255

    suspect[index] = 50
    suspect[index + 1] = 50
    suspect[index + 2] = 50
    suspect[index + 3] = 255
  }

  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const index = (y * 4 + x) * 4
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
        suspect[index] = 200
        suspect[index + 1] = 30
        suspect[index + 2] = 70
      }
    }
  }

  const result = computeDifferenceSummary(reference, suspect, 4, 4)
  assert.ok(result.differencePercent > 20, 'should flag a clear mismatch percentage')
  assert.equal(result.riskLevel, 'HIGH')
  assert.match(result.region, /central/i)
  assert.equal(result.comparable, true)
})

test('marks broadly different images inconclusive instead of high risk', () => {
  const reference = new Uint8ClampedArray(8 * 8 * 4)
  const suspect = new Uint8ClampedArray(8 * 8 * 4)

  for (let index = 0; index < reference.length; index += 4) {
    reference[index] = 0
    reference[index + 1] = 0
    reference[index + 2] = 0
    reference[index + 3] = 255
    suspect[index] = 255
    suspect[index + 1] = 255
    suspect[index + 2] = 255
    suspect[index + 3] = 255
  }

  const result = computeDifferenceSummary(reference, suspect, 8, 8)
  assert.equal(result.comparable, false)
  assert.equal(result.riskLevel, 'INCONCLUSIVE')
  assert.match(result.likelihood, /same underlying scene/i)
})

test('rejects unrelated images with similar colors but reversed spatial structure', () => {
  const width = 64
  const height = 64
  const reference = new Uint8ClampedArray(width * height * 4)
  const suspect = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const referenceValue = x < width / 2 ? 120 : 140
      const suspectValue = x < width / 2 ? 140 : 120
      reference[index] = referenceValue
      reference[index + 1] = referenceValue
      reference[index + 2] = referenceValue
      reference[index + 3] = 255
      suspect[index] = suspectValue
      suspect[index + 1] = suspectValue
      suspect[index + 2] = suspectValue
      suspect[index + 3] = 255
    }
  }

  const result = computeDifferenceSummary(reference, suspect, width, height)
  assert.equal(result.sceneMismatchPercent, 0)
  assert.ok(result.sceneCorrelation < 0)
  assert.equal(result.comparable, false)
  assert.equal(result.riskLevel, 'INCONCLUSIVE')
})
