import Image from "next/image";

export default function Home() {
  return (
    <div className="font-black flex flex-col items-center justify-center space-y-0 py-20">
      <h1 className="text-2xl">Welcome to</h1>
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
    </div>
  );
}
