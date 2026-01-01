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

        {/* TODO: finish thumbnail image with links to LinkedIn
        TODO: consider off-white background as in tailwind... but then builder bg?
        */}

        <p className="my-4">
          <a
            href="https://www.linkedin.com/in/gregdingle/"
            target="_blank"
            className="bluelink"
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
          {/* TODO: add footnote somehow from
          https://docs.google.com/document/d/1ECZAESsJkHNiMeGabG-fa50SR9IbWE-TloHO7sWKBCk/edit?tab=t.0 */}
        </p>
        <p className="my-4">
          <a
            href="https://www.linkedin.com/in/gregdingle/"
            target="_blank"
            className="bluelink"
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
      <div className="mx-8">
        {/* TODO: add footnotes in this section somehow from
        https://docs.google.com/document/d/1ECZAESsJkHNiMeGabG-fa50SR9IbWE-TloHO7sWKBCk/edit?tab=t.0 */}
        <h2 className="my-4 text-2xl">A Bit of History and Current Context</h2>
        <p className="my-4">
          <a
            href="https://en.wikipedia.org/wiki/Decision_tree"
            target="_blank"
            className="bluelink"
          >
            Decision tree analysis
          </a>{" "}
          has its historical roots in business and economics. The earliest
          decision tree software we know of is{" "}
          <a
            href="https://www.treeage.com/"
            target="_blank"
            className="bluelink"
          >
            TreeAge
          </a>
          , which was developed in the 1980s by a Boston lawyer, Morris Raker,
          then a Boston Lawyer, and his neighbor David Hoffer, then a teenage
          “whiz kid.” One of the authors of this guide, Marjorie Aaaron, was an
          early user of TreeAge. Though still used by some lawyers today,
          TreeAge is a paid product predominantly used for public health,
          pharmaceutical and medical research, as well as business
          decision-making. To serve those communities, the TreeAge software has
          developed to become highly sophisticated but less accessible to the
          non-technical user. In recent years, others have developed decision
          analytic software and services primarily aimed at and priced for large
          corporate and law firm clients.
        </p>
        <p className="my-4">
          The accumulated experience of 35+ years of building and teaching
          decision trees convinced Marjorie Aaaron of the need for a simple
          decision tree software with graphically clean and efficient interface
          and outputs. Meanwhile, Greg Dingle’s experience in repeated
          high-stakes mediations convinced him that there was a need for
          collaborating on basic decision trees via an app.
        </p>
        <p className="my-4">
          From the beginning of our partnership, our goal has been to keep{" "}
          <Link href="/" className="bluelink">
            TreeDecisions
          </Link>{" "}
          minimal and unfussy. It’s designed for users who are comfortable with
          the basic method, who are able to organize the needed information,
          questions, uncertainties, and professional assessments and estimates
          into a tree format. In other words, it’s for users who understand how
          to draw trees on paper and do the arithmetic, if possible, would
          prefer to make trees that are neater and to do the math with a mouse
          click.
        </p>
        {/* TODO: move these paragraphs to Guide page? */}
        <p className="my-4">
          As you will see, most examples used in this Guide (and in the{" "}
          <a
            href="https://www.riskandrigor.com/risk-and-rigor-the-book"
            target="_blank"
            className="bluelink"
          >
            Risk & Rigor
          </a>{" "}
          book) involve decision trees in litigation contexts, largely because
          our practice and teaching experience has been with legal cases.
          However, the{" "}
          <Link href="/" className="bluelink">
            TreeDecisions
          </Link>{" "}
          software application can be used for decision tree analysis in just
          about any context.
        </p>
        <p>
          Note also that, while always called a “decision” tree, a tree may be
          used purely for risk analysis of contingent outcomes reached at the
          end of various uncertain paths. For example, a litigation case tree is
          generally pure risk analysis because, while the parties surely seek to
          influence decision makers, they don’t hold decision-making power
          within the process.
        </p>
      </div>
    </StaticPage>
  );
}
