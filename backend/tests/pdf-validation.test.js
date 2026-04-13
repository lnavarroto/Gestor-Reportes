const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const {
	extractReportedTotalsFromLines,
	buildPdfTotalsValidation,
	normalizeMateria,
	getOrderedMaterias,
	filterRecordsByMaterias,
	detectMateriasFromRecords,
	analyzeExcelWorksheetStructure,
	parseExcelToRecords,
} = require("../src/unifiedMatrix");

function buildSampleLines() {
	return [
		[
			"1° JUZGADO CIVIL - Sede Principal",
			"Total de Escritos Asignados a FARFAN ALVIA EDSON JUNIOR : 84",
			"Total de Escritos Asignados a FUENTES CRUZ MARIA CRISTINA : 191",
			"Total de Escritos Asignados al 1° JUZGADO CIVIL - Sede Principal : 655",
		],
	];
}

test("validacion de totales PDF coincide con registros agregados", () => {
	const reported = extractReportedTotalsFromLines(buildSampleLines());
	const records = [
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "FARFAN ALVIA EDSON JUNIOR", materia: "CIVIL", cantidad: 83 },
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "FARFAN ALVIA EDSON JUNIOR", materia: "LABORAL", cantidad: 1 },
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "FUENTES CRUZ MARIA CRISTINA", materia: "CIVIL", cantidad: 181 },
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "FUENTES CRUZ MARIA CRISTINA", materia: "LABORAL", cantidad: 10 },
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "OTRO ESPECIALISTA", materia: "CIVIL", cantidad: 380 },
	];

	const validation = buildPdfTotalsValidation(records, reported);
	assert.equal(validation.hasMismatches, false);
	assert.equal(validation.specialistMismatches.length, 0);
	assert.equal(validation.juzgadoMismatches.length, 0);
});

test("validacion detecta diferencias por especialista y juzgado", () => {
	const reported = extractReportedTotalsFromLines(buildSampleLines());
	const records = [
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "FARFAN ALVIA EDSON JUNIOR", materia: "CIVIL", cantidad: 70 },
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "FUENTES CRUZ MARIA CRISTINA", materia: "CIVIL", cantidad: 191 },
		{ anio: 2026, mes: 1, juzgado: "1° JUZGADO CIVIL", especialista: "OTRO ESPECIALISTA", materia: "CIVIL", cantidad: 300 },
	];

	const validation = buildPdfTotalsValidation(records, reported);
	assert.equal(validation.hasMismatches, true);
	assert.ok(validation.specialistMismatches.some((x) => x.especialista === "FARFAN ALVIA EDSON JUNIOR"));
	assert.equal(validation.juzgadoMismatches.length, 1);
});

test("validacion soporta SALA y RELATOR con multiples especialidades", () => {
	const reported = extractReportedTotalsFromLines([
		[
			"SALA CIVIL - Sede Principal",
			"ESPECIALIDAD CIVIL",
			"RELATOR NAMO MEJIA ROXANA CAROLINA",
			"Total de Escritos Asignados a NAMO MEJIA ROXANA CAROLINA : 164",
			"ESPECIALIDAD FAMILIA CIVIL",
			"RELATOR NAMO MEJIA ROXANA CAROLINA",
			"Total de Escritos Asignados a NAMO MEJIA ROXANA CAROLINA : 31",
			"ESPECIALIDAD FAMILIA PENAL",
			"RELATOR NAMO MEJIA ROXANA CAROLINA",
			"Total de Escritos Asignados a NAMO MEJIA ROXANA CAROLINA : 3",
			"ESPECIALIDAD FAMILIA TUTELAR",
			"RELATOR NAMO MEJIA ROXANA CAROLINA",
			"Total de Escritos Asignados a NAMO MEJIA ROXANA CAROLINA : 25",
			"Total de Escritos Asignados al SALA CIVIL - Sede Principal : 223",
		],
	]);

	const records = [
		{ anio: 2026, mes: 1, juzgado: "SALA CIVIL", especialista: "NAMO MEJIA ROXANA CAROLINA", materia: "CIVIL", cantidad: 164 },
		{ anio: 2026, mes: 1, juzgado: "SALA CIVIL", especialista: "NAMO MEJIA ROXANA CAROLINA", materia: "FAMILIA CIVIL", cantidad: 31 },
		{ anio: 2026, mes: 1, juzgado: "SALA CIVIL", especialista: "NAMO MEJIA ROXANA CAROLINA", materia: "FAMILIA PENAL", cantidad: 3 },
		{ anio: 2026, mes: 1, juzgado: "SALA CIVIL", especialista: "NAMO MEJIA ROXANA CAROLINA", materia: "FAMILIA TUTELAR", cantidad: 25 },
	];

	const validation = buildPdfTotalsValidation(records, reported);
	assert.equal(validation.hasMismatches, false);
	assert.equal(validation.specialistMismatches.length, 0);
	assert.equal(validation.juzgadoMismatches.length, 0);
});

test("normaliza materias extendidas de familia y codigos abreviados", () => {
	assert.equal(normalizeMateria("FC"), "FAMILIA CIVIL");
	assert.equal(normalizeMateria("FP"), "FAMILIA PENAL");
	assert.equal(normalizeMateria("FT"), "FAMILIA TUTELAR");
	assert.equal(normalizeMateria("Especialidad Familia Civil"), "FAMILIA CIVIL");
});

test("ordena materias segun presencia real sin limitarse a civil y laboral", () => {
	const materias = getOrderedMaterias(["FT", "LABORAL", "FC", "FP"]);
	assert.deepEqual(materias, ["LABORAL", "FAMILIA CIVIL", "FAMILIA PENAL", "FAMILIA TUTELAR"]);
});

test("filtra registros por materias seleccionadas", () => {
	const filtered = filterRecordsByMaterias(
		[
			{ materia: "CIVIL", cantidad: 2 },
			{ materia: "LABORAL", cantidad: 1 },
			{ materia: "FC", cantidad: 3 },
			{ materia: "FP", cantidad: 4 },
		],
		["LABORAL", "FAMILIA CIVIL"]
	);

	assert.equal(filtered.length, 2);
	assert.deepEqual(filtered.map((item) => normalizeMateria(item.materia)), ["LABORAL", "FAMILIA CIVIL"]);
});

test("detecta materias unicas desde registros", () => {
	const detected = detectMateriasFromRecords([
		{ materia: "CIVIL" },
		{ materia: "FC" },
		{ materia: "LABORAL" },
		{ materia: "FAMILIA CIVIL" },
	]);

	assert.deepEqual(detected, ["CIVIL", "LABORAL", "FAMILIA CIVIL"]);
});

test("detecta variables estructurales de Excel y cuadros disponibles", () => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet("Reporte");

	worksheet.getCell("A8").value = "1° JUZGADO CIVIL - Sede Principal";
	worksheet.getCell("A9").value = "N° EXPEDIENTE";
	worksheet.getCell("B9").value = "F INGRESO";
	worksheet.getCell("C9").value = "DOCUMENTO";
	worksheet.getCell("D9").value = "DIAS";
	worksheet.getCell("E9").value = "ESTADO";
	worksheet.getCell("F9").value = "F RESPUESTA";
	worksheet.getCell("G9").value = "TIPO ING.";
	worksheet.getCell("A10").value = "ESPECIALIDAD";
	worksheet.getCell("B10").value = "CIVIL";
	worksheet.getCell("A11").value = "ESPECIALISTA LEGAL";
	worksheet.getCell("B11").value = "ALBURQUEQUE CARMEN DANY ESWING";
	worksheet.getCell("A12").value = "00261-2025-6-3101-JR-CI-01";
	worksheet.getCell("B12").value = new Date("2026-01-29T09:09:00");
	worksheet.getCell("C12").value = "00823-2026 ESCRITO";
	worksheet.getCell("D12").value = 50;
	worksheet.getCell("E12").value = "PENDIENTE";
	worksheet.getCell("F12").value = "00/00/0000";
	worksheet.getCell("G12").value = "E";

	const insights = analyzeExcelWorksheetStructure(worksheet, [
		{
			anio: 2026,
			mes: 1,
			juzgado: "1° JUZGADO CIVIL - Sede Principal",
			especialista: "ALBURQUEQUE CARMEN DANY ESWING",
			materia: "CIVIL",
			cantidad: 1,
		},
	]);

	assert.equal(insights.headerRow, 9);
	assert.ok(insights.detectedFields.some((field) => field.key === "fecha" && field.column === "B"));
	assert.ok(insights.detectedFields.some((field) => field.key === "estado"));
	assert.ok(insights.detectedFields.some((field) => field.key === "materia" && field.sample === "CIVIL"));
	assert.ok(insights.availableWidgets.some((widget) => widget.key === "por-estado"));
	assert.ok(insights.availableWidgets.some((widget) => widget.key === "detalle-documento"));
});

test("parsea excel tipo reporte por juzgado con encabezados distribuidos", () => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet("Escritos Ingresados por Juzgado");

	worksheet.getCell("A8").value = "1° JUZGADO CIVIL - Sede Principal";
	worksheet.getCell("A9").value = "N° EXPEDIENTE";
	worksheet.getCell("B9").value = "F INGRESO";
	worksheet.getCell("C9").value = "DOCUMENTO";
	worksheet.getCell("D9").value = "DIAS";
	worksheet.getCell("E9").value = "ESTADO";
	worksheet.getCell("F9").value = "F RESPUESTA";
	worksheet.getCell("G9").value = "TIPO ING.";
	worksheet.getCell("A10").value = "ESPECIALIDAD";
	worksheet.getCell("B10").value = "CIVIL";
	worksheet.getCell("A11").value = "ESPECIALISTA LEGAL";
	worksheet.getCell("B11").value = "ALBURQUEQUE CARMEN DANY ESWING";
	worksheet.getCell("A12").value = "00261-2025-6-3101-JR-CI-01";
	worksheet.getCell("B12").value = "29/01/2026 9:09";
	worksheet.getCell("C12").value = "00823-2026 ESCRITO";
	worksheet.getCell("E12").value = "PENDIENTE";
	worksheet.getCell("G12").value = "E";
	worksheet.getCell("A14").value = "00229-2010-0-3101-JM-CI-01";
	worksheet.getCell("B14").value = "03/02/2026 18:42";
	worksheet.getCell("C14").value = "00976-2026 ESCRITO";
	worksheet.getCell("E14").value = "PENDIENTE";
	worksheet.getCell("G14").value = "F";

	const records = parseExcelToRecords(worksheet);

	assert.equal(records.length, 2);
	assert.equal(records[0].juzgado, "1° JUZGADO CIVIL");
	assert.equal(records[0].especialista, "ALBURQUEQUE CARMEN DANY ESWING");
	assert.ok(records.some((record) => record.materia === "CIVIL"));
	assert.ok(records.some((record) => record.materia === "LABORAL"));
});
