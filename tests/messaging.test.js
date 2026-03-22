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
const { signToken } = require('../src/utils/jwt');

function dobForAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

// Helpers to seed the in-memory store with a fully-set-up conversation scenario
async function seedAdultVerifiedUser(email) {
  const id = uuidv4();
  const hash = await bcrypt.hash('Password1!', 1);
  store.users.push({
    id,
    email,
    password_hash: hash,
    email_verified: 1,
    verification_token: null,
    verification_token_expires: null,
  });
  store.profiles.push({
    id: uuidv4(),
    user_id: id,
    display_name: email.split('@')[0],
    date_of_birth: dobForAge(25),
    bio: null,
    location: null,
    is_active: 1,
    created_at: new Date().toISOString(),
  });
  return id;
}

async function seedUnverifiedUser(email) {
  const id = uuidv4();
  const hash = await bcrypt.hash('Password1!', 1);
  store.users.push({
    id,
    email,
    password_hash: hash,
    email_verified: 0,
    verification_token: null,
    verification_token_expires: null,
  });
  store.profiles.push({
    id: uuidv4(),
    user_id: id,
    display_name: email.split('@')[0],
    date_of_birth: dobForAge(25),
    bio: null,
    location: null,
    is_active: 1,
    created_at: new Date().toISOString(),
  });
  return id;
}

function seedConversation(aId, bId) {
  const [pa, pb] = [aId, bId].sort();
  const convId = uuidv4();
  store.conversations.push({ id: convId, participant_a: pa, participant_b: pb, created_at: new Date().toISOString() });
  return convId;
}

beforeEach(() => resetStore());

describe('Messaging Safety', () => {
  test('Blocked user cannot send a message (403)', async () => {
    const aliceId = await seedAdultVerifiedUser('alice@test.com');
    const bobId = await seedAdultVerifiedUser('bob@test.com');
    const convId = seedConversation(aliceId, bobId);

    // Bob blocks Alice
    store.blocks.push({ id: uuidv4(), blocker_id: bobId, blocked_id: aliceId });

    const token = signToken({ id: aliceId, email: 'alice@test.com' });
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Hello Bob!' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/block/i);
  });

  test('Unverified sender cannot send a message (403)', async () => {
    const aliceId = await seedUnverifiedUser('aliceunverified@test.com');
    const bobId = await seedAdultVerifiedUser('bob2@test.com');
    const convId = seedConversation(aliceId, bobId);

    const token = signToken({ id: aliceId, email: 'aliceunverified@test.com' });
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Hello Bob!' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/verify/i);
  });

  test('Repeated identical messages (>=5) are throttled with 429', async () => {
    const aliceId = await seedAdultVerifiedUser('alice3@test.com');
    const bobId = await seedAdultVerifiedUser('bob3@test.com');
    const convId = seedConversation(aliceId, bobId);

    // Pre-fill 5 identical messages in the store
    const identicalBody = 'Spam message!';
    for (let i = 0; i < 5; i++) {
      store.messages.push({
        id: uuidv4(),
        conversation_id: convId,
        sender_id: aliceId,
        body: identicalBody,
        created_at: new Date().toISOString(),
      });
    }

    const token = signToken({ id: aliceId, email: 'alice3@test.com' });
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: identicalBody });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/duplicate|spam/i);
  });

  test('Message with more than 3 URLs is rejected (400)', async () => {
    const aliceId = await seedAdultVerifiedUser('alice4@test.com');
    const bobId = await seedAdultVerifiedUser('bob4@test.com');
    const convId = seedConversation(aliceId, bobId);

    const token = signToken({ id: aliceId, email: 'alice4@test.com' });
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        body: 'Check these out: http://a.com http://b.com http://c.com http://d.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url/i);
  });

  test('Normal message between verified adults succeeds (201)', async () => {
    const aliceId = await seedAdultVerifiedUser('alice5@test.com');
    const bobId = await seedAdultVerifiedUser('bob5@test.com');
    const convId = seedConversation(aliceId, bobId);

    const token = signToken({ id: aliceId, email: 'alice5@test.com' });
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Hey Bob, how are you?' });

    expect(res.status).toBe(201);
    expect(res.body.messageId).toBeDefined();
    expect(store.messages).toHaveLength(1);
  });
});
