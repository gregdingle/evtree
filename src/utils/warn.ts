// Utility function for consistent warning messages
export const warnNoCurrentTree = (operation: string) => {
  console.warn(`[EVTree] No current tree selected for ${operation}`);
};

export const warnItemNotFound = (
  itemType: "Node" | "Edge" | "Tree",
  id: string,
  operation: string
) => {
  console.warn(`[EVTree] ${itemType} with id ${id} not found for ${operation}`);
};
