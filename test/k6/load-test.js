// LOAD TEST — steady, realistic traffic ramping up to a sustainable
// plateau. Simulates normal peak usage: browse events -> pick a seat ->
// book -> fetch confirmation. Mirrors scripts/load-test/load-test.js but
// targets the local docker-compose stack by default.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const bookingErrors = new Counter('booking_errors');
const bookingSuccess = new Counter('booking_success');
const bookingDuration = new Trend('booking_duration');
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '2m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function randomSeat() {
  const letters = 'ABCDE';
  const row = letters[Math.floor(Math.random() * 5)];
  const num = Math.floor(Math.random() * 20) + 1;
  return `${row}${num}`;
}

function randomEventId() {
  return Math.floor(Math.random() * 6) + 1;
}

export default function () {
  const eventId = randomEventId();

  const eventsRes = http.get(`${BASE_URL}/api/events`, {
    tags: { name: 'get_events' },
  });
  check(eventsRes, { 'get events status 200': (r) => r.status === 200 });
  errorRate.add(eventsRes.status !== 200);

  sleep(0.5);

  const payload = JSON.stringify({
    event_id: eventId,
    customer_name: `User ${__VU}`,
    customer_email: `user${__VU}@loadtest.local`,
    seats: [randomSeat()],
  });

  const start = Date.now();
  const bookingRes = http.post(`${BASE_URL}/api/bookings`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create_booking' },
  });
  bookingDuration.add(Date.now() - start);

  check(bookingRes, { 'booking status 201 or 409': (r) => r.status === 201 || r.status === 409 });

  if (bookingRes.status === 201) {
    bookingSuccess.add(1);
    errorRate.add(0);
    const bookingRef = bookingRes.json('booking.booking_ref');
    if (bookingRef) {
      const checkRes = http.get(`${BASE_URL}/api/bookings/${bookingRef}`, { tags: { name: 'get_booking' } });
      check(checkRes, { 'get booking status 200': (r) => r.status === 200 });
    }
  } else if (bookingRes.status === 409) {
    errorRate.add(0);
  } else {
    bookingErrors.add(1);
    errorRate.add(1);
  }

  sleep(1);
}
