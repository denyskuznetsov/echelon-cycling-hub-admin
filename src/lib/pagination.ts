export type PaginationItem = number | "ellipsis";

const DEFAULT_DELTA = 2;

export function getPaginationItems(
  currentPage: number,
  totalPages: number,
  delta: number = DEFAULT_DELTA,
): PaginationItem[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  const leftBound = Math.max(2, currentPage - delta);
  const rightBound = Math.min(totalPages - 1, currentPage + delta);

  const items: PaginationItem[] = [1];

  if (leftBound > 2) {
    items.push(leftBound === 3 ? 2 : "ellipsis");
  }

  for (let page = leftBound; page <= rightBound; page++) {
    items.push(page);
  }

  if (rightBound < totalPages - 1) {
    items.push(rightBound === totalPages - 2 ? totalPages - 1 : "ellipsis");
  }

  items.push(totalPages);

  return items;
}
