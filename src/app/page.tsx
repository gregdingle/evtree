import React from "react";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full items-start justify-center">
      <div
        className="
    mx-auto
    flex
    w-xl
    flex-col
    items-center
    justify-center
    rounded
    border
    bg-amber-50
    py-8
    sm:my-16
    sm:w-2xl
    sm:py-16
    dark:bg-neutral-900"
        // NOTE: neutral-900 is #171717, very close to ReactFlow default dark mode (#141414)
        // NOTE: see also logo in Toolbar.tsx
      >
        <h2 className="text-2xl">Welcome to</h2>
        <Image
          src="/favicon.svg"
          alt="TreeDecisions logo"
          width={128}
          height={128}
          className="-ml-2 w-24 sm:w-[128px] dark:invert"
        />
        <h1 className="mb-4 text-3xl sm:text-5xl">TreeDecisions</h1>
        <hr className="my-4 w-50 bg-neutral-900" />
        <p className="mx-8 mt-4 mb-2 text-center">
          Build elegant{" "}
          <a
            target="_blank"
            className="text-blue-700 hover:underline dark:text-blue-400"
            href="https://en.wikipedia.org/wiki/Decision_tree"
          >
            decision trees
          </a>{" "}
          quickly.
        </p>
        <p className="mx-8 my-2 text-center">
          Create, edit, export, and share.
        </p>
        <p className="mx-8 mt-2 mb-4 text-center">
          <a
            target="_blank"
            className="text-blue-700 hover:underline dark:text-blue-400"
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
            // TODO: extract contact email to global config
            href="mailto:gregdingle@gmail.com,maaron@just-decisions.com?subject=TreeDecisions"
            // TODO: extract this as shared link style
            className="text-blue-700 hover:underline dark:text-blue-400"
          >
            Contact
          </a>
          &nbsp;&middot;&nbsp;
          <a
            // TODO: extract contact email to global config
            href="https://github.com/gregdingle/evtree/?tab=readme-ov-file#license"
            // TODO: extract this as shared link style
            className="text-blue-700 hover:underline dark:text-blue-400"
          >
            License
          </a>
          &nbsp;&middot;&nbsp;
          <a
            // TODO: extract contact email to global config
            href="https://github.com/gregdingle/evtree/"
            // TODO: extract this as shared link style
            className="text-blue-700 hover:underline dark:text-blue-400"
          >
            Source
          </a>
        </footer>
      </div>
    </div>
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
      <Link
        href={href} // TODO: extract this as shared link style
        className="text-blue-700 hover:underline dark:text-blue-400"
      >
        {children}
      </Link>
    </h2>
  );
}
