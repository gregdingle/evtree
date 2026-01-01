import StaticPage from "@/components/StaticPage";

export default function UserGuide() {
  return (
    <StaticPage
      linkToHome={true}
      nextLabel="Start Building"
      nextHref="/builder"
    >
      <h1 className="mb-4 text-3xl sm:text-5xl">User Guide</h1>{" "}
    </StaticPage>
  );
}
