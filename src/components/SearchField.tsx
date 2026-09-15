"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import {
  createSearchFieldState,
  editSearchField,
  reconcileSearchField,
  submitSearchField,
  type SearchFieldState,
} from "./search-field-state";

interface SearchFieldProps {
  query: string;
  placeholder: string;
  onSubmit: (query: string) => void;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  buttonSize?: "large" | "medium" | "small";
}

export function SearchField({
  query,
  placeholder,
  onSubmit,
  ariaLabel = "Search",
  className,
  inputClassName,
  icon,
  disabled = false,
  buttonSize = "medium",
}: SearchFieldProps) {
  const [state, setState] = useState(() => createSearchFieldState(query));
  const stateRef = useRef<SearchFieldState>(state);
  const isComposingRef = useRef(false);
  const isHistoryNavigationRef = useRef(false);

  const updateState = (next: SearchFieldState) => {
    stateRef.current = next;
    setState(next);
  };

  useEffect(() => {
    updateState(
      reconcileSearchField(stateRef.current, query, {
        isHistoryNavigation: isHistoryNavigationRef.current,
      }),
    );
    isHistoryNavigationRef.current = false;
  }, [query]);

  useEffect(() => {
    const markHistoryNavigation = () => {
      isHistoryNavigationRef.current = true;
    };
    window.addEventListener("popstate", markHistoryNavigation);
    return () => window.removeEventListener("popstate", markHistoryNavigation);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = submitSearchField(stateRef.current, {
      disabled,
      isComposing: isComposingRef.current,
    });
    updateState(result.state);
    if (result.query !== null) onSubmit(result.query);
  };

  return (
    <form
      className={["flex min-w-0 items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
      onSubmit={handleSubmit}
      role="search"
      aria-label={`${ariaLabel} form`}
    >
      <TextField
        className={["min-w-0", inputClassName].filter(Boolean).join(" ")}
        label=""
        helpText=""
        icon={icon}
        disabled={disabled}
      >
        <TextField.Input
          placeholder={placeholder}
          aria-label={ariaLabel}
          type="search"
          disabled={disabled}
          value={state.draft}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            updateState(editSearchField(stateRef.current, event.target.value))
          }
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && isComposingRef.current) {
              event.preventDefault();
            }
          }}
        />
      </TextField>
      <Button type="submit" size={buttonSize} disabled={disabled}>
        Search
      </Button>
    </form>
  );
}
