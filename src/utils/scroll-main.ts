/** Matches the main scroll region in `DefaultPageLayout`. */
export const APP_SCROLL_CONTAINER_SELECTOR = "[data-app-scroll-container]";

/** Scrolls the app main content area to the top (not `window`). */
export function scrollMainContentToTop() {
  const container = document.querySelector<HTMLElement>(
    APP_SCROLL_CONTAINER_SELECTOR,
  );
  if (container) {
    container.scrollTo(0, 0);
    return;
  }
  window.scrollTo(0, 0);
}
