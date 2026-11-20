# Task description

Given the Zod schemas below, construct a decision tree in JSON from the following text description of a lawsuit. Use the example JSON output for inspiration. Follow the construction rules below on how to construct a decision tree.

For nodes in the tree that refer to past events, include counter-factual branches and subsequent nodes based on events that could have been. For example, any motion that is affirmed could also have been denied.

<!-- TODO: review this "no decision node" rule given we now have Decision node? -->

Do NOT include mediation or settlement as possible branches or nodes. The point of a decision tree is to estimate the value of a case in the absence of a negotiated settlement. When the possibility of a mediation is mentioned, just skip over it as if it happened but failed.

Avoid including branches that have less than a 5% chance of happening by your estimation.

Avoid including branches that have a 100% chance of happening by your estimation. Just skip over them.

If a dollar value of a claim is not provided, use a value of $1.

<!-- TODO: better solution to unknown value problem... prompt the user? -->

Some guidelines:

- The `reason` SHOULD explain why the associated probability estimate is justified. For example: "Federal court statistics show 62% of summary judgment motions fail".
- Try to make labels 32 characters long or less
- When a node is a leaf node in the tree, it is considered a terminal node, and it MUST have a value
- The probabilities in a group of branches MUST sum to 1
- The tree always starts with a single root node
- Values should be negative if they represent a loss
- Costs must be positive because they are subtracted from values

## Construction rules

These rules are distilled from Marc B. Victor, "Decision Tree Analysis: A Means of Reducing Litigation Uncertainty and Facilitating Good Settlements", 31 Georgia State University Law Review 715 (2015), https://www.litigationrisk.com/GSU%20Law%20Review%20article.pdf

- **Model what the judge and jury will decide.** Each node that has branches is one uncertain issue that a judge or jury will decide. Its branches are the possible outcomes of that issue.
- **Order the issues as they will be decided.** Go from the root to the terminal nodes in the order you expect the issues to be decided, guided by the law, standard jury instructions and the likely verdict form. A judge's ruling that affects only one later jury issue may be placed immediately before that issue. If the ruling would change the probabilities of other issues, it must come before all of them.
- **Match the depth to how the judge or jury will think.** If they will vote separately on each sub-issue, such as each element of a claim, give each sub-issue its own node. If they will only decide the overall question, use a single node and mention the sub-points in the `reason`. Treat damages the same way: use separate nodes for components that will be awarded separately, or one node for the total.
- **Probabilities are conditional.** Each `probability` is the chance of that outcome given that everything on the path from the root has already happened. The same issue may deserve different probabilities on different paths. For example, a jury that has found negligent conduct is more likely to also find causation.
- **Add nodes for what influences an issue.** When the outcome of an issue depends heavily on something else, such as whether a key document is admitted, whether a witness testifies or which jury instruction is given, add that as its own node before the issue. Then repeat the influenced issue under each of its branches, with different probabilities.
- **When a party must win all of several issues**, chain them. The winning branch of each issue leads to the next issue, and the losing branch ends in a terminal node.
- **When a party can win on any one of several alternative claims**, chain them the other way. The losing branch of the first claim leads to the next claim. If the damages are the same whichever claim succeeds, the winning branch can lead straight to damages. If the damages depend on which claims succeed, or on how many, continue to the next claim under the winning branch as well, so that each combination has its own path. Never add the probabilities of alternative claims together.
- **Use a range for uncertain damages.** When the amount of an award is uncertain, use a few representative amounts, typically a high, a medium and a low award, each with its own probability. The range does not need to be symmetrical. When the amount is undisputed, use a single value.
- **Make probabilities realistic.** A probability is realistic if it reflects what would happen if the issue were decided many times by similar judges or juries. A probability of 0.65 means that 65 of 100 similar judges would rule that way. The `reason` should name the evidence and arguments that the judge or jury will weigh.
- **Only include future costs.** A `cost` is a litigation cost that is still to come and that a settlement would avoid. Leave out money that has already been spent. If the loser will have to pay some of the winner's costs, add that amount to the award in the terminal `value`.
- **Do not do the arithmetic.** Do not calculate path probabilities or expected values, and do not adjust for risk aversion. The app does this from the tree.

## Lawsuit description

{{CASE_DESCRIPTION}}

## Zod schemas

<!-- prettier-ignore -->
```ts
{{ZOD_SCHEMAS}}
```

<!-- TODO: optimize example -->

## Example JSON output

```json
{
  "value": null,
  "cost": null,
  "branches": [
    {
      "label": "File Summary Judgment Motion",
      "probability": 0.35,
      "reason": "Federal Judicial Center studies show 35% of contract disputes involve summary judgment motions, as parties seek early resolution when material facts are undisputed and legal standards are clear",
      "nextNode": {
        "value": null,
        "cost": null,
        "branches": [
          {
            "label": "Win Summary Judgment",
            "probability": 0.38,
            "reason": "Administrative Office of US Courts data shows 38% success rate for summary judgment motions in contract disputes when moving party demonstrates absence of genuine material fact disputes",
            "nextNode": {
              "value": 1000000,
              "cost": null,
              "branches": []
            }
          },
          {
            "label": "Lose Summary Judgment",
            "probability": 0.62,
            "reason": "Federal court statistics show 62% of summary judgment motions fail when genuine issues of material fact exist or when contract interpretation requires jury determination",
            "nextNode": {
              "value": null,
              "cost": null,
              "branches": [
                {
                  "label": "Win at Trial",
                  "probability": 0.52,
                  "reason": "Bureau of Justice Statistics shows 52% plaintiff win rate at trial following denied summary judgment motions, reflecting complex factual disputes and higher defense preparedness",
                  "nextNode": {
                    "value": null,
                    "cost": null,
                    "branches": [
                      {
                        "label": "High Damages",
                        "probability": 0.25,
                        "reason": "American Bar Association litigation outcomes study shows 25% of contract cases result in full damage awards when plaintiff provides comprehensive documentation and credible expert witness testimony",
                        "nextNode": {
                          "value": 1000000,
                          "cost": null,
                          "branches": []
                        }
                      },
                      {
                        "label": "Medium Damages",
                        "probability": 0.5,
                        "reason": "National Center for State Courts data indicates 50% of successful contract plaintiffs receive partial damages when some losses are proven but consequential damages lack sufficient certainty or foreseeability",
                        "nextNode": {
                          "value": 500000,
                          "cost": null,
                          "branches": []
                        }
                      },
                      {
                        "label": "Low Damages",
                        "probability": 0.25,
                        "reason": "Federal Judicial Center studies show 25% of winning contract plaintiffs receive minimal damages when liability is clear but economic losses are difficult to quantify or plaintiff failed to mitigate damages",
                        "nextNode": {
                          "value": 250000,
                          "cost": null,
                          "branches": []
                        }
                      }
                    ]
                  }
                },
                {
                  "label": "Lose at Trial",
                  "probability": 0.48,
                  "reason": "Bureau of Justice Statistics indicates 48% of contract plaintiffs lose at trial when they cannot meet burden of proof on disputed facts or defendants successfully establish valid contractual defenses",
                  "nextNode": {
                    "value": 0,
                    "cost": null,
                    "branches": []
                  }
                }
              ]
            }
          }
        ]
      }
    },
    {
      "label": "Go Directly to Trial",
      "probability": 0.65,
      "reason": "Federal Judicial Center data shows 65% of contract disputes proceed directly to trial when factual disputes preclude summary adjudication or when legal issues require jury determination",
      "nextNode": {
        "value": null,
        "cost": null,
        "branches": [
          {
            "label": "Win at Trial",
            "probability": 0.638,
            "reason": "Direct trial win rates based on historical contract dispute outcomes, accounting for strength of legal claims and evidence quality",
            "nextNode": {
              "value": null,
              "cost": null,
              "branches": [
                {
                  "label": "High Damages",
                  "probability": 0.25,
                  "reason": "Full damage awards granted when plaintiff provides comprehensive documentation of losses and strong expert testimony validates all claimed damages",
                  "nextNode": {
                    "value": 1000000,
                    "cost": null,
                    "branches": []
                  }
                },
                {
                  "label": "Medium Damages",
                  "probability": 0.5,
                  "reason": "Moderate damages awarded when core losses are proven but some claimed damages lack sufficient documentation or involve disputed valuations",
                  "nextNode": {
                    "value": 500000,
                    "cost": null,
                    "branches": []
                  }
                },
                {
                  "label": "Low Damages",
                  "probability": 0.25,
                  "reason": "Limited damages awarded when liability is established but economic losses are minimal, speculative, or plaintiff failed to mitigate damages",
                  "nextNode": {
                    "value": 250000,
                    "cost": null,
                    "branches": []
                  }
                }
              ]
            }
          },
          {
            "label": "Lose at Trial",
            "probability": 0.362,
            "reason": "Trial loss results when plaintiff fails to prove essential elements of the contract claim or defendant successfully demonstrates non-breach or valid defenses",
            "nextNode": {
              "value": 0,
              "cost": null,
              "branches": []
            }
          }
        ]
      }
    }
  ]
}
```
