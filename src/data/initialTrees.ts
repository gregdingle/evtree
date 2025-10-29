import bathtubTreeData from "@/data/demo-bathtub-tree.json";
import demoHelloWorldTreeData from "@/data/demo-hello-world-tree.json";
import demoSexualTreeData from "@/data/demo-sexual-tree.json";
import { DecisionTree } from "@/lib/tree";

const initialTrees: Record<string, DecisionTree> = {
  [demoHelloWorldTreeData.id]:
    demoHelloWorldTreeData as unknown as DecisionTree,
  [demoSexualTreeData.id]: demoSexualTreeData as unknown as DecisionTree,
  [bathtubTreeData.id]: bathtubTreeData as unknown as DecisionTree,
};

export default initialTrees;
