# Task description

Given the Zod schemas below, construct a decision tree in JSON from the following text description of a lawsuit. Use the example JSON output for inspiration. Use the article at https://www.litigationrisk.com/GSU%20Law%20Review%20article.pdf for guidance on how to construct a decision tree.

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

## Lawsuit description

{{CASE_DESCRIPTION}}

## Zod schemas

```ts
{
  {
    ZOD_SCHEMAS;
  }
}
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
