export default function StaticPage({
  children,
}: {
  children: React.ReactNode;
}) {
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
        {children}
      </div>
    </div>
  );
}
