# Student email template

For manual sending. Every student gets **this same email** — only the
`{{NAME}}`, `{{EMAIL}}` and `{{TEMP_PASSWORD}}` fields change.

- **Set your password link (identical for everyone):**
  https://academy-risingsuntech.vercel.app/set-password
- **WhatsApp community:** https://chat.whatsapp.com/GopoZZrZmil7x9GudP3TMw

Per-student values are in `student-credentials.csv` (name, email, temporary
password). That file is gitignored — do not commit or forward it.

---

## Subject line

```
Your Rising Sun Tech student account is ready
```

---

## Email body

```text
Assalam-o-alaikum {{NAME}},

Welcome to Rising Sun Tech! Your student portal account is ready.

  Email:        {{EMAIL}}
  Password:     {{TEMP_PASSWORD}}

Please sign in and set your own password before doing anything else:

  1. Go to https://academy-risingsuntech.vercel.app/set-password
  2. Enter your email and the temporary password above
  3. Choose a password of your own (at least 8 characters)

After that, use the normal login page:
https://academy-risingsuntech/login

Two things to know:

- That temporary password stops working the moment you set your own, so please
  do it today.
- We can only open quizzes and assignments for students enrolled in a course. If
  a course is missing from your list, reply to this email and we'll add you.

All class announcements, notes and deadlines are posted in our WhatsApp
community — please join:

  https://chat.whatsapp.com/GopoZZrZmil7x9GudP3TMw

If you have any trouble signing in, just reply to this email.

Best regards,
Rising Sun Tech
```

---

## Plain-text fallback (if you can't use buttons)

```text
Set your password here:
https://academy-risingsuntech.vercel.app/set-password
```

---

## Before you send

1. Copy each row from `student-credentials.csv` into the three fields.
2. Send one email per student — never put several passwords in one email.
3. Don't CC or BCC anyone; each student must get their own password.
4. The same link works for all 11 students, so the template can stay identical
   every time.

## If a student can't get in

Open **Users** (`/users`) in the admin panel, find their row, and press the mail
icon on the right. That resets their password and marks it "must change" again.
