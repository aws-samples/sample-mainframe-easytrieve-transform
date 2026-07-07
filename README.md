# Easytrieve Modernization

Transform mainframe Broadcom Easytrieve (EZT) programs to Java 17 (Spring Boot 3.x)
using [AWS Transform custom](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/transform-easytrieve-modern-languages.html).

---

## Two Solution Paths

| Path | Best for | How |
|---|---|---|
| **Kiro Power (recommended)** | End-to-end automation, team use | Install this repo as a Kiro Power — Kiro orchestrates everything |
| **Manual (CDK/CLI)** | Learning, customization, debugging | Deploy EC2 via CDK, run `atx` CLI commands manually |

---

## Path 1: Kiro Power (recommended)

Kiro handles everything: workspace setup, BRE extraction, Java transformation,
byte-by-byte validation — all running serverless on AWS Batch.

### Step 1: Install Kiro

Download from [kiro.dev](https://kiro.dev). Sign in with your AWS Builder ID.

### Step 2: Install the aws-transform Power

1. Open Kiro → **Powers** panel (left sidebar)
2. Search for **"aws-transform"** → Click **Install**

### Step 3: Install this Power

Point Kiro at this GitHub repo:

```
https://github.com/aws-samples/sample-mainframe-easytrieve-transform
```

Or install manually — clone and run:
```bash
git clone https://github.com/aws-samples/sample-mainframe-easytrieve-transform
cd sample-mainframe-easytrieve-transform/mcp-server
npm install
```

Then tell Kiro to use it, or copy to your powers directory:

| Platform | Copy to |
|---|---|
| Windows | `%LOCALAPPDATA%\Kiro\powers\sample-mainframe-easytrieve-transform\` |
| macOS | `~/Library/Application Support/Kiro/powers/sample-mainframe-easytrieve-transform/` |
| Linux | `~/.local/share/Kiro/powers/sample-mainframe-easytrieve-transform/` |

Restart Kiro. You should see **"Easytrieve Modernization"** in the Powers panel.

### Step 4: Configure AWS Credentials

```bash
aws configure
# Region: us-east-1
# Requires: AWSTransformCustomFullAccess policy
aws sts get-caller-identity  # verify
```

### Step 5: Deploy Remote Infrastructure (one-time per account)

Open a Kiro chat and say:
> "Set up AWS Transform custom remote infrastructure for EZT transformations"

Or see POWER.md for manual deployment instructions.

### Step 6: Use It

Open a Kiro chat:
> "I want to transform my Easytrieve programs to Java.
> Source: s3://my-bucket/ezt-source/
> Input data: s3://my-bucket/input-data/
> Baseline output: s3://my-bucket/output-data/"

Kiro does the rest (~10 min per program, 128 concurrent).

---

## Path 2: Manual (CDK + CLI)

For manual step-by-step execution, see **[README-CDK.md](README-CDK.md)**.

This deploys an EC2 instance with `atx` CLI pre-installed. You run the APG epics
manually via SSH/SSM:
1. Deploy EC2 via CDK/CloudFormation
2. Create transformation definitions using `atx` CLI
3. Run BRE extraction
4. Run transformation + validation
5. Review results

---

## Repository Structure

```
sample-mainframe-easytrieve-transform/
├── POWER.md                          # Kiro Power definition
├── README.md                         # This file
├── README-CDK.md                     # Manual path instructions (CDK/CLI)
├── mcp.json                          # MCP server config for Kiro
├── hooks/                            # Kiro agent hooks (workflow enforcement)
├── steering/                         # Phase-specific workflow guides
├── mcp-server/                       # Deterministic orchestration server (Node.js)
│   ├── src/                          # TypeScript source
│   └── dist/                         # Compiled JS (ready to run)
├── test/                             # Sample EZT test workload
├── documents/                        # Transformation definition source files
│   ├── transformation_definition.md
│   ├── bre_transformation_definition.md
│   ├── summaries.md
│   └── ca-easytrieve-report-generator-11-6.txt
├── app.py                            # CDK app entry point
├── easytrieve_transform_stack.py     # CDK stack (EC2 infrastructure)
├── easytrieve-transform-stack.yaml   # CloudFormation template
├── cdk.json                          # CDK config
└── requirements.txt                  # CDK Python dependencies
```

---

## Performance (Validated)

| Metric | Result |
|---|---|
| Single EZT program (low complexity) | ~10 min |
| Parallel capacity | 128 concurrent per batch |
| Max per session | 512 programs |
| Infrastructure cost when idle | $0 (serverless) |

---

## Links

- [APG Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/transform-easytrieve-modern-languages.html)
- [AWS Transform Custom Docs](https://docs.aws.amazon.com/transform/latest/userguide/custom.html)
- [AWS Transform Pricing](https://aws.amazon.com/transform/pricing/)
