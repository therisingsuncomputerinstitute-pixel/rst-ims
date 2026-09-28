# Rising Sun Tech — Institute Management System (IMS)

End-to-end usage guide for **admins** and **students**.

## 1. Login

1. Open the app in a browser (`https://academy-risingsuntech.vercel.app`).
2. If the session expired you're redirected to `/login`.
3. Enter your email + password → you land on the **Dashboard** (`/dashboard`).
   - The dashboard is different for admins vs students (see sections below).

### First time signing in (students who were emailed credentials)

Students created through **Users → Email Student Credentials** receive an email
containing their email address, a temporary password, and a **Set your password**
button. Two ways in:

- **Via the email button** — it opens `/set-password`, where you first re-enter
  your email + temporary password, then choose your own password.
- **Via the normal login form** — sign in with the temporary password and you are
  redirected straight to the same "create your password" screen.

Until a student sets their own password every portal page redirects to
`/set-password`. Passwords must be at least 8 characters and cannot be the
temporary one. Students can request a new temporary password from an admin at any
time.

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

> **Deleting a course is deliberately hard to do by accident.** On the
> **Courses** page, **Delete** opens a dialog listing exactly what will be
> destroyed (enrolled students, quizzes and attempts, assignments and every
> submission), and the delete button stays disabled until you type the course
> **code**. The server rejects the delete unless that code matches, so the
> confirmation cannot be skipped.

### 2.2 Enroll students in a course

Students only see quizzes/assignments for courses they are enrolled in, so enroll
them **before** they can attempt anything.

1. Open the course (`/courses/<courseId>`) → **Students** tab.

**One at a time, or a few at once**

- **Add Students** → search by name/email, tick everyone you want, then
  **Enroll N**. **Select all visible** ticks everyone matching the current
  search at once.

**A whole class at once**

- **Enroll In Bulk** → paste the class list, one address per line
  (`ali@example.com`, `Bilal Ahmed <bilal@example.com>`, `Sana, sana@example.com`
  all work) → **Enroll Listed Students**.
  - Everyone must already have a student account; unknown addresses are listed
    and **nothing** is enrolled, so create them on `/users` first.
  - Re-running the same list is safe — people already enrolled are skipped.
- **Enroll Every Student** adds every student account in the institute to this
  course in one click. Handy at the start of a term.

**Removing access**

- **Remove** on a student row revokes their access to that course only (they
  keep their account and other courses).

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

### 2.6 Add course resources (links and files)

1. Open the course page → the **Resources** tab → **Add**.
2. Pick a type:
   - **Link** — a title plus a URL (`https://…`). Google Drive, YouTube and
     Notion links all work; students open them in a new tab.
   - **File** — pick a file from your computer (up to 25 MB). It is stored in
     the private `submissions` bucket and served to students through a
     short-lived signed link, so the real file path is never sent to the browser.
3. Add an optional note (e.g. "read before the next class").
4. The resource is saved as a **draft**. Press **Publish** when students should
   see it — unpublished resources are hidden from students but stay visible to
   you as the admin.
5. Deleting a resource also deletes the uploaded file from storage.

### 2.7 Grade an assignment submission

There are two entry points (both open the same page):

**From the dashboard** (Pending Grading card) → **Review & grade** on any pending submission.

**From the assignment page** (`/assignments/<assignmentId>`):
1. Scroll to **Submissions** and find the student row.
2. Download their submitted file (signed link) if you need to check it.
3. Click the student's submission → **Grade**.
4. In the **Grade submission** dialog: enter score (0–max score), add **Feedback** (optional).
5. **Save grade** → status flips to Graded, percentage auto-computed.

### 2.8 Manage users (accounts)

1. Go to **Users** (`/users`).
2. **Create account** → name, email, password (min 8 chars), **role** (admin or student).
3. Change a role anytime with the role dropdown on the row.
4. **Delete** removes the account permanently.

### 2.9 Enroll students in bulk (accounts)

This is the quickest way to onboard a whole class.

1. Go to **Users** (`/users`) → **Enroll Students In Bulk**.
2. Paste your list of student emails into the textarea, one per line. Names are
   optional and get picked up from any of these shapes:
   ```
   ali.khan@example.com
   Bilal Ahmed <bilal@example.com>
   Sana, sana@example.com
   sana@example.com, Sana
   ```
   The card shows how many addresses it detected and how many are new.
3. Tick **Email login credentials to each new student** if you want the portal to
   send the welcome mail. Untick it to just create the accounts — the generated
   passwords are then shown in a table with a **Copy All** button so you can hand
   them out yourself (WhatsApp, printout, spreadsheet).
4. Leave **Use one shared password for everyone** off to give every student their
   own unique 14-character password, or turn it on and type one password for all.
5. **Enroll Students** → confirm. Every new address becomes a student account
   flagged `mustChangePassword`, so each one must set their own password at first
   sign-in. Anyone who already has an account is **skipped untouched** — no
   password reset — which makes it safe to run the same list twice.
6. **Email All Students** sends a fresh temporary password to every existing
   student. The mail icon on a student row re-sends one to just that person.
   (Both are student-only; admin accounts are never emailed or reset.)

> If the amber "Email not configured" banner shows, enrolment still works, you
> just get the password table instead of emails — see section 5.
> If a single send fails, that student's password is rolled back automatically
> and the failure is listed in the toast.

### 2.10 Settings / profile

1. **Settings** (`/settings`) — update your profile (name, current password, change password).

---

## 3. Student flows

### 3.1 Find courses

- **Courses** (`/courses`) only lists the courses you are **enrolled in**. That's
  your working list — open one to reach its quizzes and assignments.
- **Course Catalog** (`/courses/catalog`, sidebar link or the **Browse All
  Courses** button) shows **every** course in the institute with its
  description, instructor, quiz and assignment counts.
  - Courses you're not enrolled in are marked **Locked** and cannot be opened or
    joined from here. Only the administration can enroll a student.

### 3.2 Use course resources

- Open any enrolled course → the **Resources** tab.
- Each item is either a **link** (opens in a new tab) or a **file**
  (click to download). Only resources your teacher has published appear here.
- Students enrolled in the course can open them; students not enrolled in the
  course are refused the file even if they have the link, because downloads are
  permission-checked on the server and expire after an hour.

### 3.3 Take a quiz

1. On your **Dashboard** (`/dashboard`) open **My Courses**, or go to **Courses**
   and open a course you're enrolled in.
2. Click the published quiz → **Start attempt** (intro screen shows duration, number
   of questions, total points, and the instructions written by the admin).
3. ⚠️ **You can only attempt each quiz once.** The timer starts the moment you begin.
4. Answer each question and **Submit quiz**.
5. The quiz is **auto-graded** immediately → you see your **score** and a per-question
   review (right/wrong with correct answers).

### 3.4 Submit an assignment

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

### 3.5 See your grades

- **Grades** page (`/grades`): every graded quiz and assignment with earned points,
  max points and percentage.
- Your **Dashboard** (`/dashboard`) also shows **Recent grades** and a **Score trend**
  chart, plus a **Due soon** alert for anything due within 48 hours.

---

## 4. Recommended end-to-end test (give this to the friend)

**Admin** (`shuja@test.com` / `Test12345`):
1. **Users → Enroll Students In Bulk**: paste a couple of addresses, untick emailing
   so the passwords appear in the copyable table, then enroll.
2. Create a course → **Students** tab → **Enroll In Bulk** and paste those same
   addresses (or hit **Enroll Every Student**).
3. Create a quiz (2–3 questions) → Publish.
4. Create an assignment (attach an **instructions** PDF + a **reference** file,
   set max score) → Publish.
5. **Browse All Courses / Course Catalog** as the student shows the course marked
   **Enrolled** and any other course **Locked**.

**Student** (`student@test.com` / `Test12345`, or a password from the table in step 1):
6. First sign-in forces **set your own password** — the portal will not open until
   it's changed.
7. **Courses** shows only enrolled courses; the catalog shows the rest as Locked.
8. Dashboard shows the course with a progress bar + "due soon" alerts.
9. Take the quiz → confirm instant score/review.
10. Submit the assignment (upload a file).

**Admin** again:
11. **Dashboard → Pending Grading → Review & grade** → set score + feedback.
12. Assignment page shows the submission as Graded; quiz stats show the attempt.

**Verify** grades/percentages on the Grades page for both roles.

---

## 5. Notes for the maintainer

- **Data is stored in Supabase** (Postgres + auth + private `submissions` storage bucket).
  Files are private; downloads use short-lived signed URLs.
- **Course resources** (`course_resources`) hold links and uploaded files per
  course. `kind` is `link` (URL in `url`) or `file` (`file_name`/`file_path`/
  `file_size` in the bucket under `course-resources/<courseId>/`). Deleting a
  course or a resource deletes the stored object too. Uploads are capped at
  25 MB in `src/server/ums.ts`; `next.config.ts` raises the Server Action body
  limit to 26 MB (Next's default of 1 MB silently rejects any real upload).
- **Env vars** (`.env`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (must be a legacy `eyJ…` service-role JWT —
  `sb_` keys are rejected by Storage), `SUPABASE_STORAGE_BUCKET`, `ADMIN_SETUP_TOKEN`,
  `ADMIN_BOOTSTRAP_PASSWORD`.
- **Student email** (`src/lib/email.ts`): `RESEND_API_KEY` (required) turns on
  emailing; without it the `/users` buttons refuse to run and the bulk enrol card
  falls back to showing passwords instead.
  `EMAIL_SENDER_ADDRESS` defaults to `onboarding@resend.dev` and
  `EMAIL_SENDER_NAME` to the institute name. **`onboarding@resend.dev` only
  delivers to the inbox registered on the Resend account** — sends to any other
  recipient are rejected by Resend, so treat it as test-only. Add a domain you
  own in Resend and set `EMAIL_SENDER_ADDRESS` (e.g. `no-reply@yourdomain.com`)
  when you need to reach real students; no code change required.
- **Password rules**: `mustChangePassword` on `user` forces a reset through
  `src/proxy.ts`. Students land on `/set-password` either from the emailed link
  (HMAC token, 30 min) or straight after login. `setOwnPassword` replaces the
  credential hash directly because better-auth's `setPassword` endpoint refuses
  when a password already exists.
- **Deleting a course is guarded twice**: the UI requires the course code to be
  typed into a confirm dialog, and `deleteCourse` re-checks it server-side. The
  delete cascades to quizzes, attempts, assignments and submissions.
- **Bootstrap**: only while no admins exist, `/api/make-psa` with `ADMIN_SETUP_TOKEN`
  creates the first admin (`admin@iba.edu.pk`) using `ADMIN_BOOTSTRAP_PASSWORD`.
- **Dev server**: `npm run dev`; next dev runs the custom server (`proxy.ts`), so changes
  to `.env` require restarting the server process.
- **Build/typecheck**: `npm run build` and `npx tsc --noEmit`.