/** Scarica un file via link temporaneo (evita popup blocker post-await). */
export function triggerBrowserDownload(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Path pubblico del modello Word ILO vergine. */
export const FSC_ILO_VIRGIN_TEMPLATE_PATH = '/fsc/ilo/template_it_coc_v1.2.docx'

export function downloadPublicFscFile(publicPath: string, filename: string): void {
  const url = `${window.location.origin}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`
  triggerBrowserDownload(url, filename)
}
