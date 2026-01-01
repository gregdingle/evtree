import StaticPage from "@/components/StaticPage";

export default function QuickStart() {
  return (
    <StaticPage linkToHome={true} nextLabel="User Guide" nextHref="/user-guide">
      <h1 className="mb-4 text-3xl sm:text-5xl">Quick Start</h1>{" "}
    </StaticPage>
  );
}
