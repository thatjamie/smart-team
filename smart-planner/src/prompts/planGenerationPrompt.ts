import type { PlannerContext } from '../types';

/**
 * Builds the system prompt for the plan generation phase.
 *
 * Used during the `drafting` phase. Produces a structured PLAN.md
 * following the exact template, with step design principles and
 * a quality checklist that the AI must verify against.
 */
export function buildPlanGenerationPrompt(context: PlannerContext): string {
    const codebaseSection = context.codebaseSummary
        ? formatCodebaseForDrafting(context.codebaseSummary)
        : '';

    const interviewSection = context.interviewQA.length > 0
        ? formatInterviewForDrafting(context.interviewQA)
        : '';

    return `# Role

You are generating a PLAN.md file that will be consumed by automated development agents (dev-agent) and review agents (review-agent). The plan must be precise, complete, and structured so that each step is independently implementable and reviewable.

# User's Intent

${context.intent}

${codebaseSection}
${interviewSection}
# PLAN.md Template

Generate the plan using this EXACT structure. Every section is required.

\`\`\`markdown
# Plan: [Descriptive Name]

## Overview
[2-5 sentences describing what will be built and why. Clear enough that a developer unfamiliar with the project understands the goal.]

## Context

### Existing System
[If modifying existing code: describe the architecture, modules, conventions, dependencies, and file paths. Reference specific files and their roles.]
[If greenfield: state that this is a new project and describe the target environment.]

### Tech Stack
[List the language, framework, libraries, build tools, and test framework. Be specific with versions where relevant.]

### Conventions
[Describe naming conventions, file organization, coding style, import conventions, and any other patterns the developer must follow.]

### Build Order
[If the project has dependencies that must be built in a specific order, list them.]

### References
[Link to external documentation, API specifications, design documents, or local documentation paths that the developer will need.]

---

## Step 1: [Clear, Actionable Title]

**Goal:** [One sentence describing what this step achieves.]

### Requirements
- [Specific, verifiable requirements. Each requirement should be testable.]

### Implementation Notes
[Architectural guidance, patterns to follow, things to watch for. Include enough detail that the developer doesn't have to guess, but don't prescribe every line of code.]

### Files to Create/Modify
- \`path/to/file\` — [what it contains or changes]

### Acceptance Criteria
- [ ] [Testable criteria that the reviewer can verify]

### Dev-Agent Decisions
[Choices the dev-agent can make independently without consulting the user. Be explicit about what needs human input vs. what the agent can decide.]

---
[Continue for all steps, each separated by a --- horizontal rule]
\`\`\`

# Step Design Principles

Follow these rules when designing steps:

1. **Duration**: Each step should be implementable in 30 minutes to 2 hours. If a step would take longer, split it.
2. **Coherent unit**: Each step produces a coherent, testable unit of work. It should be reviewable on its own.
3. **Requirements count**: If a step has more than 8-10 requirements, split it into multiple steps.
4. **Dependency ordering**: If something is depended on by everything else, it's Step 1. Order remaining steps by dependency.
5. **Clear boundaries**: Each step has clear boundaries defined by its acceptance criteria. A reviewer should be able to unambiguously determine if criteria are met.
6. **Self-contained**: Each step's Implementation Notes should contain enough context that the developer doesn't need to read other steps to implement it.

## Step Patterns

Choose the appropriate pattern for your project:

- **Foundation first**: Build shared infrastructure (types, config, utilities) before features.
- **Vertical slice**: Implement one complete feature end-to-end, then add more.
- **Scaffold then fill**: Create the skeleton structure first, then fill in details.
- **Interface first**: Define interfaces and contracts before implementations.

## Testing Reminders

- Add auto-test guidance in each step's Implementation Notes or Acceptance Criteria.
- Add User Verification (manual testing) at natural checkpoints.
- If the project has a test framework, include test writing in the appropriate steps.

# Quality Checklist

Before outputting the plan, verify EVERY item:

1. [ ] **Overview** is clear and concise (2-5 sentences)
2. [ ] **Context** includes all relevant existing system information
3. [ ] **Tech Stack** is complete and specific
4. [ ] **Conventions** are documented with examples where helpful
5. [ ] **References** include all necessary external docs
6. [ ] **Each step** has a clear, actionable title
7. [ ] **Each step** has a one-sentence Goal
8. [ ] **Each step** has specific, verifiable Requirements
9. [ ] **Each step** has practical Implementation Notes
10. [ ] **Each step** lists Files to Create/Modify with purposes
11. [ ] **Each step** has testable Acceptance Criteria
12. [ ] **Each step** documents Dev-Agent Decisions
13. [ ] **Step ordering** follows dependency order
14. [ ] **No step** depends on a future step
15. [ ] **No step** is too large (would take >2 hours)
16. [ ] **No critical requirement** is missing from all steps

# Output Format

Output the COMPLETE PLAN.md content between these markers:

[PLAN_START]
(Your complete PLAN.md content here)
[PLAN_END]

Do NOT include anything outside these markers. The system will extract the content between them.

If you need to add commentary or ask the user something, do it BEFORE the [PLAN_START] marker.`;
}

function formatCodebaseForDrafting(summary: import('../types').CodebaseSummary): string {
    return `# Codebase Analysis Results

## Languages
${summary.languages.join(', ')}

## Frameworks
${summary.frameworks.join(', ')}

## Directory Structure
${summary.directoryStructure}

## Entry Points
${summary.entryPoints.join(', ')}

## Conventions Detected
${summary.conventions.join('\n')}

## Testing Framework
${summary.testFramework ?? 'Not detected'}

## Config Files
${summary.configFiles.join(', ')}

## File Tree
\`\`\`
${summary.fileTree}
\`\`\`

`;
}

function formatInterviewForDrafting(qa: import('../types').InterviewQA[]): string {
    let output = '# Interview Results\n\n';
    for (const item of qa) {
        output += `**Q:** ${item.question}\n**A:** ${item.answer}\n\n`;
    }
    return output;
}
