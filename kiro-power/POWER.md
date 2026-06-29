---
name: "ezt-transform"
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
version: "1.1.0"
---

# Easytrieve Modernization Power

Transform mainframe Easytrieve (EZT) programs to Java 17 (Spring Boot 3.x) using
AWS Transform custom. Based on the [AWS Prescriptive Guidance pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/transform-easytrieve-modern-languages.html).

Source repo: [sample-mainframe-easytrieve-transform](https://github.com/aws-samples/sample-mainframe-easytrieve-transform)

---

## Prerequisites

| Requirement | How to verify | Resolution |
|---|---|---|
| **aws-transform** Kiro Power | Check Powers panel | Install from Kiro Powers panel |
| AWS credentials | `aws sts get-caller-identity` | `aws configure` with `AWSTransformCustomFullAccess` policy |
| Remote infrastructure | `aws cloudformation describe-stacks --stack-name AtxInfrastructureStack` | Deploy via `aws-transform` power (see below) |

### How It Works

This power uses **Lambda+Batch remote execution** from the `aws-transform` power:

1. User provides S3 paths to EZT source + input/output data
2. Kiro zips the workspace and uploads to the managed S3 bucket (`atx-source-code-{account}`)
3. Kiro submits a job via `aws lambda invoke --function-name atx-trigger-job`
4. AWS Batch runs `atx custom def exec` in a Fargate container (~10 min per program)
5. Results land in `s3://atx-custom-output-{account}/transformations/{job}/`

**Parallelism:** Multiple EZT programs run simultaneously — up to 128 concurrent.
A portfolio of 50 EZT programs completes in ~12-15 minutes (same as 1 program).

### Infrastructure Setup (one-time)

The `AtxInfrastructureStack` deploys:
- 8 Lambda functions (trigger, status, terminate, list — single + batch)
- AWS Batch/Fargate compute environment (costs nothing when idle)
- S3 buckets for source code and output (KMS encrypted)
- CloudWatch dashboard for monitoring
- Pre-built container image with Java 17, Maven, atx CLI (no Docker needed)

Deploy using the `aws-transform` power's remote execution flow, or manually:
```bash
git clone -b atx-remote-infra --single-branch \
  https://github.com/aws-samples/aws-transform-custom-samples.git ~/.aws/atx/custom/remote-infra
cd ~/.aws/atx/custom/remote-infra
# Configure cdk.json with your VPC, subnets, security group
./setup.sh
```

### Published Transformation Definitions (one-time)

The EZT TDs must be published once per account:
- **Easytrieve-Business-Rule-Extract** — extracts business rules from EZT source
- **Easytrieve-to-Java-Transformation** — transforms EZT to Java with validation

Create using the `aws-transform` power's in-chat TD creation flow with documents from:
```
https://github.com/aws-samples/sample-mainframe-easytrieve-transform/tree/main/documents
```

Verify: `atx custom def list --json | grep Easytrieve`

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
- Requires: VPC with private subnets + NAT Gateway
- ~5 min deploy, costs nothing when idle

### Epic 2: Create transformation definitions
- Clone APG repo documents
- Create BRE TD and Main TD via `atx json` in-chat flow
- Publish both — reused for all future EZT workloads

### Epic 3: Generate BRE (per workload)
- Zip EZT source → upload to managed S3 bucket
- Submit BRE job via Lambda:
  ```bash
  aws lambda invoke --function-name atx-trigger-job \
    --payload '{"source":"s3://atx-source-code-{account}/repos/{project}.zip",
               "command":"atx custom def exec -n Easytrieve-Business-Rule-Extract -p /source/{project}/source-code -x -t",
               "jobName":"BRE-{program}"}' \
    --cli-binary-format raw-in-base64-out /dev/stdout
  ```
- Monitor: `aws lambda invoke --function-name atx-get-job-status --payload '{"jobId":"..."}'`
- Download BRE from output S3, place in `bre-doc/`
- Human review gate

### Epic 4: Transform + validate (per workload)
- Zip full workspace (source-code/ + bre-doc/ + input-data/ + output-data/)
- Submit transformation job:
  ```bash
  aws lambda invoke --function-name atx-trigger-job \
    --payload '{"source":"s3://atx-source-code-{account}/repos/{project}.zip",
               "command":"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/{project}/source-code -x -t",
               "jobName":"EZT-{program}",
               "environment":{"JAVA_VERSION":"17"}}' \
    --cli-binary-format raw-in-base64-out /dev/stdout
  ```
- ~10 min per program, runs in parallel for multiple programs
- AWS Transform generates Java, builds with Maven, validates byte-by-byte

### Epic 5: Deliver results
- Results in: `s3://atx-custom-output-{account}/transformations/{job}/{conversation-id}/`
  - `code.zip` — transformed Java Spring Boot project
  - `logs.zip` — full conversation logs
- Review knowledge items for continuous improvement

---

## Batch Execution (multiple EZT programs)

For customers with multiple EZT programs, submit a batch:
```bash
aws lambda invoke --function-name atx-trigger-batch-jobs \
  --payload '{"batchName":"EZT-Portfolio-Transform",
             "jobs":[
               {"source":"s3://.../program1.zip","command":"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/program1/source-code -x -t","jobName":"EZT-Program1","environment":{"JAVA_VERSION":"17"}},
               {"source":"s3://.../program2.zip","command":"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/program2/source-code -x -t","jobName":"EZT-Program2","environment":{"JAVA_VERSION":"17"}}
             ]}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

Monitor batch: `aws lambda invoke --function-name atx-get-batch-status --payload '{"batchId":"..."}'`

**Validated performance:**
- 1 EZT program (low complexity): ~10 min
- Up to 128 concurrent programs per batch submission
- Max 512 programs per session (split into chunks of 128)

---

## Steering Files

| File | When to load |
|---|---|
| `td-bootstrap.md` | No TD exists — Epics 1-2 |
| `bre-extraction.md` | TD exists, starting workload — Epic 3 |
| `transform-validate.md` | BRE complete — Epics 4-5 |
| `troubleshooting.md` | Validation fails or errors |

### Phase Detection

1. Check if TDs exist (`atx custom def list`) → if not, load `td-bootstrap.md`
2. If TDs exist but no BRE → load `bre-extraction.md`
3. If BRE exists and approved → load `transform-validate.md`
4. On failure → load `troubleshooting.md`

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

---

## Hard Rules (never violate)

1. Never proceed without baseline output files
2. Never auto-approve agent checkpoints — present to user first
3. Never hardcode TD names — discover dynamically
4. Never skip BRE generation
5. Never start transformation without human-approved BRE
6. On goal shift, suggest new chat session

---

## Validation Gate Hook

```json
{
  "name": "EZT Validation Gate",
  "version": "1.0.0",
  "description": "Confirms baseline output files exist before transformation runs",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Check that output-data/ contains baseline mainframe output files. If missing, stop and ask the user to supply them before proceeding."
  }
}
```
