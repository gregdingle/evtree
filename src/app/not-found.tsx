import { CanvasCenteredHelpMessage } from "@/components/CanvasCenteredHelpMessage";

export default function NotFound() {
  // TODO: some fancier message... see Tailwind UI block of error page
  // TODO: make sure errors are being logged somewhere... vercel?... sentry?
  return <CanvasCenteredHelpMessage text="Page Not Found" />;
}
