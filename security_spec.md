# Security Specification for Warehouse Management System

## 1. Data Invariants
- A **Sale** or **Purchase** must always be associated with a valid `warehouseId`.
- Users can only access data for warehouses they are explicitly allowed to access (stored in `users/{userId}.allowedWarehouses`).
- **Admins** have global access to all warehouses and settings.
- **Products** are unique per `warehouseId`.
- **System-only fields** like `lastUpdated`, `lastActive`, and `selectedWarehouse` are handled by the system but still need validation.
- All IDs must be strictly formatted (alphanumeric).

## 2. The "Dirty Dozen" Payloads (Denial Expected)

1.  **Escalation Attempt:** A user attempts to create a profile with `role: 'admin'`.
2.  **Warehouse Hijack:** A user restricted to Warehouse A attempts to read/list documents from Warehouse B.
3.  **Identity Spoofing:** A user authenticated as `UID_123` attempts to update `users/UID_456`.
4.  **Invisible Keys:** A user attempts to update a Product but includes a field not in the allowlist (e.g., `isVerified: true`).
5.  **ID Poisoning:** Attempting to create a document with a 1MB string as the ID.
6.  **Type Mismatch:** Sending a string instead of a number for `Product.stock`.
7.  **Negative Value Attack:** Setting `Sale.total` to `-999999`.
8.  **Status Skip:** Direct update of a Purchase status to 'received' without going through allowed state transitions (if applicable, though here we mostly restrict who can do it).
9.  **Terminal State Edit:** Attempting to edit a 'DONE' transport record without being an admin.
10. **Orphaned Record:** Creating a Movement for a non-existent `productId`.
11. **Timestamp Spoofing:** Providing a manual `createdAt` string in the past instead of using server timestamps.
12. **PII Scraping:** An unauthenticated user attempts to list the `users` collection.

## 3. Test Runner (Mock)
| Identity Spoofing | (Can I set ownerId/authUid to someone else?) | PASS - Users update rules enforce UID match and email_verified check. |
| State Shortcutting | (Can I skip a status step?) | PASS - Rules restrict status updates and lock terminal states for Sales and Transports. |
| Resource Poisoning | (Can I inject a 1MB string into an ID field?) | PASS - isValidId enforces regex pattern and size limits. |
| Shadow Update | (Can I add Ghost Fields?) | PASS - affectedKeys().hasOnly() prevents extra fields on update. |

## 2. Updated "Dirty Dozen" Payloads (Denial Expected)

1.  **Escalation Attempt:** `{"role": "admin"}` on self-update by non-admin.
2.  **Warehouse Hijack:** `getDocs(collection(db, 'sales'), where('warehouseId', '==', 'unauthorized_wh'))`.
3.  **Identity Spoofing:** `setDoc(doc(db, 'users', 'other_uid'), { authUid: 'my_uid' })`.
4.  **Ghost Field Attack:** `updateDoc(productRef, { stock: 100, isVerified: true })`.
5.  **ID Poisoning:** `setDoc(doc(db, 'products', 'A'.repeat(2048)), { ... })`.
6.  **Type Mismatch:** `updateDoc(productRef, { price: "cheap" })`.
7.  **Negative Value:** `updateDoc(saleRef, { total: -100 })`.
8.  **Timestamp Spoofing:** `updateDoc(userRef, { lastActive: '2000-01-01' })`.
9.  **Terminal State Edit:** `updateDoc(transportRef, { status: 'DONE', notes: 'Hacked' })` where existing status is already 'DONE' (if terminal lock reinforced).
10. **PII Scraping:** `getDocs(collection(db, 'users'))` by non-admin.
11. **Relational Break:** Creating a product for a warehouse the user doesn't have in `allowedWarehouses`.
12. **System Field Injection:** Attempting to update `permissions` on self-profile.
