// SPIKE TEST — sudden, short burst of traffic (e.g. tickets just went on
// sale) followed by an equally sudden drop. Checks how fast the system
// recovers and whether it errors hard during the spike rather than
// degrading gracefully.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const bookingErrors = new Counter('booking_errors');
const bookingSuccess = new Counter('booking_success');
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '20s', target: 10 },   // warm up
    { duration: '10s', target: 400 },  // spike!
    { duration: '30s', target: 400 },  // hold the spike briefly
    { duration: '10s', target: 10 },   // sudden drop
    { duration: '20s', target: 10 },   // recovery / baseline
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.5'],
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

  const eventsRes = http.get(`${BASE_URL}/api/events`, { tags: { name: 'get_events' } });
  check(eventsRes, { 'get events status 200': (r) => r.status === 200 });
  errorRate.add(eventsRes.status !== 200);

  const payload = JSON.stringify({
    event_id: eventId,
    customer_name: `SpikeUser ${__VU}`,
    customer_email: `spike${__VU}@loadtest.local`,
    seats: [randomSeat()],
  });

  const bookingRes = http.post(`${BASE_URL}/api/bookings`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create_booking' },
  });

  check(bookingRes, { 'booking status 201 or 409': (r) => r.status === 201 || r.status === 409 });

  if (bookingRes.status === 201) {
    bookingSuccess.add(1);
    errorRate.add(0);
  } else if (bookingRes.status === 409) {
    errorRate.add(0);
  } else {
    bookingErrors.add(1);
    errorRate.add(1);
  }

  sleep(0.2);
}
