import type { PlannerContext, StepStatus } from '../types';

/**
 * Builds the system prompt for updating an existing plan.
 *
 * Used when `/update` is invoked. Reads existing PLAN.md and PROGRESS.md,
 * understands which steps are in various states, and modifies the plan
 * according to rules for each step status.
 */
export function buildPlanUpdatePrompt(context: PlannerContext): string {
    const existingPlanSection = context.existingPlan
        ? `# Existing PLAN.md\n\n${context.existingPlan}\n`
        : '';

    const progressSection = context.existingProgress
        ? `# Existing PROGRESS.md\n\n${context.existingProgress}\n`
        : '';

    const codebaseSection = context.codebaseSummary
        ? formatCodebaseForUpdate(context.codebaseSummary)
        : '';

    const interviewSection = context.interviewQA.length > 0
        ? formatInterviewForUpdate(context.interviewQA)
        : '';

    return `# Role

You are updating an existing PLAN.md based on new requirements from the user. You must respect the current state of the project — completed steps cannot be silently modified, and in-progress steps require discussion before changes.

# User's New Requirements

${context.intent}

${existingPlanSection}
${progressSection}
${codebaseSection}
${interviewSection}
# Update Rules

Follow these rules strictly based on each step's current status:

## Completed Steps (✅)
- **Do NOT modify** completed steps unless the user explicitly requests it
- If new requirements affect completed work, **add a new step** at the end to handle the change rather than modifying the completed step
- Exception: if the user specifically asks to redo a completed step, acknowledge the impact and proceed

## In-Progress Steps (🔄)
- **Discuss before modifying** — explain what would change and get implicit or explicit agreement
- If the change is minor and consistent with the step's goal, integrate it
- If the change fundamentally alters the step's scope, suggest splitting it or replacing it

## Pending Steps (⏳)
- **Modify freely** — these steps haven't been started yet
- Restructure, add, remove, or reorder pending steps as needed
- Ensure dependency ordering is still correct after changes
- Renumber steps if steps are added or removed

# Update Process

1. **Analyze impact**: Read the user's new requirements and identify which existing steps are affected
2. **Categorize changes**: For each change, determine if it affects completed, in-progress, or pending steps
3. **Plan modifications**: Follow the rules above for each category
4. **Present changes**: Clearly summarize what you're changing and why, before showing the updated plan
5. **Update PROGRESS.md**: If steps are added, removed, or renumbered, explain how PROGRESS.md should be updated

# Change Presentation Format

When presenting your proposed changes:

\`\`\`
## Summary of Changes
- [Added] Step N: [title] — [reason]
- [Modified] Step N: [title] — [what changed and why]
- [Removed] Step N: [title] — [reason]
- [Reordered] Step N → Step M — [reason]

## Affected Steps
- Step X (status): [description of change]
- Step Y (status): [description of change]
\`\`\`

# Quality Checklist for Updated Plans

After modifying the plan, verify:

1. [ ] All existing completed steps are unchanged (unless explicitly requested)
2. [ ] In-progress steps were only modified with justification
3. [ ] New steps follow the same template as existing steps
4. [ ] Step numbering is sequential with no gaps
5. [ ] Dependency ordering is still correct
6. [ ] No new step depends on a step that hasn't been defined
7. [ ] Acceptance criteria are still testable and unambiguous
8. [ ] The Overview and Context sections are updated to reflect the changes
9. [ ] Dev-Agent Decisions sections are updated where relevant

# Output Format

First, present a summary of changes. Then output the COMPLETE updated PLAN.md between these markers:

[PLAN_START]
(Your complete updated PLAN.md content here)
[PLAN_END]

Also output the updated PROGRESS.md between these markers:

[PROGRESS_START]
(Your complete updated PROGRESS.md content here)
[PROGRESS_END]

Do NOT include anything outside these markers for the plan and progress content.`;
}

function formatCodebaseForUpdate(summary: import('../types').CodebaseSummary): string {
    return `# Codebase Summary (if re-explored)

## Languages
${summary.languages.join(', ')}

## Frameworks
${summary.frameworks.join(', ')}

## File Tree
\`\`\`
${summary.fileTree}
\`\`\`

`;
}

function formatInterviewForUpdate(qa: import('../types').InterviewQA[]): string {
    let output = '# Update Interview Results\n\n';
    for (const item of qa) {
        output += `**Q:** ${item.question}\n**A:** ${item.answer}\n\n`;
    }
    return output;
}

// Re-export StepStatus for consumers that need to check step states
export type { StepStatus };
