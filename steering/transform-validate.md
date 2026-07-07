---
inclusion: manual
---

# Transform and Validate — Lambda+Batch Remote Execution

Load this file when: TD is published, BRE is complete and approved, user is ready to transform.

---

## Pre-flight Checks (MANDATORY)

Before submitting any job, verify ALL of the following:

### 1. BRE exists (hard gate)
```bash
ls /tmp/ezt-workspace/bre-doc/ 2>/dev/null | wc -l
# Or check the S3 workspace zip contains bre-doc/ with files
```
If `bre-doc/` is empty → **STOP**. Tell the user:
> "The Business Rule Extract hasn't been generated yet. This is required before
> transformation — it drives the accuracy of the Java output. Let me run the BRE
> step first."

Go back to `bre-extraction.md`. **Never skip this.**

### 2. Baseline output exists (hard gate)
```bash
ls /tmp/ezt-workspace/output-data/ 2>/dev/null | wc -l
```
If empty → **STOP**. Baseline files are required for validation.

### 3. Remote infrastructure deployed
```bash
aws cloudformation describe-stacks --stack-name AtxInfrastructureStack \
  --query 'Stacks[0].StackStatus' --output text --region us-east-1
```
Must be `CREATE_COMPLETE` or `UPDATE_COMPLETE`.

### 4. Pre-built container image verified (CRITICAL)
```bash
cd ~/.aws/atx/custom/remote-infra 2>/dev/null && \
  node -e "console.log(require('./cdk.json').context.prebuiltImageUri || 'NOT_SET')"
```
Must be `public.ecr.aws/d9h8z6l7/aws-transform:latest`.

If NOT set or empty, the container will waste 20+ minutes installing Java/Maven
at runtime. Fix before proceeding:
> "The container image isn't configured correctly. Set `prebuiltImageUri` to
> `public.ecr.aws/d9h8z6l7/aws-transform:latest` in cdk.json and redeploy."

### 5. TD exists
```bash
atx custom def list --json | grep -i "Easytrieve-to-Java"
```

---

## Prepare and Submit Job

### Single program

1. Zip the full workspace (ALL 4 folders required):
   ```bash
   cd /path/to/workspace
   zip -r /tmp/ezt-program.zip source-code/ bre-doc/ input-data/ output-data/
   ```

2. Upload to managed S3 bucket:
   ```bash
   ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
   aws s3 cp /tmp/ezt-program.zip s3://atx-source-code-${ACCOUNT}/repos/ezt-program.zip
   ```

3. Submit via Lambda:
   ```bash
   aws lambda invoke --function-name atx-trigger-job \
     --payload '{"source":"s3://atx-source-code-'${ACCOUNT}'/repos/ezt-program.zip",
                "command":"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/ezt-program/source-code -x -t",
                "jobName":"EZT-ProgramName",
                "environment":{"JAVA_VERSION":"17"}}' \
     --cli-binary-format raw-in-base64-out /dev/stdout
   ```

4. **IMMEDIATELY capture** the `batchJobId` and `s3OutputPath` from the response.
   Store both — needed for monitoring AND session recovery.

### Multiple programs (batch)

Submit as a batch (up to 128 per call):
```bash
aws lambda invoke --function-name atx-trigger-batch-jobs \
  --payload '{"batchName":"EZT-Portfolio",
             "jobs":[
               {"source":"s3://...program1.zip","command":"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/program1/source-code -x -t","jobName":"EZT-Prog1","environment":{"JAVA_VERSION":"17"}},
               {"source":"s3://...program2.zip","command":"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/program2/source-code -x -t","jobName":"EZT-Prog2","environment":{"JAVA_VERSION":"17"}}
             ]}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

---

## Monitor Progress

### Single job
```bash
aws lambda invoke --function-name atx-get-job-status \
  --payload '{"jobId":"<batchJobId>"}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

### Batch
```bash
aws lambda invoke --function-name atx-get-batch-status \
  --payload '{"batchId":"<batchId>"}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

Poll every 60 seconds for first 10 polls, then every 5 minutes. Report only status changes.

Status progression: `SUBMITTED` → `RUNNABLE` → `STARTING` → `RUNNING` → `SUCCEEDED`/`FAILED`

Tell the user:
> "Transformation running on AWS Batch (~10 minutes for standard programs).
> The container has Java 17 and Maven pre-installed — no setup delay."

---

## Session Recovery (CRITICAL)

### On timeout

If the job status shows `FAILED` with a timeout reason, or if token expired mid-execution:

1. Get the conversation ID from the output S3 path or CloudWatch logs:
   ```bash
   aws logs filter-log-events --log-group-name /aws/batch/atx-transform \
     --log-stream-name <logStreamName> \
     --filter-pattern "Conversation log" --limit 1
   ```
   Or from the `s3OutputPath` in the job submission response — the conversation ID is the last path segment.

2. Resume with the conversation ID:
   ```bash
   aws lambda invoke --function-name atx-trigger-job \
     --payload '{"source":"s3://atx-source-code-'${ACCOUNT}'/repos/ezt-program.zip",
                "command":"atx --conversation-id <conversation-id>",
                "jobName":"EZT-ProgramName-resume",
                "environment":{"JAVA_VERSION":"17"}}' \
     --cli-binary-format raw-in-base64-out /dev/stdout
   ```

3. Or use `atx --resume` for the most recent conversation:
   ```bash
   "command":"atx --resume"
   ```

**NEVER start a fresh session when one was interrupted. The conversation state is
preserved server-side for 30 days. Always resume.**

### On token expiry

If the user's AWS credentials/token expired during execution:
1. Ask user to refresh credentials: `aws sts get-caller-identity`
2. Once refreshed, resume the interrupted conversation (see above)
3. Do NOT resubmit the original job — it will start from scratch

---

## Retrieve Results

When status is `SUCCEEDED`:

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws s3 ls s3://atx-custom-output-${ACCOUNT}/transformations/<jobName>/
```

Each job produces:
- `code.zip` — transformed Java Spring Boot project (builds with `mvn clean install`)
- `logs.zip` — AWS Transform conversation logs

Present to user:
```
🎉 Transformation Complete — SUCCEEDED

Job:        <jobName>
Duration:   <N> seconds
Results:    s3://atx-custom-output-{account}/transformations/<jobName>/<conversation-id>/

📁 code.zip         Java Spring Boot application (Java 17, Maven)
📋 logs.zip         Full transformation conversation logs

To download:
  aws s3 cp s3://atx-custom-output-{account}/transformations/<jobName>/<conversation-id>/code.zip ./

Dashboard: https://us-east-1.console.aws.amazon.com/cloudwatch/home#dashboards/dashboard/ATX-Transform-CLI-Dashboard
```

---

## Validate Output Match

The TD includes byte-by-byte validation as an exit criterion.
`SUCCEEDED` with exit code 0 = validation passed.

To double-check, download `code.zip` and look for `validation_summary.md`:
```bash
unzip code.zip -d ./transformed
cat ./transformed/artifacts/validation_summary.md | grep "OVERALL STATUS"
```

---

## Knowledge Items (post-success)

After successful transformations:
```bash
atx custom def list-ki -n "Easytrieve-to-Java-Transformation"
```

Present each to user. If approved:
```bash
atx custom def update-ki-status -n "Easytrieve-to-Java-Transformation" --id <id> --status ENABLED
```

After 3+ successful runs, offer auto-approval:
```bash
atx custom def update-ki-config -n "Easytrieve-to-Java-Transformation" --auto-enabled TRUE
```

---

## FAILED — Load Troubleshooting

If job status is `FAILED`:
1. Check if it's a timeout → resume (see Session Recovery above)
2. Check CloudWatch logs for the actual error:
   ```bash
   aws logs get-log-events --log-group-name /aws/batch/atx-transform \
     --log-stream-name <logStreamName> --limit 50
   ```
3. Load `troubleshooting.md` for resolution guidance
