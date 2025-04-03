---
description: <Task Description>
globs: *
---
# Task-01: Project Setup

## 1. Objective
Set up the initial Next.js project structure with TypeScript, Tailwind CSS, and essential dependencies for the Serge therapeutic voice assistant application.

## 2. Task Context & Guidelines

### Important Guidelines

- Use pseudocode for architectural guidance but only mark tasks as done when the task is ready for production use - no placeholders, no placeholder API keys
- If keys are not available, ask for those to be created and await instruction
- Terminal usage: Review existing terminals that are running servers and re-use them
- Monitor terminal messages for success or failure and address any issues before proceeding
- Always ask if current changes can be committed and pushed to origin

### Streamlined Workflow

1.  **Create Feature Branch**: Begin by creating a feature branch based on the task name
    ```bash
    git checkout -b feature/task-name
    ```

2.  **Start Development Server**: Launch the development server to see changes in real-time
    ```bash
    npm run dev
    ```

3.  **Implement Task**: Complete all requirements including writing unit tests

4.  **Manual Testing**: Verify functionality and UX, iterating as needed

5.  **Finalize Task**: When satisfied with manual testing, the user will tell the agent to "push" (only single word) - this is a verbal cue for the agent to:
    - Kill the development server
    - Run the production build (`npm run build`)
    - Fix any terminal issues
    - Commit and push changes to origin

## 3. Prerequisites & Dependencies
None

## 4. Task Steps

### 5.1. Create Next.js Project
Create a new Next.js project with TypeScript and Tailwind CSS support.

```bash
# Pseudo code for project creation
npx create-next-app@latest serge --typescript --tailwind --eslint
cd serge
```

### 5.2. Install Essential Dependencies
Install required dependencies for the project.

```bash
# Pseudo code for dependency installation
npm install @openai/api @supabase/supabase-js lottie-react
npm install --save-dev @types/node @types/react @types/react-dom
```

### 5.3. Configure Project Structure
Set up the recommended project structure according to the architecture document.

```typescript
// Pseudo code for directory structure
// app/ - Next.js application directory with route groups
// components/ - Reusable UI components
// lib/ - Utility functions and service integrations
// public/ - Static assets
```

### 5.4. Configure TypeScript
Set up TypeScript configuration for the project.

```typescript
// Pseudo code for tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 5.5. Configure Tailwind CSS
Ensure Tailwind CSS is properly configured for the project.

```typescript
// Pseudo code for tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Define custom colors based on design
        primary: '#3b82f6',
        secondary: '#6b7280',
      },
      fontFamily: {
        // Define custom fonts
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### 5.6. Set Up ESLint and Prettier
Configure ESLint and Prettier for code quality and consistency.

```typescript
// Pseudo code for .eslintrc.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    // Custom rules
  },
}
```

### 5.7. Create Basic README
Update the README.md file with project information.

```markdown
# Serge - Therapeutic Voice Assistant

Serge is a web-based therapeutic application that helps users explore their life stories through guided conversation with an AI voice agent. The application uses OpenAI's Realtime Audio API to create a responsive, voice-driven therapeutic experience that follows a structured workbook approach to personal development.

## Technology Stack

- **Frontend**: Next.js 14+ with TypeScript and Tailwind CSS
- **Backend**: Fly.io API service
- **Database**: Supabase with pgvector for embeddings
- **AI**: OpenAI Realtime Audio API and GPT models
- **Animation**: Lottie for audio visualization

## Getting Started

[Installation instructions here]
```

### 5.8. Set Up Git Repository
Initialize Git repository and create initial commit.

```bash
# Pseudo code for git setup
git init
git add .
git commit -m "Initial project setup"
```

## 5. Acceptance Criteria

- [x] Next.js project is created with TypeScript support
- [x] Tailwind CSS is properly configured
- [x] Essential dependencies are installed
- [x] Project structure follows the architecture document
- [x] TypeScript configuration is set up correctly
- [x] ESLint and Prettier are configured
- [x] README.md is updated with project information
- [x] Git repository is initialized with initial commit

## 6. Verification Rules & Checklist

### Verification Rule: `verify_build_before_completion`
<rule>
name: verify_build_before_completion
description: Requires successful build verification before marking any task as complete
filters:
  # Match task completion indicators
  - type: content
    pattern: "(?i)\\b(task complete|completed|finished|done|ready for review)\\b"
  # Match verification skipping
  - type: intent
    pattern: "skip_verification"
  # Match build commands
  - type: content
    pattern: "npm run build"

actions:
  - type: reject
    message: |
      Build verification is mandatory before completing this task:
      
      You MUST run the following verification sequence:
      1. Run `npm run build && npm run start`
      2. Wait for "compiled successfully" message
      3. Confirm application loads in browser (screenshot required)
      4. Verify all acceptance criteria still pass
      
      This verification sequence cannot be skipped or partially completed.

  - type: require
    condition: "before_completion"
    steps:
      - command: "npm run build && npm run start"
        wait_for: "compiled successfully"
        verify: "browser_screenshot"
      - verify: "acceptance_criteria"
</rule>

### Checklist
- [x] Run `npm run dev` to verify the development server starts without errors
- [ ] Verify `npm run build` completes successfully without errors
- [x] Verify the project structure matches the architecture document
- [x] Confirm TypeScript compilation works without errors
- [x] Ensure Tailwind CSS styles are applied correctly
- [x] Verify ESLint runs without critical errors
- [x] Check that all dependencies are correctly listed in package.json
- [x] Confirm README.md contains accurate project information
- [x] Verify Git repository is properly initialized
