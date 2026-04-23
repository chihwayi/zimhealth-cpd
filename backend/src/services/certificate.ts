import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { db } from '../lib/db';
import { getLearnerCPDSummary } from './cpd-engine';
import { uploadToS3 } from '../lib/s3';

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export async function generateCertificate(learnerId: string, cycleYear: number) {
  const summary = await getLearnerCPDSummary(learnerId, cycleYear);
  if (summary.totalPoints < summary.requiredPoints) {
    throw new Error('Not eligible for certificate yet');
  }

  const existing = await db.certificate.findFirst({ where: { learnerId, cycleYear } });
  if (existing) return existing;

  const learner = await db.user.findUnique({
    where: { id: learnerId },
    select: { fullName: true, nczRegistrationNumber: true },
  });
  if (!learner) throw new Error('Learner not found');

  const records = await db.cPDRecord.findMany({
    where: { learnerId, cycleYear, courseId: { not: null } },
    include: { course: { select: { title: true } } },
    orderBy: { completedAt: 'asc' },
  });
  const coursesCompleted = Array.from(
    new Set(records.map((r) => r.course?.title).filter((t): t is string => !!t)),
  );

  const cert = await db.certificate.create({
    data: {
      learnerId,
      cycleYear,
      totalPoints: summary.totalPoints,
      coursesCompleted,
    },
  });

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
  const verifyUrl = `${webUrl}/verify/${cert.certificateUuid}`;

  const qrPng = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 256, margin: 1 });

  const doc = new PDFDocument({ size: 'A4', margin: 54 });
  doc.info.Title = `ZimHealth CPD Certificate ${cycleYear}`;

  // Header
  doc.fontSize(20).fillColor('#0f172a').text('ZimHealth CPD', { align: 'center' });
  doc.moveDown(0.25);
  doc.fontSize(12).fillColor('#334155').text('Certificate of Completion', { align: 'center' });

  doc.moveDown(2);

  // Body
  doc.fontSize(12).fillColor('#475569').text('This certifies that', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(28).fillColor('#0f172a').text(learner.fullName, { align: 'center' });
  doc.moveDown(0.75);

  if (learner.nczRegistrationNumber) {
    doc
      .fontSize(11)
      .fillColor('#475569')
      .text(`NCZ Reg No: ${learner.nczRegistrationNumber}`, { align: 'center' });
    doc.moveDown(0.75);
  }

  doc
    .fontSize(12)
    .fillColor('#475569')
    .text(`has earned ${summary.totalPoints} CPD points in the ${cycleYear} cycle.`, { align: 'center' });

  doc.moveDown(1.5);
  doc.fontSize(12).fillColor('#0f172a').text('Courses completed', { align: 'left' });
  doc.moveDown(0.5);

  if (coursesCompleted.length) {
    doc.fontSize(10).fillColor('#334155');
    for (const title of coursesCompleted.slice(0, 14)) {
      doc.text(`• ${title}`);
    }
    if (coursesCompleted.length > 14) doc.text(`• …and ${coursesCompleted.length - 14} more`);
  } else {
    doc.fontSize(10).fillColor('#64748b').text('No course list available.');
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(10).fillColor('#475569').text(`Certificate UUID: ${cert.certificateUuid}`);
  doc.text(`Issued: ${new Date(cert.issuedAt).toLocaleDateString('en-ZW')}`);

  // QR Code (bottom-right)
  const qrSize = 120;
  const x = doc.page.width - doc.page.margins.right - qrSize;
  const y = doc.page.height - doc.page.margins.bottom - qrSize;
  doc.image(qrPng, x, y, { width: qrSize, height: qrSize });
  doc
    .fontSize(8)
    .fillColor('#64748b')
    .text('Verify', x, y + qrSize + 4, { width: qrSize, align: 'center' });

  const pdfBuffer = await pdfToBuffer(doc);

  const key = `certificates/${learnerId}/${cert.certificateUuid}.pdf`;
  const pdfUrl = await uploadToS3(key, pdfBuffer, 'application/pdf');

  return db.certificate.update({
    where: { id: cert.id },
    data: { pdfKey: key, pdfUrl },
  });
}

