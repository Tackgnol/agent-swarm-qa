# reCAPTCHA v3 on sign-up

- **Blocks:** `sign-up/form/submit/click` and every scenario that creates an account through the UI.
- **What happens:** the submit request carries a reCAPTCHA v3 token; under automation the score is low and the API answers 403 `captcha_failed`. Observed on canary with Chromium.
- **Why it stays a barrier:** the check belongs to a third party and exists to stop automation. Working around it is out of bounds.
- **Manual procedure:** a person opens `/sign-up` in an ordinary browser, fills the form with a disposable address, submits, and confirms the welcome screen. Record who did it, when, and on which build.
- **Ways to lift it (the user's decision):** a test site key on the QA environment, an allowlisted QA account created through the API, or a non-production bypass flag.
- **Covered meanwhile:** field validation and the 403 error rendering run automated; account creation itself is `blocked`, citing this note.
