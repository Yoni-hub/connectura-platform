# Client Lifecycle

## Step 7: Share Profile (Link or PDF)

### 1) What the client clicks
- From Client Dashboard, click "Share profile" and choose Link or PDF.

### 2) What the client sees in the webapp
- Share modal opens.
- Client selects sections to share.
- Client enters recipient name.
- Optional: toggle "Allow edits" (edits require client approval).

### 3) Where the client is redirected to
- Stays in the dashboard.
- Share appears in the Profile Activity list.

### 4) What happens if the client clicks back
- No share is created until they confirm.

### 5) What goes in the client's email
- A copy of the share link and access code is sent to the client email.

### 6) What the recipient sees
- Recipient opens the link, enters the access code and name, then views the shared profile.

### 7) Internal system state after Step 7
- ProfileShare created with recipient name, selected sections, and access code.
- If edits are allowed, pending edits appear for client approval.
