import React from "react";

import Image from "next/image";
import Link from "next/link";

import StaticPage from "@/components/StaticPage";

export default function Home() {
  return (
    <StaticPage linkToHome={false}>
      <h2 className="text-2xl">Welcome to</h2>
      <Image
        // NOTE: see also logo in Toolbar.tsx
        src="/favicon.svg"
        alt="TreeDecisions logo"
        width={128}
        height={128}
        className="-ml-2 w-24 sm:w-[128px] dark:invert"
      />
      <h1 className="mb-4 text-3xl sm:text-5xl">TreeDecisions</h1>
      <hr className="my-4 w-50 bg-neutral-900" />
      <p className="mx-8 mt-4 mb-2 text-center text-lg">
        Build elegant{" "}
        <a
          target="_blank"
          className="bluelink"
          href="https://en.wikipedia.org/wiki/Decision_tree"
        >
          decision trees
        </a>{" "}
        quickly.
      </p>
      <p className="mx-8 my-2 text-center text-lg">
        Create, edit, export, and share.
      </p>
      <p className="mx-8 mt-2 mb-4 text-center text-lg">
        <a
          target="_blank"
          className="bluelink"
          href="https://en.wikipedia.org/wiki/End-to-end_encryption"
        >
          Private data
        </a>
        {/*
    TODO: better reference? see also more academic
    https://martin.kleppmann.com/papers/local-first.pdf
    https://volodymyrpavlyshyn.medium.com/benefits-of-localfirst-for-the-good-of-all-e611e3ea823f

        */}
        , no account needed.
      </p>
      <hr className="my-4 w-50 bg-neutral-900" />
      <TocLink href="/builder" className="font-semibold">
        Start Building
      </TocLink>
      <hr className="my-4 w-50 bg-neutral-900" />
      <TocLink href="/about">About</TocLink>
      <TocLink href="/quick-start">Quick Start</TocLink>
      <TocLink href="/user-guide">User Guide</TocLink>
      <hr className="my-4 w-50 bg-neutral-900" />
      <footer className="my-6">
        <a
          href="mailto:gregdingle@gmail.com,maaron@just-decisions.com?subject=TreeDecisions"
          className="bluelink"
        >
          Contact
        </a>
        &nbsp;&middot;&nbsp;
        <a
          href="https://github.com/gregdingle/evtree/?tab=readme-ov-file#license"
          className="bluelink"
        >
          License
        </a>
        &nbsp;&middot;&nbsp;
        <a href="https://github.com/gregdingle/evtree/" className="bluelink">
          Source
        </a>
      </footer>
    </StaticPage>
  );
}

function TocLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`my-4 text-2xl ${className}`}>
      <Link href={href} className="bluelink">
        {children}
      </Link>
    </h2>
  );
}
