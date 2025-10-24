"use client";

import { useEffect, useState } from "react";

import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { ReCaptchaV3Provider, initializeAppCheck } from "firebase/app-check";

import { useStore } from "@/hooks/use-store";
import { firebaseApp } from "@/lib/firebase";
import { selectShowHistogram } from "@/lib/selectors";
import { downloadSharedTree, extractShareHash } from "@/lib/share";

import CollapsiblePanel from "./components/CollapsiblePanel";
import { Histogram } from "./components/Histogram";
import LeftSidePanel from "./components/LeftSidePanel";
import ReactFlowApp from "./components/ReactFlowApp";
import RightSidePanel from "./components/RightSidePanel";
import Toolbar from "./components/Toolbar";

export default function Home() {
  // NOTE: Prevents hydration mismatch on server-side rendering caused by
  // Zustand loading from localStorage. See
  // https://nextjs.org/docs/messages/react-hydration-error#solution-1-using-useeffect-to-run-on-the-client-only
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // See https://stackoverflow.com/questions/77482473/next-js-firebase-appcheck-error-recaptcha-placeholder-element-must-be-an-ele
    if (process.env.NODE_ENV === "development") {
      // @ts-expect-error: see https://firebase.google.com/docs/app-check/web/debug-provider
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(
        "6LepM_YrAAAAAHVY3Px_MrNBS3sp9vOKfItIU7dV",
      ),
    });

    setIsClient(true);
  }, []);

  const showHistogram = useStore(selectShowHistogram);

  if (!isClient) {
    // TODO: put some kind of loading spinner here?
    return null;
  }

  return (
    <ReactFlowProvider>
      <ShareLinkLoader />
      <div className="evtree">
        <div className="flex h-screen flex-col">
          <div className="border-b">
            <Toolbar />
          </div>
          <div className="flex flex-1">
            <div className="border-r">
              <CollapsiblePanel side="left">
                <LeftSidePanel />
              </CollapsiblePanel>
            </div>
            <div
              // NOTE: #141414 copied from reactflow default dark mode
              // NOTE: see also handleExportTree and download.ts
              className="flex-1 bg-amber-50 dark:bg-[#141414]"
            >
              {showHistogram ? (
                <Histogram className="px-16 py-4" />
              ) : (
                <ReactFlowApp />
              )}
            </div>
            <div className="border-l">
              <CollapsiblePanel side="right">
                <RightSidePanel />
              </CollapsiblePanel>
            </div>
            <footer className="absolute bottom-5 right-0 w-80 text-center text-sm">
              Feedback or questions?{" "}
              <a
                href="mailto:gregdingle@gmail.com?subject=EVTree"
                className="text-blue-700 hover:underline"
              >
                Email us
              </a>
            </footer>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

/**
 * NOTE: This will replace an existing tree that has the same ID.
 * TODO: should we warn the user when the current tree updatedAt is more recent?
 */
function ShareLinkLoader() {
  const { fitView } = useReactFlow();

  // Handle shared tree links (#share=abc123&key=...)
  useEffect(() => {
    const handleHashChange = () => {
      const shareData = extractShareHash();

      if (shareData) {
        // eslint-disable-next-line no-console
        console.debug(
          `[EVTree] Downloading tree ${shareData.hash} with key ${shareData.key}`,
        );
        downloadSharedTree(shareData.hash, shareData.key)
          .then((tree) => {
            useStore.getState().loadTree(tree, true);
            // Clear the hash after successful load
            window.history.replaceState(null, "", window.location.pathname);
            fitView();
            // eslint-disable-next-line no-console
            console.debug(
              `[EVTree] Download complete, loading tree "${tree.name}"`,
            );
          })
          .catch((error) => {
            // TODO: better notification
            console.error("[EVTree] Failed to load shared tree:", error);
            window.alert(
              `Failed to load shared tree: ${(error as Error).message}`,
            );
          });
      }
    };

    // Check hash on initial load
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [fitView]);

  return <></>;
}
