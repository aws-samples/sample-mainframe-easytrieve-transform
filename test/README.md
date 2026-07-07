# EZT Power Test Workload

This folder contains a sample Easytrieve transformation workload for end-to-end testing
of the EZT Kiro Power.

## Structure

```
test/
├── source-code/
│   └── EMPRPT.jcl          # Sample EZT program (inline in JCL)
├── input-data/
│   └── EMPLOYEE.DATA       # Sample input dataset (employee records)
├── output-data/
│   └── EMPLOYEE.REPORT     # Baseline mainframe output (expected result)
└── README.md               # This file
```

## The Test Program

**EMPRPT** is an Easytrieve batch program that:
1. Reads an employee master file
2. Sorts records by department and name
3. Filters for active employees (EMP-STATUS = 'A')
4. Produces a department summary report with salary totals
5. Prints a grand total at the end

### File Layout (EMPFILE)

| Field | Position | Length | Type | Description |
|---|---|---|---|---|
| EMP-ID | 1 | 6 | Alpha | Employee ID |
| EMP-NAME | 7 | 30 | Alpha | Employee name |
| EMP-DEPT | 37 | 4 | Alpha | Department code |
| EMP-SALARY | 41 | 8 | Numeric(2) | Annual salary (cents) |
| EMP-HIRE-DATE | 49 | 8 | Alpha | Hire date YYYYMMDD |
| EMP-STATUS | 57 | 1 | Alpha | A=Active, I=Inactive |

### Business Rules
- Only active employees (STATUS='A') are included in the report
- Records are sorted by department, then by name within department
- Department subtotals show total salary and employee count
- Grand total shows overall salary sum and total active employees
- Inactive employees (IDs 100010, 100015) are excluded

## Running the Test

### Using the EZT Power (target workflow)

1. Invoke the EZT power in Kiro
2. Point it to this test folder as source
3. The power will:
   - Create/reuse the Easytrieve-to-Java-Migration TD
   - Generate BRE from the source
   - Transform to Java Spring Boot
   - Validate output matches `output-data/EMPLOYEE.REPORT`

### Manual CLI test

```bash
# Set up workspace
mkdir -p /tmp/ezt-workspace/{source-code,bre-doc,input-data,output-data}
cp test/source-code/* /tmp/ezt-workspace/source-code/
cp test/input-data/* /tmp/ezt-workspace/input-data/
cp test/output-data/* /tmp/ezt-workspace/output-data/

# Initialize git
cd /tmp/ezt-workspace/source-code && git init && git add . && git commit -m "init"

# Run transformation
atx custom def exec \
  --transformation-name "Easytrieve-to-Java-Migration" \
  --code-repository-path /tmp/ezt-workspace/source-code \
  --build-command "mvn clean install" \
  --non-interactive \
  --trust-all-tools
```

## Expected Validation

The transformed Java application should:
1. Read `EMPLOYEE.DATA` from input-data/
2. Filter for active employees (status 'A')
3. Sort by department and name
4. Produce output matching `EMPLOYEE.REPORT` byte-for-byte
5. Build successfully with `mvn clean install`
