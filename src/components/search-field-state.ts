export interface SearchFieldState {
  appliedQuery: string;
  draft: string;
  pendingSubmissions: string[];
  staleAcknowledgements: string[];
}

export function createSearchFieldState(query: string): SearchFieldState {
  const appliedQuery = query.trim();
  return {
    appliedQuery,
    draft: appliedQuery,
    pendingSubmissions: [],
    staleAcknowledgements: [],
  };
}

export function editSearchField(
  state: SearchFieldState,
  draft: string,
): SearchFieldState {
  return { ...state, draft };
}

export interface SearchFieldSubmissionGuard {
  disabled: boolean;
  isComposing: boolean;
}

export interface SearchFieldReconciliationOptions {
  isHistoryNavigation?: boolean;
}

export function submitSearchField(
  state: SearchFieldState,
  guard: SearchFieldSubmissionGuard = {
    disabled: false,
    isComposing: false,
  },
): {
  state: SearchFieldState;
  query: string | null;
} {
  if (guard.disabled || guard.isComposing) return { state, query: null };

  const query = state.draft.trim();

  if (query === state.appliedQuery || state.pendingSubmissions.includes(query)) {
    return { state, query: null };
  }

  return {
    state: {
      ...state,
      pendingSubmissions: [...state.pendingSubmissions, query],
    },
    query,
  };
}

/**
 * URL updates that match an explicitly submitted query acknowledge that
 * submission. Other URL updates are history, reset, or external navigation and
 * intentionally replace the local draft.
 */
export function reconcileSearchField(
  state: SearchFieldState,
  nextQuery: string,
  { isHistoryNavigation = false }: SearchFieldReconciliationOptions = {},
): SearchFieldState {
  const appliedQuery = nextQuery.trim();

  if (isHistoryNavigation) {
    return {
      appliedQuery,
      draft: appliedQuery,
      pendingSubmissions: [],
      staleAcknowledgements: [],
    };
  }

  const acknowledgementIndex = state.pendingSubmissions.indexOf(appliedQuery);

  if (acknowledgementIndex !== -1) {
    return {
      ...state,
      appliedQuery,
      pendingSubmissions: state.pendingSubmissions.slice(acknowledgementIndex + 1),
      staleAcknowledgements: [
        ...state.staleAcknowledgements,
        ...state.pendingSubmissions.slice(0, acknowledgementIndex),
      ],
    };
  }

  const staleAcknowledgementIndex = state.staleAcknowledgements.indexOf(appliedQuery);
  if (staleAcknowledgementIndex !== -1) {
    return {
      ...state,
      staleAcknowledgements: state.staleAcknowledgements.filter(
        (_, index) => index !== staleAcknowledgementIndex,
      ),
    };
  }

  if (appliedQuery === state.appliedQuery) return state;

  return {
    appliedQuery,
    draft: appliedQuery,
    pendingSubmissions: [],
    staleAcknowledgements: [],
  };
}
