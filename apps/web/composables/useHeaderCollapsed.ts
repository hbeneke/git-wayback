/** Forces the header into its scrolled/collapsed state while something needs the space. */
export function useHeaderCollapsed() {
  return useState<boolean>('header-collapsed', () => false)
}
