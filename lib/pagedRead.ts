/** Read through API row caps; discard partial results if any page fails. */
export async function readAllPages<T, E>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
  pageSize = 1000,
): Promise<{ data: T[] | null; error: E | null }> {
  const rows: T[] = [];
  for (;;) {
    const result = await page(rows.length, rows.length + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    if (!result.data?.length) return { data: rows, error: null };
    rows.push(...result.data);
  }
}
