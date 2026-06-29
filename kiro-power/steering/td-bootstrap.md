---
inclusion: manual
---

# TD Bootstrap — Build and Publish the EZT Transformation Definition

Load this file when: no Easytrieve TD exists yet in the customer's AWS Transform environment.

This is a one-time setup per environment. Once the TD is published, it is reused
for every subsequent EZT workload — never rebuild unless the APG documents are updated.

---

## What This Phase Does

Clones the APG GitHub repo, uploads the TD documents to the workspace,
creates the transformation definition using AWS Transform custom, and publishes it
so it is discoverable for future workloads.

Source repo:
`https://github.com/aws-samples/sample-mainframe-easytrieve-transform`

---

## Step 1 — Clone the APG Repo

Run silently:

```bash
git clone https://github.com/aws-samples/sample-mainframe-easytrieve-transform \
  /tmp/ezt-apg-repo
```

Verify the `documents/` folder exists:

```bash
ls /tmp/ezt-apg-repo/documents/
```

Expected contents:
```
transformation_definition.md
bre_transformation_definition.md
summaries.md
ca-easytrieve-report-generator-11-6.txt
```

If any file is missing, stop and tell the user:
> "The APG repo is missing expected documents. Check that
> https://github.com/aws-samples/sample-mainframe-easytrieve-transform
> is accessible and the `documents/` folder is intact."

---

## Step 2 — Stage Documents in Workspace

```bash
mkdir -p /tmp/ezt-workspace/documents
cp -r /tmp/ezt-apg-repo/documents/* /tmp/ezt-workspace/documents/
```

Confirm silently. Do not report file paths to the user — just confirm
the documents are ready.

---

## Step 3 — Create the Transformation Definition

Tell the user:
> "I have the APG transformation documents ready. I'll now create your
> Easytrieve transformation definition using AWS Transform custom."

Use `atx` CLI to create the TD. The command:

```bash
atx custom def create \
  --name "Easytrieve-to-Java-Migration" \
  --documents-path /tmp/ezt-workspace/documents/
```

Wait for the agent to generate the TD. This may take several minutes.

If the command is not available or fails, use the AWS Transform tooling
via the atx-dev Power MCP server tools instead:
- Use `search_documentation` for guidance
- Use the appropriate agent/TD creation tools

---

## Step 4 — Human Review Gate

**Do not publish without user confirmation.**

Show the user a summary of the generated TD:
> "Your transformation definition is ready for review. Here's what it covers:
> [summary of key transformation rules from the generated TD]
>
> Does this look correct, or do you want to adjust anything before I publish it?"

Wait for explicit approval. If the user wants changes, work with them to refine
the TD before proceeding.

---

## Step 5 — Publish the TD

Once the user approves, publish:

```bash
atx custom def publish --name "Easytrieve-to-Java-Migration"
```

After publishing, verify it is discoverable:

```bash
atx custom def list
```

Confirm the TD appears in the list. Refer to it by name in all user-facing
messages, never by raw ID.

Tell the user:
> "Your Easytrieve transformation definition is published and ready.
> You can now use it to transform any EZT workload — no need to rebuild it.
>
> Ready to start your first transformation?"

If yes → proceed to BRE extraction phase (load `bre-extraction.md`)

---

## Guardrails

- Never skip Step 4 (human review) — publishing an unreviewed TD produces
  poor transformation quality
- Never hardcode the TD name in tool calls — always discover via list commands
- If the APG repo is inaccessible (network, permissions), offer the user the option
  to manually supply the documents folder
- This phase is one-time — if a TD already exists, skip directly to BRE extraction
