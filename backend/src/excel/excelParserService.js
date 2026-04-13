const { cleanCellValue } = require("./loadWorkbook");
const { detectSheetPattern, normalizeText } = require("./excelPatternDetector");

const EXPEDIENTE_REGEX = /\d{3,6}-\d{4}(?:-[A-Z0-9]{1,6}){2,}/i;

function cleanLine(row = []) {
	return row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean).join(" ").trim();
}

function isBlankRow(row = []) {
	return !row.some((value) => String(cleanCellValue(value) || "").trim());
}

function isTotalLikeRow(row = []) {
	return /(TOTAL|SUBTOTAL|RESUMEN|ACUMULADO|PAGINA)/.test(normalizeText(cleanLine(row)));
}

function isHeaderLikeRow(row = []) {
	const normalized = normalizeText(cleanLine(row));
	return /(N EXPEDIENTE|F INGRESO|DOCUMENTO|DIAS|ESTADO|F RESPUESTA|TIPO ING)/.test(normalized);
}

function readContextValue(row, labelRegex) {
	const cells = row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean);
	if (!cells.length) return "";
	const first = normalizeText(cells[0]);
	if (!labelRegex.test(first)) return "";
	if (cells.length > 1) return cells.slice(1).join(" ").trim();
	return cells[0].replace(labelRegex, "").trim();
}

function extractEspecialistaFromRow(row = []) {
	const line = cleanLine(row);
	if (!line) return "";
	const byLabel = line.match(/(?:ESPECIALISTA(?:\s+LEGAL)?|RELATOR)\s*:?\s*(.+)$/i);
	if (byLabel?.[1]) return byLabel[1].trim();

	const byTotal = line.match(/TOTAL\s+DE\s+ESCRITOS\s+ASIGNADOS\s+A\s+(.+?)\s*:\s*\d+/i);
	if (byTotal?.[1]) return byTotal[1].trim();

	return "";
}

function isMainRecordRow(row = [], columnMap = {}) {
	const cell = String(cleanCellValue(row[columnMap.expediente ?? 0]) || "").trim();
	if (EXPEDIENTE_REGEX.test(cell)) return true;
	for (const value of row) {
		if (EXPEDIENTE_REGEX.test(String(cleanCellValue(value) || "").trim())) return true;
	}
	return false;
}

function isDetailRow(row = [], columnMap = {}) {
	if (isBlankRow(row)) return false;
	if (isTotalLikeRow(row)) return false;
	if (isHeaderLikeRow(row)) return false;
	if (isMainRecordRow(row, columnMap)) return false;

	const cells = row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean);
	if (!cells.length || cells.length > 5) return false;

	const joined = normalizeText(cells.join(" "));
	const hasChannelHint = /(MESA PARTES|ELECTRON|FISIC|VIRTUAL|CDG|SECRETARIA|CASILLA|CORREO)/.test(joined);
	const hasDescription = cells.some((value) => value.length >= 10);
	return hasChannelHint || hasDescription;
}

function extractDetailFields(row = [], columnMap = {}) {
	const item = String(cleanCellValue(row[columnMap.expediente ?? 0]) || "").trim();
	const canal = String(cleanCellValue(row[columnMap.fecha_ingreso ?? 1]) || "").trim();
	const descripcion = String(cleanCellValue(row[columnMap.documento ?? 2]) || "").trim();

	if (item || canal || descripcion) {
		return {
			item_detalle: item,
			canal_ingreso: canal,
			descripcion: descripcion,
		};
	}

	const cells = row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean);
	return {
		item_detalle: cells[0] || "",
		canal_ingreso: cells[1] || "",
		descripcion: cells.slice(2).join(" ").trim(),
	};
}

function parseSheetBlocks(sheet) {
	const pattern = detectSheetPattern(sheet);
	const rows = sheet?.rows || [];
	const discardedRows = [];
	const parsedRows = [];
	const blocks = [];

	if (!pattern.isSupportedExportPattern) {
		return {
			sheetName: sheet.name,
			pattern,
			parsedRows,
			discardedRows,
			blocks,
		};
	}

	let especialistaActual = "";
	let especialidadActual = "";
	let currentBlock = null;
	const headerRowIndex = pattern.headerRowIndex;
	const columnMap = pattern.columnMap;

	for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex] || [];
		const rawLine = cleanLine(row);
		if (isBlankRow(row)) {
			discardedRows.push({ rowNumber: rowIndex + 1, reason: "fila_vacia", raw: cleanLine(row) });
			continue;
		}

		const especialidad = readContextValue(row, /^ESPECIALIDAD\b|^MATERIA\b/i);
		if (especialidad) {
			especialidadActual = especialidad;
			discardedRows.push({ rowNumber: rowIndex + 1, reason: "contexto_especialidad", raw: cleanLine(row) });
			continue;
		}

		const especialista = readContextValue(row, /^ESPECIALISTA(?:\s+LEGAL)?\b|^RELATOR\b/i);
		const especialistaInline = extractEspecialistaFromRow(row);
		if (especialista || especialistaInline) {
			especialistaActual = (especialista || especialistaInline || "").trim();
			if (currentBlock) currentBlock.endRow = rowIndex;
			currentBlock = {
				especialista: especialistaActual,
				startRow: rowIndex + 1,
				endRow: rowIndex + 1,
				records: 0,
			};
			blocks.push(currentBlock);
			discardedRows.push({ rowNumber: rowIndex + 1, reason: "contexto_especialista", raw: cleanLine(row) });
			continue;
		}

		if (isTotalLikeRow(row)) {
			const especialistaEnTotal = extractEspecialistaFromRow(row);
			if (especialistaEnTotal) {
				especialistaActual = especialistaEnTotal;
			}
			if (currentBlock) currentBlock.endRow = rowIndex + 1;
			discardedRows.push({ rowNumber: rowIndex + 1, reason: "fila_total", raw: cleanLine(row) });
			continue;
		}

		if (isHeaderLikeRow(row)) {
			discardedRows.push({ rowNumber: rowIndex + 1, reason: "encabezado_repetido", raw: cleanLine(row) });
			continue;
		}

		if (!isMainRecordRow(row, columnMap)) {
			discardedRows.push({ rowNumber: rowIndex + 1, reason: "fila_no_reconocida", raw: cleanLine(row) });
			continue;
		}

		const detailCandidate = rows[rowIndex + 1] || [];
		const hasDetailRow = isDetailRow(detailCandidate, columnMap);
		const detailFields = hasDetailRow ? extractDetailFields(detailCandidate, columnMap) : {
			item_detalle: "",
			canal_ingreso: "",
			descripcion: "",
		};

		const parsed = {
			sheetName: sheet.name,
			source_main_row: rowIndex + 1,
			source_detail_row: hasDetailRow ? rowIndex + 2 : null,
			expediente: String(cleanCellValue(row[columnMap.expediente]) || "").trim(),
			fecha_ingreso: cleanCellValue(row[columnMap.fecha_ingreso]),
			documento: String(cleanCellValue(row[columnMap.documento]) || "").trim(),
			dias: cleanCellValue(row[columnMap.dias]),
			estado: String(cleanCellValue(row[columnMap.estado]) || "").trim(),
			fecha_respuesta: cleanCellValue(row[columnMap.fecha_respuesta]),
			tipo_ing: String(cleanCellValue(row[columnMap.tipo_ing]) || "").trim(),
			...detailFields,
			juzgado: pattern.globalMetadata.juzgado || "",
			especialidad: especialidadActual,
			especialista: especialistaActual || (currentBlock?.especialista || ""),
			fecha_inicio_reporte: pattern.globalMetadata.fecha_inicio_reporte || "",
			fecha_fin_reporte: pattern.globalMetadata.fecha_fin_reporte || "",
		};

		parsedRows.push(parsed);
		if (currentBlock) {
			currentBlock.records += 1;
			currentBlock.endRow = hasDetailRow ? rowIndex + 2 : rowIndex + 1;
		}

		if (hasDetailRow) {
			discardedRows.push({ rowNumber: rowIndex + 2, reason: "fila_detalle_unida", raw: cleanLine(detailCandidate) });
			rowIndex += 1;
		}

		if (!parsed.especialista && rawLine) {
			const fallback = extractEspecialistaFromRow([rawLine]);
			if (fallback) parsed.especialista = fallback;
		}
	}

	return {
		sheetName: sheet.name,
		pattern,
		parsedRows,
		discardedRows,
		blocks,
	};
}

function parseWorkbookExport(workbookData) {
	const sheetResults = workbookData.sheets.map((sheet) => parseSheetBlocks(sheet));
	return {
		sheetResults,
		parsedRows: sheetResults.flatMap((sheet) => sheet.parsedRows),
		discardedRows: sheetResults.flatMap((sheet) => sheet.discardedRows),
		blocks: sheetResults.flatMap((sheet) => sheet.blocks.map((block) => ({ ...block, sheetName: sheet.sheetName }))),
		metadata: sheetResults[0]?.pattern?.globalMetadata || { juzgado: "", fecha_inicio_reporte: "", fecha_fin_reporte: "" },
	};
}

module.exports = {
	parseWorkbookExport,
};
