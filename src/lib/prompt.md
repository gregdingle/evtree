# Task description

Given the Zod schemas below, construct a decision tree in JSON from the following text description of a lawsuit. Use the example JSON output for inspiration. Follow the construction procedure below to construct the decision tree.

<!-- TODO: consider how to model cases that have already happened... use counter-factuals? -->

<!-- TODO: consider allowing and instructing on use of Decision nodes. would they be worth the trouble for AI? -->

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
- Values are from the perspective of the party that the description is written for, or the plaintiff if that is unclear
- Values should be negative if they represent a loss
- Costs must be positive because they are subtracted from values
- Do not calculate path probabilities or expected values, and do not adjust for risk aversion. The app does this from the tree.

## Construction procedure

Work through these steps in order. They are distilled from Marc B. Victor, "Decision Tree Analysis: A Means of Reducing Litigation Uncertainty and Facilitating Good Settlements", 31 Georgia State University Law Review 715 (2015), https://www.litigationrisk.com/GSU%20Law%20Review%20article.pdf

1. **List the issues.** List each uncertain issue that a judge or jury will decide, including damages. Each issue becomes a node, and the possible outcomes of the issue become the branches of that node. The outcomes must not overlap, and together they must cover everything that could happen.
2. **Choose the depth of each issue.** If the judge or jury will vote separately on each sub-issue, such as each element of a claim, make each sub-issue its own node. If they will only decide the overall question, use a single node and mention the sub-points in the `reason`. Treat damages the same way: use separate nodes for components that will be awarded separately, or one node for the total.
3. **Order the issues.** Go from the root to the terminal nodes in the order you expect the issues to be decided, guided by the law, standard jury instructions and the likely verdict form. A judge's ruling that affects only one later jury issue may be placed immediately before that issue. If the ruling would change the probabilities of other issues, it must come before all of them.
4. **Add what influences each issue.** When the outcome of an issue depends heavily on something else, such as whether a key document is admitted, whether a witness testifies or which jury instruction is given, add that as its own node before the issue. Then repeat the influenced issue under each of its branches.
5. **Connect the issues.** When a party must win all of several issues, the winning branch of each issue leads to the next issue, and the losing branch ends in a terminal node. When a party can win on any one of several alternative claims, the losing branch of each claim leads to the next claim. If the damages are the same whichever claim succeeds, the winning branch can lead straight to damages. If the damages depend on which claims succeed, or on how many, continue to the next claim under the winning branch as well, so that each combination has its own path. Do not merge alternative claims into one node by adding their probabilities together.
6. **End every path with a value.** Every path ends in a terminal node that has a `value`. When the amount of an award is uncertain, use a few representative amounts, typically a high, a medium and a low award, each on its own branch. The range does not need to be symmetrical. When the amount is undisputed, use a single value.
7. **Give each branch a `reason` and a `probability`.** In the `reason`, name the evidence and arguments that the judge or jury will weigh. Then estimate the `probability`. A probability is realistic if it reflects what would happen if the issue were decided many times by similar judges or juries. A probability of 0.65 means that 65 of 100 similar judges would rule that way. The same issue may deserve different probabilities on different paths. For example, a jury that has found negligent conduct is more likely to also find causation.
8. **Add costs.** Set a `cost` on the node where a litigation cost is incurred. Only include costs that are still to come and that a settlement would avoid. Leave out money that has already been spent. If the loser will have to pay some of the winner's costs, add that amount to the award in the terminal `value`.

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
      "reason": "Federal Judicial Center studies show 35% of contract disputes involve summary judgment motions, as parties seek early resolution when material facts are undisputed and legal standards are clear",
      "probability": 0.35,
      "nextNode": {
        "value": null,
        "cost": null,
        "branches": [
          {
            "label": "Win Summary Judgment",
            "reason": "Administrative Office of US Courts data shows 38% success rate for summary judgment motions in contract disputes when moving party demonstrates absence of genuine material fact disputes",
            "probability": 0.38,
            "nextNode": {
              "value": 1000000,
              "cost": null,
              "branches": []
            }
          },
          {
            "label": "Lose Summary Judgment",
            "reason": "Federal court statistics show 62% of summary judgment motions fail when genuine issues of material fact exist or when contract interpretation requires jury determination",
            "probability": 0.62,
            "nextNode": {
              "value": null,
              "cost": null,
              "branches": [
                {
                  "label": "Win at Trial",
                  "reason": "Bureau of Justice Statistics shows 52% plaintiff win rate at trial following denied summary judgment motions, reflecting complex factual disputes and higher defense preparedness",
                  "probability": 0.52,
                  "nextNode": {
                    "value": null,
                    "cost": null,
                    "branches": [
                      {
                        "label": "High Damages",
                        "reason": "American Bar Association litigation outcomes study shows 25% of contract cases result in full damage awards when plaintiff provides comprehensive documentation and credible expert witness testimony",
                        "probability": 0.25,
                        "nextNode": {
                          "value": 1000000,
                          "cost": null,
                          "branches": []
                        }
                      },
                      {
                        "label": "Medium Damages",
                        "reason": "National Center for State Courts data indicates 50% of successful contract plaintiffs receive partial damages when some losses are proven but consequential damages lack sufficient certainty or foreseeability",
                        "probability": 0.5,
                        "nextNode": {
                          "value": 500000,
                          "cost": null,
                          "branches": []
                        }
                      },
                      {
                        "label": "Low Damages",
                        "reason": "Federal Judicial Center studies show 25% of winning contract plaintiffs receive minimal damages when liability is clear but economic losses are difficult to quantify or plaintiff failed to mitigate damages",
                        "probability": 0.25,
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
                  "reason": "Bureau of Justice Statistics indicates 48% of contract plaintiffs lose at trial when they cannot meet burden of proof on disputed facts or defendants successfully establish valid contractual defenses",
                  "probability": 0.48,
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
      "reason": "Federal Judicial Center data shows 65% of contract disputes proceed directly to trial when factual disputes preclude summary adjudication or when legal issues require jury determination",
      "probability": 0.65,
      "nextNode": {
        "value": null,
        "cost": null,
        "branches": [
          {
            "label": "Win at Trial",
            "reason": "Direct trial win rates based on historical contract dispute outcomes, accounting for strength of legal claims and evidence quality",
            "probability": 0.638,
            "nextNode": {
              "value": null,
              "cost": null,
              "branches": [
                {
                  "label": "High Damages",
                  "reason": "Full damage awards granted when plaintiff provides comprehensive documentation of losses and strong expert testimony validates all claimed damages",
                  "probability": 0.25,
                  "nextNode": {
                    "value": 1000000,
                    "cost": null,
                    "branches": []
                  }
                },
                {
                  "label": "Medium Damages",
                  "reason": "Moderate damages awarded when core losses are proven but some claimed damages lack sufficient documentation or involve disputed valuations",
                  "probability": 0.5,
                  "nextNode": {
                    "value": 500000,
                    "cost": null,
                    "branches": []
                  }
                },
                {
                  "label": "Low Damages",
                  "reason": "Limited damages awarded when liability is established but economic losses are minimal, speculative, or plaintiff failed to mitigate damages",
                  "probability": 0.25,
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
            "reason": "Trial loss results when plaintiff fails to prove essential elements of the contract claim or defendant successfully demonstrates non-breach or valid defenses",
            "probability": 0.362,
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
