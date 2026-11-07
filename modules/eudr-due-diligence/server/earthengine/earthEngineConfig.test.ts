import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EARTH_ENGINE_MISSING_PROJECT_ID_ERROR,
  earthEngineConfigurationError,
  isEarthEngineConfigured,
} from '@/features/eudr-due-diligence/server/earthengine/initialize'

function withEarthEngineEnv(json: string | undefined, run: () => void) {
  const prevJson = process.env.EARTH_ENGINE_PRIVATE_KEY_JSON
  const prevB64 = process.env.EARTH_ENGINE_PRIVATE_KEY_JSON_B64
  delete process.env.EARTH_ENGINE_PRIVATE_KEY_JSON_B64
  if (json === undefined) delete process.env.EARTH_ENGINE_PRIVATE_KEY_JSON
  else process.env.EARTH_ENGINE_PRIVATE_KEY_JSON = json
  try {
    run()
  } finally {
    if (prevJson === undefined) delete process.env.EARTH_ENGINE_PRIVATE_KEY_JSON
    else process.env.EARTH_ENGINE_PRIVATE_KEY_JSON = prevJson
    if (prevB64 === undefined) delete process.env.EARTH_ENGINE_PRIVATE_KEY_JSON_B64
    else process.env.EARTH_ENGINE_PRIVATE_KEY_JSON_B64 = prevB64
  }
}

test('credenziali senza project_id non superano il preflight', () => {
  withEarthEngineEnv(JSON.stringify({ client_email: 'ee@example.com' }), () => {
    assert.equal(isEarthEngineConfigured(), false)
    assert.equal(earthEngineConfigurationError(), EARTH_ENGINE_MISSING_PROJECT_ID_ERROR)
  })
})

test('project_id presente rende Earth Engine configurato', () => {
  withEarthEngineEnv(JSON.stringify({ project_id: 'demo-project' }), () => {
    assert.equal(isEarthEngineConfigured(), true)
    assert.equal(earthEngineConfigurationError(), null)
  })
})
