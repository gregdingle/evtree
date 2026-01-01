import Image from "next/image";
import Link from "next/link";

import StaticPage from "@/components/StaticPage";

export default function QuickStart() {
  return (
    <StaticPage linkToHome={true} nextLabel="User Guide" nextHref="/user-guide">
      <h1 className="mb-4 text-3xl sm:text-5xl">Quick Start</h1>{" "}
      <div className="mx-8 text-xl">
        <p className="my-4 text-base">
          Here is the minimum you need to get started with{" "}
          <Link href="/" className="bluelink">
            TreeDecisions
          </Link>
          . It&apos;s designed for those who already familiar with the logic and
          conventions of{" "}
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
            <Screenshot
              src="/quick-start/evtree-quick-start-1.png"
              alt="screenshot"
              width={634}
              height={385}
            />
            <Screenshot
              src="/quick-start/evtree-quick-start-2.png"
              alt="screenshot"
              width={663}
              height={533}
            />
          </li>
          <li className="py-2">
            Right-click on the empty canvas and <em>Add Chance Node</em>
            <Screenshot
              src="/quick-start/evtree-quick-start-3.png"
              alt="screenshot"
              width={1198}
              height={732}
            />
            <Screenshot
              src="/quick-start/evtree-quick-start-4.png"
              alt="screenshot"
              width={405}
              height={407}
            />
          </li>
          <li className="py-2">
            Right-click on your new chance node and{" "}
            <em>Add Branch to... Terminal Node</em>
            <Screenshot
              src="/quick-start/evtree-quick-start-5.png"
              alt="screenshot"
              width={585}
              height={421}
            />
          </li>
          <li className="py-2">
            Click on the <em>???</em> on the new branch and replace it with a
            label like &quot;Success&quot; or &quot;Failure&quot;. Then click on
            the <em>??%</em> and replace it with a probability like 0.5. Ignore
            the red warning for now.
            <Screenshot
              src="/quick-start/evtree-quick-start-6.png"
              alt="screenshot"
              width={760}
              height={247}
            />
          </li>
          <li className="py-2">
            Click on the <em>???</em> next to the new terminal node and replace
            it with a value like 100
            <Screenshot
              src="/quick-start/evtree-quick-start-7.png"
              alt="screenshot"
              width={777}
              height={252}
            />
          </li>
          <li className="py-2">
            Repeat steps 4 to 7 to add another branch to the original chance
            node. Make sure the probabilities of the branches sum to 1.0.
            <Screenshot
              src="/quick-start/evtree-quick-start-8.png"
              alt="screenshot"
              width={730}
              height={421}
            />
          </li>
          <li className="py-2">
            Click the <em>Calculate</em> button in the top toolbar to compute
            the expected values of your new tree.
            <Screenshot
              src="/quick-start/evtree-quick-start-9.png"
              alt="screenshot"
              width={607}
              height={368}
            />
          </li>
        </ol>
        <p className="my-4">
          Congrats! You just built your first decision tree in TreeDecisions.
        </p>
      </div>
    </StaticPage>
  );
}

interface ScreenshotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
}

function Screenshot({ src, alt, width, height }: ScreenshotProps) {
  return (
    <div className="mr-6">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="my-2 mr-8 rounded border-2 border-neutral-300 shadow-md"
      />
    </div>
  );
}
