const { loadWorkbookFromBuffer } = require("./loadWorkbook");
const { analyzeWorkbookSheets } = require("./analyzeSheetStructure");
const { buildExcelMetrics, buildReportSuggestions } = require("./buildReportSuggestions");
const { parseWorkbookExport } = require("./excelParserService");
const { normalizeParsedRows } = require("./excelNormalizationService");
const { buildExcelNormalizationPreview } = require("./excelPreviewBuilder");

function buildExcelDiagnostics(workbookAnalysis, parsed, normalized) {
	const sheetCount = workbookAnalysis.sheets.length;
	const tableCount = workbookAnalysis.analysis.sheetInsights.reduce((acc, sheet) => acc + sheet.tables.length, 0);
	const missingSignals = [];
	if (!parsed.parsedRows.length) missingSignals.push("No se encontro ningun inicio de registro con formato de expediente.");
	if (parsed.parsedRows.length && !normalized.normalizedRows.length) {
		missingSignals.push("Se detectaron filas principales pero no pasaron la normalizacion.");
	}

	let message = "Excel normalizado correctamente.";
	const reasons = [];

	if (!tableCount) {
		message = `Se leyeron ${sheetCount} hoja(s), pero no se detecto cabecera compatible del reporte exportado.`;
		reasons.push("No se encontro fila de encabezados con N EXPEDIENTE, F INGRESO y DOCUMENTO.");
	}

	if (!parsed.parsedRows.length) {
		message = "No se reconstruyeron registros desde el Excel exportado.";
		reasons.push("No se detectaron filas principales que inicien con expediente judicial.");
	}

	if (parsed.discardedRows.length) {
		reasons.push(`Filas descartadas durante parsing: ${parsed.discardedRows.length}.`);
	}

	for (const signal of missingSignals) reasons.push(signal);

	return {
		ok: normalized.normalizedRecords.length > 0,
		message,
		reasons: [...new Set(reasons)],
		sheetCount,
		tableCount,
		reconstructedRowCount: parsed.parsedRows.length,
		normalizedRowCount: normalized.normalizedRows.length,
		recordCount: normalized.normalizedRecords.length,
	};
}

async function analyzeExcelUploadController(buffer, fileName) {
	const workbookData = loadWorkbookFromBuffer(buffer, fileName);
	const analysis = analyzeWorkbookSheets(workbookData.sheets);
	const workbookAnalysis = { ...workbookData, analysis };
	const parsed = parseWorkbookExport(workbookData);
	const normalized = normalizeParsedRows(parsed.parsedRows);
	const metrics = buildExcelMetrics(normalized.normalizedRows, workbookAnalysis);
	const suggestedReports = buildReportSuggestions(analysis.workbookFieldKeys);
	const normalizationPreview = buildExcelNormalizationPreview(parsed, normalized);
	const diagnostics = buildExcelDiagnostics(workbookAnalysis, parsed, normalized);

	return {
		workbookMeta: {
			extension: workbookData.extension,
			sheets: workbookData.sheets.map((sheet) => ({
				name: sheet.name,
				rowCount: sheet.rowCount,
				columnCount: sheet.columnCount,
				mergeCount: sheet.mergeCount,
			})),
		},
		sheetInsights: analysis.sheetInsights,
		workbookFieldKeys: analysis.workbookFieldKeys,
		normalizedRows: normalized.normalizedRows,
		normalizedRecords: normalized.normalizedRecords,
		metrics,
		suggestedReports,
		normalizationPreview,
		diagnostics,
	};
}

module.exports = {
	analyzeExcelUploadController,
};
