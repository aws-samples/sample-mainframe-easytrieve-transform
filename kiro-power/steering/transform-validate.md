---
inclusion: manual
---

# Transform and Validate — Lambda+Batch Remote Execution

Load this file when: TD is published, BRE is complete and approved, user is ready to transform.

---

## Before Running

Verify:
1. Remote infrastructure deployed: `aws cloudformation describe-stacks --stack-name AtxInfrastructureStack`
2. TD exists: `atx custom def list --json | grep Easytrieve-to-Java`
3. User has provided input-data/ and output-data/ files

If infrastructure not deployed → guide user through setup (see `aws-transform` power remote execution flow).
If output-data/ is missing → stop. Tell the user baseline files are required.

---

## Prepare and Submit Job

### Single program

1. Zip the full workspace (all 4 folders must be included):
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

4. Capture the `batchJobId` from the response.

### Multiple programs (batch)

For customers with multiple EZT programs, submit as a batch (up to 128 per call):

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
> "Transformation running on AWS Batch. Expected ~10 minutes for low-complexity programs."

When `SUCCEEDED`:
> "Transformation complete. Checking results..."

---

## Retrieve Results

Results are in S3 (do NOT auto-download):

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws s3 ls s3://atx-custom-output-${ACCOUNT}/transformations/<jobName>/
```

Each job produces:
- `code.zip` — transformed Java Spring Boot project
- `logs.zip` — AWS Transform conversation logs

Present to user:
```
🎉 Transformation Complete — SUCCEEDED

Job:        <jobName>
Duration:   <N> seconds
Results:    s3://atx-custom-output-{account}/transformations/<jobName>/<conversation-id>/

📁 code.zip         Your transformed Java Spring Boot application
📋 logs.zip         Full transformation conversation logs

To download:
  aws s3 cp s3://atx-custom-output-{account}/transformations/<jobName>/<conversation-id>/code.zip ./

Dashboard: https://us-east-1.console.aws.amazon.com/cloudwatch/home#dashboards/dashboard/ATX-Transform-CLI-Dashboard
```

---

## Validate Output Match

The transformation definition includes byte-by-byte validation as an exit criterion.
If the job status is `SUCCEEDED` with exit code 0, validation passed.

To confirm, download `code.zip`, extract, and check for `validation_summary.md` or
the build output showing `diff` exit code 0.

---

## Knowledge Items (post-success)

After successful transformations, review knowledge items:
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

If job status is `FAILED`, check the CloudWatch logs:
```bash
# Log stream from the job status response
aws logs get-log-events --log-group-name /aws/batch/atx-transform \
  --log-stream-name <logStreamName> --limit 50
```

Then load `troubleshooting.md` for resolution.
