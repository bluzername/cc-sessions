/**
 * Real Claude Code output samples for testing.
 */

// Y/n prompt (default yes)
export const YES_NO_DEFAULT_YES = `I've analyzed the code and found a potential buffer overflow in the BLE handler.

Do you want me to fix the BLE buffer overflow issue as well? [Y/n]`;

// Y/n prompt (default no)
export const YES_NO_DEFAULT_NO = `This will delete 47 test files and reset the database.

Are you sure you want to proceed? [y/N]`;

// Y/n with "proceed?" pattern
export const PROCEED_QUESTION = `I've prepared the following changes:
- Updated 3 files
- Added 2 new dependencies
- Modified the build configuration

Shall I proceed?`;

// Y/n with "continue?" pattern
export const CONTINUE_QUESTION = `The migration will affect 1,247 rows in the users table.
This operation cannot be undone.

Do you want to continue?`;

// Numbered choices
export const NUMBERED_CHOICES = `I found multiple potential fixes:

1. Add null check before accessing the property
2. Use optional chaining throughout the module
3. Refactor to use a Result type pattern

Which approach would you prefer?`;

// Approval pattern
export const TOOL_APPROVAL = `Claude wants to use the following tool:

Tool: Bash
Command: rm -rf node_modules && npm install

Do you want to allow or deny this tool use?`;

// Freeform question
export const FREEFORM_QUESTION = `I've implemented the basic authentication flow. The JWT tokens are configured
with a 24-hour expiry.

What should the refresh token expiry be?`;

// Completed task (informational)
export const COMPLETED_TASK = `Done! I've made the following changes:

1. Created src/auth/jwt.js with token generation and validation
2. Added middleware in src/middleware/auth.js
3. Updated 5 route files to use the new auth middleware
4. Added 12 unit tests (all passing)

All tests pass. The build succeeds.`;

// Long output with code blocks
export const LONG_OUTPUT_WITH_CODE = `I've refactored the database module. Here's what changed:

\`\`\`javascript
// Before
const db = require('./db');
db.query('SELECT * FROM users WHERE id = ' + userId);

// After
import { pool } from './db.js';
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
\`\`\`

The key improvements are:
- Migrated from CommonJS to ESM
- Added parameterized queries to prevent SQL injection
- Using connection pooling for better performance
- Added proper error handling with try/catch

There are 3 more files that need the same treatment.

Should I continue with the remaining files? [Y/n]`;

// Error output
export const ERROR_OUTPUT = `Error: ENOENT: no such file or directory, open '/Users/dev/project/src/missing.ts'

I encountered an error trying to read the file. The file might have been moved or deleted.

Would you like me to search for it in the project? [Y/n]`;

// Empty output
export const EMPTY_OUTPUT = '';

// ANSI-colored output
export const ANSI_OUTPUT = `\x1B[32m✓\x1B[0m All tests passed (47/47)
\x1B[33m⚠\x1B[0m 2 warnings about deprecated APIs
\x1B[31m✗\x1B[0m Build failed: TypeScript error in src/index.ts

Do you want me to fix the TypeScript errors? [Y/n]`;

// Output with special HTML chars
export const HTML_SPECIAL_CHARS = `The template uses <div class="container"> and handles
cases where value > threshold && count < max.

Updated the JSX template with proper escaping.

Continue?`;

// "Yes or no" phrasing
export const YES_OR_NO = `I can either add the feature to the existing module or create a new one.
Adding to existing is simpler but creates a larger file.

Should I add it to the existing module, yes or no?`;

// Allow/deny pattern
export const ALLOW_DENY = `The script wants to:
- Read environment variables
- Write to /tmp/output.log
- Execute shell commands

Allow or deny these permissions?`;
