/** Tabela equivalente ao gráfico (acessível e útil para conferir valores exatos). */
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="group mt-4">
      <summary className="cursor-pointer list-none text-xs font-medium text-ink-3 hover:text-ink">
        <span className="group-open:hidden">Ver como tabela</span>
        <span className="hidden group-open:inline">Ocultar tabela</span>
      </summary>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-medium text-ink-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-1.5 tabular-nums text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
