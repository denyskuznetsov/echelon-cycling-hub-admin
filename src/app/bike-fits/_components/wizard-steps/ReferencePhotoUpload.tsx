"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FeatherCheck,
  FeatherImage,
  FeatherLoader,
} from "@subframe/core";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import { newBikeFitDataFieldPath } from "@/src/lib/bike-fit-new-bike-fields";
import {
  compressBikeFitImage,
  getBikeFitImageSignedUrl,
  uploadBikeFitImage,
  type BikeFitImageVariant,
} from "@/src/utils/image-upload";

type UploadState = "idle" | "uploading" | "success" | "error";

interface ReferencePhotoUploadProps {
  label: string;
  variant: BikeFitImageVariant;
  fieldKey: "final_bike_fit_image_front" | "final_bike_fit_image_side";
  bikeFitId: string;
  readOnly?: boolean;
}

export function ReferencePhotoUpload({
  label,
  variant,
  fieldKey,
  bikeFitId,
  readOnly = false,
}: ReferencePhotoUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { control, setValue } = useFormContext<BikeFitFormValues>();

  const storagePath =
    (useWatch({
      control,
      name: newBikeFitDataFieldPath(fieldKey),
    }) as string | undefined) ?? "";

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!storagePath.trim()) {
      setPreviewUrl(null);
      return;
    }

    getBikeFitImageSignedUrl(storagePath)
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (readOnly) return;

    setUploadState("uploading");
    setErrorMessage(null);

    try {
      const compressed = await compressBikeFitImage(file);
      const path = await uploadBikeFitImage(compressed, {
        bikeFitId,
        variant,
      });

      setValue(newBikeFitDataFieldPath(fieldKey), path, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setUploadState("success");

      const signedUrl = await getBikeFitImageSignedUrl(path);
      if (signedUrl) {
        setPreviewUrl(signedUrl);
      }
    } catch (error: unknown) {
      setUploadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed. Please try again.",
      );
    }
  };

  const hasImage = storagePath.trim().length > 0;
  const isUploading = uploadState === "uploading";

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-caption-bold font-caption-bold text-default-font"
      >
        {label}
      </label>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-solid border-neutral-border bg-neutral-50">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from private bucket
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="h-full w-full object-cover"
            />
          ) : (
            <FeatherImage className="h-6 w-6 text-subtext-color" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            disabled={readOnly || isUploading}
            className="block w-full max-w-sm cursor-pointer text-caption font-caption text-default-font file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-caption file:font-caption file:text-default-font hover:file:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => {
              void handleFileChange(event);
            }}
          />

          {isUploading ? (
            <span className="inline-flex items-center gap-1 text-caption font-caption text-subtext-color">
              <FeatherLoader className="h-3 w-3 animate-spin" />
              Compressing and uploading…
            </span>
          ) : null}

          {!isUploading && hasImage && uploadState !== "error" ? (
            <span className="inline-flex items-center gap-1 text-caption font-caption text-success-700">
              <FeatherCheck className="h-3 w-3" />
              Photo saved
            </span>
          ) : null}

          {uploadState === "error" && errorMessage ? (
            <span className="text-caption font-caption text-error-700">
              {errorMessage}
            </span>
          ) : null}

          {!readOnly ? (
            <span className="text-caption font-caption text-subtext-color">
              JPEG recommended. Images are compressed before upload.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
