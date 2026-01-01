import Link from "next/link";

import StaticPage from "@/components/StaticPage";

// TODO: supplement with screenshots?
export default function QuickStart() {
  return (
    <StaticPage linkToHome={true} nextLabel="User Guide" nextHref="/user-guide">
      <h1 className="mb-4 text-3xl sm:text-5xl">Quick Start</h1>{" "}
      <div className="mx-8 text-xl">
        <p className="my-4">
          Here is the minimum you need to get started with{" "}
          <Link href="/" className="bluelink">
            TreeDecisions
          </Link>{" "}
          for those who already understand the logic and conventions of{" "}
          <a
            href="https://en.wikipedia.org/wiki/Decision_tree"
            target="_blank"
            className="bluelink"
          >
            decision trees
          </a>
          .
        </p>
        <ol className="my-4 list-decimal pl-6">
          <li className="py-2">
            Open the{" "}
            <Link href="/builder" className="bluelink">
              Tree Builder
            </Link>
          </li>
          <li className="py-2">
            Click the blue <em>Create</em> button, enter a name, and create a
            new tree
          </li>
          <li className="py-2">
            Right-click on the empty canvas and <em>Add Chance Node</em>
          </li>
          <li className="py-2">
            Right-click on your new chance node and{" "}
            <em>Add Branch to... Terminal Node</em>
          </li>
          <li className="py-2">
            Click on the <em>???</em> on the new branch and replace it with a
            label like &quot;Success&quot; or &quot;Failure&quot;
          </li>
          <li className="py-2">
            Click on the <em>??%</em> on the new branch and replace it with a
            probability like 0.5. Ignore the red warning for now.
          </li>
          <li className="py-2">
            Click on the <em>???</em> next to the new terminal node and replace
            it with a value like 100
          </li>
          <li className="py-2">
            Repeat steps 4 to 7 to add another branch to the original chance
            node. Make sure the probabilities of the branches sum to 1.0.
          </li>
          <li className="py-2">
            Click the <em>Calculate</em> button in the top toolbar to compute
            the expected values of your new tree.
          </li>
        </ol>
        <p className="my-4">
          Congrats! You just built your first decision tree in TreeDecisions.
        </p>
      </div>
    </StaticPage>
  );
}
