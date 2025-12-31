import Link from "next/link";

import StaticPage from "@/components/StaticPage";

export default function About() {
  return (
    <StaticPage linkToHome={true}>
      <h1 className="mb-4 text-3xl sm:text-5xl">About</h1>
      <div className="mx-8">
        <h2 className="my-4 text-2xl">About Us</h2>

        {/* TODO: put in thumbnail image with links to LinkedIn
        TODO: links in Marjorie bio
        */}

        <p className="my-4">
          <strong>Marjorie Corman Aaron</strong> is Professor of Practice
          Emerita at the University of Cincinnati College of Law, where she
          taught negotiation, mediation, mediation advocacy, decision analysis,
          client counseling, and trial practice. Among her publications is the
          book Risk & Rigor: A Lawyer&apos;s Guide to Assessing Cases and
          Advising Clients (DRI Press 2019). She now practices as arbitrator,
          mediator and decision tree builder.
          {/* TODO: add footnote somehow from
          https://docs.google.com/document/d/1ECZAESsJkHNiMeGabG-fa50SR9IbWE-TloHO7sWKBCk/edit?tab=t.0 */}
        </p>
        <p className="my-4">
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
