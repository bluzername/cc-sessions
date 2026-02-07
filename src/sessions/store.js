import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';

/**
 * In-memory session store with JSON file persistence.
 * All reads from memory (fast). Writes debounced to disk.
 */
export class SessionStore {
  /** @param {string} filePath */
  constructor(filePath) {
    this.filePath = filePath;
    /** @type {Map<string, object>} session key → session */
    this.sessions = new Map();
    /** @type {Map<number, string>} topic_id → session key */
    this.topicIndex = new Map();
    /** @type {Map<string, string>} hash → session key */
    this.hashIndex = new Map();
    this._saveTimer = null;
    this._load();
  }

  /** Build composite key: machine + working_dir */
  static makeKey(machine, workingDir) {
    return `${machine}:${workingDir}`;
  }

  /** First 8 chars of sha256 of session key (for callback_data) */
  static makeHash(key) {
    return createHash('sha256').update(key).digest('hex').slice(0, 8);
  }

  /**
   * Create or update a session from a hook payload.
   * @returns {object} the upserted session
   */
  upsert(payload) {
    const key = SessionStore.makeKey(payload.machine, payload.working_dir);
    const hash = SessionStore.makeHash(key);
    const existing = this.sessions.get(key);

    const session = {
      key,
      hash,
      machine: payload.machine,
      project: payload.project,
      working_dir: payload.working_dir,
      topic_id: existing?.topic_id ?? null,
      status: 'idle',
      last_output: payload.output || '',
      last_event: payload.event,
      last_activity: payload.timestamp || new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString(),
      prompt_type: null,
      session_id: payload.session_id || null,
    };

    this.sessions.set(key, session);
    this.hashIndex.set(hash, key);
    if (session.topic_id) {
      this.topicIndex.set(session.topic_id, key);
    }

    this._scheduleSave();
    return session;
  }

  /** Update specific fields on a session */
  update(key, fields) {
    const session = this.sessions.get(key);
    if (!session) return null;
    Object.assign(session, fields);
    if (fields.topic_id) {
      this.topicIndex.set(fields.topic_id, key);
    }
    this._scheduleSave();
    return session;
  }

  /** Lookup session by Telegram Forum Topic ID */
  getByTopicId(topicId) {
    const key = this.topicIndex.get(topicId);
    return key ? this.sessions.get(key) : null;
  }

  /** Lookup session by callback hash */
  getByHash(hash) {
    const key = this.hashIndex.get(hash);
    return key ? this.sessions.get(key) : null;
  }

  /** Get session by key */
  get(key) {
    return this.sessions.get(key) || null;
  }

  /** All sessions */
  getAll() {
    return Array.from(this.sessions.values());
  }

  /** Active (non-archived) sessions */
  getActive() {
    return this.getAll().filter((s) => s.status !== 'archived');
  }

  /** Sessions inactive for more than `hours` */
  getStale(hours) {
    const cutoff = Date.now() - hours * 3600 * 1000;
    return this.getAll().filter((s) => {
      return s.status !== 'archived' && new Date(s.last_activity).getTime() < cutoff;
    });
  }

  /** Remove a session */
  remove(key) {
    const session = this.sessions.get(key);
    if (session) {
      if (session.topic_id) this.topicIndex.delete(session.topic_id);
      this.hashIndex.delete(session.hash);
      this.sessions.delete(key);
      this._scheduleSave();
    }
  }

  /** Save immediately (for graceful shutdown) */
  saveSync() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._save();
  }

  /** Stop the debounce timer */
  destroy() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._save();
    }, 5000);
  }

  _save() {
    try {
      const data = Object.fromEntries(this.sessions);
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to save session store:', err.message);
    }
  }

  _load() {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      for (const [key, session] of Object.entries(data)) {
        this.sessions.set(key, session);
        if (session.topic_id) {
          this.topicIndex.set(session.topic_id, key);
        }
        if (session.hash) {
          this.hashIndex.set(session.hash, key);
        }
      }
    } catch {
      // No existing store file — starting fresh
    }
  }
}
