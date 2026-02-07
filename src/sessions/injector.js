import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Sends user responses back into Claude Code sessions via tmux.
 */
export class Injector {
  constructor() {
    this._tmuxAvailable = null;
  }

  /**
   * Send text to a Claude Code session.
   * @param {object} session
   * @param {string} text
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async sendToSession(session, text) {
    // Check tmux availability
    if (this._tmuxAvailable === null) {
      this._tmuxAvailable = await this._checkTmux();
    }

    if (!this._tmuxAvailable) {
      return this._fallbackMessage(session, text);
    }

    // Find the tmux pane matching this session's working directory
    const pane = await this._findPane(session.working_dir);
    if (!pane) {
      return this._fallbackMessage(session, text);
    }

    try {
      await this._inject(pane, text);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: `\u26A0\uFE0F Injection failed: ${err.message}`,
      };
    }
  }

  async _checkTmux() {
    try {
      await execAsync('tmux list-sessions', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find a tmux pane whose current path matches the session working_dir.
   */
  async _findPane(workingDir) {
    try {
      const { stdout } = await execAsync(
        'tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index}:#{pane_current_path}"',
        { timeout: 3000 },
      );
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length < 3) continue;
        const panePath = parts.slice(2).join(':');
        if (panePath === workingDir || panePath.startsWith(workingDir + '/')) {
          return `${parts[0]}:${parts[1]}`;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Inject text into a tmux pane using send-keys.
   */
  async _inject(paneTarget, text) {
    // Escape single quotes for shell
    const escaped = text.replace(/'/g, "'\\''");
    const cmd = `tmux send-keys -t '${paneTarget}' '${escaped}' Enter`;
    await execAsync(cmd, { timeout: 5000 });
  }

  /**
   * Produce a fallback message with manual injection command.
   */
  _fallbackMessage(session, text) {
    const escaped = text.replace(/'/g, "'\\''");
    return {
      success: false,
      message: [
        `\u26A0\uFE0F Can't auto-inject \u2014 no tmux session found for <code>${session.working_dir}</code>.`,
        '',
        'Copy this command:',
        `<code>tmux send-keys -t SESSION '${escaped}' Enter</code>`,
      ].join('\n'),
    };
  }
}
