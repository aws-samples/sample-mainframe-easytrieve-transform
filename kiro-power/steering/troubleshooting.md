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

## Common Error Playbook

| Symptom | Silent check | User-facing resolution |
|---|---|---|
| `atx` not found | `which atx` | "Install atx: `curl -fsSL https://desktop-release.transform.us-east-1.api.aws/install.sh \| bash`" |
| IAM permission denied | `aws sts get-caller-identity` | "Your AWS credentials need the `AWSTransformCustomFullAccess` policy. Ask your AWS admin to attach it." |
| Maven build fails | `java -version` | "Java 17 is required. Run: `sdk install java 17-amzn`" |
| Git not initialized | `ls /tmp/ezt-workspace/source-code/.git` | Run `git init && git add . && git commit -m "init"` silently, retry. |
| Execution interrupted | Check `execution.log` for conversation-id | Resume with `atx custom def exec --conversation-id <id>` |
| Out of memory during build | `atx` log shows heap error | "Increase JVM heap: add `-Xmx4g` to Maven options. If the EZT program is very large, we may need to split it into batches." |
| S3 access denied | `aws s3 ls s3://<bucket>` | "Your IAM role doesn't have access to that bucket. Ask your admin to add S3 read/write permissions." |
| Baseline files wrong format | File is not EBCDIC | "Baseline files must be in EBCDIC format — exactly as produced by the z/OS job. ASCII or UTF-8 conversions will cause false mismatches." |
| TD not found | `atx custom def list` | "No Easytrieve TD found. Run the TD Bootstrap phase first." |

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
