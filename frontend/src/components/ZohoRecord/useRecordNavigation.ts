export function useRecordNavigation<T extends { id: string }>(
  items: T[],
  selected: T | null,
  setSelected: (item: T | null) => void,
) {
  const index = selected ? items.findIndex((item) => item.id === selected.id) : -1;

  return {
    hasPrev: index > 0,
    hasNext: index >= 0 && index < items.length - 1,
    goPrev: () => {
      if (index > 0) setSelected(items[index - 1]);
    },
    goNext: () => {
      if (index >= 0 && index < items.length - 1) setSelected(items[index + 1]);
    },
    goBack: () => setSelected(null),
  };
}
