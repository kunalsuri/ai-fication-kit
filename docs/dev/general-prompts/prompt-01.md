<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Spec Audit Prompt

Audit the [Exammple:"orient-indepth-architecture.md"], which documents the current specifications of a new feature for this project.

Complete the following in order:

1. **Assessment**: Evaluate your confidence in the completeness and accuracy of
   the specifications section. Use the knowledge about the codebase from '/ai' folder. Flag any:
   - Ambiguities or underspecified behaviors
   - Gaps between documented and implemented behavior
   - Claims that lack justification or evidence

   Provide confidence as a percentage (0–100%) with explicit reasoning.

2. **Walkthrough**: Simulate the implementation process by stepping through each specification point. For each predict:
   - What the coding agent / GPT would need to implement
   - Points of likely confusion or error
   - Any prerequisite dependencies or assumptions

3. **Readiness Check**: Based on the above, state whether the spec is sufficiently
   detailed for [INTENDED AUDIENCE: e.g., "external contributors" / "production
   deployment"]. Recommend specific improvements if not.
What is your confidence level, and what gaps should we address before proceeding?

---

# Prompt to check new code for improvements (LLM-Judge)

Understand the new code located in the “xyz” folder, specifically related to indepth.mjs. Then evaluate it as an expert software engineer and LLM-Judge to identify possible improvements, enhancements, and refinements to make the implementation better in terms of design, structure, and overall quality.

---
