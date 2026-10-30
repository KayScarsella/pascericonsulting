import test from 'node:test'
import assert from 'node:assert/strict'
import { getFscIloStatus } from '@/lib/fsc/ilo/status'

test('getFscIloStatus returns draft when not completed but has form data', () => {
  assert.equal(getFscIloStatus(null, true), 'draft')
})

test('getFscIloStatus returns overdue when never completed and empty form', () => {
  assert.equal(getFscIloStatus(null, false), 'overdue')
})

test('getFscIloStatus returns completed when recently completed', () => {
  const recent = new Date()
  recent.setMonth(recent.getMonth() - 2)
  assert.equal(getFscIloStatus(recent.toISOString(), true), 'completed')
})

test('getFscIloStatus returns overdue when completed more than 10 months ago', () => {
  const old = new Date()
  old.setMonth(old.getMonth() - 11)
  assert.equal(getFscIloStatus(old.toISOString(), true), 'overdue')
})
