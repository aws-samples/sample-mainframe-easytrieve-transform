---
inclusion: manual
---

# BRE Extraction — Intake Checklist and Business Rule Extract

Load this file when: the TD exists and the user is starting a new EZT workload transformation.

BRE extraction runs once per workload (per EZT program or batch of related programs).
The BRE is the primary input that drives transformation accuracy — the more complete it is,
the better the output matches the mainframe baseline.

---

## The 5-Item Intake Checklist

Walk through each item ONE AT A TIME. Validate each before moving to the next.
Never ask two questions at once.

---

### Item 1 — EZT Source Location

Ask:
> "Where are your Easytrieve source files?
> You can share an S3 path, a local folder, or a Git repo URL."

**If S3:** run silently, show result:
```bash
aws s3 ls s3://<path>/ --recursive | grep -iE "\.(ezt|mac|jcl)$"
```
Present: "Found [N] EZT files and [N] macro files."
If nothing found: "No EZT files found at that path. Check the prefix and try again."

**If local:** run silently, show result:
```bash
find <path> -type f \( -iname "*.ezt" -o -iname "*.mac" -o -iname "*.jcl" \)
```

**If Git:** clone silently to `/tmp/ezt-source/`, then list files.

Wait for confirmation before moving to Item 2. ✅

---

### Item 2 — Mainframe Batch Input Files

Ask:
> "Do you have the mainframe batch input files? These are the datasets your
> EZT program reads on z/OS — Sequential, Text, or DB2 exports in EBCDIC format."

If yes: ask for location, sync to `/tmp/ezt-workspace/input-data/`
```bash
# S3
aws s3 sync s3://<path>/ /tmp/ezt-workspace/input-data/

# Local
cp -r <local-path>/ /tmp/ezt-workspace/input-data/
```

If no or unsure:
> "These are needed for the validation step. Without them we can still generate code,
> but we cannot verify the output is functionally equivalent to your mainframe program.
> Do you want to proceed without validation, or pause to collect them?"

If user chooses to proceed without: note this in the run summary, skip validation in Phase 3.

Wait for confirmation. ✅

---

### Item 3 — Baseline Mainframe Output (Hard Gate)

Ask:
> "Do you have the baseline output files? These are the exact files your EZT program
> produced on the mainframe using the same input data — the gold standard we validate against."

If yes: ask for location, sync to `/tmp/ezt-workspace/output-data/`
```bash
# S3
aws s3 sync s3://<path>/ /tmp/ezt-workspace/output-data/

# Local
cp -r <local-path>/ /tmp/ezt-workspace/output-data/
```

Verify at least one file exists:
```bash
ls /tmp/ezt-workspace/output-data/ | wc -l
```

If no:
> "⚠️ Baseline output files are required for functional validation.
> Without them, we cannot confirm the transformed Java produces identical results
> to your mainframe program — which is a hard requirement of this transformation pattern.
>
> Please get these from your mainframe team: run the EZT job with the same input,
> capture the output files, and share them here. I'll wait."

**Do not proceed until baseline files are confirmed present.**

Wait for confirmation. ✅

---

### Item 4 — Custom Macros or Proprietary Utilities?

Ask:
> "Do your EZT programs use any custom-developed macros or proprietary utilities —
> code your organization wrote that isn't part of the standard Easytrieve product?"

If yes:
> "Those will need additional documentation for accurate transformation.
> Do you have a usage guide, specification, or description for them?
> (You can share a file path, S3 location, or paste a description here.)"

If docs available: copy to `/tmp/ezt-workspace/documents/custom-macros/`
If not available: flag in run summary as MANUAL_REVIEW_REQUIRED for those programs.

If no: note confirmed, continue. ✅

---

### Item 5 — Output Destination

Ask:
> "Where should the transformed Java application and validation report be delivered?
> (S3 bucket path or local folder)"

Verify the destination is writable:
```bash
# S3
aws s3 ls s3://<bucket>/ 2>&1

# Local
ls <path> 2>&1
```

If S3 bucket doesn't exist:
> "That bucket doesn't exist. Want me to create it?"

Store destination as `OUTPUT_DEST` for use in the transform phase. ✅

---

## Pre-flight Summary

Once all 5 items are confirmed, present this summary and wait for "go":

```
✅ Ready to Transform

Source:        [N] EZT files, [N] macros       from [location]
Input data:    [N] files                        from [location]
Baseline:      [N] files                        from [location]
Custom macros: [yes — documented | yes — undocumented | none]
Output:        [destination]

I'll now generate the Business Rule Extract from your EZT source,
then run the transformation autonomously.

Type 'go' to start — or let me know if anything needs adjusting.
```

**Never auto-proceed. Wait for explicit user confirmation.**

---

## BRE Generation

After "go", tell the user:
> "Generating your Business Rule Extract — extracting business logic,
> file layouts, data lineage, and data type mappings from your EZT source.
> This takes a few minutes."

Set up the workspace:
```bash
mkdir -p /tmp/ezt-workspace/{source-code,bre-doc,input-data,output-data,documents}

# Stage source
aws s3 sync s3://<source-path>/ /tmp/ezt-workspace/source-code/
# or
cp -r <local-path>/ /tmp/ezt-workspace/source-code/

# Initialize Git (required by atx)
cd /tmp/ezt-workspace/source-code
git init && git add . && git commit -m "EZT source — initial commit"
```

Run BRE extraction using `atx`:
```bash
atx custom def exec \
  --transformation-name "<discovered-TD-name>" \
  --code-repository-path /tmp/ezt-workspace/source-code \
  --bre-only \
  --documents-path /tmp/ezt-workspace/documents/
```

The BRE produces:
- Business rule catalog
- File layout definitions
- Data lineage mappings
- Data type conversion mappings

Save BRE output to `/tmp/ezt-workspace/bre-doc/`.

---

## BRE Human Review Gate

**Never skip this gate.**

Present a summary to the user:
> "Business Rule Extract is complete. Here's what was found:
>
> - [N] business rules extracted
> - [N] file layouts identified
> - [N] data lineage mappings
> - Programs flagged for manual review: [list if any]
>
> Please review the BRE before I proceed. Does this look complete and accurate?
> Any programs or rules missing?"

If user requests changes: work with them to supplement the BRE with additional
documentation before proceeding.

When user confirms BRE is good → proceed to transform-validate phase.
