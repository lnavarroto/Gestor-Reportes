const { cleanCellValue } = require("./loadWorkbook");

const FIELD_ALIASES = {
	codigo: ["ID", "CODIGO", "COD", "N EXPEDIENTE", "NRO EXPEDIENTE", "NUMERO EXPEDIENTE", "EXPEDIENTE"],
	fecha: ["FECHA", "F INGRESO", "FECHA INGRESO", "INGRESO", "F_INGRESO", "FINGRESO"],
	documento: ["DOCUMENTO", "DOC", "DETALLE DOCUMENTO"],
	estado: ["ESTADO", "SITUACION"],
	responsable: ["RESPONSABLE", "ESPECIALISTA", "ESPECIALISTA LEGAL", "USUARIO", "RELATOR", "ANALISTA"],
	dias: ["DIAS", "DIAS PENDIENTES", "ANTIGUEDAD", "ANTIGUEDAD DIAS"],
	categoria: ["CATEGORIA", "TIPO", "TIPO ING", "TIPO INGRESO", "TIPO DOCUMENTO", "MATERIA", "ESPECIALIDAD"],
	observacion: ["OBSERVACION", "OBSERVACIONES", "DETALLE", "DESCRIPCION", "GLOSA"],
	respuesta: ["F RESPUESTA", "FECHA RESPUESTA", "RESPUESTA"],
	juzgado: ["JUZGADO", "ORGANO", "ORGANO JURISDICCIONAL"],
};

const FIELD_LABELS = {
	codigo: "Codigo o expediente",
	fecha: "Fecha",
	documento: "Documento",
	estado: "Estado",
	responsable: "Responsable",
	dias: "Dias o antiguedad",
	categoria: "Categoria o materia",
	observacion: "Observacion",
	respuesta: "Fecha de respuesta",
	juzgado: "Juzgado",
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

function columnNumberToLetter(columnNumber) {
	let current = Number(columnNumber) || 0;
	let out = "";
	while (current > 0) {
		const mod = (current - 1) % 26;
		out = String.fromCharCode(65 + mod) + out;
		current = Math.floor((current - mod) / 26);
	}
	return out;
}

function isMeaningfulValue(value) {
	return cleanCellValue(value) !== "";
}

function countNonEmpty(row = []) {
	return row.filter(isMeaningfulValue).length;
}

function isLikelySummaryRow(values) {
	const line = values.map((value) => String(cleanCellValue(value))).join(" ").toUpperCase();
	return /(TOTAL|SUBTOTAL|RESUMEN|PROMEDIO|ACUMULADO)/.test(line);
}

function classifyValue(value) {
	const text = String(cleanCellValue(value) || "").trim();
	if (!text) return "empty";
	if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^\d{2}\/\d{2}\/\d{4}/.test(text)) return "date";
	if (/^-?\d+(?:[.,]\d+)?$/.test(text)) return "number";
	if (/^[A-Z0-9-]{6,}$/.test(text.toUpperCase()) && /\d/.test(text)) return "code";
	return "text";
}

function inferColumnType(rows, columnIndex, startRowIndex) {
	const sampleTypes = [];
	for (let rowIndex = startRowIndex + 1; rowIndex < rows.length && sampleTypes.length < 12; rowIndex += 1) {
		const value = rows[rowIndex]?.[columnIndex];
		if (!isMeaningfulValue(value)) continue;
		const type = classifyValue(value);
		if (type !== "empty") sampleTypes.push(type);
	}
	if (!sampleTypes.length) return "unknown";
	const frequencies = sampleTypes.reduce((acc, type) => {
		acc[type] = (acc[type] || 0) + 1;
		return acc;
	}, {});
	return Object.entries(frequencies).sort((a, b) => b[1] - a[1])[0][0];
}

function matchField(headerText) {
	const normalized = normalizeText(headerText);
	if (!normalized) return null;
	for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
		if (aliases.includes(normalized)) return fieldKey;
	}
	return null;
}

function scoreHeaderRow(row = []) {
	const detected = {};
	let score = 0;
	let textCells = 0;

	for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
		const value = row[columnIndex];
		if (!isMeaningfulValue(value)) continue;
		textCells += 1;
		const fieldKey = matchField(value);
		if (!fieldKey || detected[fieldKey]) continue;
		detected[fieldKey] = {
			columnIndex,
			header: String(cleanCellValue(value)),
		};
		score += fieldKey === "fecha" || fieldKey === "categoria" || fieldKey === "responsable" ? 3 : 2;
	}

	if (detected.codigo) score += 2;
	if (detected.estado) score += 1;
	if (textCells >= 4) score += 1;

	return {
		score,
		detected,
		textCells,
	};
}

function detectContextFields(rows, headerRowIndex) {
	const context = {};
	const start = Math.max(0, headerRowIndex - 8);
	for (let rowIndex = start; rowIndex < headerRowIndex; rowIndex += 1) {
		const row = rows[rowIndex] || [];
		const joined = row.map((value) => String(cleanCellValue(value))).filter(Boolean).join(" ");
		if (!joined) continue;
		const normalized = normalizeText(joined);
		if (!context.juzgado && normalized.includes("JUZGADO")) context.juzgado = joined.trim();
		if (!context.categoria && (normalized.includes("ESPECIALIDAD") || normalized.includes("MATERIA"))) {
			context.categoria = joined.replace(/.*?(ESPECIALIDAD|MATERIA)\s*/i, "").trim() || joined.trim();
		}
		if (!context.responsable && normalized.includes("ESPECIALISTA")) {
			context.responsable = joined.replace(/.*?ESPECIALISTA(?: LEGAL)?\s*/i, "").trim() || joined.trim();
		}
	}
	return context;
}

function detectTablesInSheet(sheet) {
	const tables = [];
	const rows = sheet.rows || [];
	let pending = null;

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex] || [];
		if (countNonEmpty(row) === 0) continue;
		const headerScore = scoreHeaderRow(row);
		const isHeaderCandidate = headerScore.score >= 6 && Object.keys(headerScore.detected).length >= 2;
		if (!isHeaderCandidate) continue;

		if (pending) {
			pending.endRowIndex = rowIndex - 1;
			tables.push(pending);
		}

		pending = {
			headerRowIndex: rowIndex,
			endRowIndex: rows.length - 1,
			fields: Object.entries(headerScore.detected).map(([key, data]) => ({
				key,
				label: FIELD_LABELS[key] || key,
				columnIndex: data.columnIndex,
				columnLetter: columnNumberToLetter(data.columnIndex + 1),
				header: data.header,
			})),
			context: detectContextFields(rows, rowIndex),
		};
	}

	if (pending) tables.push(pending);

	return tables.map((table, index) => ({
		...table,
		id: `${sheet.name}-${index + 1}`,
		startRowNumber: table.headerRowIndex + 1,
		endRowNumber: table.endRowIndex + 1,
		fields: table.fields.map((field) => ({
			...field,
			type: inferColumnType(rows, field.columnIndex, table.headerRowIndex),
			sample: findSampleValue(rows, field.columnIndex, table.headerRowIndex, table.endRowIndex),
		})),
	}));
}

function findSampleValue(rows, columnIndex, startRowIndex, endRowIndex) {
	for (let rowIndex = startRowIndex + 1; rowIndex <= endRowIndex; rowIndex += 1) {
		const value = cleanCellValue(rows[rowIndex]?.[columnIndex]);
		if (value !== "") return String(value);
	}
	return "";
}

function analyzeWorkbookSheets(sheets = []) {
	const sheetInsights = sheets.map((sheet) => {
		const tables = detectTablesInSheet(sheet);
		const detectedFields = [...new Map(tables.flatMap((table) => table.fields).map((field) => [field.key, field])).values()];
		return {
			name: sheet.name,
			rowCount: sheet.rowCount,
			columnCount: sheet.columnCount,
			mergeCount: sheet.mergeCount,
			tables,
			detectedFields,
		};
	});

	const workbookFieldKeys = new Set();
	for (const sheet of sheetInsights) {
		for (const field of sheet.detectedFields) workbookFieldKeys.add(field.key);
	}

	return {
		sheetInsights,
		workbookFieldKeys: [...workbookFieldKeys],
	};
}

module.exports = {
	FIELD_LABELS,
	analyzeWorkbookSheets,
	cleanCellValue,
	columnNumberToLetter,
	isLikelySummaryRow,
	normalizeText,
};
