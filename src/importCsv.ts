import fs from 'fs'

import { csvPath, slnbPath, elndPath, PatientRecord } from './common'

console.time(`\tReading unpaired records from "${csvPath}"`)
const csv = fs.readFileSync(csvPath).toString()

// Use `slice` to remove first line - it contains the headers
const csvLines = csv
	.split('\n')
	.slice(1)
	.map((line) => line.replace(/\r/, '')) // Remove any carriage return characters
console.timeEnd(`\tReading unpaired records from "${csvPath}"`)

console.time(`\tParsing SLNB and ELND records from CSV rows`)
const slnbRecords: PatientRecord[] = []
const elndRecords: PatientRecord[] = []

csvLines.forEach((rowString, index) => {
	const [
		genderCode,
		surgeryDate,
		depthCode,
		dysplasiaPresent,
		perineural,
		lvi,
		invasiveCode,
		ene,
		slnb,
		elnd,
	] = rowString.split(',')
	const row = {
		id: index + 2, // Offset of 2 since we trimmed off the headers, and because Excel rows start at 1 not 0.
		genderCode: Number(genderCode),
		surgeryDate: new Date(surgeryDate),
		depthCode: Number.parseInt(depthCode),
		dysplasia: Boolean(Number(dysplasiaPresent)),
		perineural: Boolean(Number(perineural)),
		lvi: Boolean(Number(lvi)),
		invasiveCode: Number(invasiveCode),
		ene: Boolean(Number(ene)),
	}
	if (Number(slnb)) {
		slnbRecords.push(row)
	} else if (Number(elnd)) {
		elndRecords.push(row)
	}
})
console.timeEnd(`\tParsing SLNB and ELND records from CSV rows`)

console.time(
	`\tWriting SLNB and ELND records to "${slnbPath}" and "${elndPath}"`
)
fs.writeFileSync(slnbPath, JSON.stringify(slnbRecords))
fs.writeFileSync(elndPath, JSON.stringify(elndRecords))
console.timeEnd(
	`\tWriting SLNB and ELND records to "${slnbPath}" and "${elndPath}"`
)

console.log(
	`${csvLines.length} records in "${csvPath}" - ${slnbRecords.length} SLNB records, ${elndRecords.length} ELND records`
)
console.log('Done ✅')
