'use strict';

// In-memory store for mocking the database
const store = {
  users: [],
  profiles: [],
  conversations: [],
  messages: [],
  blocks: [],
  reports: [],
};

function resetStore() {
  store.users = [];
  store.profiles = [];
  store.conversations = [];
  store.messages = [];
  store.blocks = [];
  store.reports = [];
}

// Build a mock query function that mimics MySQL behaviour for the queries used in routes
function buildMockQuery(store) {
  return async function mockQuery(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();

    // --- users ---
    if (/^SELECT id FROM users WHERE email/i.test(s)) {
      return store.users.filter((u) => u.email === params[0]).map((u) => ({ id: u.id }));
    }

    if (/^SELECT \* FROM users WHERE email/i.test(s)) {
      return store.users.filter((u) => u.email === params[0]);
    }

    if (/^SELECT id FROM users WHERE id/i.test(s)) {
      return store.users.filter((u) => u.id === params[0]).map((u) => ({ id: u.id }));
    }

    if (/^INSERT INTO users/i.test(s)) {
      const [id, email, password_hash, email_verified, verification_token, verification_token_expires] = params;
      store.users.push({ id, email, password_hash, email_verified: Number(email_verified) || 0, verification_token, verification_token_expires });
      return { affectedRows: 1, insertId: 0 };
    }

    if (/^SELECT id FROM users WHERE verification_token/i.test(s)) {
      const now = new Date();
      return store.users
        .filter((u) => u.verification_token === params[0] && !u.email_verified && new Date(u.verification_token_expires) > now)
        .map((u) => ({ id: u.id }));
    }

    if (/^UPDATE users SET email_verified/i.test(s)) {
      const user = store.users.find((u) => u.id === params[0]);
      if (user) {
        user.email_verified = 1;
        user.verification_token = null;
        user.verification_token_expires = null;
      }
      return { affectedRows: 1 };
    }

    // --- profiles ---
    if (/^INSERT INTO profiles/i.test(s)) {
      const [id, user_id, display_name, date_of_birth] = params;
      store.profiles.push({ id, user_id, display_name, date_of_birth, bio: null, location: null, is_active: 1, created_at: new Date().toISOString() });
      return { affectedRows: 1 };
    }

    if (/^SELECT p\.id.*FROM profiles p WHERE p\.user_id/i.test(s)) {
      return store.profiles.filter((p) => p.user_id === params[0]);
    }

    if (/^SELECT p\.id.*FROM profiles p WHERE p\.user_id = \? AND p\.is_active/i.test(s)) {
      return store.profiles.filter((p) => p.user_id === params[0] && p.is_active);
    }

    if (/^UPDATE profiles SET/i.test(s)) {
      const userId = params[params.length - 1];
      const profile = store.profiles.find((p) => p.user_id === userId);
      if (profile) {
        // Extract set fields from SQL
        const setClause = s.match(/SET (.+) WHERE/i)?.[1] || '';
        const setParts = setClause.split(',').map(p => p.trim());
        let paramIdx = 0;
        for (const part of setParts) {
          const field = part.split('=')[0].trim();
          profile[field] = params[paramIdx++];
        }
      }
      return { affectedRows: profile ? 1 : 0 };
    }

    // Search profiles (has date_of_birth range and user exclusion params)
    // SQL: WHERE is_active=1 AND date_of_birth <= ? AND date_of_birth >= ? AND user_id != ? [AND location LIKE ?] LIMIT ? OFFSET ?
    if (/^SELECT p\.id.*FROM profiles p WHERE/i.test(s)) {
      const maxDob = params[0]; // date_of_birth <= maxDob (at least minAge old)
      const minDob = params[1]; // date_of_birth >= minDob (at most maxAge old)
      const excludeId = params[2];
      return store.profiles.filter((p) => {
        if (!p.is_active) return false;
        if (p.user_id === excludeId) return false;
        const dob = p.date_of_birth;
        if (maxDob && dob > maxDob) return false;
        if (minDob && dob < minDob) return false;
        return true;
      }).map((p) => ({ ...p }));
    }

    // --- blocks ---
    if (/^SELECT id FROM blocks WHERE blocker_id = \? AND blocked_id/i.test(s)) {
      return store.blocks.filter((b) => b.blocker_id === params[0] && b.blocked_id === params[1]).map((b) => ({ id: b.id }));
    }

    if (/^SELECT id FROM blocks WHERE \(blocker_id/i.test(s)) {
      return store.blocks.filter(
        (b) =>
          (b.blocker_id === params[0] && b.blocked_id === params[1]) ||
          (b.blocker_id === params[2] && b.blocked_id === params[3])
      ).map((b) => ({ id: b.id }));
    }

    if (/^INSERT INTO blocks/i.test(s)) {
      const [id, blocker_id, blocked_id] = params;
      store.blocks.push({ id, blocker_id, blocked_id });
      return { affectedRows: 1 };
    }

    if (/^DELETE FROM blocks WHERE blocker_id/i.test(s)) {
      const before = store.blocks.length;
      store.blocks = store.blocks.filter(
        (b) => !(b.blocker_id === params[0] && b.blocked_id === params[1])
      );
      return { affectedRows: before - store.blocks.length };
    }

    // --- reports ---
    if (/^INSERT INTO reports/i.test(s)) {
      const [id, reporter_id, reported_id, reason] = params;
      store.reports.push({ id, reporter_id, reported_id, reason });
      return { affectedRows: 1 };
    }

    // --- conversations ---
    if (/^SELECT id FROM conversations WHERE participant_a = \? AND participant_b/i.test(s)) {
      return store.conversations.filter(
        (c) => c.participant_a === params[0] && c.participant_b === params[1]
      ).map((c) => ({ id: c.id }));
    }

    if (/^SELECT id FROM conversations WHERE id = \? AND \(participant_a/i.test(s)) {
      return store.conversations.filter(
        (c) => c.id === params[0] && (c.participant_a === params[1] || c.participant_b === params[2])
      ).map((c) => ({ id: c.id }));
    }

    if (/^SELECT participant_a, participant_b FROM conversations WHERE id/i.test(s)) {
      return store.conversations.filter((c) => c.id === params[0]);
    }

    if (/^SELECT c\.id.*FROM conversations c WHERE/i.test(s)) {
      return store.conversations.filter(
        (c) => c.participant_a === params[0] || c.participant_b === params[1]
      );
    }

    if (/^INSERT INTO conversations/i.test(s)) {
      const [id, participant_a, participant_b] = params;
      store.conversations.push({ id, participant_a, participant_b, created_at: new Date().toISOString() });
      return { affectedRows: 1 };
    }

    // --- messages ---
    if (/^SELECT COUNT\(\*\) AS cnt FROM messages WHERE conversation_id = \? AND sender_id = \? AND body/i.test(s)) {
      const [convId, senderId, body, since] = params;
      const sinceTime = since ? new Date(since).getTime() : 0;
      const cnt = store.messages.filter(
        (m) =>
          m.conversation_id === convId &&
          m.sender_id === senderId &&
          m.body === body &&
          new Date(m.created_at).getTime() >= sinceTime
      ).length;
      return [{ cnt }];
    }

    if (/^SELECT COUNT\(\*\) AS cnt FROM messages WHERE conversation_id = \? AND sender_id/i.test(s)) {
      const [convId, senderId] = params;
      const cnt = store.messages.filter(
        (m) => m.conversation_id === convId && m.sender_id === senderId
      ).length;
      return [{ cnt }];
    }

    if (/^INSERT INTO messages/i.test(s)) {
      const [id, conversation_id, sender_id, body] = params;
      store.messages.push({ id, conversation_id, sender_id, body, created_at: new Date().toISOString() });
      return { affectedRows: 1 };
    }

    if (/^SELECT id, sender_id, body, created_at FROM messages WHERE conversation_id/i.test(s)) {
      return store.messages.filter((m) => m.conversation_id === params[0]);
    }

    // --- user + profile join (assertUserVerifiedAndAdult) ---
    if (/^SELECT u\.email_verified, p\.date_of_birth FROM users u JOIN profiles p/i.test(s)) {
      const user = store.users.find((u) => u.id === params[0]);
      if (!user) return [];
      const profile = store.profiles.find((p) => p.user_id === params[0]);
      if (!profile) return [];
      return [{ email_verified: user.email_verified, date_of_birth: profile.date_of_birth }];
    }

    // Default: return empty result
    return [];
  };
}

module.exports = { store, resetStore, buildMockQuery };
