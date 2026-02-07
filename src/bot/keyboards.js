import { InlineKeyboard } from 'grammy';

/**
 * Build an InlineKeyboard based on detected prompt type.
 *
 * callback_data format: "{session_hash}:{value}"
 * Total must be <= 64 bytes.
 */
export function buildKeyboard(promptInfo, sessionHash) {
  if (!promptInfo || promptInfo.type === 'none') {
    return undefined;
  }

  const kb = new InlineKeyboard();

  switch (promptInfo.type) {
    case 'yesno': {
      if (promptInfo.default === 'y') {
        kb.text('\u2705 Yes', `${sessionHash}:y`).text('\u274C No', `${sessionHash}:n`);
      } else {
        kb.text('\u274C No', `${sessionHash}:n`).text('\u2705 Yes', `${sessionHash}:y`);
      }
      break;
    }
    case 'choice': {
      const options = promptInfo.options || [];
      for (const opt of options) {
        const num = opt.replace(/\D/g, '');
        kb.text(num, `${sessionHash}:${num}`);
      }
      break;
    }
    case 'approval': {
      kb.text('\u2705 Allow', `${sessionHash}:allow`).text('\u274C Deny', `${sessionHash}:deny`);
      break;
    }
    case 'freeform':
    default: {
      kb.text('\u25B6\uFE0F Continue', `${sessionHash}:continue`).text(
        '\u23F9 Stop',
        `${sessionHash}:stop`,
      );
      break;
    }
  }

  return kb;
}

/**
 * Parse callback_data back into { hash, value }.
 */
export function parseCallbackData(data) {
  const colonIdx = data.indexOf(':');
  if (colonIdx === -1) return null;
  return {
    hash: data.slice(0, colonIdx),
    value: data.slice(colonIdx + 1),
  };
}
