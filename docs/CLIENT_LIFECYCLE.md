# Client Lifecycle

## Step 7: Message Agent (Relationship Starts)

### 1) What the client clicks
- From an agent card, client clicks "Message".

### 2) What the client sees in the webapp
- Messaging panel opens.
- Conversation header shows agent name.
- Text input is visible.
- Button visible: Send (shows "Sending..." while in-flight).
- Optional buttons: Save Agent; View agent profile.
- System text for first-time conversation: "Introduce yourself to start the conversation."

### 3) Where the client is redirected to
- Messages tab (client dashboard).
- Conversation is active and pinned at top.

### 4) What happens if the client clicks back
- Browser back: client returns to Agent search page; conversation remains saved.
- Switching tabs: client can leave Messages; conversation stays active.
- Unread badge appears when agent replies.

### 5) What goes in the client's email
- No email is sent yet (client sending a message does not generate an email).

### 6) What the client sees when they check email
- No new email from Connsura.

### 7) Client action regarding email
- No action; conversation is in-app only.

### 8) Reminder shown in Overview tab
- After first message is sent: "Waiting for agent reply".
- If email not verified yet: "Verify your email".
- Once agent replies: "Agent replied - continue conversation".

### Internal system state after Step 7
- Agent relationship: Active.
- Conversation thread created.
- No profile sharing yet.
- No edits allowed yet.
- Agent can request profile share.

### Audit log entries
- CLIENT_MESSAGE_THREAD_OPENED (clicked Message)
- CLIENT_CONVERSATION_CREATED (if first time with that agent)
- CLIENT_MESSAGE_SENT (after client clicks Send, success/fail)

Note: message content stays in the Messages table; audit log stores only message_id / conversation_id.
