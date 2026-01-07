import Link from "next/link";

import StaticPage from "@/components/StaticPage";

export default function UserGuide() {
  return (
    <StaticPage
      linkToHome={true}
      nextLabel="Start Building"
      nextHref="/builder"
    >
      <h1 className="mb-4 text-3xl sm:text-5xl">User Guide</h1>{" "}
      <div className="mx-8 flex flex-col items-center text-xl">
        <p className="my-4">
          We wrote this user guide to help you get the most out of
          TreeDecisions. It covers all the main features and functionality of
          the app, with step-by-step instructions and helpful tips.
        </p>
        <hr className="my-4 w-50 bg-neutral-900" />
        <p className="my-4 text-2xl font-semibold">
          <Link
            href="/user-guide/TreeDecisons User Guide.pdf"
            className="bluelink"
            target="_blank"
          >
            Download PDF
          </Link>
        </p>
        <hr className="my-4 w-50 bg-neutral-900" />
      </div>
    </StaticPage>
  );
}
