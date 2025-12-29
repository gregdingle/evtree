"use client";

import { useEffect, useState } from "react";

import { getStorage } from "@firebase/storage";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import {
  ReCaptchaV3Provider,
  getToken,
  initializeAppCheck,
} from "firebase/app-check";

import CollapsiblePanel from "@/components/CollapsiblePanel";
import { Histogram } from "@/components/Histogram";
import LeftSidePanel from "@/components/LeftSidePanel";
import ReactFlowApp from "@/components/ReactFlowApp";
import RightSidePanel from "@/components/RightSidePanel";
import Toolbar from "@/components/Toolbar";
import { useStore } from "@/hooks/use-store";
import { firebaseApp } from "@/lib/firebase";
import { selectShowHistogram } from "@/lib/selectors";
import { downloadSharedTree, extractShareHash } from "@/lib/share";

export default function Home() {
  // NOTE: Prevents hydration mismatch on server-side rendering caused by
  // Zustand loading from localStorage. See
  // https://nextjs.org/docs/messages/react-hydration-error#solution-1-using-useeffect-to-run-on-the-client-only
  const [isValidClient, setIsValidClient] = useState(false);

  useEffect(() => {
    if (!firebaseApp) {
      console.warn(
        "[EVTree] Firebase app is not initialized, skipping App Check",
      );
      if (!isValidClient) {
        setIsValidClient(true);
      }
      return;
    }
    // See https://stackoverflow.com/questions/77482473/next-js-firebase-appcheck-error-recaptcha-placeholder-element-must-be-an-ele
    if (process.env.NODE_ENV === "development") {
      // @ts-expect-error: see https://firebase.google.com/docs/app-check/web/debug-provider
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const firebaseAppCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(
        process.env["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"]!,
      ),
    });
    getToken(firebaseAppCheck).then(() => {
      // eslint-disable-next-line no-console
      console.debug("[EVTree] Client validated by Firebase App Check");
      setIsValidClient(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showHistogram = useStore(selectShowHistogram);

  if (!isValidClient) {
    // TODO: put some kind of loading spinner here?
    return null;
  }

  return (
    <ReactFlowProvider>
      {isValidClient && <ShareLinkLoader />}
      <div
        // NOTE: fixed positioning with inset-0 tells the element to attach itself
        // to all four edges of the viewport
        className="evtree fixed inset-0"
      >
        <div className="flex h-full flex-col">
          {/* NOTE: Responsive design! Read-only mode for below medium size screens */}
          <div className="hidden border-b md:block">
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
              className="w-screen bg-amber-50 dark:bg-[#141414]"
            >
              {showHistogram ? (
                <Histogram className="px-16 py-4" />
              ) : (
                <ReactFlowApp />
              )}
            </div>
            {/* NOTE: Responsive design! Read-only mode for below medium size screens */}
            <div className="hidden border-l md:block">
              <CollapsiblePanel side="right">
                <RightSidePanel />
              </CollapsiblePanel>
            </div>
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
        if (!firebaseApp) {
          console.error("[EVTree] Firebase app is not initialized");
          window.alert(
            `Failed to load shared tree: Firebase is not initialized`,
          );
          return;
        }
        const firebaseStorage = getStorage(firebaseApp);
        downloadSharedTree(shareData.hash, shareData.key, firebaseStorage)
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
