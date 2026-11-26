const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

const attempts = new Map();

function isLocked(username) {
    const entry = attempts.get(username);
    if (!entry || !entry.lockedUntil) return false;
    if (Date.now() >= entry.lockedUntil) {
        attempts.delete(username);
        return false;
    }
    return true;
}

function recordFailure(username) {
    const entry = attempts.get(username) || { fails: 0, lockedUntil: 0 };
    entry.fails += 1;
    if (entry.fails >= MAX_FAILS) {
        entry.lockedUntil = Date.now() + LOCK_MS;
        entry.fails = 0;
    }
    attempts.set(username, entry);
}

function recordSuccess(username) {
    attempts.delete(username);
}

module.exports = { isLocked, recordFailure, recordSuccess };
