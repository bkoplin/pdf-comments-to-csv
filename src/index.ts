import { readFileSync } from 'node:fs'
import * as fs from 'node:fs'
import { anyOf, carriageReturn, charNotIn, createRegExp, digit, dotAll, exactly, global, linefeed, maybe, not, oneOrMore, whitespace, wordChar } from 'magic-regexp'
import { colord, extend } from 'colord'
import rgbPlugin from 'colord/plugins/'
import { castArray, forEach, forOwn, isEqual, keyBy, map, mapValues, omit, padStart, pickBy, times, toNumber, uniq, uniqWith } from 'lodash-es'
import { objectMap } from '@antfu/utils'
import type { ValueOf } from 'type-fest'
import { KeysOfUnion } from 'type-fest'
import moment from 'moment-timezone'
import * as XLSX from 'xlsx'
import namesPlugin from 'colord/plugins/names'

extend([namesPlugin])
/* load 'fs' for readFile and writeFile support */
XLSX.set_fs(fs)
// const oldWb = XLSX.readFile('/Users/benkoplin/Library/CloudStorage/OneDrive-SharedLibraries-ReedSmithLLP/CHRISTUS USFHP - Documents/Filings - Complaints/2024.03.12 Complaint in Intervention (filed).fdf.xlsx', { cellDates: true, cellHTML: true, cellStyles: true, raw: true, dense: true })
// const oldWs = oldWb.Sheets[oldWb.SheetNames[0]]
// fs.writeFileSync('./test/snapshots/2024.03.12 Complaint in Intervention (filed).fdf.xlsx.json', JSON.stringify(oldWs, null, '\t'))
// fs.writeFileSync('./test/snapshots/2024.03.12 Complaint in Intervention (filed).Styles.fdf.xlsx.json', JSON.stringify(oldWb.Styles, null, '\t'))
const fdfBoundaryRegExp = createRegExp(linefeed.or(carriageReturn), exactly('endobj'), linefeed.or(carriageReturn), [global])
const fdfContentsRegExp = createRegExp(exactly('Contents('), anyOf(whitespace, not.whitespace).times.atLeast(1).groupedAs('comment_text'), exactly(')/CreationDate'))
const fdfColorRegExp = createRegExp(
  exactly('<</C['),
  exactly('0.').or('1.').and(oneOrMore(digit)).groupedAs('r'),
  whitespace,
  exactly('0.').or('1.').and(oneOrMore(digit)).groupedAs('g'),
  whitespace,
  exactly('0.').or('1.').and(oneOrMore(digit)).groupedAs('b'),
  exactly(']/CA '),
  exactly('0.').or('1.').and(oneOrMore(digit)).groupedAs('a'),
)
const fdfCreationDateRegExp = createRegExp(
  exactly('/CreationDate(D:'),
  digit.times(4).as('year'),
  digit.times(2).as('month'),
  digit.times(2).as('day'),
  digit.times(2).as('hour'),
  digit.times(2).as('minute'),
  digit.times(2).as('second'),
  exactly('-').and(digit.times(2)).as('utc_offset'),
)
const fdfPageNumberRegExp = createRegExp('/Page ', digit.times.atLeast(1).as('page_number'), '/')
const fdfAuthorRegExp = createRegExp(
  exactly('/T('),
  charNotIn(')').times.atLeast(1).groupedAs('author'),
)

export default function run(fdfPath: string): void {
  const fdfContents = readFileSync(fdfPath, 'utf8')
  const fdfComments = splitFdfContents(fdfContents)
  const fdfCommentObjects = parseFdfComments(fdfComments)
  generateExcelFromComments(fdfCommentObjects, fdfPath)
  return fdfContents
}
interface Cell {
  'color': string
  'closestColorName': string
  'PAGE NUMBER': string | undefined
  'COLOR': XLSX.CellObject
  'TEXT': XLSX.CellObject | undefined
  'CREATED': XLSX.CellObject
  // 'CREATED DATE': XLSX.CellObject
  'CREATED BY': XLSX.CellObject
}
function generateExcelFromComments(fdfCommentObjects: Cell[], fdfPath: string): void {
  const workbook = XLSX.utils.book_new()
  // const styledCommentObjects = fdfCommentObjects.map(cell => ({
  //   ...cell,
  //   style: {
  //     fill: {
  //       patternType: 'solid',
  //       fgColor: {
  //         rgb: cell.color.replace('#', '').toUpperCase(),
  //       },
  //     },
  //   },
  // }))
  // workbook.Styles = {
  //   Fills: [
  //     {
  //       patternType: 'none',
  //     },
  //     {
  //       patternType: 'gray125',
  //     },
  //     ...uniqWith(map(styledCommentObjects, o => o.style), isEqual),
  //   ],
  // }
  // const commentBackgroundColors = keyBy(styledCommentObjects, o => o.closestColorName)
  // .map(color => (
  // ))
  const worksheet = XLSX.utils.json_to_sheet(fdfCommentObjects.map(o => pickBy(o, (v, k) => k !== 'color' && k !== 'closestColorName')), { cellDates: true, cellHTML: true, cellStyles: true, raw: true })
  // const worksheetRange = XLSX.utils.decode_range(worksheet['!ref'] as string)
  // // console.log(worksheetRange)
  // times(worksheetRange.e.r, (rowIndex) => {
  //   const rowData = worksheet['!data'][rowIndex]
  //   if (rowIndex === 0 || typeof rowData === 'undefined')
  //     return
  //   const cellData = rowData[0]
  //   if (typeof cellData === 'undefined')
  //     return
  //   // const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 0 })
  //   // console.log('🚀 ~ file: index.ts:63 ~ times ~ cellAddress:', cellAddress)
  //   if (cellData.v in commentBackgroundColors) {
  //     worksheet['!data'][rowIndex][0].s = commentBackgroundColors[cellData.v].style
  //   }
  // })
  // forEach(fdfCommentObjects, (fdfCommentObject, i) => {
  // })
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Comments')
  XLSX.writeFile(workbook, `${fdfPath}.xlsx`, { cellStyles: true, bookSST: true, cellDates: true })
}

export function parseFdfComments(fdfComments: string[]): Cell[] {
  return fdfComments.map((fdfComment): Cell => {
    const fdfColorMatchGroups = fdfComment.match(fdfColorRegExp)?.groups
    const fdfCreationDateGroups = fdfComment.match(fdfCreationDateRegExp)?.groups
    const fdfAuthorGroups = fdfComment.match(fdfAuthorRegExp)?.groups
    const fdfPageNumberGroups = fdfComment.match(fdfPageNumberRegExp)?.groups
    const commentText = fdfComment.match(fdfContentsRegExp)?.groups?.comment_text
    const colorObject = { r: 0, g: 0, b: 0, a: 0 }
    const creationDateObject = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, utc_offset: 0 }
    let authorObject = { author: '' }
    if (typeof fdfColorMatchGroups !== 'undefined') {
      forOwn(fdfColorMatchGroups, (value, key) => {
        if (typeof value !== 'undefined')
          colorObject[key] = toNumber(value) * (key === 'a' ? 1 : 255)
      })
    }
    if (typeof fdfCreationDateGroups !== 'undefined') {
      objectMap(fdfCreationDateGroups, (key, value) => {
        if (typeof value !== 'undefined') {
          const numericValue = toNumber(value)
          creationDateObject[key] = key === 'month' ? numericValue - 1 : key === 'utc_offset' ? numericValue * 60 : numericValue
        }
      })
    }
    if (typeof fdfAuthorGroups !== 'undefined' && typeof fdfAuthorGroups.author !== 'undefined') {
      authorObject = fdfAuthorGroups
    }
    const color = colord(omit(colorObject, 'a')).toHex()
    const closestColorName = colord(colorObject).toName({ closest: true })
    return {
      color,
      closestColorName,
      'PAGE NUMBER': fdfPageNumberGroups?.page_number ? padStart(toNumber(fdfPageNumberGroups.page_number) + 1, 3, '0') : undefined,
      'COLOR': {
        t: 's',
        v: `${closestColorName}`,
        r: `<t>${closestColorName}</t>`,
        h: `${closestColorName}`,
        z: 'General',
        w: `${closestColorName}`,
        s: {
          patternType: 'solid',
          fgColor: {
            rgb: color.replace('#', '').toUpperCase(),
          },
        },
      },
      'TEXT': { t: 't', v: commentText },
      'CREATED DATE': { t: 'd', v: moment(creationDateObject).utcOffset(creationDateObject.utc_offset).tz(moment.tz.guess()).toDate() },
      'CREATED BY': { t: 't', v: authorObject.author },
    }
  })
}

export function splitFdfContents(fdfContents: string): string[] {
  return fdfContents.split(fdfBoundaryRegExp).filter((value) => {
    return fdfContentsRegExp.test(value)
  })
}
