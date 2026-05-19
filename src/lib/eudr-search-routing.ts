export function normalizeEudrSearchTab(tab: string | null | undefined): "analisi" | "verifiche" {
  return tab === "verifiche" || tab === "verifica" ? "verifiche" : "analisi"
}
