# SplitSmart — Expense Backend Update

## Included changes
- Create expenses through `POST /api/group-expenses/:groupId`.
- Edit expenses through new `PUT /api/group-expenses/:groupId/:expenseId`.
- Delete expenses through `DELETE /api/group-expenses/:groupId/:expenseId`.
- Keep selected participants and custom shares when saving.
- Persist notes and recurring-expense fields in MongoDB.
- Refresh group details from the API after create, edit, delete, and undo.
- Undo after deleting recreates the expense in MongoDB (it receives a new MongoDB ID).

## Apply the update
1. Back up your current project folder.
2. Extract this ZIP and copy the updated project files over your project folder.
3. Do not overwrite your existing `backend/.env`. This ZIP intentionally excludes secrets and `node_modules`.
4. Open a terminal in `backend` and run `npm install` only if dependencies are not already installed.
5. Start the backend with `node server.js`.
6. Refresh the frontend group details page.

## Test checklist
1. Add an expense with equal split and choose only two participants. Verify the shares are divided between those two only.
2. Add an expense with custom split. Make sure the shares total exactly equals the amount.
3. Edit the description, amount, payer, participants, and category; save and refresh.
4. Delete an expense; refresh and verify it stays deleted.
5. Use UNDO in the notification; verify the expense is recreated and survives refresh.
6. Try editing/deleting as a user who did not create the expense and is not the group admin; the backend should reject it.

## Notes
- MongoDB stores notes and recurring-expense metadata, but the app's current group expense APIs do not include recurring scheduling automation.
- This update preserves the existing frontend design.
