"use client";

import React, { useEffect, useState } from "react";
import { FeatherImage, FeatherLoader } from "@subframe/core";
import { getBikeFitImageSignedUrl } from "@/src/utils/image-upload";

interface BikeFitReferencePhotosProps {
  frontPath: string;
  sidePath: string;
}

interface ReferencePhotoPreviewProps {
  label: string;
  storagePath: string;
}

function ReferencePhotoPreview({
  label,
  storagePath,
}: ReferencePhotoPreviewProps) {
  const trimmedPath = storagePath.trim();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(trimmedPath));

  useEffect(() => {
    let cancelled = false;

    if (!trimmedPath) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getBikeFitImageSignedUrl(trimmedPath)
      .then((url) => {
        if (!cancelled) {
          setSignedUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trimmedPath]);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-caption font-caption text-subtext-color">
        {label}
      </figcaption>
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-solid border-neutral-border bg-neutral-50">
        {loading ? (
          <FeatherLoader className="h-5 w-5 animate-spin text-subtext-color" />
        ) : signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private bucket signed URL
          <img
            src={signedUrl}
            alt={label}
            className="h-full w-full object-contain"
          />
        ) : trimmedPath ? (
          <span className="px-3 text-center text-caption font-caption text-subtext-color">
            Could not load image
          </span>
        ) : (
          <div className="flex flex-col items-center gap-1 text-subtext-color">
            <FeatherImage className="h-5 w-5" />
            <span className="text-caption font-caption">No photo</span>
          </div>
        )}
      </div>
    </figure>
  );
}

export function BikeFitReferencePhotos({
  frontPath,
  sidePath,
}: BikeFitReferencePhotosProps) {
  return (
    <section className="flex w-full flex-col items-start gap-3">
      <span className="text-body-bold font-body-bold text-default-font">
        Reference photos
      </span>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <ReferencePhotoPreview label="Front view" storagePath={frontPath} />
        <ReferencePhotoPreview label="Side view" storagePath={sidePath} />
      </div>
    </section>
  );
}
