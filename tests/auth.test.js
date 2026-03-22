'use strict';

const request = require('supertest');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { store, resetStore, buildMockQuery } = require('./setup');

jest.mock('../src/db', () => {
  const { store, buildMockQuery } = require('./setup');
  return { query: buildMockQuery(store) };
});

jest.mock('../src/utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/app');

function dobForAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => resetStore());

describe('Authentication', () => {
  test('Valid registration creates user and returns 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com',
      password: 'SecurePass1!',
      date_of_birth: dobForAge(25),
      display_name: 'New User',
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/verify/i);
    expect(store.users).toHaveLength(1);
    expect(store.users[0].email).toBe('new@test.com');
    expect(store.users[0].email_verified).toBe(0);
  });

  test('Duplicate email registration returns 409', async () => {
    const hash = await bcrypt.hash('SecurePass1!', 1);
    store.users.push({
      id: uuidv4(),
      email: 'dup@test.com',
      password_hash: hash,
      email_verified: 0,
      verification_token: null,
      verification_token_expires: null,
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'dup@test.com',
      password: 'SecurePass1!',
      date_of_birth: dobForAge(25),
      display_name: 'Dup User',
    });
    expect(res.status).toBe(409);
  });

  test('Login with wrong password returns 401', async () => {
    const hash = await bcrypt.hash('CorrectPass1!', 1);
    store.users.push({
      id: uuidv4(),
      email: 'login@test.com',
      password_hash: hash,
      email_verified: 1,
      verification_token: null,
      verification_token_expires: null,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'WrongPassword',
    });
    expect(res.status).toBe(401);
  });

  test('Login without email verification returns 403', async () => {
    const hash = await bcrypt.hash('SecurePass1!', 1);
    store.users.push({
      id: uuidv4(),
      email: 'unverified@test.com',
      password_hash: hash,
      email_verified: 0,
      verification_token: null,
      verification_token_expires: null,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'unverified@test.com',
      password: 'SecurePass1!',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/verify/i);
  });

  test('Valid login with verified account returns JWT token', async () => {
    const hash = await bcrypt.hash('SecurePass1!', 1);
    store.users.push({
      id: uuidv4(),
      email: 'verified@test.com',
      password_hash: hash,
      email_verified: 1,
      verification_token: null,
      verification_token_expires: null,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'verified@test.com',
      password: 'SecurePass1!',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  test('Rate limiting: 11th request to auth endpoint returns 429', async () => {
    const requests = [];
    for (let i = 0; i < 11; i++) {
      requests.push(
        request(app).post('/api/auth/login').send({
          email: `user${i}@test.com`,
          password: 'somepassword',
        })
      );
    }
    const results = await Promise.all(requests);
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(429);
  });
});
