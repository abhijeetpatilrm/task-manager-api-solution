'use strict';

const request = require('supertest');
const app = require('../../src/app');

// ─────────────────────────────────────────────────────────────────────────────
// GET / — root health-check
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /', () => {
  it('200 — returns success status', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('200 — includes a human-readable message', async () => {
    const res = await request(app).get('/');
    expect(res.body.message).toMatch(/Task Management API/i);
  });

  it('200 — response body is a JSON object (not an array or primitive)', async () => {
    const res = await request(app).get('/');
    expect(typeof res.body).toBe('object');
    expect(Array.isArray(res.body)).toBe(false);
  });

  it('200 — documentation object is present and contains endpoint keys', async () => {
    const res = await request(app).get('/');
    expect(res.body).toHaveProperty('documentation');
    expect(res.body.documentation).toHaveProperty('endpoints');
    const endpoints = res.body.documentation.endpoints;
    expect(endpoints).toHaveProperty('GET /tasks');
    expect(endpoints).toHaveProperty('POST /tasks');
    expect(endpoints).toHaveProperty('PATCH /tasks/:id/complete');
    expect(endpoints).toHaveProperty('PATCH /tasks/:id/assign');
  });

  it('200 — Content-Type is application/json', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
