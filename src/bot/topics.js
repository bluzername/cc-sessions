/**
 * Manages the lifecycle of Telegram Forum Topics.
 * One session = one topic. Topics are reused for the same machine+project.
 */

const STATUS_EMOJI = {
  active: '\u{1F7E2}',
  idle: '\u{1F7E1}',
  error: '\u{1F534}',
  completed: '\u2705',
  archived: '\u26AB',
};

// Telegram's fixed icon_color palette
const ICON_COLORS = {
  active: 0x8eee98, // green
  idle: 0xffd67e, // yellow
  error: 0xfb6f5f, // red
  completed: 0x6fb9f0, // blue
  archived: 0xcb86db, // purple
};

// Debounce: max 1 rename per topic per 30 seconds
const renameTimers = new Map();
const RENAME_DEBOUNCE_MS = 30000;

/**
 * Create a new Forum Topic for a session.
 * @param {import('grammy').Api} api
 * @param {number} groupId
 * @param {object} session
 * @returns {Promise<number>} topic message_thread_id
 */
export async function createTopic(api, groupId, session) {
  const name = buildTopicName(session);
  const color = ICON_COLORS[session.status] || ICON_COLORS.idle;
  const result = await api.createForumTopic(groupId, name, { icon_color: color });
  return result.message_thread_id;
}

/**
 * Rename topic to reflect current session status. Debounced.
 */
export async function updateTopicStatus(api, groupId, topicId, session) {
  const timerKey = `${groupId}:${topicId}`;

  // Clear any pending rename
  if (renameTimers.has(timerKey)) {
    clearTimeout(renameTimers.get(timerKey));
  }

  // Debounce: delay the rename
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      renameTimers.delete(timerKey);
      try {
        const name = buildTopicName(session);
        await api.editForumTopic(groupId, topicId, { name });
      } catch (err) {
        // Topic may have been deleted or we lack permissions
        console.error(`Failed to rename topic ${topicId}:`, err.message);
      }
      resolve();
    }, RENAME_DEBOUNCE_MS);
    renameTimers.set(timerKey, timer);
  });
}

/**
 * Immediately rename a topic (no debounce). Used for tests and critical updates.
 */
export async function renameTopic(api, groupId, topicId, session) {
  const name = buildTopicName(session);
  await api.editForumTopic(groupId, topicId, { name });
}

/**
 * Close (archive) a topic.
 */
export async function closeTopic(api, groupId, topicId) {
  try {
    await api.closeForumTopic(groupId, topicId);
  } catch (err) {
    if (!err.message?.includes('TOPIC_NOT_MODIFIED')) {
      throw err;
    }
  }
}

/**
 * Reopen a closed topic.
 */
export async function reopenTopic(api, groupId, topicId) {
  try {
    await api.reopenForumTopic(groupId, topicId);
  } catch (err) {
    if (!err.message?.includes('TOPIC_NOT_MODIFIED')) {
      throw err;
    }
  }
}

const TOPIC_NAME_MAX = 128; // Telegram limit
const SEPARATOR = ' \u00B7 ';

/**
 * Build topic name from session data.
 * Format: "{emoji} {project} · {machine}" plus " · {task}" when a task label is set.
 */
export function buildTopicName(session) {
  const emoji = STATUS_EMOJI[session.status] || '\u{1F7E1}';
  const parts = [session.project, session.machine, session.task].filter(Boolean);
  const name = `${emoji} ${parts.join(SEPARATOR)}`;
  return name.length > TOPIC_NAME_MAX ? name.slice(0, TOPIC_NAME_MAX - 3) + '...' : name;
}

/**
 * Clear all debounce timers (for cleanup/testing).
 */
export function clearTimers() {
  for (const timer of renameTimers.values()) {
    clearTimeout(timer);
  }
  renameTimers.clear();
}
