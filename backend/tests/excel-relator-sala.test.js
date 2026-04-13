const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { analyzeExcelUpload } = require("../src/excel");

function buildBufferFromRows(rows) {
	const worksheet = XLSX.utils.aoa_to_sheet(rows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, "Escritos Ingresados por Sala");
	return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("detecta SALA, RELATOR y especialidad como materia", async () => {
	const rows = [
		["ESCRITOS INGRESADOS"],
		["Desde 01/01/2026 00:00:00 Hasta 31/01/2026 23:59:59"],
		["SALA CIVIL - Sede Principal"],
		["N° EXPEDIENTE", "F INGRESO", "DOCUMENTO", "DIAS", "ESTADO", "F RESPUESTA", "TIPO ING."],
		["ESPECIALIDAD", "FAMILIA CIVIL"],
		["RELATOR", "NAMO MEJIA ROXANA CAROLINA"],
		["00001-2026-0-3101-JR-CI-01", "12/01/2026 10:30", "00224-2026 ESCRITO", 12, "PENDIENTE", "00/00/0000", "F"],
		[4, "Mesa Partes Electrónica", "CUMPLE MANDATO"],
		["Total de Escritos Asignados a NAMO MEJIA ROXANA CAROLINA  : 1"],
		["ESPECIALIDAD", "CIVIL"],
		["RELATOR", "NAMO MEJIA ROXANA CAROLINA"],
		["00002-2026-0-3101-JR-CI-01", "13/01/2026 11:30", "00225-2026 OFICIO", 11, "PENDIENTE", "00/00/0000", "E"],
		[4, "CDG Física", "REMITE OFICIO"],
		["Total de Escritos Asignados a NAMO MEJIA ROXANA CAROLINA  : 2"],
		["Total de Escritos Asignados al SALA CIVIL - Sede Principal  : 2"],
	];

	const buffer = buildBufferFromRows(rows);
	const result = await analyzeExcelUpload(buffer, "reporte-sala.xlsx");

	assert.equal(result.normalizedRows.length, 2);
	assert.equal(result.normalizedRows.some((row) => row.especialista === "SIN ESPECIALISTA"), false);
	assert.equal(result.normalizedRows.every((row) => /SALA CIVIL/i.test(row.juzgado)), true);
	assert.equal(result.normalizedRows.some((row) => row.materia === "FAMILIA CIVIL"), true);
	assert.equal(result.normalizedRows.some((row) => row.materia === "CIVIL"), true);
	assert.equal(result.normalizedRows.every((row) => row.especialista === "NAMO MEJIA ROXANA CAROLINA"), true);
});
