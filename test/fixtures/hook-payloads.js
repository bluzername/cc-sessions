/**
 * Sample hook payloads for testing.
 */

export const BASIC_STOP = {
  event: 'stop',
  session_id: 'abc123',
  machine: 'macbook-pro',
  project: 'vantage-firmware',
  working_dir: '/Users/evy/vantage-firmware',
  timestamp: '2026-02-07T11:15:00Z',
  output: 'Do you want me to fix this? [Y/n]',
  secret: 'test-secret-123',
};

export const NOTIFICATION_IDLE = {
  event: 'notification',
  session_id: 'def456',
  machine: 'linux-workstation',
  project: 'ml-models',
  working_dir: '/home/dev/ml-models',
  timestamp: '2026-02-07T12:30:00Z',
  output: 'Training complete. Review results?',
  secret: 'test-secret-123',
};

export const DIFFERENT_MACHINE = {
  event: 'stop',
  session_id: 'ghi789',
  machine: 'build-server',
  project: 'ios-app',
  working_dir: '/var/builds/ios-app',
  timestamp: '2026-02-07T13:00:00Z',
  output: 'Build succeeded. Deploy to TestFlight? [Y/n]',
  secret: 'test-secret-123',
};

export const LONG_OUTPUT_PAYLOAD = {
  event: 'stop',
  session_id: 'jkl012',
  machine: 'macbook-pro',
  project: 'patent-doc',
  working_dir: '/Users/evy/patent-doc',
  timestamp: '2026-02-07T14:00:00Z',
  output: 'x'.repeat(5000),
  secret: 'test-secret-123',
};

export const MALFORMED_PAYLOAD = 'this is not JSON';

export const WRONG_SECRET = {
  ...BASIC_STOP,
  secret: 'wrong-secret',
};

export const NO_OUTPUT = {
  event: 'stop',
  session_id: 'mno345',
  machine: 'macbook-pro',
  project: 'webapp',
  working_dir: '/Users/evy/webapp',
  timestamp: '2026-02-07T15:00:00Z',
  output: '',
  secret: 'test-secret-123',
};
