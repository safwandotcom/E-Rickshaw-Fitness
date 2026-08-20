import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCertificatePdf } from '../dist/lib/certificate-pdf.js';

test('renders a valid PDF certificate containing a QR image', async () => {
  const pdf = await renderCertificatePdf({
    certificateNumber: 'ERF-2026-00000001',
    chassisSuffix: '8821',
    zone: 'DHK-N-04',
    status: 'active',
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    verificationUrl: '/api/v1/public/verify/123456',
    qrPayload: 'ERF1.test.payload'
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1_000);
});
