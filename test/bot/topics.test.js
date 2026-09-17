import { describe, it, expect, afterEach } from 'vitest';
import { buildTopicName, clearTimers } from '../../src/bot/topics.js';

afterEach(() => {
  clearTimers();
});

describe('buildTopicName', () => {
  it('builds name with status emoji', () => {
    const name = buildTopicName({ status: 'active', project: 'my-app', machine: 'macbook' });
    expect(name).toContain('\u{1F7E2}');
    expect(name).toContain('my-app');
    expect(name).toContain('macbook');
  });

  it('uses yellow for idle', () => {
    const name = buildTopicName({ status: 'idle', project: 'app', machine: 'mac' });
    expect(name).toContain('\u{1F7E1}');
  });

  it('uses red for error', () => {
    const name = buildTopicName({ status: 'error', project: 'app', machine: 'mac' });
    expect(name).toContain('\u{1F534}');
  });

  it('uses check mark for completed', () => {
    const name = buildTopicName({ status: 'completed', project: 'app', machine: 'mac' });
    expect(name).toContain('\u2705');
  });

  it('uses black circle for archived', () => {
    const name = buildTopicName({ status: 'archived', project: 'app', machine: 'mac' });
    expect(name).toContain('\u26AB');
  });

  it('includes separator between project and machine', () => {
    const name = buildTopicName({ status: 'idle', project: 'proj', machine: 'host' });
    expect(name).toContain('\u00B7');
  });

  it('truncates long names to 128 chars', () => {
    const name = buildTopicName({
      status: 'idle',
      project: 'a'.repeat(100),
      machine: 'b'.repeat(100),
    });
    expect(name.length).toBeLessThanOrEqual(128);
    expect(name).toContain('...');
  });

  it('defaults to yellow emoji for unknown status', () => {
    const name = buildTopicName({ status: 'unknown', project: 'app', machine: 'mac' });
    expect(name).toContain('\u{1F7E1}');
  });
});

describe('buildTopicName with task', () => {
  it('appends the task label after the machine', () => {
    const name = buildTopicName({
      status: 'active',
      project: 'fw',
      machine: 'mac',
      task: 'Fix BLE overflow',
    });
    expect(name).toBe('\u{1F7E2} fw · mac · Fix BLE overflow');
  });

  it('omits the separator when there is no task', () => {
    const name = buildTopicName({ status: 'idle', project: 'fw', machine: 'mac', task: null });
    expect(name).toBe('\u{1F7E1} fw · mac');
  });

  it('still respects the 128 char limit with a long task', () => {
    const name = buildTopicName({
      status: 'idle',
      project: 'fw',
      machine: 'mac',
      task: 't'.repeat(200),
    });
    expect(name.length).toBeLessThanOrEqual(128);
  });
});
