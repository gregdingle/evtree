import bathtubTreeData from "@/data/demo-bathtub-tree.json";
import demoHelloWorldTreeData from "@/data/demo-hello-world-tree.json";
import demoSexualTreeData from "@/data/demo-sexual-tree.json";
import componentSupplyTreeData from "@/data/reference/component-supply-tree.json";
import haplessHarvestTreeData from "@/data/reference/hapless-harvest-defense-with-costs-tree.json";
import { DecisionTree } from "@/lib/tree";

// NOTE: The list of trees is sorted by updatedAt, latest first, so the Hello
// World tree needs the latest updatedAt to be first, see initialTrees.test.ts
const initialTrees: Record<string, DecisionTree> = {
  [demoHelloWorldTreeData.id]:
    demoHelloWorldTreeData as unknown as DecisionTree,
  [demoSexualTreeData.id]: demoSexualTreeData as unknown as DecisionTree,
  [bathtubTreeData.id]: bathtubTreeData as unknown as DecisionTree,
  // NOTE: one of the reference trees, see reference-trees.test.ts. It is the
  // defense side of Hapless Harvest, which is the only side with fees and costs
  // that follow the case text.
  [haplessHarvestTreeData.id]:
    haplessHarvestTreeData as unknown as DecisionTree,
  // TODO: this reference tree is here to try it against the AI. Decide
  // whether to keep it as a default tree, see reference-trees.test.ts.
  [componentSupplyTreeData.id]:
    componentSupplyTreeData as unknown as DecisionTree,
};

export default initialTrees;
