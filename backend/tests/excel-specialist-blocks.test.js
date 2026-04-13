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

test("asigna especialista correcto por bloques separados por fila total", async () => {
	const rows = [
		["ESCRITOS INGRESADOS"],
		["Desde 01/10/2025 00:00:00 Hasta 10/04/2026 23:59:59"],
		["1° JUZGADO CIVIL - Sede Principal"],
		["N° EXPEDIENTE", "F INGRESO", "DOCUMENTO", "DIAS", "ESTADO", "F RESPUESTA", "TIPO ING."],
		["ESPECIALIDAD", "CIVIL"],
		["ESPECIALISTA LEGAL", "ALBURQUEQUE CARMEN DANY ESWING"],
		["00261-2025-6-3101-JR-CI-01", "29/01/2026 9:09", "00823-2026 ESCRITO", 50, "PENDIENTE", "00/00/0000", "E"],
		[4, "Mesa Partes Electrónica", "CUMPLO CON LO ORDENADO"],
		["Total de Escritos Asignados a ALBURQUEQUE CARMEN DANY ESWING  : 1"],
		["ESPECIALISTA LEGAL", "FARFAN ALVIA EDSON JUNIOR"],
		["00505-2024-55-3101-JR-CI-01", "22/01/2026 11:01", "00531-2026 ESCRITO", 55, "PENDIENTE", "00/00/0000", "E"],
		[4, "CDG Física", "ACTA DE LEGALIZACION DE FIRMA"],
		["Total de Escritos Asignados a FARFAN ALVIA EDSON JUNIOR  : 1"],
	];

	const buffer = buildBufferFromRows(rows);
	const result = await analyzeExcelUpload(buffer, "reporte.xlsx");

	assert.equal(result.normalizedRows.length, 2);
	const especialistas = result.normalizedRows.map((row) => row.especialista);
	assert.ok(especialistas.includes("ALBURQUEQUE CARMEN DANY ESWING"));
	assert.ok(especialistas.includes("FARFAN ALVIA EDSON JUNIOR"));
	assert.equal(especialistas.includes("SIN ESPECIALISTA"), false);
});
