const { cleanCellValue } = require("./loadWorkbook");

const HEADER_ALIASES = {
	expediente: ["N EXPEDIENTE", "NRO EXPEDIENTE", "NUMERO EXPEDIENTE", "EXPEDIENTE"],
	fecha_ingreso: ["F INGRESO", "FECHA INGRESO", "INGRESO", "FECHA"],
	documento: ["DOCUMENTO", "DOC"],
	dias: ["DIAS", "DIAS PENDIENTES", "ANTIGUEDAD"],
	estado: ["ESTADO", "SITUACION"],
	fecha_respuesta: ["F RESPUESTA", "FECHA RESPUESTA", "RESPUESTA"],
	tipo_ing: ["TIPO ING", "TIPO INGRESO", "TIPO ING."],
};

function normalizeText(value) {
	return String(cleanCellValue(value) || "")
		.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getNonEmptyCells(row = []) {
	return row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean);
}

function matchHeaderKey(text) {
	const normalized = normalizeText(text);
	if (!normalized) return null;
	for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
		if (aliases.includes(normalized)) return key;
	}
	return null;
}

function detectHeaderRow(rows = []) {
	let best = null;

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex] || [];
		const columnMap = {};
		let score = 0;

		for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
			const key = matchHeaderKey(row[columnIndex]);
			if (!key || columnMap[key] !== undefined) continue;
			columnMap[key] = columnIndex;
			score += key === "expediente" || key === "fecha_ingreso" || key === "documento" ? 3 : 2;
		}

		if (Object.keys(columnMap).length < 4) continue;
		if (
			columnMap.expediente === undefined ||
			columnMap.fecha_ingreso === undefined ||
			columnMap.documento === undefined
		) {
			continue;
		}

		if (!best || score > best.score) {
			best = {
				rowIndex,
				columnMap,
				score,
			};
		}
	}

	return best;
}

function detectDateRange(rows = []) {
	const limit = Math.min(rows.length, 25);
	let fechaInicio = null;
	let fechaFin = null;

	for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
		const joined = getNonEmptyCells(rows[rowIndex]).join(" ");
		if (!joined) continue;
		const match = joined.match(/DESDE\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{4}(?:\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?)\s*HASTA\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{4}(?:\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?)/i);
		if (match) {
			fechaInicio = match[1].trim();
			fechaFin = match[2].trim();
			break;
		}
	}

	return {
		fecha_inicio_reporte: fechaInicio,
		fecha_fin_reporte: fechaFin,
	};
}

function detectJuzgado(rows = []) {
	const limit = Math.min(rows.length, 30);
	for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
		const line = getNonEmptyCells(rows[rowIndex]).join(" ").trim();
		if (!line) continue;
		const normalized = normalizeText(line);
		if (!/(JUZGADO|SALA)/.test(normalized)) continue;
		if (/(TOTAL|SUBTOTAL|RESUMEN|N EXPEDIENTE|F INGRESO)/.test(normalized)) continue;
		return line.replace(/\s+/g, " ").trim();
	}
	return "";
}

function detectGlobalMetadata(sheet) {
	const rows = sheet?.rows || [];
	const dateRange = detectDateRange(rows);
	return {
		reportName: "",
		juzgado: detectJuzgado(rows),
		...dateRange,
	};
}

function detectSheetPattern(sheet) {
	const rows = sheet?.rows || [];
	const header = detectHeaderRow(rows);
	return {
		headerRowIndex: header ? header.rowIndex : -1,
		columnMap: header ? header.columnMap : {},
		isSupportedExportPattern: Boolean(header),
		globalMetadata: detectGlobalMetadata(sheet),
	};
}

module.exports = {
	normalizeText,
	detectSheetPattern,
	detectGlobalMetadata,
};
