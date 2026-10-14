# Privacy fields (B9-06) — redacted public version

Field-by-field personal / sensitive data and who may see it. No real values.
Ciphertext never leaves the service layer in list/get DTOs (see B8-05 taint guard).

Legend: **A** = Admin, **B** = Builder, **V** = Viewer, **Self** = owning user,
**—** = never exposed via API.

| Entity / field | Sensitivity | A | B | V | Notes |
| -------------- | ----------- | - | - | - | ----- |
| **users.username** | identifier | ✓ | ✓ | ✓ | citext; unique |
| **users.display_name** | PII | ✓ | ✓ | ✓ | |
| **users.email** | PII | ✓ | ✓ | ✓ | optional |
| **users.phone** | PII | ✓ | ✓ | ✓ | optional |
| **users.photo_object_key** | path | ✓ | ✓ | ✓ | storage key, not bytes |
| **users.role** | access | ✓ | ✓ | ✓ | |
| **users.is_active** | access | ✓ | ✓ | ✓ | |
| **users.must_change_password** | access | ✓ | ✓ | Self | |
| **users.password_hash** | secret | — | — | — | never in DTOs |
| **users.created_at / updated_at** | meta | ✓ | ✓ | ✓ | |
| **sessions.token_hash** | secret | — | — | — | hash only; listOwn omits hash |
| **sessions.user_agent / ip** | PII | Self | Self | Self | own sessions only |
| **login_attempts.*** | security | — | — | — | internal rate-limit |
| **company_profile.legal_name** | org | ✓ | ✓ | ✓ | |
| **company_profile.gstin** | tax id | ✓ | ✓ | ✓ | plain |
| **company_profile.pan_encrypted** | tax id | ✓ | — | — | decrypted for Admin only; omitted otherwise |
| **company_profile.invoice_defaults** | config | ✓ | ✓ | ✓ | |
| **company_bank_accounts.label / bank_name / account_holder / branch** | org | ✓ | ✓ | — | Viewer denied listBanks |
| **company_bank_accounts.account_number_encrypted** | financial | ✓ | ✓ | — | decrypted in view for A/B |
| **company_bank_accounts.ifsc_encrypted** | financial | ✓ | ✓ | — | decrypted in view for A/B |
| **invoices.party_name** | PII / org | ✓ | ✓ | ✓* | *subject to invoice visibility |
| **invoices.invoice_no / amounts / dates / status** | business | ✓ | ✓ | ✓* | |
| **invoices.extra** | varies | ✓ | ✓ | ✓* | avoid stuffing secrets |
| **invoice_steps.data** | business / PII | ✓ | ✓ | ✓* | step answers; file keys only |
| **documents.original_filename** | meta | ✓ | ✓ | ✓* | |
| **documents.sha256 / mime / size** | meta | ✓ | ✓ | ✓* | |
| **documents.object_key** | path | ✓ | ✓ | ✓* | served only via authenticated stream |
| **document bytes** | content | stream | stream | stream | after permission check; Cache-Control private immutable |
| **audit_log.before / after** | mixed | ✓ | ✓* | ✓* | redacted writer; RLS limits non-admin |
| **reminder_state** | prefs | Self | Self | Self | per-user dismissals |
| **user_preferences.prefs** | prefs | Self | Self | Self | |
| **storage_ops_daily** | ops meta | health | health | health | counts only; no PII |

### Rules of thumb

1. Never put file bytes or plaintext passwords in the database or audit JSON.
2. Never expose a public file URL; downloads go through `/api/files/[id]`.
3. Encrypted columns (`*_encrypted`) are decrypt-on-read only inside services for allowed roles.
4. Temporary passwords from `users.create` / `resetPassword` are returned once and not stored plaintext.
