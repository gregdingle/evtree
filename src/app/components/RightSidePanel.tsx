export default function RightSidePanel() {
  // TODO: selection

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Properties
      </h2>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Select a node to view its properties
        </p>
      </div>
    </div>
  );
}
