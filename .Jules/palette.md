## 2024-06-08 - Accessible Password Visibility Toggle
**Learning:** The password visibility toggle button in the login form lacks an `aria-label` making it difficult for screen readers to understand its purpose. It relies solely on text 'show' / 'hide' which may not give sufficient context for screen reader users or when translation is applied dynamically.
**Action:** Add an `aria-label` to the button that explicitly states 'Show password' or 'Hide password' based on the state.
