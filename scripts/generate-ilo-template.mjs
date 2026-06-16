/**
 * Genera public/fsc/ilo/template_it_coc_v1.2.docx con placeholder docxtemplater.
 * Eseguire: node scripts/generate-ilo-template.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'fsc', 'ilo')
const outFile = path.join(outDir, 'template_it_coc_v1.2.docx')

const sections = [
  { title: 'Autovalutazione ILO — Anno {reference_year}', body: '' },
  { title: '{section_header_title}', fields: ['org_name', 'org_address', 'representative', 'assessment_date'] },
  { title: '{section_clr_72_title}', fields: ['clr_72_compliance', 'clr_72_how_complies', 'clr_72_evidence'] },
  { title: '{section_clr_73_title}', fields: ['clr_73_compliance', 'clr_73_how_complies', 'clr_73_evidence'] },
  { title: '{section_clr_74_title}', fields: ['clr_74_compliance', 'clr_74_how_complies', 'clr_74_evidence'] },
  { title: '{section_clr_75_title}', fields: ['clr_75_compliance', 'clr_75_how_complies', 'clr_75_evidence'] },
  { title: '{section_terzisti_title}', fields: ['subcontractor_management', 'subcontractor_evidence'] },
  { title: '{section_attestation_title}', fields: ['attestor_name', 'attestor_date', 'attestation_note'] },
]

function paragraph(text, bold = false) {
  const boldTag = bold ? '<w:b/>' : ''
  return `<w:p><w:r><w:rPr>${boldTag}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const bodyParts = [
  paragraph('Modello base Autovalutazione Lavoratori ILO (FSC Italia CoC V1.2)', true),
  paragraph('Compilare i campi tramite la piattaforma Cloud FSC o sostituire questo file con il modello ufficiale taggato.'),
  paragraph(''),
]

for (const sec of sections) {
  bodyParts.push(paragraph(sec.title, true))
  if (sec.fields) {
    for (const f of sec.fields) {
      bodyParts.push(paragraph(`${f}: {${f}}`))
    }
  }
  bodyParts.push(paragraph(''))
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n    ')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const zip = new PizZip()
zip.file('[Content_Types].xml', contentTypes)
zip.file('_rels/.rels', rels)
zip.file('word/document.xml', documentXml)

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, zip.generate({ type: 'nodebuffer' }))
console.log('Written', outFile)
