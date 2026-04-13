const {
	cleanCellValue,
	isLikelySummaryRow,
	normalizeText,
} = require("./analyzeSheetStructure");

function parseDateValue(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	const text = String(cleanCellValue(value) || "").trim();
	if (!text) return null;
	const direct = new Date(text);
	if (!Number.isNaN(direct.getTime())) return direct;
	const slash = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
	if (!slash) return null;
	const date = new Date(
		Number(slash[3]),
		Number(slash[2]) - 1,
		Number(slash[1]),
		Number(slash[4] || 0),
		Number(slash[5] || 0),
		Number(slash[6] || 0)
	);
	return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(value) {
	const text = String(cleanCellValue(value) || "").trim();
	if (!text) return null;
	const normalized = text.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
}

function normalizeCategory(value) {
	return String(cleanCellValue(value) || "")
		.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
}

function aggregateRecords(records = []) {
	const map = new Map();
	for (const record of records) {
		if (!record.anio || !record.mes) continue;
		const key = `${record.anio}|${record.mes}|${record.juzgado}|${record.especialista}|${record.materia}`;
		map.set(key, (map.get(key) || 0) + (Number(record.cantidad) || 0));
	}
	return [...map.entries()].map(([key, cantidad]) => {
		const [anio, mes, juzgado, especialista, materia] = key.split("|");
		return {
			anio: Number(anio),
			mes: Number(mes),
			juzgado,
			especialista,
			materia,
			cantidad,
		};
	});
}

function isExpedienteLike(value) {
	const text = String(cleanCellValue(value) || "").trim().toUpperCase();
	if (!text) return false;
	if (/^TOTAL|SUBTOTAL|RESUMEN/.test(text)) return false;
	return /\d{3,6}-\d{4}(?:-[A-Z0-9]{1,6}){2,}/.test(text);
}

function splitDocumentField(documento) {
	const text = String(documento || "").trim();
	if (!text) return { numeroDocumento: "", tipoDocumento: "" };
	const match = text.match(/^(\d{3,6}-\d{4})\s+(.+)$/i);
	if (!match) return { numeroDocumento: "", tipoDocumento: text };
	return {
		numeroDocumento: match[1],
		tipoDocumento: match[2].trim(),
	};
}

function isLikelyMainRecordRow(row, table) {
	const codigoField = table.fields.find((field) => field.key === "codigo");
	if (codigoField && isExpedienteLike(row[codigoField.columnIndex])) return true;
	for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
		if (isExpedienteLike(row[columnIndex])) return true;
	}
	return false;
}

function parseContextLabelValue(row = [], labelRegex) {
	const cells = row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean);
	if (!cells.length) return "";
	const first = normalizeText(cells[0]);
	if (!labelRegex.test(first)) return "";
	if (cells.length > 1) return cells.slice(1).join(" ").trim();
	return cells[0].replace(labelRegex, "").trim();
}

function updateContextFromRow(row = [], table, currentContext) {
	const next = {
		juzgado: currentContext.juzgado || table.context.juzgado || "",
		categoria: currentContext.categoria || table.context.categoria || "",
		responsable: currentContext.responsable || table.context.responsable || "",
	};

	const especialidad = parseContextLabelValue(row, /^ESPECIALIDAD\b|^MATERIA\b/i);
	if (especialidad) next.categoria = especialidad;

	const especialista = parseContextLabelValue(row, /^ESPECIALISTA(?:\s+LEGAL)?\b|^RELATOR\b/i);
	if (especialista) next.responsable = especialista;

	const line = row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean).join(" ").trim();
	const normalizedLine = normalizeText(line);
	if (
		line &&
		!isExpedienteLike(line) &&
		/(JUZGADO|SALA)/.test(normalizedLine) &&
		!/(TOTAL|SUBTOTAL|RESUMEN)/.test(normalizedLine) &&
		!/(N EXPEDIENTE|F INGRESO|ESTADO)/.test(normalizedLine)
	) {
		next.juzgado = line.replace(/\s+/g, " ").trim();
	}

	return next;
}

function isLikelyDetailRow(row = [], table) {
	if (!row.length) return false;
	if (isLikelyMainRecordRow(row, table)) return false;
	const values = row.map((value) => String(cleanCellValue(value) || "").trim()).filter(Boolean);
	if (!values.length || values.length > 4) return false;
	if (isLikelySummaryRow(values)) return false;

	const joined = normalizeText(values.join(" "));
	if (/^TOTAL|SUBTOTAL|RESUMEN/.test(joined)) return false;

	const hasChannelHint = /(MESA PARTES|ELECTRONIC|ELECTRONIC|FISIC|VIRTUAL|SECRETARIA|CASILLA|CORREO)/.test(joined);
	const hasRichText = values.some((value) => value.length > 10);
	return hasChannelHint || hasRichText;
}

function mergeDetailRow(structured, detailRow, table) {
	const fechaField = table.fields.find((field) => field.key === "fecha");
	const documentoField = table.fields.find((field) => field.key === "documento");
	const observacionField = table.fields.find((field) => field.key === "observacion");

	const fallbackCanal = cleanCellValue(detailRow?.[fechaField?.columnIndex ?? 1]);
	const fallbackDescripcion = cleanCellValue(detailRow?.[documentoField?.columnIndex ?? 2]);
	const explicitObservacion = cleanCellValue(detailRow?.[observacionField?.columnIndex ?? -1]);

	const canalText = String(fallbackCanal || "").trim();
	const descripcionText = String(fallbackDescripcion || "").trim();
	const observacionText = String(explicitObservacion || "").trim();

	if (canalText && !parseDateValue(canalText)) structured.canalIngreso = canalText;
	if (descripcionText) structured.descripcionDocumento = descripcionText;
	if (!structured.observacion && observacionText) {
		structured.observacion = observacionText;
	} else if (!structured.observacion && descripcionText) {
		structured.observacion = descripcionText;
	}
}

function isRepeatedHeader(row = [], table) {
	const byColumn = new Map(table.fields.map((field) => [field.columnIndex, normalizeText(field.header)]));
	let matches = 0;
	for (const [columnIndex, expected] of byColumn.entries()) {
		if (normalizeText(row[columnIndex]) === expected) matches += 1;
	}
	return matches >= Math.max(2, Math.ceil(table.fields.length / 2));
}

function buildStructuredRow(row, table, sheetName) {
	const structured = {
		sheetName,
		context: table.context,
	};

	for (const field of table.fields) {
		structured[field.key] = cleanCellValue(row[field.columnIndex]);
	}

	structured.juzgado = structured.juzgado || table.context.juzgado || "";
	structured.responsable = structured.responsable || table.context.responsable || "";
	structured.categoria = structured.categoria || table.context.categoria || "";
	structured.fecha = parseDateValue(structured.fecha);
	structured.respuesta = parseDateValue(structured.respuesta);
	structured.dias = parseNumber(structured.dias);
	structured.estado = String(structured.estado || "").trim();
	structured.codigo = String(structured.codigo || "").trim();
	structured.documento = String(structured.documento || "").trim();
	structured.observacion = String(structured.observacion || "").trim();
	const contextCategoria = normalizeCategory(table.context.categoria || "");
	const rawCategoria = String(structured.categoria || "").trim().toUpperCase();
	const isIngresoCode = /^[A-Z]$/.test(rawCategoria);
	structured.tipoIngresoCodigo = isIngresoCode ? rawCategoria : "";
	structured.categoria = normalizeCategory(
		isIngresoCode
			? contextCategoria
			: rawCategoria || contextCategoria
	);
	structured.responsable = String(structured.responsable || "").toUpperCase().replace(/\s+/g, " ").trim();
	structured.juzgado = String(structured.juzgado || "").replace(/\s+/g, " ").trim();
	structured.expediente = structured.codigo;

	const parts = splitDocumentField(structured.documento);
	structured.numeroDocumento = parts.numeroDocumento;
	structured.tipoDocumento = parts.tipoDocumento;
	structured.canalIngreso = "";
	structured.descripcionDocumento = "";

	return structured;
}

function shouldKeepStructuredRow(structured) {
	if (!structured) return false;
	if (!structured.fecha && !structured.codigo && !structured.documento) return false;
	const summaryText = [structured.codigo, structured.documento, structured.observacion, structured.estado]
		.filter(Boolean)
		.join(" ");
	if (/(TOTAL|SUBTOTAL|RESUMEN|PROMEDIO)/i.test(summaryText)) return false;
	return true;
}

function toReportRecord(structured) {
	if (!structured.fecha) return null;
	return {
		anio: structured.fecha.getFullYear(),
		mes: structured.fecha.getMonth() + 1,
		juzgado: structured.juzgado || "SIN JUZGADO",
		especialista: structured.responsable || "SIN ESPECIALISTA",
		materia: normalizeCategory(structured.categoria || structured.estado || "SIN MATERIA") || "SIN MATERIA",
		cantidad: 1,
	};
}

function buildNormalizedRecordsFromWorkbookAnalysis(workbookAnalysis) {
	const normalizedRows = [];
	const reportRecords = [];

	for (const sheet of workbookAnalysis.sheets) {
		const sheetInsight = workbookAnalysis.analysis.sheetInsights.find((item) => item.name === sheet.name);
		if (!sheetInsight) continue;

		for (const table of sheetInsight.tables) {
			let currentContext = {
				juzgado: table.context.juzgado || "",
				categoria: table.context.categoria || "",
				responsable: table.context.responsable || "",
			};

			for (let rowIndex = table.headerRowIndex + 1; rowIndex <= table.endRowIndex; rowIndex += 1) {
				const row = sheet.rows[rowIndex] || [];
				const nonEmptyValues = row.filter((value) => cleanCellValue(value) !== "");
				if (!nonEmptyValues.length) continue;
				currentContext = updateContextFromRow(row, table, currentContext);
				if (isLikelySummaryRow(nonEmptyValues)) continue;
				if (isRepeatedHeader(row, table)) continue;
				if (!isLikelyMainRecordRow(row, table)) continue;

				const structured = buildStructuredRow(row, table, sheet.name);
				structured.juzgado = structured.juzgado || String(currentContext.juzgado || "").trim();
				structured.responsable = structured.responsable || String(currentContext.responsable || "").toUpperCase().trim();
				if (!structured.categoria || structured.categoria === "SIN MATERIA") {
					structured.categoria = normalizeCategory(currentContext.categoria || structured.categoria);
				}

				const nextRow = sheet.rows[rowIndex + 1] || [];
				if (isLikelyDetailRow(nextRow, table)) {
					mergeDetailRow(structured, nextRow, table);
					rowIndex += 1;
				}

				if (!shouldKeepStructuredRow(structured)) continue;

				normalizedRows.push(structured);
				const reportRecord = toReportRecord(structured);
				if (reportRecord) reportRecords.push(reportRecord);
			}
		}
	}

	return {
		normalizedRows,
		normalizedRecords: aggregateRecords(reportRecords),
	};
}

module.exports = {
	buildNormalizedRecordsFromWorkbookAnalysis,
};
