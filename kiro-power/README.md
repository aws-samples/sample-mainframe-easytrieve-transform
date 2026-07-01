# Easytrieve Modernization — Kiro Power

Transform mainframe Broadcom Easytrieve (EZT) programs to Java 17 (Spring Boot 3.x)
using [AWS Transform custom](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/transform-easytrieve-modern-languages.html),
orchestrated end-to-end by Kiro.

---

## Step 1: Install Kiro

Download and install Kiro from [kiro.dev](https://kiro.dev). Sign in with your AWS Builder ID.

---

## Step 2: Install the aws-transform Power

1. Open Kiro
2. Open the **Powers** panel (left sidebar)
3. Search for **"aws-transform"**
4. Click **Install**

This provides the MCP tools Kiro uses to interact with AWS Transform.

---

## Step 3: Install the ezt-transform Power

Copy the `kiro-power/` folder contents to your Kiro custom powers directory:

| Platform | Copy to |
|---|---|
| Windows | `%LOCALAPPDATA%\Kiro\powers\ezt-transform\` |
| macOS | `~/Library/Application Support/Kiro/powers/ezt-transform/` |
| Linux | `~/.local/share/Kiro/powers/ezt-transform/` |

Example (Windows PowerShell):
```powershell
Copy-Item -Recurse .\kiro-power\* "$env:LOCALAPPDATA\Kiro\powers\ezt-transform\"
```

Example (macOS/Linux):
```bash
mkdir -p ~/Library/Application\ Support/Kiro/powers/ezt-transform
cp -r kiro-power/* ~/Library/Application\ Support/Kiro/powers/ezt-transform/
```

Then build the MCP server:
```bash
cd <powers-dir>/ezt-transform/mcp-server
npm install
npm run build
```

Restart Kiro. You should see "Easytrieve Modernization" in the Powers panel.

---

## Step 4: Configure AWS Credentials

You need AWS credentials with the `AWSTransformCustomFullAccess` managed policy attached.

```bash
aws configure
# Enter your Access Key ID, Secret Access Key, region: us-east-1
```

Verify:
```bash
aws sts get-caller-identity
```

---

## Step 5: Deploy Remote Infrastructure (one-time per account)

The transformation runs serverless on AWS Batch/Fargate. One team member deploys this once — everyone shares it.

**Option A — Ask Kiro to do it:**

Open a Kiro chat and say:
> "Set up AWS Transform custom remote infrastructure for EZT transformations"

Kiro (via the aws-transform power) will guide you through VPC configuration and deployment.

**Option B — Manual:**

```bash
# Clone infrastructure repo
git clone -b atx-remote-infra --single-branch \
  https://github.com/aws-samples/aws-transform-custom-samples.git ~/.aws/atx/custom/remote-infra
cd ~/.aws/atx/custom/remote-infra

# Edit cdk.json — set your VPC, private subnets (min 2), and security group
# Then deploy:
./setup.sh
```

Verify:
```bash
aws cloudformation describe-stacks --stack-name AtxInfrastructureStack \
  --query 'Stacks[0].StackStatus' --output text --region us-east-1
# Should return: CREATE_COMPLETE
```

---

## Step 6: Publish Transformation Definitions (one-time per account)

The EZT-specific TDs tell AWS Transform how to convert Easytrieve to Java. Publish once — everyone reuses them.

```bash
# Clone the APG pattern documents
git clone https://github.com/aws-samples/sample-mainframe-easytrieve-transform /tmp/ezt-apg

# Use atx CLI to create the transformation definition
atx
# When prompted, say: "Create a custom transformation using my transformation definition file at /tmp/ezt-apg/documents/transformation_definition.md"
# Review and publish as "Easytrieve-to-Java-Transformation"
```

Verify:
```bash
atx custom def list --json | grep Easytrieve
```

---

## Step 7: Use the Power

Open a Kiro chat and tell it about your EZT workload:

> "I want to transform my Easytrieve programs to Java.
> Source code is at s3://my-bucket/ezt-source/
> Input data is at s3://my-bucket/input-data/
> Baseline output is at s3://my-bucket/output-data/"

Kiro handles the rest:
1. Zips your workspace and uploads to the managed S3 bucket
2. Submits the transformation job via Lambda
3. Monitors progress (~10 min per program)
4. Delivers results with validation report

### What you need to provide

| Item | Description | Required |
|---|---|---|
| EZT source | `.ezt`, `.jcl`, `.mac` files — S3 path or local folder | Yes |
| Input data | Mainframe batch input files (EBCDIC) — as executed on z/OS | Yes |
| Baseline output | Mainframe output from running the EZT job with that input | Yes |

### What Kiro produces

| Output | Location |
|---|---|
| Java Spring Boot project | `s3://atx-custom-output-{account}/transformations/{job}/{id}/code.zip` |
| Transformation logs | `s3://atx-custom-output-{account}/transformations/{job}/{id}/logs.zip` |
| CloudWatch dashboard | `ATX-Transform-CLI-Dashboard` in your AWS console |

---

## Running the Included Test

Verify your setup works with the bundled test workload:

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

# Zip test data
cd Kiro-power/test
zip -r /tmp/ezt-test.zip source-code/ input-data/ output-data/

# Upload to managed bucket
aws s3 cp /tmp/ezt-test.zip s3://atx-source-code-${ACCOUNT}/repos/ezt-test.zip

# Submit job
aws lambda invoke --function-name atx-trigger-job \
  --payload "{\"source\":\"s3://atx-source-code-${ACCOUNT}/repos/ezt-test.zip\",\"command\":\"atx custom def exec -n Easytrieve-to-Java-Transformation -p /source/ezt-test/source-code -x -t\",\"jobName\":\"EZT-Test\",\"environment\":{\"JAVA_VERSION\":\"17\"}}" \
  --cli-binary-format raw-in-base64-out /dev/stdout

# Check status (wait ~10 min)
aws lambda invoke --function-name atx-get-job-status \
  --payload '{"jobId":"<jobId-from-above>"}' \
  --cli-binary-format raw-in-base64-out /dev/stdout
```

Expected result: `"status":"SUCCEEDED"` with `"exitCode":0` in ~10 minutes.

---

## Multiple EZT Programs (Batch Mode)

For portfolios with many EZT programs, Kiro submits them in parallel:

- Up to **128 concurrent** transformations per batch
- ~10 min wall-clock regardless of count (programs run simultaneously)
- Max 512 programs per session

Just tell Kiro:
> "I have 50 EZT programs to transform. They're all in s3://my-bucket/ezt-programs/"

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "AtxInfrastructureStack does not exist" | Run Step 5 to deploy infrastructure |
| "No transformation definitions found" | Run Step 6 to publish TDs |
| Lambda returns "Invalid command" | Check for special characters in the command string |
| Job FAILED | Check CloudWatch log group `/aws/batch/atx-transform` |
| Validation mismatch | Ensure baseline output is EBCDIC from the actual mainframe execution |

---

## Power Structure

```
Kiro-power/
├── POWER.md                         # Power behavior definition
├── README.md                        # This file
├── hooks/
│   └── ezt-validation-gate.json     # Baseline output enforcement
├── steering/
│   ├── td-bootstrap.md              # Infrastructure + TD creation guide
│   ├── bre-extraction.md            # Business rule extraction workflow
│   ├── transform-validate.md        # Transformation + validation workflow
│   └── troubleshooting.md           # Error resolution playbook
└── test/
    ├── source-code/EMPRPT.jcl       # Sample EZT program
    ├── input-data/EMPLOYEE.DATA     # Sample input dataset
    └── output-data/EMPLOYEE.REPORT  # Expected baseline output
```

---

## Links

- [APG Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/transform-easytrieve-modern-languages.html)
- [APG Source Repo](https://github.com/aws-samples/sample-mainframe-easytrieve-transform)
- [AWS Transform Custom Docs](https://docs.aws.amazon.com/transform/latest/userguide/custom.html)
- [AWS Transform Pricing](https://aws.amazon.com/transform/pricing/)
