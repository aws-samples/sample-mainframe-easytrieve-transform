---
name: "sample-mainframe-easytrieve-transform"
displayName: "Easytrieve Modernization"
description: "Transform mainframe Broadcom Easytrieve (EZT) programs to Java 17 (Spring Boot) using AWS Transform custom — guided, interactive, end-to-end."
keywords:
  - easytrieve
  - ezt
  - mainframe
  - modernization
  - transform
  - java
  - migration
  - broadcom
  - batch
  - report generator
  - spring boot
  - jcl
author: "Shubham Roy, AWS"
version: "1.2.0"
---

# Easytrieve Modernization Power

Transform mainframe Easytrieve (EZT) programs to Java 17 (Spring Boot 3.x) using
AWS Transform custom. Based on the [AWS Prescriptive Guidance pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/transform-easytrieve-modern-languages.html).

Source repo: [sample-mainframe-easytrieve-transform](https://github.com/aws-samples/sample-mainframe-easytrieve-transform)

---

## Onboarding

Run these checks silently at the start of EVERY session. Report only failures.

### Step 1: Verify aws-transform Power is installed

Check the Powers panel for `aws-transform`. If missing:
> "Before we start, install the **aws-transform** power from the Kiro Powers panel.
> It provides the tools I need to run transformations."

Stop and wait.

### Step 2: Verify AWS credentials

```bash
aws sts get-caller-identity
```

If fails:
> "AWS credentials are not configured. Run `aws configure` with credentials that
> have the `AWSTransformCustomFullAccess` managed policy attached."

### Step 3: Verify remote infrastructure

```bash
aws cloudformation describe-stacks --stack-name AtxInfrastructureStack \
  --query 'Stacks[0].StackStatus' --output text --region us-east-1
```

If not `CREATE_COMPLETE` or `UPDATE_COMPLETE`:
> "The remote execution infrastructure is not deployed. I'll help you set it up —
> it takes about 5 minutes and costs nothing when idle."

Then guide through deployment using the `aws-transform` power's remote execution flow.

### Step 4: Verify pre-built container image (CRITICAL)

The Fargate container MUST use the pre-built image that includes Java 17, Maven 3.6+,
and atx CLI. Verify:

```bash
cd ~/.aws/atx/custom/remote-infra 2>/dev/null && \
  node -e "console.log(require('./cdk.json').context.prebuiltImageUri || 'NOT_SET')"
```

Expected: `public.ecr.aws/d9h8z6l7/aws-transform:latest`

If `NOT_SET` or empty:
> "⚠️ The container is not configured to use the pre-built image. This means Java and
> Maven need to be installed on every run, adding 20+ minutes of delay.
>
> Fix: Set `prebuiltImageUri` in `~/.aws/atx/custom/remote-infra/cdk.json` to
> `public.ecr.aws/d9h8z6l7/aws-transform:latest` and redeploy with `./setup.sh`."

**Do NOT proceed until the pre-built image is confirmed. This is the #1 cause of
slow transformations and timeouts.**

### Step 5: Verify transformation definitions exist

```bash
atx custom def list --json 2>/dev/null | grep -i easytrieve
```

If no Easytrieve TDs found → load `td-bootstrap.md` to create them.

---

## How It Works

This power includes an **MCP server** (`ezt-transform-mcp`) that handles all
deterministic orchestration. The LLM's role is limited to:
- Understanding what the user wants (conversational)
- Collecting inputs (S3 paths, BRE review confirmation)
- Calling the MCP tools in sequence
- Presenting results in plain language

### MCP Tools (deterministic — no LLM reasoning needed)

| Tool | What it does |
|---|---|
| `ezt_check_prereqs` | Verifies credentials, infrastructure, container image, TDs |
| `ezt_prepare_workspace` | Downloads from S3, organizes 4-folder structure, zips, uploads |
| `ezt_run_bre` | Submits BRE extraction job via Lambda |
| `ezt_run_transform` | Submits transformation job — **REFUSES if bre-doc/ is empty** |
| `ezt_check_status` | Polls job status, extracts conversation ID for recovery |
| `ezt_resume_job` | Resumes interrupted job with conversation ID |
| `ezt_get_results` | Retrieves S3 paths, validation status, download commands |
| `ezt_run_batch` | Submits up to 128 programs in parallel |

### Tool call sequence (typical flow)

```
ezt_check_prereqs()
  → ezt_prepare_workspace(source, input, output, programName)
    → ezt_run_bre(workspaceS3Path, programName)
      → ezt_check_status(jobId)  [poll until SUCCEEDED]
      → [user reviews BRE]
    → ezt_prepare_workspace(source, input, output, breDocPath, programName)
      → ezt_run_transform(workspaceS3Path, programName)
        → ezt_check_status(jobId)  [poll until SUCCEEDED]
        → ezt_get_results(jobId)
```

If any job times out: `ezt_check_status` returns the `conversationId` →
call `ezt_resume_job` instead of resubmitting.

---

## Workflow (APG Epics)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Epic 1       │─▶│ Epic 2       │─▶│ Epic 3       │─▶│ Epic 4       │─▶│ Epic 5       │
│ Setup Infra  │  │ Create TDs   │  │ Generate BRE │  │ Prepare Data │  │ Validate +   │
│              │  │              │  │              │  │ + Transform  │  │ Deliver      │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
     one-time          one-time        per workload     per workload      per workload
```

### Epic 1: Deploy remote infrastructure
- Deploy `AtxInfrastructureStack` (Lambda + Batch + S3)
- MUST use pre-built image: `public.ecr.aws/d9h8z6l7/aws-transform:latest`
- Requires: VPC with private subnets + NAT Gateway
- ~5 min deploy, costs nothing when idle

### Epic 2: Create transformation definitions
- Clone APG repo documents
- Create BRE TD and Main TD via `atx json` in-chat flow
- Publish both — reused for all future EZT workloads

### Epic 3: Generate BRE (per workload) — MANDATORY

**This step CANNOT be skipped.** The BRE drives transformation accuracy.

- Zip EZT source → upload to managed S3 bucket
- Submit BRE job via Lambda
- Monitor until complete
- Download BRE, place in `bre-doc/`
- Human review gate — user must confirm BRE before proceeding

### Epic 4: Transform + validate (per workload)

**Gate:** Verify `bre-doc/` folder contains the BRE output. If empty → stop, go back to Epic 3.

- Zip full workspace (source-code/ + bre-doc/ + input-data/ + output-data/)
- Submit transformation job with `environment:{"JAVA_VERSION":"17"}`
- ~10 min per program (pre-built image, no install delays)
- AWS Transform generates Java, builds with Maven, validates byte-by-byte

### Epic 5: Deliver results
- Results in S3: `code.zip` (Java project) + `logs.zip` (conversation)
- Review knowledge items for continuous improvement

---

## Session Recovery (timeout/token expiry)

**CRITICAL:** When a job times out or token expires, NEVER restart from scratch.
Always recover the existing session.

### Capture conversation ID on submission

Every job response includes a conversation ID in the output path:
```
s3://atx-custom-output-{account}/transformations/{job}/{conversation-id}/
```

Store this. Also available from CloudWatch logs:
```bash
aws logs filter-log-events --log-group-name /aws/batch/atx-transform \
  --log-stream-name <logStreamName> \
  --filter-pattern "Conversation log" --limit 1
```

### Resume an interrupted session

If a job timed out or was interrupted:
```bash
aws lambda invoke --function-name atx-trigger-job \
  --payload '{"source":"s3://atx-source-code-{account}/repos/{project}.zip",
             "command":"atx --conversation-id {conversation-id}",
             "jobName":"EZT-{program}-resume",
             "environment":{"JAVA_VERSION":"17"}}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

Or use `atx --resume` to continue the most recent conversation:
```bash
"command":"atx --resume"
```

**Never start a new session when one was interrupted. Always resume.**

---

## Steering Files

| File | Inclusion | When active |
|---|---|---|
| `td-bootstrap.md` | manual | No TD exists — Epics 1-2 |
| `bre-extraction.md` | manual | TD exists, starting workload — Epic 3 |
| `transform-validate.md` | manual | BRE complete — Epics 4-5 |
| `troubleshooting.md` | manual | Validation fails, timeouts, or errors |

**Important:** The critical workflow gates (BRE required, baseline required) are
enforced BOTH in this POWER.md file AND via the `ezt-workflow-enforcement` hook.
This means even if a steering file fails to load, the enforcement still applies.
The steering files provide detailed step-by-step guidance but the guardrails
are not dependent on them.

### Phase Detection

1. Check if TDs exist (`atx custom def list`) → if not, load `td-bootstrap.md`
2. If TDs exist but `bre-doc/` is empty → load `bre-extraction.md`
3. If `bre-doc/` has content AND user approved it → load `transform-validate.md`
4. On failure/timeout → load `troubleshooting.md`

**Hard enforcement:** NEVER load `transform-validate.md` unless BRE output exists
in the workspace. Check `bre-doc/` folder — if empty, force `bre-extraction.md`.

---

## Agent Behavior

### Activation

Activate when the user mentions Easytrieve, EZT, mainframe batch transformation,
or drops `.ezt`, `.mac`, or `.jcl` files. Greet with:

> "Let's get your Easytrieve transformation started. I need three things:
> 1. **EZT source** — S3 path with your .ezt/.jcl/.mac files
> 2. **Input data** — S3 path to mainframe batch input (EBCDIC)
> 3. **Baseline output** — S3 path to mainframe output from running the job (EBCDIC)
>
> I'll handle workspace setup, BRE extraction, Java transformation, and
> byte-by-byte validation — all running serverless on AWS Batch."

### Rules
- Never expose internal mechanics — present outcomes, not process
- Refer to jobs by name, not raw IDs
- Always ask for S3 paths — never assume locations
- Present batch results with CloudWatch dashboard link
- On timeout/interruption: always resume, never restart

---

## Hard Rules (never violate)

1. Never proceed to transformation without BRE completed and human-approved
2. Never proceed without baseline output files in `output-data/`
3. Never auto-approve agent checkpoints — present to user first
4. Never hardcode TD names — discover dynamically
5. Never restart a timed-out session — always resume with conversation ID
6. Never run transformation without pre-built container image verified
7. On goal shift, suggest new chat session

**BRE ENFORCEMENT (inline — do not rely on steering files for this):**

Before submitting ANY `atx custom def exec -n Easytrieve-to-Java-Transformation` job,
you MUST verify that the `bre-doc/` folder in the workspace zip is non-empty.
If it is empty or missing, STOP and tell the user:

> "The Business Rule Extract hasn't been generated yet. This is a required step —
> it extracts the business logic from your EZT source and drives the accuracy of
> the Java transformation. Let me run the BRE step first."

Then run the BRE extraction (Epic 3) before proceeding. This check applies
regardless of which steering file is loaded or whether steering files loaded at all.

---

## Validation Gate Hook

```json
{
  "name": "EZT Validation Gate",
  "version": "1.0.0",
  "description": "Confirms BRE and baseline output exist before transformation runs",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Check that: (1) bre-doc/ contains the BRE output from Epic 3, and (2) output-data/ contains baseline mainframe output files. If EITHER is missing, stop and tell the user which step they need to complete first."
  }
}
```
