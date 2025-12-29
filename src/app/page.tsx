import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div
      // TODO: responsive design
      // TODO: dark mode
      className="mx-auto
    my-16
    flex
    max-w-4xl
    min-w-2xl
    flex-col
    items-center
    justify-center
    border
    bg-amber-50
    py-20 dark:bg-neutral-900"
      // NOTE: neutral-900 is #171717, very close to ReactFlow default dark mode (#141414)
    >
      <h2 className="text-2xl">Welcome to</h2>
      <div
        // NOTE: see also logo in Toolbar.tsx
        className="flex items-center space-x-4"
      >
        <Image
          src="/favicon.svg"
          alt="TreeDecisions logo"
          width={96}
          height={96}
          className="dark:invert"
        />
        <h1 className="text-5xl">TreeDecisions</h1>
      </div>
      <hr className="my-8 w-50 bg-neutral-900" />
      <h2 className="text-2xl">
        <Link
          href="/editor" // TODO: extract this as shared link style
          className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          Start Editing
        </Link>
      </h2>
      <hr className="my-8 w-50 bg-neutral-900" />
      <h2 className="text-2xl">Documentation</h2>
      <h3 className="text-xl">(coming soon!)</h3>
    </div>
  );
}
