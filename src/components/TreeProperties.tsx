import { keys, toPairs } from "es-toolkit/compat";

import { CURRENCIES, CurrencyCode } from "@/lib/currency";
import { ROUNDING, RoundingCode } from "@/lib/rounding";
import { DecisionTree, DecisionTreeSimpleProperties } from "@/lib/tree";

import { PropertyInput } from "./PropertyInput";
import { VariablesInput } from "./VariablesInput";

export function TreeProperties({
  currentTree,
  onTreeDataUpdate,
}: {
  currentTree: DecisionTree | undefined;
  onTreeDataUpdate: (treeData: DecisionTreeSimpleProperties) => void;
}) {
  return currentTree ? (
    <div className="mb-8">
      <PropertyInput
        label="Name"
        value={currentTree.name}
        onChange={(value) => onTreeDataUpdate({ name: value })}
        placeholder="Enter tree name"
      />
      <PropertyInput
        label="Description"
        optional
        textarea
        value={currentTree.description}
        onChange={(value) => onTreeDataUpdate({ description: value })}
        placeholder="Enter tree description"
      />
      <hr className="my-6 border-gray-500" />
      <PropertyInput
        label="Currency"
        info={`Determines the symbol that will \nbe used to label amounts`}
        select
        value={currentTree.currency ?? CURRENCIES[""].code}
        onChange={(value) =>
          onTreeDataUpdate({ currency: value as CurrencyCode })
        }
        options={toPairs(CURRENCIES).map(([code, data]) => ({
          value: code,
          label: `${data.symbol} ${data.code} - ${data.name}`,
        }))}
      />
      {/* TODO: have a 'probabilities' setting for formating as decimal or percentage? */}
      <PropertyInput
        label="Rounding"
        info={`Determines how amounts will be \nrounded for display on the tree`}
        select
        value={currentTree.rounding ?? ROUNDING[""].code}
        onChange={(value) =>
          onTreeDataUpdate({ rounding: value as RoundingCode })
        }
        options={toPairs(ROUNDING).map(([code, data]) => ({
          value: code,
          label: `${data.name} ${data.scale ? " → " + keys(data.scale).join(", ") : ""}`,
        }))}
      />
      {/* TODO: instead of a tree setting, consider switching this display on "calculate".
        see proof-of-concept in git stash  */}
      <PropertyInput
        label="Terminal Display"
        info={`Determines what number will be \ndisplayed next to each terminal node`}
        select
        value={currentTree.terminalValueDisplay ?? "net"}
        onChange={(value) =>
          onTreeDataUpdate({ terminalValueDisplay: value as "outcome" | "net" })
        }
        options={[
          { value: "net", label: "Net Value" },
          { value: "outcome", label: "Outcome Value" },
        ]}
      />
      <hr className="my-6 border-gray-500" />
      <VariablesInput
        scope="value"
        // TODO: add 'See docs for more info on forumlas' when docs are done?
        info={`Creates variables that may be \nused in formulas for outcome values`}
      />
      <VariablesInput
        scope="cost"
        info={`Creates variables that may be \nused in formulas for node costs`}
      />
      <VariablesInput
        scope="probability"
        info={`Creates variables that may be \nused in formulas for branch \nprobabilities`}
      />
    </div>
  ) : (
    <p className="">No tree selected</p>
  );
}
