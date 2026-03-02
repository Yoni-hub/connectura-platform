Connsura DB backup bundle created 2026-03-02 08:46:47 -05:00

Sources included:
- local-5432 (active local app database)
- local-5433 (secondary local postgres source)
- staging (remote AWS EC2 postgres via SSH)

Files:
- */full.sql: full logical dump of the entire database
- local-5432/structured-export.json: focused business export (questions/products/sections/input types/tooltips/clients/forms)
- local-5433/structured-export.json: focused business export (questions/products/sections/input types/tooltips/clients/forms)
- manifest.sha256.json: SHA256 checksums of bundle files

Notes:
- Empty files from failed intermediate attempts may exist:
  - local-5432/key-tables.sql
  - staging/QuestionBank.json
  They are safe to ignore; use full.sql and structured-export.json files.
