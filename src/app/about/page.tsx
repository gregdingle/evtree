import Image from "next/image";
import Link from "next/link";

import StaticPage from "@/components/StaticPage";

export default function About() {
  return (
    <StaticPage
      linkToHome={true}
      nextLabel="Quick Start"
      nextHref="/quick-start"
    >
      <h1 className="mb-4 text-3xl sm:text-5xl">About</h1>
      <div className="mx-8">
        <h2 className="my-4 text-2xl">About Us</h2>
        <p className="my-4">
          <a
            href="https://www.linkedin.com/in/marjorie-corman-aaron-49a77a48/"
            target="_blank"
            className="float-left mr-4 mb-2 rounded border-2 border-neutral-300"
          >
            <Image
              src="/about/marjorie-aaron.jpg"
              alt="Marjorie Corman Aaron"
              width={100}
              height={100}
            />
          </a>
          <strong>Marjorie Corman Aaron</strong> is Professor of Practice
          Emerita at the University of Cincinnati College of Law, where she
          taught negotiation, mediation, mediation advocacy, decision analysis,
          client counseling, and trial practice. Among her publications is the
          book{" "}
          <a
            href="https://www.riskandrigor.com/risk-and-rigor-the-book"
            target="_blank"
            className="bluelink"
          >
            Risk & Rigor
          </a>
          : A Lawyer&apos;s Guide to Assessing Cases and Advising Clients (DRI
          Press 2019) . She now practices as arbitrator, mediator and decision
          tree builder.
        </p>
        <p className="my-4">
          <a
            href="https://www.linkedin.com/in/gregdingle/"
            target="_blank"
            className="float-left mr-4 mb-2 rounded border-2 border-neutral-300"
          >
            <Image
              src="/about/greg-dingle.jpg"
              alt="Greg Dingle"
              width={100}
              height={100}
            />
          </a>
          <strong>Greg Dingle</strong> is a software engineer with experience in
          high-stakes mediation as a member of the Creditor Committee of the{" "}
          <a
            href="https://restructuring.ra.kroll.com/blockfi/Home-Index"
            target="_blank"
            className="bluelink"
          >
            Blockfi Chapter 11 bankruptcy
          </a>
          . He previously worked for{" "}
          <a href="https://flux.ai/" target="_blank" className="bluelink">
            Flux.ai
          </a>{" "}
          and Facebook, among other endeavors.
        </p>
      </div>
      <div className="mx-8">
        {/* TODO: better heading? About ??? */}
        <h2 className="my-4 text-2xl">About the App</h2>
        <p className="my-4">
          We created{" "}
          <Link href="/" className="bluelink">
            TreeDecisions
          </Link>{" "}
          to provide a simple and easy software for professionals seeking to
          make{" "}
          <a
            href="https://en.wikipedia.org/wiki/Decision_tree"
            target="_blank"
            className="bluelink"
          >
            decision trees
          </a>
          . It accomplishes the basics, enabling users to build a tree structure
          that reflects a decision and the possible but uncertain paths that
          might follow. A user can enter estimated probabilities, and estimated
          outcomes and estimated costs of achieving those outcomes. Based on the
          numerical values entered, the software will calculate an overall{" "}
          <a
            href="https://en.wikipedia.org/wiki/Expected_value"
            className="bluelink"
            target="_blank"
          >
            expected value
          </a>
          , the expected value at each juncture along the way, and the overall
          probability of each possible outcome.
        </p>
      </div>
    </StaticPage>
  );
}
