import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface CertificatePdfData {
  certificateNumber: string;
  chassisSuffix: string;
  zone: string;
  status: string;
  expiresAt: Date;
  verificationUrl: string;
  qrPayload: string;
}

export async function renderCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const qrImage = await QRCode.toBuffer(data.qrPayload, { type: 'png', width: 160, margin: 1 });
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(22).fillColor('#006a4e').text('E-RICKSHAW FITNESS CERTIFICATE', { align: 'center' });
    document.moveDown(0.5).fontSize(11).fillColor('#16261e').text('Issued by the authorized vehicle fitness authority', { align: 'center' });
    document.moveDown(2).fontSize(12).text(`Certificate number: ${data.certificateNumber}`);
    document.moveDown(0.5).text(`Vehicle chassis (last four): ${data.chassisSuffix}`);
    document.text(`Zone: ${data.zone}`);
    document.text(`Status: ${data.status.toUpperCase()}`);
    document.text(`Valid until: ${data.expiresAt.toISOString().slice(0, 10)}`);
    document.moveDown(2).fontSize(10).fillColor('#4b5e53').text('Verify this certificate online using its QR sticker or short code. Do not share owner contact information.', { width: 480 });
    document.moveDown(1).fillColor('#006a4e').text(`Public verification: ${data.verificationUrl}`);
    document.image(qrImage, 390, 170, { fit: [145, 145], align: 'center', valign: 'center' });
    document.moveDown(4).fillColor('#16261e').text('This document is digitally issued. Roadside verification should use the signed QR payload and live status whenever connectivity is available.', { width: 480 });
    document.end();
  });
}
