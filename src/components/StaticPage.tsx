import Link from "next/link";

export function StaticPage({
  linkToHome,
  nextLabel,
  nextHref,
  children,
}: {
  linkToHome: boolean;
  children: React.ReactNode;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="min-h-screen w-full">
      <div
        className="
    relative
    mx-auto
    flex
    flex-col
    items-center
    justify-center
    rounded
    border
    bg-amber-50
    py-8
    sm:w-lg
    md:my-16
    md:w-xl
    md:py-16
    lg:w-2xl
    dark:bg-neutral-900"
        // NOTE: neutral-900 is #171717, very close to ReactFlow default dark mode (#141414)
      >
        {linkToHome && (
          <Link
            href="/"
            className="bluelink absolute top-4 left-4 md:top-8 md:left-8"
          >
            ◁ Home
          </Link>
        )}
        {nextLabel && nextHref && (
          <Link
            href={nextHref}
            className="bluelink absolute top-4 right-4 md:top-8 md:right-8"
          >
            {nextLabel}{" "}
            <span
              // HACK: see https://stackoverflow.com/questions/17995873/black-left-right-pointing-triangles-not-the-same-size
              style={{
                transform: "rotate(180deg)",
                display: "inline-block",
                verticalAlign: "baseline",
                paddingTop: "1px",
              }}
            >
              ◁
            </span>
          </Link>
        )}

        {children}

        {nextLabel && nextHref && (
          <div className="mt-8">
            <Link
              href="/"
              className="bluelink bottom-4 left-4 px-2 md:bottom-8 md:left-8"
            >
              ◁ Home
            </Link>
            &nbsp;&nbsp;
            <Link
              href={nextHref}
              className="bluelink bottom-4 left-4 px-2 md:bottom-8 md:left-8"
            >
              {nextLabel}{" "}
              <span
                // HACK: see https://stackoverflow.com/questions/17995873/black-left-right-pointing-triangles-not-the-same-size
                style={{
                  transform: "rotate(180deg)",
                  display: "inline-block",
                  verticalAlign: "baseline",
                  paddingTop: "1px",
                }}
              >
                ◁
              </span>
            </Link>
          </div>
        )}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center text-xs text-gray-500">
          © 2025–{new Date().getFullYear()} Greg Dingle & Marjorie Aaron
        </div>
      </div>
    </div>
  );
}
