import Image from "next/image";

import { StaticPage } from "@/components/StaticPage";

export default function DataSecurity() {
  return (
    <StaticPage linkToHome={true} nextLabel="User Guide" nextHref="/user-guide">
      <h1 className="mb-4 text-3xl sm:text-5xl">Data Security</h1>{" "}
      <div className="mx-8 text-xl">
        <p className="my-4">
          TreeDecisions is designed with your data privacy and security in mind.
          Unlike most web applications, TreeDecisions does not store any of the
          data you enter on our servers––with two partial exceptions, both
          explained below. Instead, all data is stored locally on your device
          using your browser&apos;s{" "}
          <a
            href="https://en.wikipedia.org/wiki/Web_storage"
            target="_blank"
            className="bluelink"
          >
            web storage
          </a>
          .
        </p>
        <div className="my-4">
          This means that:
          <ul className="my-4 list-disc pl-6">
            <li className="py-2">
              Your data will only be available on the device (computer, tablet,
              phone) and browser (Chrome, Firefox, Safari, etc.) where you
              entered it.
            </li>
            <li className="py-2">
              You do not need to create an account or provide any personal
              information to use TreeDecisions.
            </li>
            <li className="py-2">
              If you clear your browser data, or your have configured your
              browser to do so automatically, your data may be lost.
            </li>
            <li className="py-2">
              If you wish to have a permanent copy of your data outside your
              browser, you should export your trees as JSON files and keep the
              files in a safe place.
            </li>
          </ul>
        </div>
        {/* TODO: add screenshot of button
                    <Screenshot
            src="/quick-start/evtree-quick-start-1.png"
            alt="screenshot"
            width={634}
            height={385}
          /> */}
        <p className="my-4">
          <strong>Partial exception #1:</strong> When you click{" "}
          <em>Save & Copy Link</em>, the app encrypts a copy of the current
          tree, uploads it to our server, then makes a link to that copy with
          the decryption key appended. You can share this link with others (or
          yourself). The encrypted copy is stored permanently on our server, but{" "}
          <a
            target="_blank"
            className="bluelink"
            href="https://en.wikipedia.org/wiki/End-to-end_encryption"
          >
            we have no way to decrypt it
          </a>{" "}
          without the key embedded in the link. This feature is optional and
          only used when you explicitly choose to save and share a link.
        </p>
        {/* TODO: screenshot to AI feature */}
        <p className="my-4">
          <strong>Partial exception #2:</strong> When you create a new tree by
          clicking <em>Generate with AI</em>, the app sends a copy of the text
          you entered to an{" "}
          <a
            target="_blank"
            className="bluelink"
            href="https://en.wikipedia.org/wiki/Google_Gemini"
          >
            AI service
          </a>{" "}
          for processing. The AI service has its own data policies which you
          should review. This feature is optional and only used when you
          explicitly choose to generate a tree with AI.
        </p>
        <p className="my-4">
          You are welcome to review our{" "}
          <a
            target="_blank"
            className="bluelink"
            href="https://github.com/gregdingle/evtree/"
          >
            source code
          </a>{" "}
          for consistency with all these claims. You can even fork the project
          and run your own modified instance of the app for{" "}
          <a
            target="_blank"
            className="bluelink"
            href="https://github.com/gregdingle/evtree/?tab=readme-ov-file#license"
          >
            non-production use.
          </a>
        </p>
      </div>
    </StaticPage>
  );
}

interface ScreenshotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
}

function Screenshot({ src, alt, width, height }: ScreenshotProps) {
  return (
    <div className="mr-6">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="my-2 mr-8 rounded border-2 border-neutral-300 shadow-md"
      />
    </div>
  );
}
