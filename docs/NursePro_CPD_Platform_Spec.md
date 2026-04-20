# NursePro CPD — Full Platform Technical Specification

> A multi-channel Continuing Professional Development platform for Zimbabwean nurses and healthcare professionals. Competing directly with MyCPDZW through superior offline capability, WhatsApp-native learning, AI-assisted education, and a robust role-based management system.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Channels & Access Points](#3-channels--access-points)
4. [Core Feature Modules](#4-core-feature-modules)
5. [Course Creation & Content Management](#5-course-creation--content-management)
6. [Media & Asset Management](#6-media--asset-management)
7. [AI Integration](#7-ai-integration)
8. [Offline-First Strategy](#8-offline-first-strategy)
9. [WhatsApp Bot Architecture](#9-whatsapp-bot-architecture)
10. [Payments & Subscriptions](#10-payments--subscriptions)
11. [NCZ Integration](#11-ncz-integration)
12. [Tech Stack](#12-tech-stack)
13. [Project Structure](#13-project-structure)
14. [Dependencies](#14-dependencies)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Development Roadmap](#16-development-roadmap)

---

## 1. Platform Overview

NursePro CPD is a three-channel healthcare professional development platform built specifically for the Zimbabwean context. It delivers CPD content via a web application, an offline-capable mobile app, and a WhatsApp bot — ensuring that every nurse can earn required CPD points regardless of device quality, internet reliability, or data budget.

**Core problems solved vs. MyCPDZW:**

| Problem with MyCPDZW | NursePro Solution |
|---|---|
| No offline support | Full offline-first mobile app (SQLite + background sync) |
| No WhatsApp learning | WhatsApp bot with AI tutor, quiz engine, and point crediting |
| Hard paywall from day one | Freemium: free 12 points/year via WhatsApp, paid for full library |
| Manual NCZ point submission | Automated NCZ sync adapter — points submitted automatically |
| No AI or adaptive content | Claude-powered adaptive learning paths and clinical Q&A |
| Basic UI, poor UX | Modern, accessible, mobile-first design |
| No role-based content management | Full RBAC: Admin, Content Manager, NCZ Officer, Learner |

---

## 2. User Roles & Permissions

The platform operates on a strict Role-Based Access Control (RBAC) model with four defined roles. Permissions are enforced at the API level (middleware) and reflected in each interface.

---

### 2.1 System Administrator (Super Admin)

**The sole final authority on the entire platform.** This role has unrestricted access to every part of the system with no override possible by any other role.

**Capabilities:**

- Full access to all platform data, settings, and configurations
- Create, suspend, reactivate, or permanently delete any user account regardless of role
- Assign and revoke all roles including Content Manager and NCZ Officer
- Override or manually adjust CPD points for any learner
- Approve or reject Content Manager accounts before they can publish
- Access and export all platform analytics, financial reports, audit logs
- Configure CPD rules: points per cadre, renewal cycles, passing thresholds
- Manage the NCZ sync adapter: credentials, sync frequency, field mappings
- Control payment gateway configurations (Paynow, Stripe keys, pricing tiers)
- Manage media storage settings, file size limits, allowed formats
- Toggle any platform feature on/off (e.g. disable WhatsApp bot, put platform in maintenance mode)
- View all audit logs: who did what, when, from which IP
- Manage system-wide announcements and notifications
- Full access to AI/Claude API configuration and prompt management
- Approve or block course submissions from Content Managers before they go live

**Interface:** Dedicated `/admin` portal — separate from the main learner interface.

---

### 2.2 Content Manager (Course Creator)

A verified healthcare educator, institution, or content partner responsible for creating and maintaining CPD courses. Must be approved by the System Administrator before they can publish content.

**Capabilities:**

- Create, edit, publish, unpublish, and archive their own courses
- Upload and manage all media for their courses: videos, images, PDFs, audio, thumbnails
- Build quizzes, set passing scores, assign CPD point values to activities
- Set course metadata: title, description, cadre targeting (nurse/midwife/pharmacist etc.), specialty area, difficulty level
- View analytics on their own courses: enrolments, completion rates, pass rates, average score
- Manage their own Content Manager profile and bio
- Submit courses for Admin review before going live (if platform is set to require approval)
- Respond to learner reviews/ratings on their courses
- Schedule course publication and expiry dates
- Create course bundles (series of related modules)
- View earnings/revenue if on a revenue-share model

**Cannot:**

- Access other Content Managers' courses or data
- Adjust CPD point rules system-wide
- Access learner personal data beyond aggregate analytics
- Publish a course without Admin approval (if approval workflow is enabled)
- Access financial or payment system data
- Access the NCZ sync system

**Interface:** Dedicated `/creator` portal with a course-builder dashboard.

---

### 2.3 NCZ Officer (Nurses Council of Zimbabwe)

A read-focused role for authorised Nurses Council of Zimbabwe staff. Provides full visibility into CPD compliance data without the ability to modify learner records or platform content.

**Capabilities:**

- View the CPD points dashboard for all registered nurses/midwives on the platform
- Search and filter learners by: registration number, name, cadre, institution, district, province
- View individual learner CPD history: courses completed, points earned, dates, certificates issued
- Download CPD compliance reports in CSV and PDF format (individual or bulk)
- View aggregated statistics: compliance rates by institution, district, cadre, cycle year
- Verify certificates by certificate ID (for audit purposes)
- Receive automated sync reports when points are submitted to NCZ systems
- Flag learners for follow-up (internal NCZ note — does not affect learner's platform account)
- View course catalogue and course content metadata (not learner quiz answers)

**Cannot:**

- Modify any learner's CPD points
- Edit, create, or delete courses
- Access payment or subscription data
- Access platform system settings
- Create or manage other user accounts

**Interface:** Dedicated `/ncz` portal — clean, report-focused, with prominent search and export tools.

---

### 2.4 Learner (Nurse / Midwife / Healthcare Professional)

The primary end-user of the platform. A registered nurse, midwife, pharmacist, or other healthcare professional earning CPD points toward license renewal.

**Capabilities:**

- Register using NCZ registration number, email, and password
- Browse and enrol in available CPD courses
- Complete course modules (video, reading, audio, interactive)
- Take and retake quizzes (within attempt limits set by Content Manager)
- Earn CPD points automatically upon passing assessments
- Download certificates for completed activities
- View personal CPD dashboard: points earned, points needed, renewal deadline
- Download full CPD report for manual NCZ submission (PDF)
- Manage subscription: view plan, upgrade, payment history
- Set learning preferences for AI-powered recommendations
- Access WhatsApp bot from the same account (linked by phone number)
- Rate and review courses
- Access offline content packs (downloaded on Wi-Fi, usable without data)

**Interface:** Main web app and mobile app learner dashboard.

---

### 2.5 Role Permission Matrix

| Feature | System Admin | Content Manager | NCZ Officer | Learner |
|---|:---:|:---:|:---:|:---:|
| Create/edit courses | ✅ (all) | ✅ (own) | ❌ | ❌ |
| Upload media | ✅ | ✅ | ❌ | ❌ |
| View all learner data | ✅ | ❌ | ✅ (read) | ❌ (own only) |
| Adjust CPD points | ✅ | ❌ | ❌ | ❌ |
| Export NCZ reports | ✅ | ❌ | ✅ | ❌ |
| Manage user accounts | ✅ | ❌ | ❌ | ❌ |
| Configure payment gateways | ✅ | ❌ | ❌ | ❌ |
| View own course analytics | ✅ | ✅ | ❌ | ❌ |
| View platform-wide analytics | ✅ | ❌ | Partial | ❌ |
| Configure AI/Claude settings | ✅ | ❌ | ❌ | ❌ |
| Access NCZ sync adapter | ✅ | ❌ | View logs | ❌ |
| Earn CPD points | ❌ | ❌ | ❌ | ✅ |
| Download personal certificate | ❌ | ❌ | ❌ | ✅ |

---

## 3. Channels & Access Points

### 3.1 Web Application (`/` — main site)

A Progressive Web App (PWA) built with React + Vite. Works in any browser, installable on desktop or mobile. Contains all four role-specific interfaces behind authentication.

- **Learner dashboard** — course browsing, progress, points, certificates, offline pack downloads
- **Creator portal** (`/creator`) — full course builder, media uploader, analytics
- **NCZ portal** (`/ncz`) — compliance reports, learner search, export tools
- **Admin portal** (`/admin`) — system configuration, user management, approvals, audit logs

### 3.2 Mobile Application (iOS & Android)

Built with React Native + Expo. Installable from the App Store and Google Play. Key differentiator: **offline-first architecture** — content downloaded on Wi-Fi works fully without internet.

- Learner-focused (no course creation or admin on mobile)
- Offline content packs: download full modules on Wi-Fi, complete offline, sync points on reconnect
- Push notifications for renewal reminders, new course alerts, point milestones
- Biometric login (fingerprint / face ID)

### 3.3 WhatsApp Bot

Accessible at a dedicated WhatsApp Business number. No app install required. Works on any phone that supports WhatsApp — including very basic Android devices.

- Available 24/7, responds in seconds
- Menu-driven learning flow (numbered replies)
- AI-powered clinical Q&A (Claude)
- Micro-quizzes with automatic point crediting
- Subscription and payment management
- Renewal reminders and point balance queries
- Falls back to SMS via Twilio if WhatsApp is unavailable

---

## 4. Core Feature Modules

### 4.1 CPD Points Engine

The authoritative system for CPD point calculation, validation, and record-keeping. Rules are configurable by the System Administrator.

- Points assigned per activity type (video watch, quiz pass, reading, webinar attendance)
- Configurable by professional cadre (nurse = 12 pts/year, different threshold for pharmacist etc.)
- Points only credited on successful quiz completion (configurable pass mark)
- Partial credit support: points scale with quiz score (optional, Admin-configurable)
- Annual cycle reset with rollover protection (no carryover to next year)
- Audit trail: every point credit or debit logged with timestamp, activity ID, and score
- Manual override by Admin only (logged and flagged in audit trail)

### 4.2 Certificate Generation

- PDF certificates auto-generated on reaching point thresholds
- Unique certificate ID (UUID) — verifiable by NCZ Officers via search
- Certificate includes: learner name, registration number, points earned, period, courses completed, platform signature
- Bulk certificate download (PDF zip) for annual renewal submission
- QR code on certificate links to verification page

### 4.3 Learning Engine

- SCORM 1.2 / SCORM 2004 compatible (import existing eLearning packages)
- Native video player with progress tracking (completion % tracked per module)
- Quiz engine: multiple choice, true/false, short answer, image-based questions
- Configurable attempt limits, time limits, randomised question order
- Prerequisite module chains (must complete Module A before Module B unlocks)
- Completion status: not started / in progress / completed / passed / failed

### 4.4 Notifications & Reminders

- Push notifications (mobile app)
- WhatsApp reminders (via bot)
- Email notifications (Nodemailer)
- Automated renewal reminder schedule: 90 days, 60 days, 30 days, 7 days before deadline
- AI-personalised reminder messages based on points gap and deadline proximity

### 4.5 Analytics Dashboard

- **Admin view:** total learners, active subscriptions, revenue, course completion rates, points issued, NCZ sync status
- **Creator view:** enrolments, completion rates, quiz scores, ratings, revenue share
- **NCZ view:** compliance rates by institution/district/cadre, export to CSV/PDF
- Charts: monthly active learners, points distributed over time, popular courses

---

## 5. Course Creation & Content Management

### 5.1 Course Builder (Creator Portal)

A drag-and-drop course builder accessible to approved Content Managers via `/creator`.

**Course structure:**

```
Course
├── Thumbnail image (required)
├── Promo video (optional)
├── Description and metadata
├── Modules (ordered list)
│   ├── Module 1
│   │   ├── Content sections (video / reading / audio / interactive)
│   │   └── End-of-module quiz
│   ├── Module 2
│   │   └── ...
│   └── Final assessment (required for point crediting)
└── Completion criteria (pass mark, min modules completed)
```

**Course metadata fields:**

| Field | Type | Notes |
|---|---|---|
| Title | Text | Max 100 chars |
| Subtitle | Text | Max 200 chars |
| Thumbnail | Image upload | JPG/PNG, min 800×450px, max 2MB |
| Promo video | Video upload or URL | MP4 or YouTube/Vimeo embed |
| Description | Rich text | Full HTML editor |
| CPD category | Select | Clinical / Management / Ethics / Research |
| Target cadre | Multi-select | Nurse / Midwife / Pharmacist / Clinical Officer / Lab Tech / All |
| Specialty area | Select | Paediatrics / Obstetrics / ICU / Primary Care / etc. |
| Difficulty | Select | Foundation / Intermediate / Advanced |
| Language | Select | English / Shona / Ndebele |
| CPD points value | Number | Set by creator, approved by Admin |
| Estimated duration | Number | Minutes |
| Accreditation body | Text | NCZ / MCAZ / etc. |
| Tags | Multi-tag | For search and recommendations |
| Visibility | Select | Draft / Under Review / Published / Archived |
| Expiry date | Date | Optional — auto-unpublishes on this date |
| Price override | Number | Optional override of platform default pricing |

### 5.2 Module Builder

Each module within a course can contain any combination of content sections:

- **Video section:** upload MP4 (up to 2GB) or embed from YouTube/Vimeo. Completion = 80% watch time.
- **Reading section:** rich text editor with image support, PDF embed, or downloadable resource file.
- **Audio section:** MP3/WAV podcast-style lessons (useful for WhatsApp offline packs).
- **Interactive section:** HTML5 embed (for SCORM packages or third-party interactive content).
- **Quiz section:** configurable question types, marks, pass threshold, attempt limits.

### 5.3 Quiz Builder

- Question types: multiple choice (single/multi-answer), true/false, matching, image-based MCQ
- Question bank: store questions separately and randomise selection per attempt
- Question metadata: difficulty tag, topic tag, reference source
- Import questions from CSV
- AI question generation: provide a document or topic and Claude generates draft questions for creator review (must be reviewed and approved before publishing)
- Configurable: pass mark, attempt limit, time limit, show correct answers after submission

### 5.4 Publishing Workflow

```
Creator creates course (Draft)
        ↓
Creator submits for review
        ↓
Admin receives notification → reviews content, quiz, media, metadata
        ↓
Admin approves → course goes Live   OR   Admin rejects with comments → back to Creator
```

If the System Administrator disables the review workflow (e.g. for trusted creators), creators can publish directly.

---

## 6. Media & Asset Management

All media is stored in AWS S3 (or compatible object storage such as Cloudflare R2 for cost efficiency).

### 6.1 Supported Media Types

| Type | Formats | Max Size | Use case |
|---|---|---|---|
| Thumbnail image | JPG, PNG, WebP | 2 MB | Course and module thumbnails |
| Promo image | JPG, PNG, WebP | 5 MB | Course banner, creator profile |
| Video | MP4 (H.264) | 2 GB | Course content, promo video |
| Audio | MP3, WAV, OGG | 200 MB | Podcast-style lessons, WhatsApp audio messages |
| Document | PDF | 50 MB | Reading materials, clinical guidelines, EDLIZ |
| Presentation | PPTX, PDF | 50 MB | Slide-based lessons |
| SCORM package | ZIP | 500 MB | Imported eLearning packages |
| Certificate template | PDF | 2 MB | Admin-managed certificate design |
| Profile photo | JPG, PNG | 1 MB | User and creator profile pictures |

### 6.2 Media Processing Pipeline

On upload, media goes through a processing queue (Bull + Redis):

- **Images:** auto-resized to multiple breakpoints (thumbnail 400×225, medium 800×450, full 1920×1080), converted to WebP for web delivery
- **Videos:** transcoded via FFmpeg to multiple bitrates (1080p, 720p, 480p, 360p) for adaptive streaming. Low-bandwidth version (360p) automatically included in offline packs
- **Audio:** normalised, converted to MP3 128kbps for streaming, compressed further for WhatsApp delivery
- **Documents:** preview thumbnails generated for PDFs, text extracted for search indexing

### 6.3 Offline Content Packs

Content Managers can mark modules as "offline-ready." The system bundles the offline assets (compressed video, audio, PDFs) into a downloadable ZIP pack per course. Learners download the pack on Wi-Fi; the mobile app unpacks it to local SQLite + filesystem storage.

### 6.4 CDN Delivery

All media served through a CDN (Cloudflare) for fast delivery across Zimbabwe and the region. Signed URLs prevent unauthorised access to paid content.

---

## 7. AI Integration

AI is used only where it provides genuine value. All AI features use the Anthropic Claude API.

### 7.1 WhatsApp AI Tutor

The most important AI application. When a learner messages the WhatsApp bot with a clinical question (e.g. "what is the dose of amoxicillin for a child under 5?"), Claude responds with an evidence-based, EDLIZ-aligned answer in plain language. The tutor:

- Is constrained by a system prompt to healthcare and CPD topics only
- References Zimbabwe-specific clinical guidelines (EDLIZ, MOHCC protocols)
- Declines to answer questions outside its scope (e.g. general chat)
- Keeps responses short enough to read comfortably in WhatsApp (under 300 words)
- Follows up with a relevant quiz question to earn micro-points

### 7.2 Adaptive Learning Recommendations

After a learner completes 3 or more courses, the AI analyses their performance data and specialty tag history to recommend what to study next. Input data: completed courses, quiz scores by topic, cadre, stated specialty, upcoming renewal deadline. Output: ordered list of recommended courses with explanations.

### 7.3 AI Question Generation

Content Managers can paste a block of text (e.g. a section of a clinical guideline) and request draft quiz questions. Claude generates multiple choice questions with correct answers and distractors. These are draft only — the creator must review, edit, and approve each question before it enters the question bank. This accelerates course creation without removing human quality control.

### 7.4 Smart Renewal Reminders

Instead of generic "you have X days left" messages, the AI drafts personalised reminder messages based on: current points gap, courses the learner has started but not finished, how many days until deadline, and preferred contact channel. Sent via WhatsApp, push notification, or email depending on learner preference.

### 7.5 AI Constraints & Safety

- All AI calls use a tightly scoped system prompt — no free-form general AI assistant
- Claude API responses are cached in Redis for 24 hours for identical questions (cost reduction)
- Usage monitored: unusual volume triggers alert to Admin
- Learners can flag AI responses as inaccurate — flagged responses reviewed by Admin

---

## 8. Offline-First Strategy

Addressing the reality of unreliable internet and load-shedding in Zimbabwe.

### 8.1 Mobile App (React Native)

- **SQLite via expo-sqlite:** all course metadata, progress, quiz state, and pending point credits stored locally
- **expo-file-system:** downloaded media files (video, audio, PDFs) stored in device filesystem
- **Background sync (expo-background-fetch):** when connectivity detected, sync queue is flushed — pending points submitted to backend, new content checked
- **Conflict resolution:** backend is authoritative for points; local state is merged on sync
- **Sync indicator:** learner always sees their connection and sync status ("3 activities pending sync")

### 8.2 Web App (PWA)

- **Service Worker (Workbox):** caches app shell, static assets, and recently accessed course content
- **IndexedDB (idb library):** stores quiz state and pending point submissions
- **Background Sync API:** queued form submissions (quiz answers) automatically retry when online
- **Offline indicator:** clear UI banner when running in offline mode

### 8.3 WhatsApp Bot — Low-Data Design

- All bot responses are text-only by default (no images, no links unless essential)
- Lessons chunked to under 160 characters per message where possible (SMS-friendly)
- Audio lesson delivery: MP3 compressed to under 500KB for WhatsApp audio message
- No video delivery via WhatsApp (too heavy) — audio + transcript instead
- Learner can type `"offline pack"` to receive a WhatsApp message with a download link to the course offline pack (for when they have Wi-Fi access later)

---

## 9. WhatsApp Bot Architecture

### 9.1 Technology

- **WhatsApp Business API** via Twilio (primary) or 360dialog (alternative)
- **Webhook receiver:** Express.js endpoint receives all incoming messages
- **Session manager:** Redis stores conversation state per phone number (TTL: 24 hours inactivity)
- **Bot router:** parses incoming message, determines user intent, routes to appropriate handler
- **AI Tutor:** Anthropic Claude API for clinical Q&A
- **Quiz engine:** stateful multi-turn quiz flow managed in Redis session

### 9.2 Conversation Flow

```
Incoming message
      ↓
Auth check (is this number registered?)
      ↓ YES                    ↓ NO
Main menu              Registration prompt
  1. Learn                     ↓
  2. Take quiz          Guide to web registration
  3. My points         (or mini registration via bot)
  4. Ask a question
  5. Subscribe / pay
  6. Help
      ↓
Route to handler
```

### 9.3 Bot Commands Reference

| Command / Reply | Action |
|---|---|
| `Hi` / `Hello` / `Menu` | Show main menu |
| `1` (after menu) | Start today's lesson (next uncompleted micro-module) |
| `2` | Start a quiz on the most recent lesson |
| `3` | Show current CPD points balance and renewal deadline |
| `4` + question text | AI clinical question answering |
| `5` | Show subscription options and payment link |
| `6` | Help text and contact information |
| `stop` | Pause notifications (GDPR/POPIA compliant opt-out) |
| `points` | Quick points balance shortcut |
| `cert` | Send a link to download latest certificate |

### 9.4 WhatsApp Message Templates (Pre-approved by Meta)

Templates are required for business-initiated messages (e.g. reminders). Key templates:

- **Renewal reminder:** "Hi {{name}}, your CPD renewal is in {{days}} days. You need {{points}} more points. Reply 1 to start learning now."
- **Points milestone:** "Congratulations {{name}}! You've earned {{points}} CPD points this cycle. {{remaining}} more to go."
- **Certificate ready:** "Your CPD certificate is ready for download: {{link}}"
- **New course:** "A new course matching your specialty is available: {{title}}. Reply 1 to start."

---

## 10. Payments & Subscriptions

### 10.1 Pricing Tiers

| Tier | Price | Channels | Content | Points |
|---|---|---|---|---|
| **Free** | $0 | WhatsApp only | Micro-lessons | Up to 12/year |
| **Standard** | $5 USD/year (local: ~ZiG equivalent) | Web + Mobile + WhatsApp | Full course library | Unlimited |
| **Institution** | Negotiated | All channels | Full library + bulk licensing | Unlimited for all staff |
| **Diaspora** | $15 USD/year | All channels | Full library | Unlimited |

### 10.2 Payment Gateways

- **Paynow Zimbabwe:** EcoCash, Innbucks, ZIPIT, OneMoney — for local learners
- **Stripe:** Card payments — for diaspora and institution invoicing
- **Mobile money via WhatsApp:** Send payment link via bot, learner pays via EcoCash directly

### 10.3 Subscription Management

- Annual subscription model (aligns with NCZ renewal cycle)
- Subscription status checked on every protected API call
- Grace period: 14 days after expiry before content access is restricted (WhatsApp free tier remains)
- Automatic renewal reminders at 30, 14, and 3 days before expiry
- Admin can grant free access to individual learners (e.g. for scholarship programmes)

---

## 11. NCZ Integration

### 11.1 NCZ Sync Adapter

The NCZ Sync Adapter is a backend service that periodically (configurable: daily, weekly, on-demand) submits accumulated CPD point records to the Nurses Council of Zimbabwe's system.

- Submits: registration number, points earned, activity type, date completed, course accreditation reference
- Delivery method: configurable — REST API (if NCZ has one), SFTP CSV export, or email report
- Sync log: every submission logged with timestamp, records count, success/failure status
- Failed submissions queued for retry with exponential backoff
- Admin receives alert on any sync failure
- NCZ Officers can view sync logs in their portal and manually trigger a sync

### 11.2 NCZ Portal Features (Dedicated `/ncz` interface)

- Learner search by: registration number, name, institution, district, province, cadre
- Individual learner CPD history view (read-only): all activities, points, dates, certificates
- Bulk export: CSV or PDF report for any cohort (e.g. all nurses in Mashonaland East)
- Compliance dashboard: percentage of registered learners meeting the 12-point annual requirement
- Certificate verification: search by certificate ID to confirm authenticity
- Annual compliance report (auto-generated each cycle): total registered, total compliant, total non-compliant
- Sync status panel: last sync time, records submitted, any errors

### 11.3 Data Shared with NCZ

Only the minimum necessary data is shared:

- NCZ registration number (identifier)
- Full name
- CPD points total for current cycle
- Breakdown by activity type and date
- Certificate reference numbers

Payment data, personal contact details, quiz answers, and medical information are **never** shared with NCZ.

---

## 12. Tech Stack

### 12.1 Frontend — Web App

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| TypeScript | Type safety across all frontend code |
| TailwindCSS | Utility-first styling |
| vite-plugin-pwa | PWA manifest, service worker, installability |
| Workbox | Service worker caching strategies (stale-while-revalidate, cache-first) |
| React Router v6 | Client-side routing with role-based route guards |
| TanStack Query (React Query) | Server state management, caching, background refetch |
| Zustand | Client state management (auth, UI state) |
| idb | IndexedDB wrapper for offline data persistence |
| Recharts | CPD progress charts and analytics dashboards |
| React Hook Form + Zod | Form management and validation |
| TipTap | Rich text editor for course descriptions and reading sections |

### 12.2 Mobile App

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile framework |
| Expo (SDK 51+) | Build toolchain, OTA updates, native module access |
| expo-sqlite | Local SQLite database for offline course data and progress |
| expo-file-system | Storing downloaded offline content packs |
| expo-background-fetch | Background sync when connectivity is restored |
| expo-notifications | Push notifications for reminders and milestones |
| expo-secure-store | Secure JWT token storage |
| React Navigation v6 | Screen navigation and deep linking |
| TanStack Query | API data fetching with offline-aware cache |
| Zustand | App state (auth, offline queue, sync status) |

### 12.3 Backend API

| Technology | Purpose |
|---|---|
| Node.js 20 LTS | JavaScript runtime |
| Express.js | HTTP framework and routing |
| TypeScript | Type safety |
| Prisma ORM | Database schema management, migrations, type-safe queries |
| PostgreSQL 15 | Primary relational database |
| Redis 7 | Session storage, API caching, Bull job queues |
| Bull | Background job queue: media processing, NCZ sync, email sending |
| Zod | Request body and parameter validation |
| jsonwebtoken (JWT) | Authentication tokens |
| bcryptjs | Password hashing |
| Multer + Sharp | File upload handling and image resizing |
| FFmpeg (fluent-ffmpeg) | Video transcoding pipeline |
| PDFKit | Certificate and report PDF generation |
| Nodemailer | Transactional email (certificates, reminders, notifications) |

### 12.4 WhatsApp Bot

| Technology | Purpose |
|---|---|
| Node.js + Express | Webhook receiver for incoming WhatsApp messages |
| Twilio SDK | WhatsApp Business API integration (primary) |
| 360dialog (alternative) | Alternative WhatsApp Business API provider |
| Anthropic Claude SDK | AI tutor and clinical question answering |
| Redis | Conversation session state per phone number |
| Bull | Queue inbound messages during high load |

### 12.5 AI

| Technology | Purpose |
|---|---|
| Anthropic Claude API (claude-sonnet-4-20250514) | WhatsApp AI tutor, adaptive recommendations, question generation, smart reminders |
| Claude API response caching (Redis) | Cache frequent Q&A responses for 24h to reduce API costs |

### 12.6 Infrastructure & Storage

| Technology | Purpose |
|---|---|
| AWS S3 (or Cloudflare R2) | Media storage: videos, images, audio, documents, offline packs |
| Cloudflare CDN | Fast media delivery + DDoS protection |
| Cloudflare Images | Image optimisation and resizing |
| Docker + Docker Compose | Local development environment (PostgreSQL + Redis) |
| Railway or Render | Backend API hosting (affordable, managed, Africa-accessible latency) |
| Vercel | Web app hosting (global CDN, automatic deployments) |
| Expo EAS Build | Mobile app builds and OTA updates |

### 12.7 Payments

| Technology | Purpose |
|---|---|
| Paynow Zimbabwe SDK | EcoCash, Innbucks, ZIPIT, OneMoney — local mobile money |
| Stripe | Card payments for diaspora and institutions |

### 12.8 Developer Tooling

| Technology | Purpose |
|---|---|
| pnpm workspaces | Monorepo package management |
| Turborepo | Monorepo build orchestration and caching |
| Vitest | Unit and integration testing |
| Playwright | End-to-end web testing |
| ESLint + Prettier | Code quality and formatting |
| GitHub Actions | CI/CD: test, build, deploy on merge to main |
| Sentry | Error monitoring (backend + web + mobile) |

---

## 13. Project Structure

```
nursepro-cpd/                          ← monorepo root
├── apps/
│   ├── web/                           ← React + Vite PWA
│   │   ├── public/
│   │   │   ├── manifest.json          ← PWA manifest
│   │   │   └── icons/                 ← App icons (various sizes)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── learner/
│   │   │   │   │   ├── Dashboard.tsx
│   │   │   │   │   ├── Courses.tsx
│   │   │   │   │   ├── CoursePlayer.tsx
│   │   │   │   │   ├── MyPoints.tsx
│   │   │   │   │   ├── Certificates.tsx
│   │   │   │   │   └── Profile.tsx
│   │   │   │   ├── creator/           ← /creator portal
│   │   │   │   │   ├── CreatorDashboard.tsx
│   │   │   │   │   ├── CourseBuilder.tsx
│   │   │   │   │   ├── ModuleBuilder.tsx
│   │   │   │   │   ├── QuizBuilder.tsx
│   │   │   │   │   ├── MediaLibrary.tsx
│   │   │   │   │   └── Analytics.tsx
│   │   │   │   ├── ncz/               ← /ncz portal
│   │   │   │   │   ├── NczDashboard.tsx
│   │   │   │   │   ├── LearnerSearch.tsx
│   │   │   │   │   ├── ComplianceReports.tsx
│   │   │   │   │   └── CertVerify.tsx
│   │   │   │   └── admin/             ← /admin portal
│   │   │   │       ├── AdminDashboard.tsx
│   │   │   │       ├── UserManagement.tsx
│   │   │   │       ├── CourseApprovals.tsx
│   │   │   │       ├── SystemConfig.tsx
│   │   │   │       ├── NczSyncAdmin.tsx
│   │   │   │       ├── PaymentConfig.tsx
│   │   │   │       └── AuditLog.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/                ← shared UI primitives
│   │   │   │   ├── course/            ← course-specific components
│   │   │   │   ├── charts/            ← Recharts wrappers
│   │   │   │   └── layout/            ← nav, sidebar, shell
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useOffline.ts
│   │   │   │   └── useCPDPoints.ts
│   │   │   ├── store/
│   │   │   │   ├── auth.store.ts      ← Zustand auth store
│   │   │   │   └── offline.store.ts   ← offline sync state
│   │   │   ├── lib/
│   │   │   │   ├── api.ts             ← typed API client
│   │   │   │   └── offline-db.ts      ← IndexedDB helpers
│   │   │   ├── sw.ts                  ← Service worker (Workbox)
│   │   │   └── main.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── mobile/                        ← React Native + Expo
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── HomeScreen.tsx
│   │   │   │   ├── CourseListScreen.tsx
│   │   │   │   ├── CoursePlayerScreen.tsx
│   │   │   │   ├── QuizScreen.tsx
│   │   │   │   ├── PointsScreen.tsx
│   │   │   │   ├── CertificatesScreen.tsx
│   │   │   │   ├── DownloadsScreen.tsx  ← manage offline packs
│   │   │   │   └── ProfileScreen.tsx
│   │   │   ├── offline/
│   │   │   │   ├── db.ts              ← SQLite schema and queries
│   │   │   │   ├── ContentSync.ts     ← download and unpack content packs
│   │   │   │   ├── SyncQueue.ts       ← queue pending point submissions
│   │   │   │   └── BackgroundSync.ts  ← expo-background-fetch handler
│   │   │   ├── store/
│   │   │   │   ├── auth.store.ts
│   │   │   │   └── sync.store.ts
│   │   │   └── navigation/
│   │   │       ├── RootNavigator.tsx
│   │   │       └── TabNavigator.tsx
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── whatsapp-bot/                  ← WhatsApp Bot (Node.js)
│       ├── src/
│       │   ├── webhook.ts             ← Express POST /webhook
│       │   ├── sessionManager.ts      ← Redis conversation state
│       │   ├── botRouter.ts           ← routes messages to handlers
│       │   ├── handlers/
│       │   │   ├── menuHandler.ts
│       │   │   ├── learnHandler.ts    ← delivers micro-lessons
│       │   │   ├── quizHandler.ts     ← stateful quiz flow
│       │   │   ├── pointsHandler.ts   ← points balance query
│       │   │   ├── aiTutor.ts         ← Claude API integration
│       │   │   ├── paymentHandler.ts  ← payment link generation
│       │   │   └── helpHandler.ts
│       │   ├── templates.ts           ← WhatsApp message templates
│       │   ├── twilio.ts              ← Twilio client wrapper
│       │   └── index.ts
│       └── package.json
│
├── packages/                          ← shared across all apps
│   ├── api-client/                    ← typed fetch wrappers (used by web + mobile)
│   │   ├── src/
│   │   │   ├── courses.ts
│   │   │   ├── points.ts
│   │   │   ├── auth.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── ui/                            ← shared React components (web + mobile where applicable)
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── PointsBadge.tsx
│   │   └── package.json
│   └── types/                         ← shared TypeScript types
│       ├── src/
│       │   ├── user.ts                ← User, Role enums
│       │   ├── course.ts              ← Course, Module, Quiz types
│       │   ├── points.ts              ← CPDRecord, Certificate types
│       │   └── index.ts
│       └── package.json
│
├── backend/                           ← Node.js + Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── courses.ts
│   │   │   ├── modules.ts
│   │   │   ├── quizzes.ts
│   │   │   ├── points.ts
│   │   │   ├── certificates.ts
│   │   │   ├── media.ts               ← upload endpoints
│   │   │   ├── payments.ts
│   │   │   ├── ncz.ts                 ← NCZ portal data endpoints
│   │   │   ├── admin.ts
│   │   │   └── creator.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts      ← JWT verification
│   │   │   ├── role.middleware.ts      ← RBAC enforcement
│   │   │   └── upload.middleware.ts    ← Multer config
│   │   ├── services/
│   │   │   ├── cpdEngine.ts            ← points rules and calculation
│   │   │   ├── ncz-sync.ts             ← automated NCZ submission
│   │   │   ├── certificate.ts          ← PDF certificate generation
│   │   │   ├── adaptiveLearning.ts     ← Claude API recommendations
│   │   │   ├── aiQuestionGen.ts        ← Claude API question generation
│   │   │   ├── mediaProcessor.ts       ← FFmpeg + Sharp pipeline
│   │   │   ├── contentPack.ts          ← offline pack bundler
│   │   │   ├── notifications.ts        ← push + email + WhatsApp reminders
│   │   │   └── payments.ts             ← Paynow + Stripe abstraction
│   │   ├── jobs/                       ← Bull queue workers
│   │   │   ├── mediaWorker.ts
│   │   │   ├── syncWorker.ts
│   │   │   ├── notificationWorker.ts
│   │   │   └── reportWorker.ts
│   │   ├── db/
│   │   │   ├── schema.prisma           ← Prisma schema (all models)
│   │   │   └── migrations/
│   │   ├── lib/
│   │   │   ├── redis.ts
│   │   │   ├── s3.ts
│   │   │   ├── claude.ts              ← Claude API client with caching
│   │   │   └── logger.ts
│   │   └── app.ts
│   └── package.json
│
├── turbo.json                         ← Turborepo pipeline config
├── pnpm-workspace.yaml
├── docker-compose.yml                 ← local: postgres 15 + redis 7
├── .env.example                       ← all required env vars documented
└── README.md
```

---

## 14. Dependencies

### 14.1 Backend (`backend/package.json`)

```json
{
  "dependencies": {
    "express": "^4.19",
    "typescript": "^5.4",
    "@anthropic-ai/sdk": "^0.27",
    "@prisma/client": "^5.14",
    "ioredis": "^5.3",
    "bull": "^4.12",
    "jsonwebtoken": "^9.0",
    "bcryptjs": "^2.4",
    "zod": "^3.23",
    "multer": "^1.4",
    "sharp": "^0.33",
    "fluent-ffmpeg": "^2.1",
    "pdfkit": "^0.15",
    "nodemailer": "^6.9",
    "@aws-sdk/client-s3": "^3.600",
    "twilio": "^5.1",
    "paynow": "^2.0",
    "stripe": "^15.0",
    "cors": "^2.8",
    "helmet": "^7.1",
    "compression": "^1.7",
    "morgan": "^1.10"
  },
  "devDependencies": {
    "prisma": "^5.14",
    "vitest": "^1.6",
    "ts-node": "^10.9",
    "nodemon": "^3.1"
  }
}
```

### 14.2 Web App (`apps/web/package.json`)

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.24",
    "@tanstack/react-query": "^5.50",
    "zustand": "^4.5",
    "idb": "^8.0",
    "recharts": "^2.12",
    "react-hook-form": "^7.52",
    "zod": "^3.23",
    "@hookform/resolvers": "^3.9",
    "@tiptap/react": "^2.5",
    "@tiptap/starter-kit": "^2.5",
    "tailwindcss": "^3.4",
    "clsx": "^2.1",
    "workbox-window": "^7.1"
  },
  "devDependencies": {
    "vite": "^5.3",
    "vite-plugin-pwa": "^0.20",
    "workbox-build": "^7.1",
    "@vitejs/plugin-react": "^4.3",
    "typescript": "^5.4",
    "vitest": "^1.6",
    "@playwright/test": "^1.44"
  }
}
```

### 14.3 Mobile App (`apps/mobile/package.json`)

```json
{
  "dependencies": {
    "expo": "~51.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "expo-sqlite": "~14.0",
    "expo-file-system": "~17.0",
    "expo-background-fetch": "~12.0",
    "expo-notifications": "~0.28",
    "expo-secure-store": "~13.0",
    "@react-navigation/native": "^6.1",
    "@react-navigation/bottom-tabs": "^6.5",
    "@react-navigation/stack": "^6.3",
    "@tanstack/react-query": "^5.50",
    "zustand": "^4.5",
    "react-native-video": "^6.3"
  }
}
```

### 14.4 WhatsApp Bot (`apps/whatsapp-bot/package.json`)

```json
{
  "dependencies": {
    "express": "^4.19",
    "twilio": "^5.1",
    "@anthropic-ai/sdk": "^0.27",
    "ioredis": "^5.3",
    "bull": "^4.12",
    "zod": "^3.23",
    "typescript": "^5.4"
  }
}
```

---

## 15. Infrastructure & Deployment

### 15.1 Environment Variables (`.env.example`)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/nursepro"
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-secret-here"
JWT_EXPIRES_IN="7d"

# Anthropic AI
ANTHROPIC_API_KEY="sk-ant-..."

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_NUMBER="whatsapp:+263..."

# AWS S3 / Cloudflare R2
S3_BUCKET_NAME="nursepro-media"
S3_REGION="af-south-1"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
CDN_BASE_URL="https://media.nursepro.co.zw"

# Payments
PAYNOW_INTEGRATION_ID="..."
PAYNOW_INTEGRATION_KEY="..."
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="..."
FROM_EMAIL="no-reply@nursepro.co.zw"

# NCZ Sync
NCZ_SYNC_API_URL="https://ncz-api.co.zw/..."
NCZ_API_KEY="..."
NCZ_SYNC_SCHEDULE="0 2 * * *"   # daily at 2am

# App URLs
WEB_URL="https://nursepro.co.zw"
API_URL="https://api.nursepro.co.zw"
```

### 15.2 Deployment Architecture

```
Internet
   ↓
Cloudflare (CDN + DDoS + WAF)
   ↓
┌──────────────────────────────────────────┐
│  Vercel                                  │  ← Web app (React PWA)
│  apps/web → nursepro.co.zw               │
└──────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────┐
│  Railway / Render                        │  ← Backend API + WhatsApp Bot
│  backend → api.nursepro.co.zw            │
│  whatsapp-bot → bot.nursepro.co.zw       │
│  PostgreSQL (managed)                    │
│  Redis (managed)                         │
└──────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────┐
│  Cloudflare R2 / AWS S3                  │  ← Media storage
│  + Cloudflare Images                     │
└──────────────────────────────────────────┘
```

---

## 16. Development Roadmap

### Phase 1 — Core Platform (Weeks 1–8)
- Monorepo setup (pnpm + Turborepo)
- PostgreSQL schema and Prisma migrations
- Auth service (registration by NCZ number, JWT)
- CPD points engine (rules, crediting, audit log)
- Course CRUD and module builder (backend)
- Media upload pipeline (S3, image resizing, basic video)
- Web app: learner dashboard, course browser, quiz flow
- Creator portal: course builder, media uploader, quiz builder
- EcoCash / Stripe payments
- Certificate generation (PDF)

### Phase 2 — WhatsApp Bot (Weeks 9–11)
- Twilio WhatsApp Business API setup
- Webhook receiver and session manager (Redis)
- Bot conversation flow (menu, learn, quiz, points)
- Claude AI tutor integration
- Micro-quiz point crediting via bot
- WhatsApp payment link flow

### Phase 3 — Mobile App + Offline (Weeks 12–15)
- Expo app scaffold
- SQLite offline schema
- Content pack downloader
- Background sync (expo-background-fetch)
- Push notifications (reminders, milestones)

### Phase 4 — NCZ Portal + Sync (Weeks 14–16)
- NCZ Officer role and portal (`/ncz`)
- Automated NCZ sync adapter
- Bulk compliance reporting (CSV / PDF)
- Certificate verification endpoint

### Phase 5 — Admin Portal + AI Features (Weeks 16–20)
- Full Admin portal (`/admin`)
- Course approval workflow
- Platform-wide analytics
- Adaptive learning recommendations (Claude)
- AI question generation for creators
- Smart AI-personalised renewal reminders

### Phase 6 — Hardening & Launch (Weeks 20–24)
- Security audit and penetration testing
- Load testing (simulate 10,000 concurrent learners)
- Accessibility audit (WCAG 2.1 AA)
- Multilingual support (Shona, Ndebele)
- Sentry error monitoring integration
- Full documentation and API reference
- Soft launch to pilot institutions
- Public launch

---

*Document version: 1.0 — NursePro CPD Platform*
*Prepared: April 2026*
