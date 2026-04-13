const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { analyzeExcelUpload } = require("../src/excel");

function buildBufferFromRows(rows) {
	const worksheet = XLSX.utils.aoa_to_sheet(rows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, "Escritos Ingresados por Juzgado");
	return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("parser modular reconstruye registro principal+detalle con contexto", async () => {
	const rows = [
		["ESCRITOS INGRESADOS"],
		["Desde 01/01/2026 Hasta 31/01/2026"],
		["1° JUZGADO CIVIL - Sede Principal"],
		["N° EXPEDIENTE", "F INGRESO", "DOCUMENTO", "DIAS", "ESTADO", "F RESPUESTA", "TIPO ING."],
		["ESPECIALIDAD", "CIVIL"],
		["ESPECIALISTA LEGAL", "ALBURQUEQUE CARMEN DANY ESWING"],
		["00261-2025-6-3101-JR-CI-01", "2026-01-29 09:09:31", "00823-2026 ESCRITO", 50, "PENDIENTE", "00/00/0000", "E"],
		[4, "Mesa Partes Electrónica", "CUMPLO CON LO ORDENADO"],
		["TOTAL DE ESCRITOS ASIGNADOS", 1],
	];

	const buffer = buildBufferFromRows(rows);
	const result = await analyzeExcelUpload(buffer, "reporte.xlsx");

	assert.ok(result.normalizedRows.length >= 1);
	const first = result.normalizedRows[0];

	assert.equal(first.juzgado, "1° JUZGADO CIVIL - Sede Principal");
	assert.equal(first.responsable, "ALBURQUEQUE CARMEN DANY ESWING");
	assert.equal(first.categoria, "CIVIL");
	assert.equal(first.expediente, "00261-2025-6-3101-JR-CI-01");
	assert.equal(first.numeroDocumento, "00823-2026");
	assert.equal(first.tipoDocumento, "ESCRITO");
	assert.equal(first.tipoIngresoCodigo, "E");
	assert.equal(first.canalIngreso, "Mesa Partes Electrónica");
	assert.equal(first.descripcionDocumento, "CUMPLO CON LO ORDENADO");

	assert.ok(result.normalizedRecords.length >= 1);
	assert.ok(result.normalizedRecords.some((record) => record.materia === "CIVIL"));
});
