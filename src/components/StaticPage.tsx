import Link from "next/link";

export default function StaticPage({
  linkToHome,
  children,
}: {
  linkToHome: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full">
      <div
        className="
    relative
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
      >
        {linkToHome && (
          <Link
            href="/"
            className="bluelink absolute top-4 left-4 sm:top-8 sm:left-8"
          >
            ◁ Home
          </Link>
        )}

        {children}
      </div>
    </div>
  );
}
