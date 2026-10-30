import test from 'node:test'
import assert from 'node:assert/strict'
import { INVITE_CALLBACK_OTP_TYPES, isInviteCallbackOtpType } from './auth-callback-debug'

test('isInviteCallbackOtpType accepts invite and magiclink', () => {
  assert.equal(isInviteCallbackOtpType('invite'), true)
  assert.equal(isInviteCallbackOtpType('magiclink'), true)
})

test('isInviteCallbackOtpType rejects recovery', () => {
  assert.equal(isInviteCallbackOtpType('recovery'), false)
})

test('isInviteCallbackOtpType covers declared OTP types', () => {
  for (const t of INVITE_CALLBACK_OTP_TYPES) {
    assert.equal(isInviteCallbackOtpType(t), true)
  }
})
