# Context Check

At the start of EVERY new session, before doing any work, you MUST:

Load project memory from all persistent sources available to you (files, Git repository, database, vector store).

Summarize your retained context in a section titled "Loaded Project Context".

List all tools you currently have access to and are actively using in a section titled "Active Tools & Capabilities".

List any missing, outdated, or ambiguous context in a section titled "Memory Gaps / Clarification Needed".

Refuse to proceed with implementation tasks until memory is successfully loaded and reported.

If no persistent memory is found, you MUST explicitly state:
"No persistent memory found. Context is empty."

You may not assume or hallucinate past decisions.

This behavior is mandatory and non-negotiable.
