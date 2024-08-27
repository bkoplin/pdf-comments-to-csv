import { join, parse } from 'node:path'
import { describe, expect, it } from 'vitest'
import run, { parseFdfComments, splitFdfContents } from '../src'

const filePath = '/Users/benkoplin/Library/CloudStorage/OneDrive-SharedLibraries-ReedSmithLLP/CHRISTUS USFHP - Documents/Filings - Complaints/2024.03.12 Complaint in Intervention (filed).fdf'
const parsedFilepath = parse(filePath)
describe('should', () => {
  it('exported', () => {
    const contents = run(filePath)
    const splitContents = splitFdfContents(contents)
    const parsedContents = parseFdfComments(splitContents)
    expect(contents).toMatchFileSnapshot(join(__dirname, 'snapshots', `${parsedFilepath.name}.txt`))
    expect(stringifyObject(splitContents)).toMatchFileSnapshot(join(__dirname, 'snapshots', `contents.json`))
    expect(stringifyObject(parsedContents)).toMatchFileSnapshot(join(__dirname, 'snapshots', `content_objects.json`))
  })
})
function stringifyObject(object: any): string {
  return JSON.stringify(object, null, '\t')
}
