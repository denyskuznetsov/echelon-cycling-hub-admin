"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import {
  createSearchFieldState,
  editSearchField,
  isSearchFieldCompositionEvent,
  reconcileSearchField,
  submitSearchField,
  type SearchFieldState,
} from "./search-field-state";

interface SearchFieldProps {
  query: string;
  urlState: string;
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
  urlState,
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
    if (next === stateRef.current) return;
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
  }, [query, urlState]);

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
      isComposing:
        isComposingRef.current ||
        isSearchFieldCompositionEvent(
          event.nativeEvent as { isComposing?: boolean; keyCode?: number },
        ),
    });
    updateState(result.state);
    if (result.query !== null) onSubmit(result.query);
  };

  return (
    <form
      className={["flex w-full min-w-0 flex-wrap items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
      onSubmit={handleSubmit}
      role="search"
      aria-label={`${ariaLabel} form`}
    >
      <TextField
        className={["min-w-[12rem] grow", inputClassName].filter(Boolean).join(" ")}
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
            if (
              event.key === "Enter" &&
              (isComposingRef.current ||
                isSearchFieldCompositionEvent(event.nativeEvent))
            ) {
              event.preventDefault();
            }
          }}
        />
      </TextField>
      <Button className="flex-none" type="submit" size={buttonSize} disabled={disabled}>
        Search
      </Button>
    </form>
  );
}
