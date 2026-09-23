#!/usr/bin/env sh
# Runs automatically by LocalStack on container startup (mounted into
# /etc/localstack/init/ready.d/). Creates the S3 bucket bookings-worker
# uploads QR codes to, and verifies the SES "from" identity so
# SendEmail calls succeed against LocalStack's SES mock.
set -e

BUCKET="${AWS_S3_BUCKET:-ticketops-qr-codes-247}"
FROM_EMAIL="${SES_FROM_EMAIL:-chimdi247@gmail.com}"

echo "[localstack-init] creating S3 bucket: ${BUCKET}"
awslocal s3 mb "s3://${BUCKET}" 2>/dev/null || echo "[localstack-init] bucket already exists"

echo "[localstack-init] verifying SES identity: ${FROM_EMAIL}"
awslocal ses verify-email-identity --email-address "${FROM_EMAIL}" || true

echo "[localstack-init] done"
