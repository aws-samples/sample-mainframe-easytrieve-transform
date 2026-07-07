---
inclusion: manual
---

# Troubleshooting — NEEDS_REVIEW and Error Handling

Load this file when: validation fails, atx exhausts options, or user reports an error.

---

## NEEDS_REVIEW — Output Mismatch, atx Exhausted

When atx has run all iterations and output still does not match baseline:

Read the mismatch analysis:
```bash
LATEST=$(ls -t ~/.aws/atx/custom/ | head -1)
cat ~/.aws/atx/custom/$LATEST/artifacts/validation_summary.md
cat ~/.aws/atx/custom/$LATEST/logs/execution.log | tail -100
```

Present to the user — in plain language, not raw log output:
```
⚠️ Transformation needs your input

AWS Transform ran [N] iterations and could not fully match your baseline output.

What's unresolved:
  [program name]: [describe what the expected output represents vs what was generated]
  [program name]: [same]

Most likely cause: one or more programs use custom macros or proprietary utilities
that aren't fully documented in the transformation definition.

To resolve, I need one or more of the following — whichever you have:
  1. Documentation for custom macros (usage guide, spec, or description)
  2. Business rules for the unmatched programs
  3. An explanation of what the mismatched output section is supposed to represent

Which of these can you provide?
```

Wait for user response before retrying.

---

## Resolution Flow

### User provides additional documentation

1. Copy docs to the workspace:
```bash
cp <user-supplied-doc> /tmp/ezt-workspace/documents/
```

2. Re-publish the TD with the new context using AWS Transform tooling:
```bash
atx custom def update \
  --name "<discovered-TD-name>" \
  --documents-path /tmp/ezt-workspace/documents/
```

3. Find the interrupted conversation ID:
```bash
LATEST=$(ls -t ~/.aws/atx/custom/ | head -1)
grep "conversation-id" ~/.aws/atx/custom/$LATEST/logs/execution.log | tail -1
```

4. Resume from where atx stopped:
```bash
atx custom def exec \
  --conversation-id <conversation-id> \
  --non-interactive \
  --trust-all-tools
```

Tell the user:
> "Resuming transformation with the additional documentation included.
> Posting updates as it runs."

Return to transform-validate milestone update flow.

---

### User cannot provide documentation

If the user has no additional docs for the unmatched programs:

> "Without documentation for those programs, the transformation will likely
> produce the same result on retry. Here are your options:
>
> **Option A** — Accept partial transformation:
> The matched programs are ready. The flagged programs need manual Java conversion.
> I can deliver the partial output now with a clear list of what needs manual work.
>
> **Option B** — Engage your mainframe team:
> They can provide the macro specs or business rules. Once you have them,
> we can retry and the transformation should complete fully.
>
> Which would you prefer?"

For Option A — deliver partial output:
- Mark run status as `PARTIAL` in `pipeline-summary.json`
- Deliver transformed programs that passed to the output destination
- Include a `manual-review-required.md` listing the flagged programs with
  the specific mismatches and recommended manual steps

---

## Timeout and Session Recovery

### Lambda/Batch job timed out

**Root cause:** The default Batch job timeout may be too short for complex EZT programs.

**Fix:** Resume the conversation — do NOT restart from scratch:
```bash
# Get conversation ID from the S3 output path or CloudWatch logs
aws logs filter-log-events --log-group-name /aws/batch/atx-transform \
  --log-stream-name <logStreamName> --filter-pattern "Conversation log" --limit 1

# Resume
aws lambda invoke --function-name atx-trigger-job \
  --payload '{"source":"s3://atx-source-code-{account}/repos/{project}.zip",
             "command":"atx --conversation-id <conversation-id>",
             "jobName":"{program}-resume",
             "environment":{"JAVA_VERSION":"17"}}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

### Token/credential expiry during execution

**Root cause:** AWS session token expired while the Batch job was running.

**Fix:**
1. Have user refresh credentials: `aws sts get-caller-identity`
2. Resume the conversation (same as timeout recovery above)
3. The conversation state is preserved server-side for 30 days

**NEVER start a new session. Always use `--conversation-id` or `--resume`.**

### Container installing Java/Maven at runtime (20+ min delay)

**Root cause:** The `prebuiltImageUri` is not set in cdk.json, so the container
starts from a base image and installs everything from scratch.

**Fix:**
```bash
cd ~/.aws/atx/custom/remote-infra
# Verify current setting:
node -e "console.log(require('./cdk.json').context.prebuiltImageUri || 'NOT_SET')"

# If NOT_SET, fix it:
node -e "const f='./cdk.json';const c=JSON.parse(require('fs').readFileSync(f));c.context.prebuiltImageUri='public.ecr.aws/d9h8z6l7/aws-transform:latest';require('fs').writeFileSync(f,JSON.stringify(c,null,2))"

# Redeploy:
./setup.sh
```

The pre-built image includes Java 8/11/17/21/25, Maven, Gradle, Node.js, Python,
Git, AWS CLI, and atx CLI — all baked in with zero install time.

---

## Common Error Playbook

| Symptom | Root Cause | Resolution |
|---|---|---|
| Job FAILED + timeout | Batch timeout exceeded | Resume with `--conversation-id` (see above) |
| Job FAILED + token expired | AWS credentials expired mid-run | Refresh creds + resume with `--conversation-id` |
| 40+ min execution time | Container missing pre-built image | Set `prebuiltImageUri` in cdk.json + redeploy |
| BRE step was skipped | Power phase detection bypassed | Re-run BRE step — it's mandatory for accuracy |
| `atx` not found in container | Custom image without atx | Use pre-built image: `public.ecr.aws/d9h8z6l7/aws-transform:latest` |
| IAM permission denied | Missing policy | Attach `AWSTransformCustomFullAccess` to caller identity |
| Maven build fails in container | Wrong Java version activated | Verify `environment:{"JAVA_VERSION":"17"}` in job payload |
| S3 access denied | IAM role can't reach bucket | Ensure source is in managed bucket `atx-source-code-{account}` |
| Baseline files wrong format | Not EBCDIC | Files must be EBCDIC from z/OS — ASCII/UTF-8 causes false mismatches |
| TD not found | Not published | Run TD Bootstrap (Epic 2) first |
| Lambda "Invalid command" | Special characters in command | Avoid `( ) ! # % ^ * ? \ { } \| ; > <` in command string |

For any error not in this table:
1. Read the last 50 lines of `execution.log`
2. Present the error in plain language — not raw log output
3. Suggest the most likely fix based on the error type
4. Offer to retry once the fix is confirmed

---

## Knowledge Item Review (Post-PASS)

After any PASS run, offer to review knowledge items:

```bash
atx custom def list-ki --name "<discovered-TD-name>"
```

For each item, present:
- What the agent learned (in plain language)
- Whether it applies broadly or only to this program
- Recommended action (enable / skip)

Let the user decide on each. Never auto-enable without confirmation.

```bash
# Enable a specific item
atx custom def update-ki-status --name "<discovered-TD-name>" --id <id> --status ENABLED

# After 3+ PASS runs with manual review — offer auto-approval
atx custom def update-ki-config --name "<discovered-TD-name>" --auto-enabled TRUE
```
