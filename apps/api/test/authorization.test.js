import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthorizationError, requireZoneAccess } from '../dist/lib/authorization.js';

const inspector = {
  userId: 'user-1',
  roles: ['inspector'],
  scope: { districtIds: ['dhaka'], zoneIds: ['dhk-n-04'] }
};

test('allows an inspector in their assigned district and zone', () => {
  assert.doesNotThrow(() => requireZoneAccess(inspector, 'dhaka', 'dhk-n-04'));
});

test('rejects an inspector outside their assigned zone', () => {
  assert.throws(
    () => requireZoneAccess(inspector, 'dhaka', 'dhk-s-02'),
    AuthorizationError
  );
});
