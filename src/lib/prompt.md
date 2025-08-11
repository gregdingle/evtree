# Task description

Given the Zod schemas below, construct a decision tree in JSON from the following text description of a lawsuit. Use the example JSON output for inspiration. Use the article at https://www.litigationrisk.com/GSU%20Law%20Review%20article.pdf for guidance on how to construct a decision tree.

For past decisions in the tree, include counter-factual outcomes and subsequent decisions based on events that could have been. For example, any motion that is affirmed could also have been denied.

Do NOT include mediation or settlement as possible outcomes or decisions. The point of a decision tree is to estimate the value of a case in the absence of a negotiated settlement. When the possibility of a mediation is mentioned in the text description of a lawsuit, just skip over it as if it happened but failed.

Avoid including outcomes that have less than a 10% chance of happening by your estimation.

Avoid including outcomes that have a 100% chance of happening by your estimation, unless they occur more than 6 months from the preceding decision.

<!-- QUESTION: , or they have `estimatedHours` of more than 20. -->

<!-- TODO: better solution to unknown value problem... prompt the user? -->

If a dollar value for a claim is not provided in the text description, use a value of $1.

Some guidelines:

- The `reason` SHOULD explain why the associated probability estimate is justified. For example: "Federal court statistics show 62% of summary judgment motions fail".
- The first decision in the tree MUST have the earliest date
- All dates MUST be in ascending order from left to right in the tree along a single path
- Try to make the decision labels 24 characters long or less
- Try to make the outcome labels 16 characters long or less
- Only include an outcome label if the relationship between the previous decision and the next decision is not obvious
- When an outcome is terminal, it MUST have a value
- The probabilities in a group of outcomes MUST sum to 1
- Path IDs MUST contain only consecutive integers. For example: "1/a/2/a/3".

<!-- TODO: try adding to zod scheam and validate with zod? -->

## Lawsuit description

{{LAWSUIT_DESCRIPTION}}

## Zod schemas

<!-- TODO: keep this in sync with decisionTreeTypes.ts somehow -->

```ts
// Create forward references for our schemas
// This approach avoids using 'any' type while handling circular references
// NOTE: need to keep Shape and Schema definitions in sync
interface OutcomeShape {
  /**
   * Unique identifier for the outcome, following a specific path format.
   * QUESTION: rename to `path`?
   */
  id: string;

  /**
   * User-facing label for the outcome.
   */
  label?: string;

  /**
   * Probability estimate of this outcome occurring, between 0 and 1.
   */
  probability: number;

  /**
   * The reason for a probability estimate.
   */
  reason: string;

  /**
   * Terminal value of the outcome. If this is defined, it indicates that this
   * outcome does not lead to another decision.
   * QUESTION: should a terminal decision be required instead?
   */
  value?: number;

  /**
   * The next decision following this outcome.
   */
  nextDecision?: DecisionShape;
}

interface DecisionShape {
  /**
   * Unique identifier for the outcome, following a specific path format.
   * QUESTION: rename to `path`?
   */
  id: string;

  /**
   * User-facing label for the decision.
   */
  label: string;

  /**
   * Optional user-facing description of the decision.
   */
  description?: string;

  /**
   * Possible outcomes of the decision.
   */
  outcomes: OutcomeShape[];

  /**
   * Computed from `outcomes`. When no outcomes are present, this is the
   * expected value of the decision.
   */
  expectedValue?: number;

  /**
   * Estimated date for the decision, can be a Date object or an ISO string.
   */
  estimatedDate: Date | string;

  /**
   * Estimated costs in hours to achieve the decision.
   */
  estimatedHours: number;

  /**
   * Indicates if this decision is a final judgment entered by the court. Used
   * for interest calculations.
   */
  isFinalJudgment?: boolean;
}

// NOTE: Define schemas lazily for circular references
export const OutcomeSchema: z.ZodType<OutcomeShape> = z.lazy(() =>
  z
    .object({
      id: z
        .string()
        .regex(
          /^\d\/[a-z]+(?:\/\d\/[a-z])*$/,
          "Outcome ID must follow path format like '1/a' or '1/a/2/b'",
        ),
      label: z
        .string()
        .max(100, "Label must be 100 characters or less")
        .optional(),
      probability: z
        .number()
        .min(0, "Probability must be between 0 and 1")
        .max(1, "Probability must be between 0 and 1"),
      reason: z.string().min(1, "Reason is required"),
      nextDecision: DecisionSchema.optional(),
      value: z.number().nonnegative().optional(),
    })
    .refine(
      (data) => data.nextDecision !== undefined || data.value !== undefined,
      {
        message:
          "An outcome must either lead to another decision or have a terminal value",
        path: ["outcome"],
      },
    ),
);

export const DecisionSchema: z.ZodType<DecisionShape> = z.lazy(() =>
  z
    .object({
      id: z
        .string()
        .regex(
          /^\d+(?:\/[a-z]\/\d+)*$/,
          "Decision ID must follow path format like '1' or '1/a/2'",
        ),
      label: z
        .string()
        .min(1, "Label is required")
        .max(100, "Label must be 100 characters or less"),
      description: z.string().optional(),
      outcomes: z.array(OutcomeSchema),
      expectedValue: z.number().optional(),
      estimatedDate: z.union([z.date(), z.string()]),
      estimatedHours: z.number(),
      isFinalJudgment: z.boolean().optional(),
    })
    .refine(
      (decision: Decision): boolean => {
        const sum = decision.outcomes.reduce(
          (acc, outcome) => acc + outcome.probability,
          0,
        );
        return Math.abs(sum - 1) < 0.000001; // Allow for floating point imprecision
      },
      {
        message: "Probabilities of outcomes must sum to 1",
        path: ["outcomes"],
      },
    ),
);
```

<!-- TODO: optimize example -->

## Example JSON output##

```json
{
  "id": "1",
  "label": "Contract Dispute Filed",
  "description": "Contract dispute case has been filed - next steps in litigation",
  "estimatedDate": "2025-06-03T22:34:03.804Z",
  "estimatedHours": 10,
  "outcomes": [
    {
      "id": "1/a",
      "label": "Proceed to Discovery",
      "probability": 1,
      "reason": "Federal Rules of Civil Procedure require discovery phase in 100% of civil cases to enable parties to obtain information and documents necessary for trial preparation",
      "nextDecision": {
        "id": "1/a/2",
        "label": "Trial Decision",
        "description": "Whether to go to trial or dispositive motion",
        "estimatedDate": "2025-12-03T23:34:03.804Z",
        "estimatedHours": 25,
        "outcomes": [
          {
            "id": "1/a/2/a",
            "label": "File Summary Judgment Motion",
            "probability": 0.35,
            "reason": "Federal Judicial Center studies show 35% of contract disputes involve summary judgment motions, as parties seek early resolution when material facts are undisputed and legal standards are clear",
            "nextDecision": {
              "id": "1/a/2/a/3",
              "label": "Summary Judgment Outcome",
              "description": "Result of summary judgment motion",
              "estimatedDate": "2026-02-03T23:34:03.804Z",
              "estimatedHours": 50,
              "outcomes": [
                {
                  "id": "1/a/2/a/3/a",
                  "label": "Win Summary Judgment",
                  "probability": 0.38,
                  "reason": "Administrative Office of US Courts data shows 38% success rate for summary judgment motions in contract disputes when moving party demonstrates absence of genuine material fact disputes",
                  "value": 1000000
                },
                {
                  "id": "1/a/2/a/3/b",
                  "label": "Lose Summary Judgment",
                  "probability": 0.62,
                  "reason": "Federal court statistics show 62% of summary judgment motions fail when genuine issues of material fact exist or when contract interpretation requires jury determination",
                  "nextDecision": {
                    "id": "1/a/2/a/3/b/4",
                    "label": "Go to Trial",
                    "description": "Trial after losing summary judgment",
                    "estimatedDate": "2026-06-03T22:34:03.804Z",
                    "estimatedHours": 80,
                    "outcomes": [
                      {
                        "id": "1/a/2/a/3/b/4/a",
                        "label": "Win at Trial",
                        "probability": 0.52,
                        "reason": "Bureau of Justice Statistics shows 52% plaintiff win rate at trial following denied summary judgment motions, reflecting complex factual disputes and higher defense preparedness",
                        "nextDecision": {
                          "id": "1/a/2/a/3/b/4/a/5",
                          "label": "Damages Award",
                          "description": "Level of damages awarded at trial",
                          "estimatedDate": "2026-09-03T22:34:03.804Z",
                          "estimatedHours": 100,
                          "isFinalJudgment": true,
                          "outcomes": [
                            {
                              "id": "1/a/2/a/3/b/4/a/5/a",
                              "label": "High Damages",
                              "probability": 0.25,
                              "reason": "American Bar Association litigation outcomes study shows 25% of contract cases result in full damage awards when plaintiff provides comprehensive documentation and credible expert witness testimony",
                              "value": 1000000
                            },
                            {
                              "id": "1/a/2/a/3/b/4/a/5/b",
                              "label": "Medium Damages",
                              "probability": 0.5,
                              "reason": "National Center for State Courts data indicates 50% of successful contract plaintiffs receive partial damages when some losses are proven but consequential damages lack sufficient certainty or foreseeability",
                              "value": 500000
                            },
                            {
                              "id": "1/a/2/a/3/b/4/a/5/c",
                              "label": "Low Damages",
                              "probability": 0.25,
                              "reason": "Federal Judicial Center studies show 25% of winning contract plaintiffs receive minimal damages when liability is clear but economic losses are difficult to quantify or plaintiff failed to mitigate damages",
                              "value": 250000
                            }
                          ],
                          "expectedValue": null
                        }
                      },
                      {
                        "id": "1/a/2/a/3/b/4/b",
                        "label": "Lose at Trial",
                        "probability": 0.48,
                        "reason": "Bureau of Justice Statistics indicates 48% of contract plaintiffs lose at trial when they cannot meet burden of proof on disputed facts or defendants successfully establish valid contractual defenses",
                        "value": 0
                      }
                    ],
                    "expectedValue": null
                  }
                }
              ],
              "expectedValue": null
            }
          },
          {
            "id": "1/a/2/b",
            "label": "Go Directly to Trial",
            "probability": 0.65,
            "reason": "Federal Judicial Center data shows 65% of contract disputes proceed directly to trial when factual disputes preclude summary adjudication or when legal issues require jury determination",
            "nextDecision": {
              "id": "1/a/2/b/3",
              "label": "Trial Outcome",
              "description": "Result of the trial",
              "estimatedDate": "2026-04-03T22:34:03.804Z",
              "estimatedHours": 75,
              "outcomes": [
                {
                  "id": "1/a/2/b/3/a",
                  "label": "Win at Trial",
                  "probability": 0.638,
                  "reason": "Direct trial win rates based on historical contract dispute outcomes, accounting for strength of legal claims and evidence quality",
                  "nextDecision": {
                    "id": "1/a/2/b/3/a/4",
                    "label": "Damages Award",
                    "description": "Level of damages awarded at trial",
                    "estimatedDate": "2026-06-03T22:34:03.804Z",
                    "estimatedHours": 90,
                    "isFinalJudgment": true,
                    "outcomes": [
                      {
                        "id": "1/a/2/b/3/a/4/a",
                        "label": "High Damages",
                        "probability": 0.25,
                        "reason": "Full damage awards granted when plaintiff provides comprehensive documentation of losses and strong expert testimony validates all claimed damages",
                        "value": 1000000
                      },
                      {
                        "id": "1/a/2/b/3/a/4/b",
                        "label": "Medium Damages",
                        "probability": 0.5,
                        "reason": "Moderate damages awarded when core losses are proven but some claimed damages lack sufficient documentation or involve disputed valuations",
                        "value": 500000
                      },
                      {
                        "id": "1/a/2/b/3/a/4/c",
                        "label": "Low Damages",
                        "probability": 0.25,
                        "reason": "Limited damages awarded when liability is established but economic losses are minimal, speculative, or plaintiff failed to mitigate damages",
                        "value": 250000
                      }
                    ],
                    "expectedValue": null
                  }
                },
                {
                  "id": "1/a/2/b/3/b",
                  "label": "Lose at Trial",
                  "probability": 0.362,
                  "reason": "Trial loss results when plaintiff fails to prove essential elements of the contract claim or defendant successfully demonstrates non-breach or valid defenses",
                  "value": 0
                }
              ],
              "expectedValue": null
            }
          }
        ],
        "expectedValue": null
      }
    }
  ],
  "expectedValue": null
}
```
