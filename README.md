# Mr. Snowman 2.0 - Technical Specifications

## 1. System Architecture

The system follows a decoupled 3-tier architecture:

*   **Frontend**: Single Page Application (SPA).
    *   **Tech**: React (CDN), TailwindCSS (CDN), Vanilla JS (ES6 modules).
    *   **Hosting**: Static serving (GitHub Pages compatible).
    *   **API Layer**: `api.js` handles JWT injection and centralized error handling.
*   **Backend**: REST API & Background Workers.
    *   **Tech**: Node.js (v18+), Express.
    *   **Hosting**: Render / Docker compatible.
    *   **Security**: CORS whitelist, Helmet headers (implied), Rate limiting.
*   **Database**: Relational Database.
    *   **Tech**: PostgreSQL (Supabase).
    *   **Access**: Row Level Security (RLS) enabled for all user tables.

## 2. Technology Stack

*   **Runtime**: Node.js
*   **Database**: PostgreSQL 15+ (Supabase managed)
*   **Key Libraries**:
    *   `express`: Web server framework.
    *   `node-imap`: Low-level IMAP client for connection management.
    *   `mailparser`: MIME parsing for incoming emails.
    *   `nodemailer`: SMTP transport management.
    *   `node-cron`: Task scheduling.
    *   `@supabase/supabase-js`: Database client.

## 3. Core Process Specifications

### A. Campaign Execution Engine (`campaignExecutor.js`)
*   **Trigger**: Cron schedule (Every 5 minutes) or Manual API trigger.
*   **Concurrency**: Uses optimistic locking (`status = 'processing'`) to support multiple worker instances without race conditions.
*   **Execution Flow**:
    1.  **Identification**: Selects contacts with `status='in_progress'`, `campaign_status='running'`, and `next_send_time <= NOW()`.
    2.  **Validation**: Checks User Send Schedule (Timezone aware) and Account Daily Limits.
    3.  **Step Execution**:
        *   **Email**: Personalizes content (Liquid-like syntax), selects Sending Account (Round-robin if multiple accounts attached), sends via SMTP, appends tracking pixel.
        *   **Wait**: Calculates delta using `wait_days`, `wait_hours`, `wait_minutes`. Updates `next_send_time`.
        *   **Condition**: Queries `email_events` for specific interactions (Open/Click/Reply). Routes contact to `yes` or `no` branch path.

### B. Reply Detection System (`imapMonitor.js`)
*   **Mechanism**: Real-time Persistent Connections (IDLE).
*   **Logic**:
    1.  Maintains active IMAP connections for all `is_active` accounts.
    2.  Listens for `mail` event (new message arrival).
    3.  Fetches headers and body structure.
    4.  **Attribution**:
        *   Checks `In-Reply-To` and `References` headers.
        *   Matches sender email to `contacts` table.
        *   Finds most recent `sent` event for that contact to identify the specific Campaign.
    5.  **Action**: Updates `campaign_contacts` status to `replied` and logs `replied` event.
*   **Zoho Specifics**: Implements regional host resolution and fallback logic for Zoho data centers.

### C. Email Sending & Tracking (`emailService.js`)
*   **Transport**: Reuseable Nodemailer/SMTP transports with connection pooling.
*   **Tracking**:
    *   **Opens**: Injects 1x1 transparent PNG pixel.
    *   **Clicks**: Rewrites links to tracking endpoint (if configured).
*   **Rate Limiting**: Checks `emails_sent_today` vs `daily_send_limit` before attempting send.

## 4. Database Schema (Key Entities)

*   `user_profiles`: Extended auth data.
*   `email_accounts`: Stores SMTP/IMAP credentials. **Passwords are AES-256-CBC encrypted**.
*   `campaigns`: Configuration, schedules, status.
*   `campaign_steps`: Linked-list implementation of workflow. Support branching (`parent_id`, `branch`).
*   `campaign_contacts`: State machine for each contact (Current Step, Status, Next Send Time).
*   `inbox_messages`: Local cache of incoming emails for UI display (GDPR minimization compatible).

## 5. Security Specifications

*   **Authentication**: Supabase Auth (JWT).
*   **Data Isolation**: RLS policies enforce `user_id` segregation at the database engine level.
*   **Credential Storage**:
    *   IMAP/SMTP passwords stored as `iv:encrypted_content` strings.
    *   Key derived from `ENCRYPTION_KEY` env var. (Must be 32 bytes/64 hex chars).

## 6. Configuration Reference (.env)

| Variable | Description |
|----------|-------------|
| `PORT` | API Server port (default 3001) |
| `SUPABASE_URL` | Application database URL |
| `SUPABASE_SERVICE_KEY` | Admin role key (for workers) |
| `ENCRYPTION_KEY` | 64-char Hex key for AES-256 |
| `FRONTEND_URL` | CORS allow-list origin |
