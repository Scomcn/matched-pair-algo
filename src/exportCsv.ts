import fs from 'fs'

import {
	pairingJsonPath,
	elndPath,
	getHazardExplanation,
	pairingCsvPath,
	PatientRecord,
	RecordComparison,
	slnbPath,
} from './common'

console.time(`\tReading pairings from "${pairingJsonPath}"`)
const elndRecords = JSON.parse(
	fs.readFileSync(elndPath).toString()
) as PatientRecord[]
const pairings = JSON.parse(
	fs.readFileSync(pairingJsonPath).toString()
) as RecordComparison[]
console.timeEnd(`\tReading pairings from "${pairingJsonPath}"`)

console.time('\tConverting pairings to CSV rows')
const recordToCsvRow = (
	record: PatientRecord,
	surgeryType: 'ELND' | 'SLNB'
): (string | number)[] => [
	record.id,
	record.genderCode,
	record.surgeryDate.toString(),
	record.depthCode,
	Number(record.dysplasia),
	Number(record.perineural),
	Number(record.lvi),
	Number(record.invasiveCode),
	Number(record.ene),
	Number(surgeryType === 'SLNB'),
	Number(surgeryType === 'ELND'),
]

const csvRows = elndRecords.map((record) => {
	const row = recordToCsvRow(record, 'ELND')
	const matched = pairings.find(
		(pairing) => pairing.elndRecord.id === record.id
	)
	if (matched) {
		row.push('<->')
		row.push(...recordToCsvRow(matched.slnbRecord, 'SLNB'))
		row.push(matched.difference)
		row.push(
			`ELND:(${getHazardExplanation(
				matched.elndRecord
			)}) SLNB:(${getHazardExplanation(matched.slnbRecord)})`
		)
		row.push(Number(!!matched.perfect))
	}
	return row.join(',')
})

const csvHeaders = [
	'Row #',
	'gender code',
	'Date of Surgery',
	'Depth Code',
	'Dysplasia Present',
	'Perineural',
	'LVI',
	'Invasive Front Code',
	'ENE',
	'SLNB',
	'ELND',
]
const csvHeader = [
	...csvHeaders,
	'<->',
	...csvHeaders,
	'Hazard difference',
	'Hazard calculation',
	'Perfect match',
].join(',')

const pairingsCsvData = [csvHeader, ...csvRows].join('\r\n')
console.timeEnd('\tConverting pairings to CSV rows')

console.time(`\tWriting CSV rows to "${pairingCsvPath}"`)
fs.writeFileSync(pairingCsvPath, pairingsCsvData)
console.timeEnd(`\tWriting CSV rows to "${pairingCsvPath}"`)

console.log(`${csvRows.length} rows, ${pairings.length} pairings`)
console.log('Done ✅')
