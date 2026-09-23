const QRCode = require('qrcode');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

// AWS_S3_ENDPOINT lets this point at LocalStack for docker-compose/local
// dev (forcePathStyle is required for LocalStack-style endpoints). When
// unset, this behaves exactly as before and talks to real AWS S3.
const s3Endpoint = process.env.AWS_S3_ENDPOINT;
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2',
  ...(s3Endpoint ? { endpoint: s3Endpoint, forcePathStyle: true } : {}),
});
const BUCKET = process.env.AWS_S3_BUCKET || 'ticketops-qr-codes-247';

// generate QR code PNG buffer from booking data
const generateQR = async (bookingData) => {
  const qrContent = JSON.stringify({
    ref: bookingData.booking_ref,
    event: bookingData.event_title,
    seats: bookingData.seats,
  });
  // returns a PNG buffer
  const buffer = await QRCode.toBuffer(qrContent, { type: 'png', width: 300 });
  return buffer;
};

// upload QR PNG to S3 and return pre-signed URL
const uploadQR = async (bookingRef, qrBuffer) => {
  const key = `qr-codes/${bookingRef}.png`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: qrBuffer,
    ContentType: 'image/png',
  }));

  logger.info({ message: 'QR uploaded to S3', booking_ref: bookingRef, key });

  // generate pre-signed URL valid for 7 days
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn: 7 * 24 * 60 * 60 });

  return url;
};

module.exports = { generateQR, uploadQR };
