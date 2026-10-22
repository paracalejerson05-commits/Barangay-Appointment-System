# Security Spec

1. **Data Invariants**:
- User profiles can only be created by the authenticated user and their `uid` must match `request.auth.uid`.
- Service Requests can only be read/written by the user who created them (matching `residentUid`) or by an admin.
- Notifications can only be read/updated by the recipient (`userId`).
- Announcements and Settings are globally readable, but only writable by an admin.

2. **Dirty Dozen Payloads**:
(Simulated payloads for testing)
- Create User with wrong UID
- Update User role (escalation)
- Read other user's ServiceRequest
- Update other user's ServiceRequest
- Create ServiceRequest with mismatched residentUid
- Update ServiceRequest status (by resident)
- Read other user's Notification
- Create Announcement (by resident)
- Update Settings (by resident)
- Create ServiceRequest without required fields
- Update ServiceRequest with invalid type
- Create Notification (by resident)

