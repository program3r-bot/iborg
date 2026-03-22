'use strict';

const request = require('supertest');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { store, resetStore, buildMockQuery } = require('./setup');

// Mock the DB module before requiring app
jest.mock('../src/db', () => {
  const { store, buildMockQuery } = require('./setup');
  return { query: buildMockQuery(store) };
});

// Mock email to avoid network calls
jest.mock('../src/utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/app');

// Helper: compute a DOB string for someone exactly `age` years old
function dobForAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => resetStore());

describe('Age Gating', () => {
  test('Registering with age < 18 returns 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'young@test.com',
      password: 'Password1!',
      date_of_birth: dobForAge(17),
      display_name: 'Too Young',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/18/);
  });

  test('Registering with age exactly 17 years and 364 days returns 400', async () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setDate(d.getDate() + 1); // one day short of 18
    const dob = d.toISOString().slice(0, 10);

    const res = await request(app).post('/api/auth/register').send({
      email: 'almostadult@test.com',
      password: 'Password1!',
      date_of_birth: dob,
      display_name: 'Almost Adult',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/18/);
  });

  test('Registering with age exactly 18 returns 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'adult18@test.com',
      password: 'Password1!',
      date_of_birth: dobForAge(18),
      display_name: 'Just Adult',
    });
    expect(res.status).toBe(201);
  });

  test('Public profile view of a minor returns 404', async () => {
    // Inject a minor user directly into store
    const userId = uuidv4();
    const adultId = uuidv4();
    const hash = await bcrypt.hash('Password1!', 1);

    store.users.push(
      { id: userId, email: 'minor@test.com', password_hash: hash, email_verified: 1, verification_token: null, verification_token_expires: null },
      { id: adultId, email: 'adult@test.com', password_hash: hash, email_verified: 1, verification_token: null, verification_token_expires: null }
    );
    store.profiles.push(
      { id: uuidv4(), user_id: userId, display_name: 'Minor', date_of_birth: dobForAge(16), bio: null, location: null, is_active: 1, created_at: new Date().toISOString() },
      { id: uuidv4(), user_id: adultId, display_name: 'Adult', date_of_birth: dobForAge(25), bio: null, location: null, is_active: 1, created_at: new Date().toISOString() }
    );

    const { signToken } = require('../src/utils/jwt');
    const token = signToken({ id: adultId, email: 'adult@test.com' });

    const res = await request(app)
      .get(`/api/profiles/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('Profile search never returns under-18 profiles', async () => {
    const adultId = uuidv4();
    const minorId = uuidv4();
    const hash = await bcrypt.hash('Password1!', 1);

    store.users.push(
      { id: adultId, email: 'adult@test.com', password_hash: hash, email_verified: 1, verification_token: null, verification_token_expires: null },
      { id: minorId, email: 'minor2@test.com', password_hash: hash, email_verified: 1, verification_token: null, verification_token_expires: null }
    );
    store.profiles.push(
      { id: uuidv4(), user_id: adultId, display_name: 'Adult', date_of_birth: dobForAge(25), bio: null, location: null, is_active: 1, created_at: new Date().toISOString() },
      { id: uuidv4(), user_id: minorId, display_name: 'Minor', date_of_birth: dobForAge(15), bio: null, location: null, is_active: 1, created_at: new Date().toISOString() }
    );

    const { signToken } = require('../src/utils/jwt');
    const token = signToken({ id: adultId, email: 'adult@test.com' });

    const res = await request(app)
      .get('/api/profiles/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ages = res.body.results.map((r) => r.age);
    expect(ages.every((a) => a >= 18)).toBe(true);
    expect(ages).not.toContain(15);
  });
});
