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
        {nextLabel && nextHref && (
          <Link
            href={nextHref}
            className="bluelink absolute top-4 right-4 sm:top-8 sm:right-8"
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
              className="bluelink bottom-4 left-4 px-2 sm:bottom-8 sm:left-8"
            >
              ◁ Home
            </Link>
            &nbsp;&nbsp;
            <Link
              href={nextHref}
              className="bluelink bottom-4 left-4 px-2 sm:bottom-8 sm:left-8"
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
