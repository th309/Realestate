---
trigger: always_on
---

# Primary Directive: Project Context Enforcement

**Mandatory Action:**
Before processing any user command, code generation request, or architectural query, you MUST read and apply the contents of the `project_instructions.md` file located in the root directory.

## Operational Constraints

1.  **Context Loading:**
    * Do not rely on generic training data if it conflicts with `project_instructions.md`.
    * Specifically review the **Technology Stack**, **Architecture**, **Design Systems**, and **Security Best Practices** sections of the file to ensure compliance.

2.  **Code Generation:**
    * All generated code must utilize the libraries, versions, and patterns defined in the `project_instructions.md` tech stack.
    * If a user request contradicts the project instructions, issue a warning and ask for confirmation before proceeding.

3.  **Style & Formatting:**
    * Adhere strictly to the linter rules and naming conventions outlined in the instructions file.

## Response Protocol
* If the `project_instructions.md` file is missing or empty, alert the user immediately.
* (Optional) Briefly confirm active constraints at the start of complex tasks (e.g., "Aligning with project architecture defined in instructions...").