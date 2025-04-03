# Plan for Restructuring Requirements/sample-task.md

This document outlines the approved plan for restructuring `Requirements/sample-task.md` to incorporate elements inspired by `Requirements/tmpsystemprompt.md`.

## Proposed New Structure

```markdown
---
description: <Task Description>
globs: *
---

# Task-01: Project Setup

## 1. Objective
(Content from the current `## Descriptionnnn` section)
*   Set up the initial Next.js project structure...

## 2. Task Context & Guidelines
(Combines existing `## Task Preamble`, `## Important Guidelines`, and `## Streamlined Workflow`)

### Important Guidelines
*   Use pseudocode...
*   If keys are not available...
*   Terminal usage...
*   Monitor terminal messages...
*   Always ask if current changes...

### Streamlined Workflow
1.  **Create Feature Branch**: ...
2.  **Start Development Server**: ...
3.  **Implement Task**: ...
4.  **Manual Testing**: ...
5.  **Finalize Task**: ...

## 3. Prerequisites & Dependencies
(Content from the current `## Dependencies` section)
*   None

## 4. Estimates
(Combines `## Estimated Complexity` and `## Estimated Time`)
*   **Complexity**: Low
*   **Time**: 1-2 hours

## 5. Task Steps
(Keep existing structure and content)
### 5.1. Create Next.js Project
### 5.2. Install Essential Dependencies
### 5.3. Configure Project Structure
### 5.4. Configure TypeScript
### 5.5. Configure Tailwind CSS
### 5.6. Set Up ESLint and Prettier
### 5.7. Create Basic README
### 5.8. Set Up Git Repository

## 6. Acceptance Criteria
(Keep existing content)
*   [x] Next.js project is created...
*   ...

## 7. Verification Rules & Checklist
(Renamed from `## Verification Checklist`, keeps existing content including the `<rule>`)

### Verification Rule: `verify_build_before_completion`
<rule>
name: verify_build_before_completion
description: Requires successful build verification before marking any task as complete
...
</rule>

### Checklist
*   [x] Run `npm run dev`...
*   [ ] Verify `npm run build`...
*   ...
```

## Structure Visualization (Mermaid)

```mermaid
graph TD
    A[sample-task.md] --> B(Frontmatter);
    A --> C(# Task Title);
    A --> D(## 1. Objective);
    A --> E(## 2. Task Context & Guidelines);
        E --> E1(### Important Guidelines);
        E --> E2(### Streamlined Workflow);
    A --> F(## 3. Prerequisites & Dependencies);
    A --> G(## 4. Estimates);
    A --> H(## 5. Task Steps);
        H --> H1(### Step 5.1);
        H --> H2(### Step 5.2);
        H --> Hn(...);
    A --> I(## 6. Acceptance Criteria);
    A --> J(## 7. Verification Rules & Checklist);
        J --> J1(### Verification Rule);
        J --> J2(### Checklist);