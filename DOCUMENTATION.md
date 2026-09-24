# Rising Sun Tech — Institute Management System (IMS)

End-to-end usage guide for **admins** and **students**.

## 1. Login

1. Open the app in a browser (`https://academy-risingsuntech.vercel.app`).
2. If the session expired you're redirected to `/login`.
3. Enter your email + password → you land on the **Dashboard** (`/dashboard`).
   - The dashboard is different for admins vs students (see sections below).

### Test accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `shuja@test.com` | `Test12345` |
| Student | `student@test.com` | `Test12345` |

Roles are managed on the **Users** page (`/users`, admins only). A user is either
`student` or `admin`; admins have access to every page, students only to their own.

---

## 2. Admin flows

### 2.1 Create a course

1. Go to **Courses** (`/courses`) → **New course**.
2. Fill in: **Course name** (e.g. "Calculus I"), **Course code** (e.g. "MATH-101"),
   **Instructor**, **Term**, **Description**.
3. **Create course** → you land on the course page.

### 2.2 Enroll students in a course

Students only see quizzes/assignments for courses they are enrolled in, so enroll
them **before** they can attempt anything.

1. Open the course (`/courses/<courseId>`).
2. Scroll to **Enrolled Students**.
3. **Enroll Student** → pick a student in the dialog → **Enroll**.
4. To revoke access: expand a student row → **Remove**.

### 2.3 Create a quiz

1. Open the course page → under **Quizzes**, click **New quiz** (navigates to
   `/courses/<courseId>/quiz/new`).
2. Quiz settings:
   - **Quiz title** (required)
   - **Duration (minutes)** — the time limit per student attempt
   - **Due date** (optional)
   - **Description** — short summary shown to students
   - **Instructions** — rules/notes shown on the intro screen
3. Under **Questions**, click **Add question** and fill each:
   - **Prompt** (required)
   - **Points** (default 1; total points shown at the top)
   - Answer type: **multiple choice** or **true/false**
   - Options + select the **correct answer** (every question must have one)
4. **Save quiz** → you land on the quiz page as a **Draft**.

> Tips: you can delete a question with the trash icon. The quiz is NOT visible to
> students until you **Publish** it (right top of the quiz page).

5. **Publish** to make it live. Students can now take it (once per student).

### 2.4 Check quiz results

On the quiz page (`/quizzes/<quizId>`) admin sees:

- The **Publish / Unpublish** toggle.
- Stat tiles: **Attempts**, **Submitted**, **Enrolled students**, and score stats.
- The **Attempts** list — each row shows the student, status, score and submitted time.

Quizzes are **auto-graded**; grades appear in the grades table and student stats automatically.

### 2.5 Create an assignment

1. Open the course page → under **Assignments**, click **New assignment**
   (`/courses/<courseId>/assignment/new`).
2. Fill in:
   - **Title** (required)
   - **Max score** — full marks (used to compute percentage)
   - **Due date** (optional)
   - **Description**
   - **Instructions** — text instructions
3. **Attached files** — add as many files as you want, in **any format (PDF, DOCX, images…)**:
   - Click **Add file** and pick a file.
   - Mark it as **Instructions** (e.g. an instruction/guide PDF) or **Reference**
     (e.g. readings, templates, sample material).
   - Repeat for more files; remove any with the ✕ button.
4. **Create assignment** → land on the assignment page (files are uploaded with it).
5. **Publish** it so students can submit.

### 2.6 Grade an assignment submission

There are two entry points (both open the same page):

**From the dashboard** (Pending Grading card) → **Review & grade** on any pending submission.

**From the assignment page** (`/assignments/<assignmentId>`):
1. Scroll to **Submissions** and find the student row.
2. Download their submitted file (signed link) if you need to check it.
3. Click the student's submission → **Grade**.
4. In the **Grade submission** dialog: enter score (0–max score), add **Feedback** (optional).
5. **Save grade** → status flips to Graded, percentage auto-computed.

### 2.7 Manage users (accounts)

1. Go to **Users** (`/users`).
2. **Create account** → name, email, password (min 8 chars), **role** (admin or student).
3. Change a role anytime with the role dropdown on the row.
4. **Delete** removes the account permanently.

### 2.8 Settings / profile

1. **Settings** (`/settings`) — update your profile (name, current password, change password).

---

## 3. Student flows

### 3.1 Take a quiz

1. On your **Dashboard** (`/dashboard`) open **My Courses**, or go to **Courses**
   and open a course you're enrolled in.
2. Click the published quiz → **Start attempt** (intro screen shows duration, number
   of questions, total points, and the instructions written by the admin).
3. ⚠️ **You can only attempt each quiz once.** The timer starts the moment you begin.
4. Answer each question and **Submit quiz**.
5. The quiz is **auto-graded** immediately → you see your **score** and a per-question
   review (right/wrong with correct answers).

### 3.2 Submit an assignment

1. Open the assignment (`/assignments/<assignmentId>`) from a course or the dashboard.
2. Read the text **Instructions**. If the admin attached files, they're shown in
   two groups — **Instructions** and **Reference files** — each with a **Download**
   button (works for any format: PDF, DOCX, etc.).
3. Under **Submit your work**:
   - **Attach a file** (required — e.g. PDF of your solution)
   - Add **Comments** (optional)
4. **Submit** → submission becomes **Pending** until graded.
5. You can **Update submission** (re-upload a new file). If already graded, the
   existing score is kept until the admin re-grades it.

### 3.3 See your grades

- **Grades** page (`/grades`): every graded quiz and assignment with earned points,
  max points and percentage.
- Your **Dashboard** (`/dashboard`) also shows **Recent grades** and a **Score trend**
  chart, plus a **Due soon** alert for anything due within 48 hours.

---

## 4. Recommended end-to-end test (give this to the friend)

**Admin** (`shuja@test.com` / `Test12345`):
1. Create a course → enroll `student@test.com`.
2. Create a quiz (2–3 questions) → Publish.
3. Create an assignment (attach an **instructions** PDF + a **reference** file,
   set max score) → Publish.

**Student** (`student@test.com` / `Test12345`):
4. Dashboard shows the course with a progress bar + "due soon" alerts.
5. Take the quiz → confirm instant score/review.
6. Submit the assignment (upload a file).

**Admin** again:
7. **Dashboard → Pending Grading → Review & grade** → set score + feedback.
8. Assignment page shows the submission as Graded; quiz stats show the attempt.

**Verify** grades/percentages on the Grades page for both roles.

---

## 5. Notes for the maintainer

- **Data is stored in Supabase** (Postgres + auth + private `submissions` storage bucket).
  Files are private; downloads use short-lived signed URLs.
- **Env vars** (`.env`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (must be a legacy `eyJ…` service-role JWT —
  `sb_` keys are rejected by Storage), `SUPABASE_STORAGE_BUCKET`, `ADMIN_SETUP_TOKEN`,
  `ADMIN_BOOTSTRAP_PASSWORD`.
- **Bootstrap**: only while no admins exist, `/api/make-psa` with `ADMIN_SETUP_TOKEN`
  creates the first admin (`admin@iba.edu.pk`) using `ADMIN_BOOTSTRAP_PASSWORD`.
- **Dev server**: `npm run dev`; next dev runs the custom server (`proxy.ts`), so changes
  to `.env` require restarting the server process.
- **Build/typecheck**: `npm run build` and `npx tsc --noEmit`.