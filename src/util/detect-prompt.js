/**
 * Analyze Claude Code output to determine what type of response is expected.
 * Drives which inline keyboard buttons to show.
 *
 * Returns: { type: string, default?: string, options?: string[] }
 */

export function detectPrompt(text) {
  if (!text) return { type: 'none' };

  // Check last 500 chars for prompt patterns
  const tail = text.slice(-500);

  // Y/n patterns (case-sensitive: capital letter = default)
  if (/\[Y\/n\]/.test(tail) || /\(Y\/n\)/.test(tail)) {
    return { type: 'yesno', default: 'y' };
  }
  if (/\[y\/N\]/.test(tail) || /\(y\/N\)/.test(tail)) {
    return { type: 'yesno', default: 'n' };
  }

  // Generic yes/no question patterns
  if (/\bproceed\?\s*$/im.test(tail)) {
    return { type: 'yesno', default: 'y' };
  }
  if (/\bcontinue\?\s*$/im.test(tail)) {
    return { type: 'yesno', default: 'y' };
  }
  if (/\byes or no\b/i.test(tail)) {
    return { type: 'yesno', default: 'y' };
  }

  // Numbered choice patterns (look for 2+ numbered items near the end)
  // Only trigger if the numbered items appear in the last 300 chars
  // to avoid false positives on completed task summaries
  const tailShort = text.slice(-300);
  const choiceMatches = tailShort.match(/^\s*([1-9])\.\s+/gm);
  if (choiceMatches && choiceMatches.length >= 2) {
    // Verify this looks like a choice prompt (ends with a question or has no conclusion after)
    const afterLast = tailShort.slice(
      tailShort.lastIndexOf(choiceMatches[choiceMatches.length - 1]),
    );
    if (!/\ball\b.*\bpass\b/i.test(afterLast) && !/\bdone\b/i.test(afterLast)) {
      const options = choiceMatches.map((m) => m.trim().replace(/\.\s+$/, ''));
      return { type: 'choice', options };
    }
  }

  // Approval patterns (tool use, permissions)
  if (/\ballow\b.*\bdeny\b/i.test(tail) || /\bdeny\b.*\ballow\b/i.test(tail)) {
    return { type: 'approval' };
  }
  if (/\btool use\b/i.test(tail) && /\bapprove\b|\ballow\b|\bpermit\b/i.test(tail)) {
    return { type: 'approval' };
  }

  // If we have a question mark near the end, it's likely freeform
  if (/\?\s*$/.test(tail.trim())) {
    return { type: 'freeform' };
  }

  // Default: since hook fires on Stop, Claude has stopped.
  // If no prompt pattern detected, treat as freeform (user can still respond)
  return { type: 'freeform' };
}
