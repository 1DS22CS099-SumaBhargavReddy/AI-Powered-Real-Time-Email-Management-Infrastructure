import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp up to 20 virtual users
    { duration: '20s', target: 50 }, // Stay at 50 VUs
    { duration: '10s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete within 200ms
    http_req_failed: ['rate<0.01'],   // error rate must be less than 1%
  },
};

export default function () {
  const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

  // 1. Health Liveness Check
  const liveRes = http.get(`${BASE_URL}/health/live`);
  check(liveRes, {
    'liveness status is 200': (r) => r.status === 200,
  });

  // 2. Health Readiness Check
  const readyRes = http.get(`${BASE_URL}/health/ready`);
  check(readyRes, {
    'readiness status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}
