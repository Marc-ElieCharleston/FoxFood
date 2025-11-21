# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FoxFood** is a meal planning and delivery management application built for a chef (Emeric) to manage his weekly meal catalog and client orders. Clients can select up to 5 dishes per week, receive automated reminders, and request custom dishes. The admin can manage the dish catalog, review custom dish requests, and configure notification preferences.

## Development Commands

```bash
# Start development server (default: http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Architecture & Key Concepts

### Technology Stack
- **Next.js 16** (App Router) with React 19
- **NextAuth.js** for authentication (Google OAuth + Credentials)
- **Vercel Postgres** (Neon) via `@vercel/postgres`
- **Tailwind CSS 4** for styling
- **Resend** for email notifications
- **Vercel Cron** for scheduled tasks

### Database Layer (`lib/db.js`)

Uses `@vercel/postgres` with tagged template literals for queries:

```javascript
import { sql } from '@vercel/postgres'

// Direct queries with sql`` template
const result = await sql`SELECT * FROM users WHERE email = ${email}`

// Access results via result.rows
const user = result.rows[0]
```

**Important**: Always use parameterized queries with `${variable}` syntax - never concatenate strings directly.

### Authentication (`lib/auth.js`)

Dual authentication system:
- **Google OAuth**: Auto-creates accounts for new users with role='client'
- **Credentials**: Email/password with bcrypt hashing

Session data includes: `id`, `email`, `name`, `role`, `phone`

**Roles**:
- `admin`: Full access to `/admin/*` routes, dish management, custom dish approval
- `client`: Access to dish selection, settings, custom dish requests

### Notification System

Multi-channel (email + SMS) notification system with 4 core modules:

1. **`lib/notifications.js`**: Send functions for email (Resend) and SMS
   - `sendUserReminder()`: Reminder to users about upcoming delivery
   - `notifyAdminOnSelection()`: Notify admin when user completes selection
   - `notifyAdminMissingSelection()`: Alert admin about users without selections
   - `notifyAdminCustomDish()`: Notify admin of custom dish requests

2. **`lib/reminder-scheduler.js`**: Business logic for reminder processing
   - `processReminders()`: Main function called by cron job
   - Calculates days until delivery based on user's `delivery_day`
   - Checks user reminders (1, 3, 5 days before)
   - Triggers admin alerts based on `admin_settings.auto_reminder_days_before`

3. **Cron Job** (`/api/cron/send-reminders`):
   - Runs daily at 9:00 UTC (configured in `vercel.json`)
   - Secured with `CRON_SECRET` environment variable
   - Processes all user reminders automatically

4. **Real-time Notifications**:
   - Selection completed: Triggered in `/api/selections` POST
   - Custom dish request: Triggered in `/api/custom-dishes` POST

All notifications are logged to `notifications_log` table for audit trail.

### Database Schema

**Core Tables**:
- `users`: User accounts with role, delivery preferences
- `dishes`: Meal catalog (name, category, description, active status)
- `weekly_selections`: User's weekly dish selections (JSONB array of dish IDs)
- `user_reminders`: Multiple configurable reminders per user (days_before: 1, 3, or 5)
- `custom_dish_requests`: User requests with optional ingredient suggestions (JSONB)
- `admin_settings`: Admin notification preferences and auto-reminder configuration
- `notifications_log`: Audit log of all sent notifications

**Schema Files** (in `sql/` directory):
- `schema.sql`: Base schema (users, dishes, weekly_selections)
- `add_user_settings.sql`: User settings columns migration
- `add_notifications_system.sql`: Notification tables (user_reminders, custom_dish_requests, admin_settings, notifications_log)

### API Route Structure

**User Routes**:
- `/api/dishes`: GET (filter by active/category), POST (create), PUT (update), DELETE
- `/api/selections`: GET (current week), POST (upsert selection, triggers admin notification)
- `/api/settings`: GET/POST user reminder preferences
- `/api/custom-dishes`: GET (user's requests), POST (create request, triggers admin notification)

**Admin Routes** (`/api/admin/*`):
- `/api/admin/settings`: GET/POST admin notification preferences
- `/api/admin/custom-dishes`: GET (all requests, filter by status)
- `/api/admin/custom-dishes/[id]`: PUT (approve/reject), DELETE

**Cron Routes**:
- `/api/cron/send-reminders`: Protected by `CRON_SECRET`, calls `processReminders()`

### Page Structure

**User Pages**:
- `/`: Home page with dish selection, category filters, custom dish request button
- `/parametres`: Configure delivery day/time, multiple reminders (1, 3, 5 days), email/SMS preferences
- `/login`, `/register`: Authentication pages

**Admin Pages** (`/admin/*`):
- `/admin`: Dish catalog management (CRUD operations)
- `/admin/plats-personnalises`: Review custom dish requests, approve/reject/delete with notes
- `/admin/parametres`: Configure admin notification preferences and auto-reminder days

All admin pages have shared navigation bar to switch between sections.

### Weekly Selection Logic

Selections are tied to `week_start_date` (Monday of the week):

```javascript
// Calculate Monday of current week
const today = new Date()
const dayOfWeek = today.getDay()
const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
const monday = new Date(today.setDate(diff))
monday.setHours(0, 0, 0, 0)

// Upsert pattern
INSERT INTO weekly_selections (user_id, week_start_date, ...)
VALUES (...)
ON CONFLICT (user_id, week_start_date)
DO UPDATE SET ...
```

This ensures one selection per user per week.

### Reminder Day Calculation

Users configure `delivery_day` (French day name: "Lundi", "Mardi", etc.). The scheduler:

1. Converts day name to number (1=Monday, 7=Sunday)
2. Calculates days until next occurrence of that day
3. Checks if any user reminder matches that number of days
4. Verifies user hasn't made selection yet
5. Sends reminder via configured method(s)

See `lib/reminder-scheduler.js` for implementation details.

## Environment Variables

**Required**:
```bash
# Database
POSTGRES_URL=postgresql://...  # Neon/Vercel Postgres connection string

# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=random_secret_32_chars

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Notifications
RESEND_API_KEY=re_...  # For email notifications
FROM_EMAIL=noreply@your-domain.com

# Cron Security
CRON_SECRET=random_secret_for_cron_auth
```

**Optional** (for SMS):
```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+33...
```

Note: SMS functionality is currently simulated. Uncomment Twilio code in `lib/notifications.js` to enable.

## Important Patterns

### Client-Side State Management

Uses React hooks for state, no global state library. Example from home page:

```javascript
const [selectedDishes, setSelectedDishes] = useState([])
const MAX_DISHES = 5

const toggleDishSelection = (dishId) => {
  setSelectedDishes(prev => {
    if (prev.includes(dishId)) {
      return prev.filter(id => id !== dishId)
    } else if (prev.length < MAX_DISHES) {
      return [...prev, dishId]
    } else {
      toast.error(`Maximum ${MAX_DISHES} plats autorisés`)
      return prev
    }
  })
}
```

### Toast Notifications

Uses `sonner` library for user feedback:

```javascript
import { toast } from 'sonner'

// Success, error, info
toast.success('Sélection enregistrée!')
toast.error('Erreur lors de la sauvegarde')
```

### Protected Routes

Admin pages check role in `useEffect`:

```javascript
useEffect(() => {
  if (status === 'loading') return
  if (!session || session.user.role !== 'admin') {
    router.push('/')
  }
}, [session, status, router])
```

### API Error Handling

Standard pattern for all API routes:

```javascript
try {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ... route logic

  return NextResponse.json({ success: true, data })
} catch (error) {
  console.error('Error:', error)
  return NextResponse.json({ error: 'Error message' }, { status: 500 })
}
```

## Common Modifications

### Adding a New Dish Category

1. Update `category` enum in database (ALTER TYPE or CHECK constraint)
2. Add to `categoryLabels` object in pages using categories
3. Add corresponding color/emoji styling

### Adding a New Notification Type

1. Add function to `lib/notifications.js`
2. Add checkbox to `/admin/parametres` if admin-configurable
3. Add column to `admin_settings` if needed
4. Trigger from appropriate API route
5. Add to `processReminders()` if scheduled

### Modifying Reminder Days

Currently hardcoded to 1, 3, 5 days. To change:

1. Update CHECK constraint in `user_reminders` table
2. Update UI in `/parametres` page
3. Update form state structure in `page.jsx`

## Testing the System

**Manual Cron Test**:
```bash
curl -X GET "http://localhost:3000/api/cron/send-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Check Logs**: Vercel Dashboard → Functions → send-reminders → Logs

**Database Queries** (in Neon console):
```sql
-- Check user reminders
SELECT * FROM user_reminders WHERE user_id = 1;

-- Check notification logs
SELECT * FROM notifications_log ORDER BY sent_at DESC LIMIT 10;

-- Check pending custom dishes
SELECT * FROM custom_dish_requests WHERE status = 'pending';
```

## Deployment Notes

- Auto-deploys to Vercel on push to `main` branch
- Cron jobs configured in `vercel.json` (no additional setup needed)
- Set all environment variables in Vercel project settings
- Database migrations must be run manually in Neon console
- First deployment: Run all SQL files in order (schema.sql → add_user_settings.sql → add_notifications_system.sql)

## File Naming Conventions

- Pages: `page.jsx` (App Router convention)
- API routes: `route.js`
- Components: PascalCase (e.g., `Header.jsx`)
- Utilities: camelCase (e.g., `notifications.js`)
- SQL migrations: snake_case with descriptive names (e.g., `add_notifications_system.sql`)

## Additional Documentation

- **NOTIFICATIONS_SETUP.md**: Comprehensive guide to the notification system, configuration, architecture diagrams, and troubleshooting
- **sql/**: Database migration files with comments explaining schema changes
