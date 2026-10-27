import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreate, validateChange, transition, taskBucket, identifier, date } from '../app/lib/crmFollowups.mjs';

const payload = { title: 'Teklif sonucu', customerName: 'Restoran', kind: 'offer', dueAt: '2026-10-30T05:00:00.000Z', offerId: 'offer_1' };
test('invalid linkage, unsupported kinds and malformed dates are rejected before storage', () => {
  for (const id of ['../users', 'a/b', '', '<script>']) assert.throws(() => identifier(id));
  for (const dueAt of ['2026-02-30T10:00:00.000Z', '2026-10-30', 'not-a-date']) assert.throws(() => date(dueAt));
  assert.throws(() => validateCreate({ ...payload, kind: 'send-message' }));
  assert.throws(() => validateCreate({ ...payload, customerName: '' }));
  assert.throws(() => validateCreate({ ...payload, notes: 'x'.repeat(2001) }));
  assert.equal(validateCreate(payload).dueAt.toISOString(), payload.dueAt);
});
test('concurrent edits cannot complete or reschedule a stale task', () => {
  assert.throws(() => transition({ status: 'open', revision: 'new' }, { revision: 'old', action: 'complete' }, new Date()), { status: 409 });
  assert.throws(() => transition({ status: 'completed', revision: 'same' }, { revision: 'same', action: 'reschedule' }, new Date()), { status: 409 });
});
test('completion, reopening and rescheduling retain explicit lifecycle semantics', () => {
  const now = new Date(), dueAt = new Date('2026-11-01T05:00:00Z');
  const completed = transition({ status: 'open', revision: 'one' }, { action: 'complete', revision: 'one' }, now);
  assert.equal(completed.closedAt, now); assert.equal(completed.status, 'completed');
  const reopened = transition({ status: 'completed', revision: 'two' }, { action: 'reopen', revision: 'two', dueAt }, now);
  assert.equal(reopened.status, 'open'); assert.equal(reopened.closedAt, null); assert.equal(reopened.dueAt, dueAt);
  assert.throws(() => validateChange({ id: 'task', revision: 'one', action: 'reopen' }));
});
test('today and overdue use Kazakhstan midnight rather than operator computer time', () => {
  const now = new Date('2026-10-27T19:15:00.000Z'); // 28 October, 00:15 in Kazakhstan
  assert.equal(taskBucket({ status: 'open', dueAt: '2026-10-27T19:05:00Z' }, now), 'today');
  assert.equal(taskBucket({ status: 'open', dueAt: '2026-10-27T18:59:00Z' }, now), 'overdue');
  assert.equal(taskBucket({ status: 'completed', dueAt: '2026-10-27T18:59:00Z' }, now), 'closed');
});
