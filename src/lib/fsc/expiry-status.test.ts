import test from 'node:test'
import assert from 'node:assert/strict'
import { getFscExpiryStatus } from '@/lib/fsc/expiry-status'

function daysFromToday(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

test('getFscExpiryStatus returns none when expires_at is null', () => {
  assert.equal(getFscExpiryStatus(null), 'none')
})

test('getFscExpiryStatus returns expired for past dates', () => {
  assert.equal(getFscExpiryStatus(daysFromToday(-1)), 'expired')
})

test('getFscExpiryStatus returns warning within 30 days', () => {
  assert.equal(getFscExpiryStatus(daysFromToday(15)), 'warning')
  assert.equal(getFscExpiryStatus(daysFromToday(30)), 'warning')
})

test('getFscExpiryStatus returns ok beyond 30 days', () => {
  assert.equal(getFscExpiryStatus(daysFromToday(45)), 'ok')
})
