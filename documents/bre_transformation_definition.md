# Easytrieve-Business-Rule-Extract

## Objective

Extract comprehensive business rules from mainframe Easytrieve programs, COBOL programs, JCL job streams, copybooks, and control cards, producing two structured BRE (Business Requirements Extract) documents that fully catalog all business logic, data layouts, processing flows, and transformation rules with sufficient detail to serve as input for downstream code transformation packages such as the Easytrieve-to-Java-Migration transformation.

## Summary

This transformation analyzes all mainframe source artifacts in the source-code folder including Easytrieve programs (.ezt files), inline Easytrieve embedded in JCL, JCL job streams (.jcl/.JCL files), COBOL programs, copybooks, and control cards. It proceeds through five phases: (1) inventory and dependency mapping of all source artifacts, (2) detailed program analysis and business rule extraction for Easytrieve and COBOL programs, (3) data flow and file layout documentation with field-by-field definitions including mainframe data types and Java-equivalent type mappings, (4) business rule cataloging and classification with unique identifiers, and (5) assembly and validation of two BRE output documents. The first BRE document covers JCL and PROC business requirements with detailed analysis of Easytrieve/COBOL-related steps and high-level coverage of non-Easytrieve/non-COBOL steps. The second BRE document covers all Easytrieve programs (including inline from JCL) and COBOL programs with full detailed business rules. Both documents are written to the bre-doc folder. If baseline data files are present in the optional input-data and output-data folders, validation cross-references documented file layouts against the actual baseline data; if these folders do not exist or are empty, this cross-validation step is skipped.

## Entry Criteria

1. Source code must be organized with at minimum a 2-folder structure: (1) source-code folder containing mainframe source files (Easytrieve .ezt files, JCL .jcl/.JCL files, COBOL programs, copybooks, control cards), (2) bre-doc folder as the output destination for BRE documents. Optionally, (3) input-data folder containing baseline input files and (4) output-data folder containing baseline output files may be present. The transformation will proceed successfully whether or not the input-data and output-data folders exist or contain files.
2. JCL files must have .jcl or .JCL file extensions
3. Easytrieve code must be either inline statements within JCL files (delimited by SYSIN DD * or SYSIN DD DATA) or separate .ezt files in the source-code folder
4. COBOL programs, if present, must be identifiable source files with standard COBOL division structure (IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE)
5. Copybooks, if present, must be identifiable as COPY member source files referenced by COBOL or Easytrieve programs
6. Control cards, if present, must be identifiable parameter files referenced by JCL DD statements (typically SYSIN or PARM)
7. The bre-doc folder must exist (or be creatable) as the output destination for the generated BRE documents
8. If the mainframe application uses GDG (Generation Data Group) datasets, the GDG base definitions and generation referencing patterns (relative generation numbers such as +1, 0, -1, -n) must be identifiable in JCL DD statements

## Implementation Steps

### Phase 1: Source Code Inventory and Dependency Mapping

#### 1.1 Enumerate and Classify All Source Artifacts

Scan the entire source-code folder and classify every file into one of the following artifact types: (a) Easytrieve programs -- standalone .ezt files, (b) Inline Easytrieve -- Easytrieve code embedded within JCL SYSIN DD * or SYSIN DD DATA blocks, (c) JCL job streams -- files with .jcl or .JCL extensions containing JOB, EXEC, and DD statements, (d) COBOL programs -- source files containing IDENTIFICATION DIVISION or PROGRAM-ID markers, (e) Copybooks -- COPY member files referenced by COBOL COPY statements or Easytrieve COPY statements, (f) Control cards -- parameter/input files referenced by JCL DD statements for program configuration. Record the file name, file path, file type, and approximate line count for each artifact. Produce a complete source artifact inventory table.

#### 1.2 Parse JCL Job Streams and Identify All Steps

For each JCL file, parse and extract: (a) JOB statement with job name, class, MSGCLASS, NOTIFY, and other job-level parameters, (b) every EXEC statement with PGM= or PROC= references and PARM= values, (c) every DD statement with DSN=, DISP=, DCB= (RECFM, RECL, BLKSIZE), SPACE=, and UNIT= parameters, (d) PROC definitions and symbolic parameter declarations with default values, (e) IF/THEN/ELSE/ENDIF conditional execution blocks, (f) COND parameters on EXEC and JOB statements specifying return code conditions, (g) INCLUDE statements and JCLLIB ORDER references, (h) SORT control statements embedded in SYSIN for DFSORT/SYNCSORT utility steps. For each EXEC step, classify it as: Easytrieve step (PGM=EZTPA00, PGM=EZTPX00, or similar Easytrieve runtime), COBOL step (PGM= referencing a COBOL program), utility step (IEBGENER, IEBCOPY, IDCAMS, DFSORT, ICETOOL, etc.), or other step (any other program reference).

#### 1.3 Extract Inline Easytrieve Code from JCL

For each JCL step identified as an Easytrieve execution step, extract the inline Easytrieve source code from the associated SYSIN DD * or SYSIN DD DATA block. Record the extracted code with its originating JCL file name, job name, and step name. Treat each extracted inline Easytrieve block as a separate logical Easytrieve program for subsequent analysis in Phase 2, linking it back to its parent JCL step context.

#### 1.4 Build Cross-Artifact Dependency Graph

Construct a dependency graph that maps relationships between all artifacts: (a) JCL jobs to the programs they execute (Easytrieve, COBOL, utilities), (b) JCL steps to input and output datasets via DD statements, (c) Easytrieve programs to FILE declarations and their corresponding JCL DD names, (d) COBOL programs to copybooks via COPY statements, (e) COBOL programs to files via SELECT/ASSIGN and FD statements, (f) Programs to control cards via SYSIN or PARM DD references, (g) Inter-step dependencies via temporary datasets (&&TEMP or DSN= references shared across steps), (h) GDG dataset references with relative generation numbers identified in DD DSN= parameters. Document the complete dependency graph showing which JCL jobs call which programs, which programs read/write which files, which copybooks are shared across programs, and how data flows between JCL steps via intermediate datasets.

#### 1.5 Map Source Files to Baseline Data Files (Optional -- Skip If No Baseline Data Present)

Document all confirmed mappings and flag any unmatched DD references or baseline data files. This mapping will be used in Phase 5 for optional validation. If neither the input-data nor output-data folders exist, or if they are empty, skip this step entirely and proceed to Phase 2 without error.

### Phase 2: Program Analysis and Business Rule Extraction

#### 2.1 Analyze Easytrieve Programs -- FILE Declarations and Field Definitions

For each Easytrieve program (standalone .ezt and inline from JCL), parse and document all FILE declarations including: file name, file organization (SEQUENTIAL, INDEXED, RELATIVE, VIRTUAL, TABLE), record format (F, V, FB, VB, VBS, U), record length, and associated JCL DD name. For each FILE, extract all field DEFINE statements documenting: field name, starting position, length, data type (A for alphanumeric, N for numeric/zoned decimal, P for packed decimal, B for binary, M for mixed DBCS, K for DBCS, U for unsigned numeric, I for signed integer), decimal positions, OCCURS clauses for arrays with index definitions, VARYING length field specifications, VALUE/RESET initialization values, MASK edit patterns, and any field redefinition relationships. Document working storage fields (W type prefix) and static fields (S type prefix) separately from file-based fields. Map every Easytrieve data type to its Java equivalent: A to String, N to BigDecimal or int/long, P (packed decimal) to BigDecimal, B (binary) to int/long/BigInteger depending on length, U to BigDecimal, I to int/long.

#### 2.2 Analyze Easytrieve Programs -- JOB Activities and Processing Logic

For each Easytrieve program, identify all JOB activity declarations and their INPUT file associations (JOB INPUT file-name or JOB INPUT NULL for no-input jobs). For each JOB activity, extract the complete processing logic including: (a) File processing operations -- GET (read records with HOLD/NOHOLD options), PUT (write records), POINT (position for keyed access), READ/WRITE for explicit I/O, SELECT for conditional record inclusion, (b) SORT operations with sort key specifications (USING clause with field names and ASC/DESC order), BEFORE sort procedures, and output handling, (c) Control flow -- IF/ELSE-IF/ELSE/END-IF conditional blocks with all condition types (field relational tests, series tests, class tests, file presence tests, record relational tests, combined AND/OR conditions), DO WHILE/UNTIL loops, PERFORM paragraph calls, GO TO branching (including GO TO JOB for activity transfer), CASE/END-CASE multi-way branching, EXIT statements, (d) Data manipulation -- assignment statements with arithmetic expressions (addition, subtraction, multiplication, division) including ROUNDED/TRUNCATED/INTEGER modifiers, MOVE statements for character transfer without conversion, MOVE LIKE for transferring fields with identical names between files, (e) CALL statements for external subprogram invocation (STATIC/DYNAMIC binding), EXECUTE for invoking other activities within the same program. Document the sequential flow of each JOB activity as a series of numbered business rule statements.

#### 2.3 Analyze Easytrieve Programs -- Report Generation Logic

For each Easytrieve program containing REPORT, PRINT, or DISPLAY output statements, extract and document: (a) REPORT declarations with report name, output file, page formatting (line size, page size), SEQUENCE fields (sort order for report), CONTROL fields (break level hierarchy for subtotals/totals), SUMMARY reporting mode, TITLESKIP and spacing parameters, (b) TITLE lines with literal text and field references for report headers, (c) LINE definitions specifying output field placement, column positions, and formatting, (d) HEADING overrides for column headers, (e) SUM fields for automatic accumulation at control breaks, (f) Report procedures -- BEFORE-LINE (pre-print processing), AFTER-LINE (post-print processing), BEFORE-BREAK (pre-break processing), AFTER-BREAK (post-break subtotal/total logic), ENDPAGE (page overflow handling), REPORT-INPUT (custom record selection for reports), (g) DISPLAY statements with NEWPAGE options and inline field formatting, (h) PRINT statements with LINE definitions for ad-hoc output. Document the business purpose of each report, its output destination, and the complete field layout of every output line.

#### 2.4 Analyze Easytrieve Programs -- Database Access Patterns

For each Easytrieve program that accesses databases, extract and document: (a) SQL database access via embedded SQL statements (SELECT, INSERT, UPDATE, DELETE) including table names, column references, WHERE clause conditions, JOIN logic, cursor declarations and FETCH loops, COMMIT/ROLLBACK processing, and SQL INCLUDE for host variable definitions, (b) IMS/DLI database access via DLI statements with PCB references, segment search arguments (SSAs), GU/GN/GNP/ISRT/REPL/DLET calls, (c) IDMS database access via FIND/OBTAIN/STORE/MODIFY/ERASE/CONNECT/DISCONNECT statements with area, set, and record references, (d) VSAM file access patterns including keyed reads (POINT followed by GET), sequential processing, and update-in-place (GET with HOLD followed by PUT with UPDATE). For each database access, document the business purpose, the data being accessed or modified, and any transaction boundaries (COMMIT processing with automatic vs controlled commit modes).

#### 2.5 Analyze COBOL Programs -- Division Structure and Business Logic

For each COBOL program referenced in the JCL job streams, parse and document: (a) IDENTIFICATION DIVISION -- program name, author, date-written, remarks describing program purpose, (b) ENVIRONMENT DIVISION -- CONFIGURATION SECTION with SPECIAL-NAMES (e.g., DECIMAL-POINT IS COMMA), INPUT-OUTPUT SECTION with SELECT/ASSIGN statements mapping file logical names to JCL DD names, file organization (SEQUENTIAL, INDEXED, RELATIVE), access mode (SEQUENTIAL, RANDOM, DYNAMIC), record key definitions, (c) DATA DIVISION -- FILE SECTION with FD (File Description) entries including record length, block size, recording mode, and all 01-level record descriptions with complete field hierarchies; WORKING-STORAGE SECTION with all data item definitions including level numbers, PIC clauses, USAGE clauses (DISPLAY, COMP, COMP-3, COMP-1, COMP-2, BINARY, PACKED-DECIMAL), VALUE clauses, OCCURS clauses with DEPENDING ON for variable-length arrays, REDEFINES for alternate data interpretations, 88-level condition names, (d) PROCEDURE DIVISION -- all paragraphs and sections with their business logic flow, PERFORM THRU sequences, EVALUATE/WHEN (case logic), IF/ELSE conditional processing, file I/O (OPEN, READ, WRITE, REWRITE, DELETE, CLOSE, START), MOVE/COMPUTE/ADD/SUBTRACT/MULTIPLY/DIVIDE arithmetic operations, STRING/UNSTRING operations, INSPECT/TALLY/REPLACING operations, CALL to subprograms with USING parameters, SORT/MERGE operations with INPUT/OUTPUT PROCEDURE. Map every COBOL data type to its Java equivalent: PIC X to String, PIC 9 (DISPLAY) to BigDecimal or String, PIC 9 COMP-3 (packed decimal) to BigDecimal, PIC 9 COMP/COMP-4/BINARY to int/long, PIC 9 COMP-1 to float, PIC 9 COMP-2 to double, PIC S9 (signed) variants follow the same mapping with sign handling.

#### 2.6 Analyze Copybooks -- Data Structure Definitions

For each copybook referenced by COBOL or Easytrieve programs, extract the complete data structure definition including: all level numbers (01 through 49, 66 for RENAMES, 77 for independent items, 88 for condition names), field names, PIC clauses with exact picture strings, USAGE clauses, VALUE clauses, OCCURS/DEPENDING ON, REDEFINES relationships, and FILLER entries with their byte positions. Calculate byte offsets for every field within the record structure. Document which programs reference each copybook and whether the copybook defines input records, output records, working storage structures, or communication areas. Create a field-by-field table for each copybook showing: field name, level, PIC clause, mainframe data type (EBCDIC alphanumeric, zoned decimal, packed decimal, binary, COMP-3, COMP), byte offset, byte length, decimal positions, and Java-equivalent data type.

#### 2.7 Analyze Control Cards -- Parameter Definitions

For each control card file referenced in JCL DD statements (typically SYSIN for utility programs or parameter files for application programs), document: the card format (fixed columns, keyword=value pairs, positional parameters, or free-form text), all parameter names and their valid values, the business meaning of each parameter, how parameters influence program execution flow, and any embedded code or inline data within control cards. If control cards contain DFSORT/SYNCSORT control statements, document the SORT FIELDS, INCLUDE/OMIT conditions, OUTREC/INREC reformatting, and SUM FIELDS specifications.

### Phase 3: Data Flow and File Layout Documentation

#### 3.1 Document Complete File Layouts with Field Definitions

For every input and output file identified in the source artifacts, create a comprehensive file layout document containing: (a) File identification -- file name/DSN, JCL DD name, file organization, record format, record length, block size, (b) Record layout table with columns for: field name, byte offset (starting position), byte length, mainframe data type (EBCDIC alphanumeric, zoned decimal N, packed decimal P/COMP-3, binary B/COMP/COMP-4, signed/unsigned variants), decimal positions, PIC clause or Easytrieve DEFINE specification, description/business meaning, valid value ranges or domain values, and Java-equivalent data type mapping (String, BigDecimal, int, long, float, double, BigInteger, byte[]), (c) For files with multiple record types (identified by a record type indicator field), document each record layout variant separately with the discriminator field value that identifies it, (d) For GDG datasets, document the GDG base name, generation referencing pattern (create +1, read current 0, read previous -1/-n), and the role of each generation in the processing flow.

#### 3.2 Document Data Lineage from Input to Output

For each processing flow (JCL job or sequence of jobs), trace the complete data lineage: (a) Source input files and their record layouts, (b) Intermediate transformations applied at each step (field mappings, calculations, filtering criteria, sort operations, aggregation/summarization logic, record selection/rejection criteria), (c) Temporary/intermediate datasets created between JCL steps with their layouts and the processing that produced them, (d) Final output files and their record layouts, (e) For each output field, trace backward to identify the source input field(s) and any transformation logic applied. Present the data lineage as a flow diagram description (textual) showing: INPUT FILE(S) with fields → PROCESSING STEP(S) with transformation rules → OUTPUT FILE(S) with fields.

#### 3.3 Document Custom Format Definitions and Lookup Tables

Extract and document all custom formats, edit masks, and lookup tables used in the source programs: (a) Easytrieve MASK definitions with their edit patterns and the fields they apply to, (b) Easytrieve TABLE files (FILE with TABLE attribute) with their key/value structures and search logic (SEARCH statement usage), (c) COBOL 88-level condition name value definitions used as lookup/validation tables, (d) Hardcoded value mappings in IF/EVALUATE/CASE structures that function as lookup tables, (e) Date format conventions used across programs (YYMMDD, MMDDYY, CCYYMMDD, Julian dates, packed dates), (f) Any encoding or decoding routines. For each custom format or lookup, document its purpose, all valid values, and where it is used across the codebase.

#### 3.4 Document z/OS-Specific Data Representations

Create a comprehensive data type reference section documenting all z/OS-specific data representations found in the source code and their modernized equivalents: (a) EBCDIC encoding -- character fields stored in EBCDIC requiring conversion to ASCII/UTF-8, noting any special characters or code page dependencies, (b) Packed decimal (COMP-3 in COBOL, P type in Easytrieve) -- encoding rules (two digits per byte plus sign nibble), byte length calculation (n digits = CEIL((n+1)/2) bytes), and Java mapping to BigDecimal, (c) Zoned decimal (DISPLAY in COBOL, N type in Easytrieve) -- encoding rules (one digit per byte, sign in high nibble of last byte), and Java mapping to BigDecimal, (d) Binary fields (COMP/COMP-4/BINARY in COBOL, B type in Easytrieve) -- halfword (2 bytes), fullword (4 bytes), doubleword (8 bytes) representations, signed vs unsigned, and Java mapping to int/long/BigInteger, (e) COMP-1 (single-precision floating point) to Java float, COMP-2 (double-precision floating point) to Java double, (f) Sign conventions -- separate sign (SIGN IS LEADING/TRAILING SEPARATE CHARACTER) vs embedded sign, (g) Alphanumeric fields (PIC X in COBOL, A type in Easytrieve) with EBCDIC space padding (X'40') vs ASCII space (X'20').

### Phase 4: Business Rule Cataloging and Classification

#### 4.1 Assign Unique Identifiers to All Business Rules

Review all business rules extracted in Phase 2 and assign each a unique identifier using the format BR-NNN (e.g., BR-001, BR-002, ..., BR-999). Each business rule should represent a single discrete logic unit: a calculation, a condition/decision, a data transformation, a validation check, a file I/O operation, a sort operation, a report generation rule, or a database access operation. Number business rules sequentially within each program, then consolidate into a master catalog with globally unique identifiers.

#### 4.2 Classify Business Rules by Category

Categorize each numbered business rule into one or more of the following categories: (a) Data Validation -- input field validation, range checks, format checks, cross-field validation, (b) Business Calculation -- arithmetic computations, accumulations, averaging, percentage calculations, (c) Data Transformation -- field format conversions, data type conversions, field mapping/derivation, string manipulation, (d) Conditional Processing -- decision logic that routes processing based on data values including IF/ELSE trees, CASE/EVALUATE structures, and 88-level condition checks, (e) File I/O Operation -- file open/close, sequential read/write, keyed access, update-in-place, (f) Sort and Merge -- sort key definitions, sort order, pre-sort and post-sort processing, merge operations, (g) Report Generation -- report formatting, control break logic, subtotal/total accumulation, page handling, (h) Database Operation -- SQL queries, IMS/DLI calls, VSAM operations, IDMS operations with transaction boundaries, (i) Error Handling -- error detection conditions, error response actions, abend processing, return code setting, (j) Control Flow -- program-to-program calls, activity sequencing, loop control, GO TO branching.

#### 4.3 Document Processing Assumptions, Ambiguities, and Edge Cases

For each program analyzed, create a processing notes section documenting: (a) Assumptions made during analysis where source code behavior is ambiguous, (b) Edge cases identified in conditional logic (e.g., what happens when a file is empty, when a key is not found, when a numeric field contains spaces or low-values), (c) Implicit behavior in Easytrieve (e.g., automatic end-of-file handling in JOB activities, automatic report page breaks, default TALLY counter behavior, automatic record I/O in JOB INPUT processing), (d) COBOL implicit behaviors (e.g., ON SIZE ERROR handling, NOT AT END processing, CORRESPONDING operations), (e) JCL conditional execution logic that may affect which programs run (COND parameter return code checking, IF/THEN/ELSE step-level conditions), (f) GDG generation referencing ambiguities (which generation is current depends on execution context), (g) Any hardcoded values, magic numbers, or unexplained constants with notes on their likely purpose.

### Phase 5: BRE Document Assembly and Validation

#### 5.1 Assemble BRE Document 1: JCL and PROC Business Requirements Extract

Compile the first BRE document covering all JCL job streams and PROC definitions. Structure the document as follows:

**Section 1 -- Executive Summary:** Provide a high-level overview of all JCL jobs, their business purpose, execution sequence, and inter-job dependencies.

**Section 2 -- JCL Job Inventory:** List every JCL job with its job name, file name, number of steps, called programs, and brief description.

**Section 3 -- Complete File Layouts:** For every file (input, output, intermediate, working storage) referenced by any program, provide the complete field-by-field layout table as documented in Phase 3, including byte offsets, mainframe data types, PIC/DEFINE specifications, and Java-equivalent type mappings.

**Section 4 -- Business Rule Catalog:** Present the complete catalog of all business rules extracted from Easytrieve and COBOL programs, organized by program, with each rule identified by its BR-NNN number, category, description, source code reference (program name, approximate location), and any dependencies on other rules. Include:

- Data validation rules
- Business calculation rules with formulas
- Data transformation and mapping rules
- Conditional processing decision trees
- File processing rules (read/write patterns, record selection criteria)
- Sort and merge specifications
- Report generation rules with output format definitions
- Database access rules with query/DML specifications

**Section 5 -- Custom Format Definitions and Lookup Tables:** Present all custom formats, edit masks (Easytrieve MASK definitions), TABLE file definitions, COBOL 88-level value sets, and hardcoded lookup tables as documented in Phase 3.

**Section 6 -- Data Lineage:** For each program, present the complete data lineage from input files through processing to output files as documented in Phase 3, showing field-level transformations.

**Section 7 -- Data Type Reference:** Present the z/OS to Java data type mapping reference as documented in Phase 3, covering EBCDIC encoding, packed decimal, zoned decimal, binary fields, COMP/COMP-3 fields, and all other mainframe-specific data representations found in the source code.

**Section 8 -- Processing Notes:** Present all assumptions, ambiguities, and edge cases documented in Phase 4, organized by program, to flag areas requiring human review or clarification during downstream transformation.

Write the completed BRE Document 1 to the bre-doc folder.

#### 5.2 Assemble BRE Document 2: Easytrieve and COBOL Programs Business Requirements Extract

Compile the second BRE document covering all Easytrieve programs (standalone and inline) and all COBOL programs. Structure the document with the same section organization as BRE Document 1 but focused on program-level detail rather than JCL-level orchestration.

Write the completed BRE Document 2 to the bre-doc folder.

#### 5.3 Validate File Layouts Against Baseline Data (Optional -- Skip If No Baseline Data Present)

This validation step is only performed if baseline data files are present in the input-data and/or output-data folders. If these folders do not exist or are empty, skip this entire step without error and proceed to Step 5.4. When baseline data files are present, cross-reference the documented file layouts from BRE Document 2 (Section 3) against actual baseline data files in the input-data and output-data folders: (a) For each mapped input file, verify that the documented record length matches the actual file record length by examining the data, (b) For each mapped output file, verify that the documented record length and record structure are consistent with the actual output data, (c) Where files contain fixed-length records, confirm that the total byte count per record matches the documented layout total, (d) Where files contain multiple record types, verify that the record type indicator field values found in the actual data match those documented in the layouts, (e) Flag any discrepancies between documented layouts and actual data for review and correction. Document all validation results (confirmed matches and discrepancies) in a validation summary appended to BRE Document 2. If no baseline data files were available, note in BRE Document 2 that baseline data validation was skipped due to the absence of input-data and output-data files.

#### 5.4 Validate Completeness and Cross-Reference Integrity

Perform a final completeness check: (a) Verify every source artifact from the Phase 1 inventory is covered in either BRE Document 1 or BRE Document 2 (or both), (b) Verify every JCL step that executes an Easytrieve or COBOL program has a corresponding detailed entry in BRE Document 1 and the program is fully analyzed in BRE Document 2, (c) Verify every business rule identifier (BR-NNN) referenced in BRE Document 1 exists in the BRE Document 2 catalog, (d) Verify every file referenced in the programs has a complete file layout in BRE Document 2 Section 3, (e) Verify every copybook referenced in COBOL programs has been parsed and its fields documented, (f) Verify that the data lineage in BRE Document 2 Section 6 accounts for all input-to-output field mappings. Report any gaps or incomplete coverage areas and resolve them before finalizing the BRE documents.

#### 5.5 Write Final BRE Documents to bre-doc Folder

Write both completed and validated BRE documents to the bre-doc folder: (a) BRE Document 1 as a single comprehensive file covering JCL and PROC business requirements, (b) BRE Document 2 as a single comprehensive file covering Easytrieve and COBOL program business requirements. Ensure both documents are formatted and structured so that the downstream Easytrieve-to-Java-Migration transformation can consume them directly from the bre-doc folder as its business logic documentation input.

## Validation / Exit Criteria

1. A complete source artifact inventory has been produced listing every file in the source-code folder classified by type (Easytrieve program, inline Easytrieve, JCL job stream, COBOL program, copybook, control card) with file name, path, type, and line count
2. A complete cross-artifact dependency graph has been constructed mapping JCL jobs to programs, programs to files, programs to copybooks, and inter-step data flows via temporary datasets and GDG generations
3. Every Easytrieve program has been fully analyzed including FILE declarations, field definitions with data types, JOB activities with complete processing logic, report generation specifications, and database access patterns
4. Every Easytrieve program's business rules have been extracted covering all conditional logic (IF/ELSE-IF/CASE), data manipulation (assignments, arithmetic, MOVE), file processing operations (SORT, SELECT, GET, PUT, POINT, READ, WRITE), and all database access patterns (SQL, IMS/DLI, IDMS, VSAM)
5. Every COBOL program has been fully analyzed including all four divisions, WORKING-STORAGE and FILE SECTION data definitions with PIC clauses and USAGE types, PROCEDURE DIVISION business logic, file I/O operations, CALL interfaces, and SORT/MERGE operations
6. Every copybook has been parsed with a field-by-field table showing field name, level, PIC clause, mainframe data type, byte offset, byte length, decimal positions, and Java-equivalent data type
7. Every file layout has been documented with complete field definitions including byte offsets, mainframe data types, and Java-equivalent type mappings, with files containing multiple record types having each variant documented separately
8. All business rules have been assigned unique identifiers (BR-001, BR-002, etc.) and classified by category (data validation, business calculation, data transformation, conditional processing, file I/O, sort/merge, report generation, database operation, error handling, control flow)
9. Data lineage has been documented for every processing flow showing input-to-output field mappings with transformation rules
10. All z/OS-specific data representations (EBCDIC, packed decimal, zoned decimal, binary, COMP/COMP-3) found in the source code have been documented with their Java-equivalent type mappings
11. All GDG dataset references have been documented with base names, relative generation patterns, and business purposes
12. Processing notes documenting assumptions, ambiguities, and edge cases have been recorded for each program
13. BRE Document 1 (JCL and PROC Business Requirements Extract) has been assembled and written to the bre-doc folder, containing: executive summary, JCL job inventory, detailed job analysis with full coverage of Easytrieve/COBOL steps and high-level coverage of utility/other steps, GDG dataset reference, and cross-job dependencies
14. BRE Document 2 (Easytrieve and COBOL Programs Business Requirements Extract) has been assembled and written to the bre-doc folder, containing: executive summary, program inventory, complete file layouts, business rule catalog with BR-NNN identifiers, custom format definitions and lookup tables, data lineage, data type reference with mainframe-to-Java mappings, and processing notes
15. If baseline data files are present in the input-data and/or output-data folders, file layouts documented in BRE Document 2 have been cross-referenced against the actual baseline data files, with record lengths and record structures validated and any discrepancies flagged. If the input-data and output-data folders do not exist or are empty, this cross-reference validation has been skipped and a note has been included in BRE Document 2 indicating baseline data validation was not performed.
16. Completeness validation has confirmed that every source artifact is covered, every BR-NNN reference in BRE Document 1 exists in BRE Document 2, every file has a layout, every copybook has been parsed, and data lineage accounts for all input-to-output field mappings
17. Both BRE documents are structured and formatted to be directly consumable by the Easytrieve-to-Java-Migration transformation package via the bre-doc folder
