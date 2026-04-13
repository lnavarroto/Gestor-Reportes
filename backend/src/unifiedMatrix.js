const ExcelJS = require("exceljs");
const { PDFParse } = require("pdf-parse");

const MONTHS_ORDER = {
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	septiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12,
};

const MONTHS_LABEL = {
	1: "ENERO",
	2: "FEBRERO",
	3: "MARZO",
	4: "ABRIL",
	5: "MAYO",
	6: "JUNIO",
	7: "JULIO",
	8: "AGOSTO",
	9: "SEPTIEMBRE",
	10: "OCTUBRE",
	11: "NOVIEMBRE",
	12: "DICIEMBRE",
};

const MATERIA_PREFERRED_ORDER = [
	"CIVIL",
	"LABORAL",
	"FAMILIA CIVIL",
	"FAMILIA PENAL",
	"FAMILIA TUTELAR",
	"PENAL",
	"CONSTITUCIONAL",
];

const CORE_EXCEL_HEADER_ALIASES = {
	fecha: ["F INGRESO", "FECHA", "FECHA INGRESO", "INGRESO", "F_INGRESO", "FINGRESO"],
	especialista: ["ESPECIALISTA LEGAL", "ESPECIALISTA", "ESPECIALISTAS"],
	juzgado: ["JUZGADO", "ORGANO JURISDICCIONAL", "ORGANO", "JUZ"],
	tipo: ["TIPO", "TIPO ING", "TIPO INGRESO", "TIPO DOC", "TIPO DOCUMENTO", "DOCUMENTO"],
};

const EXCEL_VARIABLE_ALIASES = {
	expediente: ["N EXPEDIENTE", "NRO EXPEDIENTE", "NUMERO EXPEDIENTE", "EXPEDIENTE"],
	fecha: CORE_EXCEL_HEADER_ALIASES.fecha,
	documento: ["DOCUMENTO", "DOC"],
	dias: ["DIAS"],
	estado: ["ESTADO"],
	respuesta: ["F RESPUESTA", "FECHA RESPUESTA", "RESPUESTA"],
	tipo: CORE_EXCEL_HEADER_ALIASES.tipo,
	especialista: CORE_EXCEL_HEADER_ALIASES.especialista,
	materia: ["ESPECIALIDAD", "MATERIA"],
	juzgado: CORE_EXCEL_HEADER_ALIASES.juzgado,
};

const REPORT_STYLE_VARIABLE_ALIASES = {
	...EXCEL_VARIABLE_ALIASES,
	tipo: ["TIPO ING", "TIPO INGRESO", "TIPO"],
};

const EXCEL_FIELD_LABELS = {
	expediente: "Expediente",
	fecha: "Fecha de ingreso",
	documento: "Documento",
	dias: "Dias",
	estado: "Estado",
	respuesta: "Fecha de respuesta",
	tipo: "Tipo de ingreso",
	especialista: "Especialista",
	materia: "Materia",
	juzgado: "Juzgado",
};

const PDF_SECTION_HEADER_MARKERS = ["ESCRITOS INGRESADOS", "DEMANDAS INGRESADAS"];
const PDF_TOTAL_BY_SPECIALIST_REGEX = /TOTAL\s+DE\s+(?:ESCRITOS|DEMANDAS)\s+ASIGNADOS\s+A\s+(.+?)\s*:\s*(\d+)/i;
const PDF_TOTAL_BY_JUZGADO_REGEX = /TOTAL\s+DE\s+(?:ESCRITOS|DEMANDAS)\s+ASIGNADOS\s+AL\s+(.+?)\s*:\s*(\d+)/i;

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

function findExcelHeaderMap(worksheet, aliases = CORE_EXCEL_HEADER_ALIASES) {
	if (!worksheet) return { headerRow: null, headerMap: null };

	const maxRow = Math.min(worksheet.rowCount || 0, 140);
	const maxCol = Math.min(worksheet.columnCount || 0, 90);

	let headerRow = null;
	let headerMap = null;

	for (let r = 1; r <= maxRow; r += 1) {
		const found = {};
		let score = 0;

		for (let c = 1; c <= maxCol; c += 1) {
			const h = normalizeHeader(worksheet.getCell(r, c).value);
			if (!h) continue;

			if (!found.fecha && aliases.fecha.includes(h)) {
				found.fecha = c;
				score += 3;
			}
			if (!found.especialista && aliases.especialista.includes(h)) {
				found.especialista = c;
				score += 3;
			}
			if (!found.juzgado && aliases.juzgado.includes(h)) {
				found.juzgado = c;
				score += 2;
			}
			if (!found.tipo && aliases.tipo.includes(h)) {
				found.tipo = c;
				score += 3;
			}
		}

		const keys = ["fecha", "especialista", "juzgado", "tipo"].filter((k) => found[k]).length;
		if (score >= 6 && keys >= 2 && found.fecha && found.tipo) {
			headerRow = r;
			headerMap = found;
			break;
		}
	}

	return { headerRow, headerMap };
}

function findLabelMatches(worksheet, aliases = EXCEL_VARIABLE_ALIASES) {
	const maxRow = Math.min(worksheet?.rowCount || 0, 20);
	const maxCol = Math.min(worksheet?.columnCount || 0, 20);
	const matches = {};

	for (let row = 1; row <= maxRow; row += 1) {
		for (let col = 1; col <= maxCol; col += 1) {
			const normalized = normalizeHeader(worksheet.getCell(row, col).value);
			if (!normalized) continue;

			for (const [key, aliasList] of Object.entries(aliases)) {
				if (matches[key]) continue;
				if (aliasList.includes(normalized)) {
					matches[key] = {
						row,
						col,
						header: cleanText(worksheet.getCell(row, col).value),
					};
				}
			}
		}
	}

	return matches;
}

function findFirstNonEmptyBelow(worksheet, row, col) {
	const maxRow = Math.min(worksheet?.rowCount || 0, row + 40);
	for (let currentRow = row + 1; currentRow <= maxRow; currentRow += 1) {
		const value = cleanText(worksheet.getCell(currentRow, col).value);
		if (value) return value;
	}
	return "";
}

function findNeighborValue(worksheet, row, col) {
	for (let offset = 1; offset <= 3; offset += 1) {
		const value = cleanText(worksheet.getCell(row, col + offset).value);
		if (value) return value;
	}
	return "";
}

function analyzeExcelWorksheetStructure(worksheet, records = []) {
	if (!worksheet) return null;

	const { headerRow, headerMap } = findExcelHeaderMap(worksheet);
	const labelMatches = findLabelMatches(worksheet);
	const firstRecord = Array.isArray(records) && records.length ? records[0] : null;
	const detectedFields = [];
	const seen = new Set();

	const pushField = (key, details) => {
		if (!details || seen.has(key)) return;
		seen.add(key);
		detectedFields.push({
			key,
			label: EXCEL_FIELD_LABELS[key] || key,
			...details,
		});
	};

	for (const [key, col] of Object.entries(headerMap || {})) {
		const sampleFromRecord =
			key === "fecha"
				? firstRecord?.anio && firstRecord?.mes
					? `${firstRecord.anio}-${String(firstRecord.mes).padStart(2, "0")}`
					: ""
				: key === "especialista"
				? firstRecord?.especialista || ""
				: key === "juzgado"
				? firstRecord?.juzgado || ""
				: key === "tipo"
				? firstRecord?.materia || findFirstNonEmptyBelow(worksheet, headerRow, col)
				: findFirstNonEmptyBelow(worksheet, headerRow, col);

		pushField(key, {
			header: cleanText(worksheet.getCell(headerRow, col).value),
			column: columnNumberToLetter(col),
			source: `Columna ${columnNumberToLetter(col)}`,
			sample: sampleFromRecord || findFirstNonEmptyBelow(worksheet, headerRow, col),
		});
	}

	for (const [key, match] of Object.entries(labelMatches)) {
		let sample = findNeighborValue(worksheet, match.row, match.col);
		if (!sample) sample = findFirstNonEmptyBelow(worksheet, match.row, match.col);
		if (!sample && key === "materia") sample = firstRecord?.materia || "";
		if (!sample && key === "especialista") sample = firstRecord?.especialista || "";
		if (!sample && key === "juzgado") sample = firstRecord?.juzgado || "";

		pushField(key, {
			header: match.header,
			column: columnNumberToLetter(match.col),
			source: `Bloque ${columnNumberToLetter(match.col)}${match.row}`,
			sample,
		});
	}

	if (firstRecord?.juzgado) {
		pushField("juzgado", {
			header: "JUZGADO DETECTADO",
			source: "Contenido del reporte",
			sample: firstRecord.juzgado,
		});
	}

	if (firstRecord?.materia) {
		pushField("materia", {
			header: "MATERIA DETECTADA",
			source: "Contenido del reporte",
			sample: firstRecord.materia,
		});
	}

	const availableFieldKeys = new Set(detectedFields.map((field) => field.key));
	const availableWidgets = [
		{
			key: "por-juzgado",
			label: "Cuadro por juzgado",
			enabled: availableFieldKeys.has("juzgado"),
			reason: availableFieldKeys.has("juzgado") ? "Se detecto el juzgado del reporte." : "No se detecto juzgado legible.",
		},
		{
			key: "por-especialista",
			label: "Cuadro por especialista",
			enabled: availableFieldKeys.has("especialista"),
			reason: availableFieldKeys.has("especialista") ? "Se detecto especialista legal." : "No se detecto especialista claro.",
		},
		{
			key: "por-materia",
			label: "Cuadro por materia",
			enabled: availableFieldKeys.has("materia") || availableFieldKeys.has("tipo"),
			reason:
				availableFieldKeys.has("materia") || availableFieldKeys.has("tipo")
					? "Se detecto materia o tipo de ingreso."
					: "No se detecto materia o tipo utilizable.",
		},
		{
			key: "por-fecha",
			label: "Cuadro temporal por mes",
			enabled: availableFieldKeys.has("fecha"),
			reason: availableFieldKeys.has("fecha") ? "Se detecto fecha de ingreso." : "No se detecto fecha valida.",
		},
		{
			key: "por-estado",
			label: "Cuadro por estado",
			enabled: availableFieldKeys.has("estado"),
			reason: availableFieldKeys.has("estado") ? "Se detecto columna de estado." : "No se detecto estado.",
		},
		{
			key: "por-dias",
			label: "Cuadro por dias de atencion",
			enabled: availableFieldKeys.has("dias"),
			reason: availableFieldKeys.has("dias") ? "Se detecto columna de dias." : "No se detectaron dias.",
		},
		{
			key: "detalle-documento",
			label: "Cuadro de detalle documental",
			enabled: availableFieldKeys.has("documento") || availableFieldKeys.has("expediente"),
			reason:
				availableFieldKeys.has("documento") || availableFieldKeys.has("expediente")
					? "Se detecto expediente o documento."
					: "No se detecto documento o expediente.",
		},
	].filter((widget) => widget.enabled);

	return {
		headerRow,
		detectedFields,
		availableWidgets,
	};
}

function monthName(monthNumber) {
	return MONTHS_LABEL[Number(monthNumber)] || String(monthNumber || "");
}

function cleanText(v) {
	if (v === null || v === undefined) return "";
	if (typeof v === "string") return v.trim();
	if (typeof v === "number") return String(v);
	if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
	if (v instanceof Date) return v.toISOString();
	if (Array.isArray(v?.richText)) return v.richText.map((x) => x.text || "").join("").trim();
	if (v?.text) return String(v.text).trim();
	if (v?.result !== undefined && v?.result !== null) return cleanText(v.result);
	return String(v).trim();
}

function normalizeMateria(value) {
	const t = cleanText(value)
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
	if (!t) return "SIN MATERIA";
	if (t === "e") return "CIVIL";
	if (t === "f") return "LABORAL";
	if (t === "fc") return "FAMILIA CIVIL";
	if (t === "fp") return "FAMILIA PENAL";
	if (t === "ft") return "FAMILIA TUTELAR";
	if (t.includes("familia civil")) return "FAMILIA CIVIL";
	if (t.includes("familia penal")) return "FAMILIA PENAL";
	if (t.includes("familia tutelar")) return "FAMILIA TUTELAR";
	if (t === "familia") return "FAMILIA";
	if (t.includes("labor")) return "LABORAL";
	if (t.includes("civil")) return "CIVIL";
	if (t.includes("penal")) return "PENAL";
	if (t.includes("constitucional")) return "CONSTITUCIONAL";
	return cleanText(value).toUpperCase();
}

function inferMateriaFromLine(line, fallbackMateria) {
	const up = cleanText(line).toUpperCase();

	if (up.includes("FAMILIA CIVIL") || /-FC-/.test(up)) return "FAMILIA CIVIL";
	if (up.includes("FAMILIA PENAL") || /-FP-/.test(up)) return "FAMILIA PENAL";
	if (up.includes("FAMILIA TUTELAR") || /-FT-/.test(up)) return "FAMILIA TUTELAR";
	if (up.includes("LABORAL") || /-LA-/.test(up)) return "LABORAL";
	if (up.includes("CIVIL") || /-CI-/.test(up)) return "CIVIL";
	if (up.includes("PENAL") || /-PE-/.test(up)) return "PENAL";

	return normalizeMateria(fallbackMateria);
}

function inferMateriaFromExpedienteLine(line, fallbackMateria) {
	const up = cleanText(line).toUpperCase();
	if (/-CI-/.test(up)) return "CIVIL";
	if (/-FC-/.test(up)) return "FAMILIA CIVIL";
	if (/-FP-/.test(up)) return "FAMILIA PENAL";
	if (/-FT-/.test(up)) return "FAMILIA TUTELAR";
	if (/-LA-/.test(up)) return "LABORAL";
	if (/-PE-/.test(up)) return "PENAL";
	return inferMateriaFromLine(line, fallbackMateria);
}

function getOrderedMaterias(materias) {
	const unique = [...new Set((materias || []).map((materia) => normalizeMateria(materia)).filter(Boolean))];
	return unique.sort((a, b) => {
		const indexA = MATERIA_PREFERRED_ORDER.indexOf(a);
		const indexB = MATERIA_PREFERRED_ORDER.indexOf(b);
		if (indexA !== -1 || indexB !== -1) {
			return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
		}
		return a.localeCompare(b, "es");
	});
}

function filterRecordsByMaterias(records, materias) {
	const orderedMaterias = getOrderedMaterias(materias).filter((materia) => materia !== "SIN MATERIA");
	if (!orderedMaterias.length) return Array.isArray(records) ? [...records] : [];

	const allowed = new Set(orderedMaterias);
	return (records || []).filter((record) => allowed.has(normalizeMateria(record.materia)));
}

function filterRecordsByEspecialistas(records, especialistas) {
	if (!Array.isArray(especialistas)) return Array.isArray(records) ? [...records] : [];
	if (!especialistas.length) return [];
	const allowed = new Set(especialistas.map((item) => String(item || "").trim().toUpperCase()));
	return (records || []).filter((record) => allowed.has(String(record.especialista || "").trim().toUpperCase()));
}

function detectMateriasFromRecords(records) {
	return getOrderedMaterias((records || []).map((record) => record.materia)).filter(
		(materia) => materia && materia !== "SIN MATERIA"
	);
}

function normalizePersonName(text) {
	return cleanText(text)
		.toUpperCase()
		.replace(/\./g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function isResolvedSpecialistName(name) {
	const n = normalizePersonName(name);
	return Boolean(n && n !== "SIN ESPECIALISTA");
}

function looksLikeSpecialistLine(text) {
	const n = normalizePersonName(text);
	if (!n) return false;
	if (/\d/.test(n)) return false;
	if (n.includes("TOTAL DE ESCRITOS")) return false;
	if (n.includes("ESPECIALIDAD") || n.includes("JUZGADO")) return false;
	return n.split(" ").length >= 3;
}

function parseDateToYearMonth(raw) {
	if (!raw && raw !== 0) return null;
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		return { year: raw.getFullYear(), month: raw.getMonth() + 1 };
	}
	if (typeof raw === "number" && Number.isFinite(raw)) {
		// Serial de Excel
		const excelEpoch = new Date(Date.UTC(1899, 11, 30));
		const ms = Math.floor(raw * 24 * 60 * 60 * 1000);
		const d = new Date(excelEpoch.getTime() + ms);
		if (!Number.isNaN(d.getTime())) return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
	}

	const text = cleanText(raw);
	if (!text) return null;

	const m1 = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
	if (m1) {
		const month = Number(m1[2]);
		const year = Number(m1[3]);
		if (month >= 1 && month <= 12) return { year, month };
	}

	const m2 = text.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (m2) {
		const month = Number(m2[2]);
		const year = Number(m2[1]);
		if (month >= 1 && month <= 12) return { year, month };
	}

	return null;
}

function normalizeHeader(text) {
	return cleanText(text)
		.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function parseRawDate(raw) {
	if (raw === null || raw === undefined || raw === "") return null;
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

	if (typeof raw === "number" && Number.isFinite(raw)) {
		const excelEpoch = new Date(Date.UTC(1899, 11, 30));
		const ms = Math.floor(raw * 24 * 60 * 60 * 1000);
		const d = new Date(excelEpoch.getTime() + ms);
		if (!Number.isNaN(d.getTime())) return d;
	}

	const txt = cleanText(raw);
	if (!txt) return null;

	const m1 = txt.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
	if (m1) {
		const dd = Number(m1[1]);
		const mm = Number(m1[2]) - 1;
		const yy = Number(m1[3]);
		const hh = Number(m1[4] || 0);
		const mi = Number(m1[5] || 0);
		const ss = Number(m1[6] || 0);
		const d = new Date(yy, mm, dd, hh, mi, ss);
		if (!Number.isNaN(d.getTime())) return d;
	}

	const m2 = txt.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
	if (m2) {
		const yy = Number(m2[1]);
		const mm = Number(m2[2]) - 1;
		const dd = Number(m2[3]);
		const hh = Number(m2[4] || 0);
		const mi = Number(m2[5] || 0);
		const ss = Number(m2[6] || 0);
		const d = new Date(yy, mm, dd, hh, mi, ss);
		if (!Number.isNaN(d.getTime())) return d;
	}

	const fallback = new Date(txt);
	return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function findReportStyleColumnMap(worksheet) {
	if (!worksheet) return { headerRow: null, columnMap: null };

	const maxRow = Math.min(worksheet.rowCount || 0, 40);
	const maxCol = Math.min(worksheet.columnCount || 0, 20);
	let best = null;

	for (let row = 1; row <= maxRow; row += 1) {
		const found = {};
		let score = 0;

		for (let col = 1; col <= maxCol; col += 1) {
			const normalized = normalizeHeader(worksheet.getCell(row, col).value);
			if (!normalized) continue;

			for (const [key, aliases] of Object.entries(REPORT_STYLE_VARIABLE_ALIASES)) {
				if (found[key]) continue;
				if (aliases.includes(normalized)) {
					found[key] = col;
					score += 1;
				}
			}
		}

		if (found.fecha) score += 3;
		if (found.tipo) score += 2;
		if (found.documento || found.expediente) score += 2;

		if (!best || score > best.score) {
			best = { row, found, score };
		}
	}

	if (!best || !best.found.fecha || !best.found.tipo || (!best.found.documento && !best.found.expediente)) {
		return { headerRow: null, columnMap: null };
	}

	return { headerRow: best.row, columnMap: best.found };
}

function findLabeledValueInRow(worksheet, row, aliases) {
	const maxCol = Math.min(worksheet.columnCount || 0, 20);
	for (let col = 1; col <= maxCol; col += 1) {
		const normalized = normalizeHeader(worksheet.getCell(row, col).value);
		if (!aliases.includes(normalized)) continue;

		const right = findNeighborValue(worksheet, row, col);
		if (right) return right;
		const below = findFirstNonEmptyBelow(worksheet, row, col);
		if (below) return below;
	}
	return "";
}

function parseExcelRowsFromReportLayout(worksheet) {
	if (!worksheet) return [];

	const { headerRow, columnMap } = findReportStyleColumnMap(worksheet);
	if (!headerRow || !columnMap?.fecha || !columnMap?.tipo) return [];

	const rows = [];
	let currentJuzgado = "";
	let currentEspecialista = "";
	let currentMateria = "";

	for (let row = 1; row <= worksheet.rowCount; row += 1) {
		const flat = [];
		for (let col = 1; col <= Math.min(worksheet.columnCount || 0, 20); col += 1) {
			const value = cleanText(worksheet.getCell(row, col).value);
			if (value) flat.push(value);
		}
		if (!flat.length) continue;

		const line = flat.join(" ").toUpperCase();
		const juzgado = extractOrganoJurisdiccional(line);
		if (juzgado) currentJuzgado = juzgado;

		const especialistaValue = findLabeledValueInRow(worksheet, row, EXCEL_VARIABLE_ALIASES.especialista.map(normalizeHeader));
		if (especialistaValue) currentEspecialista = normalizePersonName(especialistaValue);

		const materiaValue = findLabeledValueInRow(worksheet, row, EXCEL_VARIABLE_ALIASES.materia.map(normalizeHeader));
		if (materiaValue) currentMateria = normalizeMateria(materiaValue);

		if (row <= headerRow) continue;

		const fechaObj = parseRawDate(worksheet.getCell(row, columnMap.fecha).value);
		if (!fechaObj) continue;

		const expediente = columnMap.expediente ? cleanText(worksheet.getCell(row, columnMap.expediente).value) : "";
		const documento = columnMap.documento ? cleanText(worksheet.getCell(row, columnMap.documento).value) : "";
		const tipo = columnMap.tipo ? cleanText(worksheet.getCell(row, columnMap.tipo).value).toUpperCase() : "";

		if (!expediente && !documento) continue;

		rows.push({
			fecha: fechaObj,
			especialista: currentEspecialista || "SIN ESPECIALISTA",
			juzgado: currentJuzgado || "SIN JUZGADO",
			tipo,
			materia: currentMateria || normalizeMateria(tipo),
		});
	}

	return rows;
}

function parseExcelRowsFromFlatTable(worksheet) {
	if (!worksheet) return [];
	const maxRow = Math.min(worksheet.rowCount || 0, 140);
	const maxCol = Math.min(worksheet.columnCount || 0, 90);

	const { headerRow, headerMap } = findExcelHeaderMap(worksheet, CORE_EXCEL_HEADER_ALIASES);

	if (!headerRow || !headerMap || !headerMap.fecha || !headerMap.tipo || !headerMap.especialista) {
		return [];
	}

	const rows = [];
	let lastEspecialista = "";
	let lastJuzgado = "";

	for (let r = headerRow + 1; r <= worksheet.rowCount; r += 1) {
		const flat = [];
		for (let c = 1; c <= maxCol; c += 1) {
			const t = cleanText(worksheet.getCell(r, c).value);
			if (t) flat.push(t);
		}
		if (!flat.length) continue;

		const line = flat.join(" ").toUpperCase();
		if (
			line.includes("PODER JUDICIAL") ||
			line.includes("CORTE SUPERIOR") ||
			line.includes("REPORTE DE ESCRITO") ||
			line.includes("REPORTE DE DEMANDA") ||
			line.includes("ESCRITOS INGRESADOS") ||
			line.includes("DEMANDAS INGRESADAS") ||
			line.includes("DESDE ") ||
			line.includes(" HASTA ") ||
			line.includes("PAG ") ||
			line.includes("N EXPEDIENTE") ||
			line.includes("F RESPUESTA") ||
			line.includes("ESTADO")
		) {
			continue;
		}

		const fechaRaw = worksheet.getCell(r, headerMap.fecha).value;
		const espRaw = worksheet.getCell(r, headerMap.especialista).value;
		const juzRaw = headerMap.juzgado ? worksheet.getCell(r, headerMap.juzgado).value : "";
		const tipoRaw = worksheet.getCell(r, headerMap.tipo).value;

		let especialista = normalizePersonName(espRaw);
		let juzgado = cleanText(juzRaw);
		const tipo = cleanText(tipoRaw).toUpperCase();
		const fechaObj = parseRawDate(fechaRaw);

		if (especialista) lastEspecialista = especialista;
		else especialista = lastEspecialista;

		if (juzgado) lastJuzgado = juzgado;
		else juzgado = lastJuzgado;

		if (!fechaObj || !tipo || !especialista) continue;

		rows.push({
			fecha: fechaObj,
			especialista,
			juzgado: juzgado || "SIN JUZGADO",
			tipo,
		});
	}

	return rows;
}

function parseExcelRowsFlexible(worksheet) {
	const flatRows = parseExcelRowsFromFlatTable(worksheet);
	if (flatRows.length) return flatRows;
	return parseExcelRowsFromReportLayout(worksheet);
}

function parseExcelToRecords(worksheet) {
	const rawRows = parseExcelRowsFlexible(worksheet);
	if (!rawRows.length) return [];

	const mapped = rawRows.map((r) => ({
		anio: r.fecha.getFullYear(),
		mes: r.fecha.getMonth() + 1,
		juzgado: r.juzgado,
		especialista: r.especialista,
		materia: normalizeMateria(r.tipo || r.materia),
		cantidad: 1,
	}));

	return aggregateRecords(mapped);
}

function parseExcelWorkbookToRecords(workbook) {
	if (!workbook || !Array.isArray(workbook.worksheets)) return [];
	const merged = [];

	for (const ws of workbook.worksheets) {
		const wsRecords = parseExcelToRecords(ws);
		if (wsRecords.length) merged.push(...wsRecords);
	}

	return aggregateRecords(merged);
}

function aggregateRecords(records) {
	const map = new Map();
	for (const r of records) {
		const anio = Number(r.anio);
		const mesRaw = cleanText(r.mes).toLowerCase();
		const mesNum = MONTHS_ORDER[mesRaw] || Number(r.mes) || null;
		if (!anio || !mesNum) continue;

		const item = {
			anio,
			mes: mesNum,
			juzgado: cleanText(r.juzgado) || "SIN JUZGADO",
			especialista: cleanText(r.especialista) || "SIN ESPECIALISTA",
			materia: normalizeMateria(r.materia),
			cantidad: Number(r.cantidad) || 0,
		};

		const key = `${item.anio}|${item.mes}|${item.juzgado}|${item.especialista}|${item.materia}`;
		map.set(key, (map.get(key) || 0) + item.cantidad);
	}

	const out = [];
	for (const [key, cantidad] of map.entries()) {
		const [anio, mes, juzgado, especialista, materia] = key.split("|");
		out.push({
			anio: Number(anio),
			mes: Number(mes),
			juzgado,
			especialista,
			materia,
			cantidad,
		});
	}

	out.sort((a, b) => {
		if (a.juzgado !== b.juzgado) return a.juzgado.localeCompare(b.juzgado, "es");
		if (a.especialista !== b.especialista) return a.especialista.localeCompare(b.especialista, "es");
		if (a.anio !== b.anio) return a.anio - b.anio;
		if (a.mes !== b.mes) return a.mes - b.mes;
		return a.materia.localeCompare(b.materia, "es");
	});

	return out;
}

async function parsePdfToRecords(pdfBuffer) {
	const parser = new PDFParse({ data: pdfBuffer });
	const parsed = await parser.getText();
	await parser.destroy();
	const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : [{ text: parsed.text || "" }];
	console.log(`[PDF Parser] Paginas detectadas: ${pages.length}`);

	let currentJuzgado = "SIN JUZGADO";
	let currentMateria = "SIN MATERIA";
	let currentEspecialista = "";

	const raw = [];
	let pendingEntries = [];

	const flushPending = (forcedEspecialista, expectedCount) => {
		if (!pendingEntries.length) return;
		const esp = normalizePersonName(forcedEspecialista || currentEspecialista || "");
		if (!isResolvedSpecialistName(esp)) {
			return;
		}
		if (typeof expectedCount === "number" && expectedCount !== pendingEntries.length) {
			console.log(
				`[PDF Parser] Diferencia detectada para ${esp}: entradas=${pendingEntries.length}, total_reportado=${expectedCount}`
			);
		}
		for (const e of pendingEntries) {
			raw.push({
				anio: e.anio,
				mes: e.mes,
				juzgado: e.juzgado || "SIN JUZGADO",
				especialista: esp,
				materia: e.materia || "SIN MATERIA",
				cantidad: 1,
			});
		}
		pendingEntries = [];
	};

	for (const page of pages) {
		const lines = cleanText(page.text)
			.split(/\r?\n/)
			.map((l) => l.replace(/\s+/g, " ").trim())
			.filter(Boolean);

		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];
			const up = line.toUpperCase();
			if (
				up.includes("PODER JUDICIAL") ||
				up.includes("CORTE SUPERIOR") ||
				PDF_SECTION_HEADER_MARKERS.some((marker) => up.includes(marker)) ||
				up.includes("DESDE ") ||
				up.includes(" HASTA ") ||
				up.includes("PAG ")
			) {
				continue;
			}

			const nextJuzgado = extractOrganoJurisdiccional(line);
			if (nextJuzgado) {
				if (nextJuzgado && nextJuzgado !== currentJuzgado && isResolvedSpecialistName(currentEspecialista)) {
					flushPending(currentEspecialista);
				}
				currentJuzgado = nextJuzgado || currentJuzgado;
				continue;
			}

			const materiaMatch = line.match(
				/ESPECIALIDAD\s+([A-ZÁÉÍÓÚÑ ]+?)(?=\s+(?:RELATOR|ESPECIALISTA\s+LEGAL)\b|$)/i
			);
			if (materiaMatch) {
				const nextMateria = normalizeMateria(materiaMatch[1]);
				if (nextMateria !== currentMateria && isResolvedSpecialistName(currentEspecialista)) {
					flushPending(currentEspecialista);
				}
				currentMateria = nextMateria;

				// Algunos PDFs colocan "ESPECIALIDAD ... RELATOR ..." en la misma linea.
				const inlineEspecialistaMatch = line.match(/(?:ESPECIALISTA\s+LEGAL|RELATOR)\s+(.+)/i);
				if (inlineEspecialistaMatch) {
					const nextEspecialista = normalizePersonName(inlineEspecialistaMatch[1]);
					if (isResolvedSpecialistName(currentEspecialista) && nextEspecialista !== currentEspecialista) {
						flushPending(currentEspecialista);
					}
					currentEspecialista = nextEspecialista;
				}

				continue;
			}

			const especialistaMatch = line.match(/(?:ESPECIALISTA\s+LEGAL|RELATOR)\s*:?\s+(.+)/i);
			if (especialistaMatch) {
				const nextEspecialista = normalizePersonName(especialistaMatch[1]);
				if (isResolvedSpecialistName(currentEspecialista) && nextEspecialista !== currentEspecialista) {
					flushPending(currentEspecialista);
				}
				currentEspecialista = nextEspecialista;
				continue;
			}

			if (/^ESPECIALISTA\s+LEGAL:?$/i.test(up)) {
				const nextLine = lines[index + 1] || "";
				if (nextLine && looksLikeSpecialistLine(nextLine)) {
					const nextEspecialista = normalizePersonName(nextLine);
					if (isResolvedSpecialistName(currentEspecialista) && nextEspecialista !== currentEspecialista) {
						flushPending(currentEspecialista);
					}
					currentEspecialista = nextEspecialista;
					index += 1;
					continue;
				}
			}

			if (/^RELATOR:?$/i.test(up)) {
				const nextLine = lines[index + 1] || "";
				if (nextLine && looksLikeSpecialistLine(nextLine)) {
					const nextEspecialista = normalizePersonName(nextLine);
					if (isResolvedSpecialistName(currentEspecialista) && nextEspecialista !== currentEspecialista) {
						flushPending(currentEspecialista);
					}
					currentEspecialista = nextEspecialista;
					index += 1;
					continue;
				}
			}

			const totalMatch = line.match(PDF_TOTAL_BY_SPECIALIST_REGEX);
			if (totalMatch) {
				const espFromTotal = normalizePersonName(totalMatch[1]);
				const totalReportado = Number(totalMatch[2]);
				flushPending(espFromTotal, totalReportado);
				currentEspecialista = espFromTotal || currentEspecialista;
				continue;
			}

			const dateTimeMatches = [...line.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/g)];
			if (!dateTimeMatches.length) continue;

			// En algunos PDFs la línea del expediente no cumple siempre el mismo patrón,
			// pero la marca fecha+hora sí representa un ingreso válido.
			if (/TOTAL\s+DE\s+(?:ESCRITOS|DEMANDAS)/i.test(up)) continue;

			for (const match of dateTimeMatches) {
				const dm = parseDateToYearMonth(match[1]);
				if (!dm) continue;
				pendingEntries.push({
					anio: dm.year,
					mes: dm.month,
					juzgado: currentJuzgado,
					materia: currentMateria && currentMateria !== "SIN MATERIA"
						? currentMateria
						: inferMateriaFromExpedienteLine(line, currentMateria),
				});
			}
		}
	}

	flushPending(currentEspecialista);

	return aggregateRecords(
		raw.filter((item) => isResolvedSpecialistName(item.especialista))
	);
}

async function detectPdfReportKind(pdfBuffer) {
	const parser = new PDFParse({ data: pdfBuffer });
	const parsed = await parser.getText();
	await parser.destroy();

	const text = cleanText(parsed.text || "").toUpperCase();
	const demandasHeaders = (text.match(/DEMANDAS\s+INGRESADAS/g) || []).length;
	const escritosHeaders = (text.match(/ESCRITOS\s+INGRESADOS/g) || []).length;

	if (demandasHeaders > escritosHeaders) return "DEMANDA";
	if (escritosHeaders > demandasHeaders) return "ESCRITO";

	if (/TOTAL\s+DE\s+DEMANDAS/i.test(text)) return "DEMANDA";
	if (/TOTAL\s+DE\s+ESCRITOS/i.test(text)) return "ESCRITO";

	return "INGRESO";
}

function normalizeJuzgadoName(text) {
	return cleanText(text)
		.toUpperCase()
		.replace(/\s+-\s+SEDE.+$/i, "")
		.replace(/\s+/g, " ")
		.trim();
}

function extractOrganoJurisdiccional(line) {
	const text = cleanText(line);
	if (!text) return "";

	const juzgadoMatch = text.match(/\d+\s*°?\s*JUZGADO[^\n]*/i);
	if (juzgadoMatch) return normalizeJuzgadoName(juzgadoMatch[0]);

	const salaMatch = text.match(/(?:\d+\s*°?\s*)?SALA\s+[A-ZÁÉÍÓÚÑ ]+\s*-\s*SEDE[^\n]*/i);
	if (salaMatch) return normalizeJuzgadoName(salaMatch[0]);

	return "";
}

function extractReportedTotalsFromLines(pageLines) {
	const specialistTotals = new Map();
	const juzgadoTotals = new Map();
	let currentJuzgado = "SIN JUZGADO";

	for (const lines of pageLines) {
		for (const rawLine of lines) {
			const line = cleanText(rawLine);
			if (!line) continue;

			const organo = extractOrganoJurisdiccional(line);
			if (organo) {
				currentJuzgado = organo;
			}

			const espTotalMatch = line.match(PDF_TOTAL_BY_SPECIALIST_REGEX);
			if (espTotalMatch) {
				const especialista = normalizePersonName(espTotalMatch[1]);
				const total = Number(espTotalMatch[2]) || 0;
				const key = `${currentJuzgado}|${especialista}`;
				specialistTotals.set(key, (specialistTotals.get(key) || 0) + total);
				continue;
			}

			const juzTotalMatch = line.match(PDF_TOTAL_BY_JUZGADO_REGEX);
			if (juzTotalMatch) {
				const juzgado = normalizeJuzgadoName(juzTotalMatch[1]) || currentJuzgado;
				const total = Number(juzTotalMatch[2]) || 0;
				juzgadoTotals.set(juzgado, (juzgadoTotals.get(juzgado) || 0) + total);
			}
		}
	}

	return { specialistTotals, juzgadoTotals };
}

function buildPdfTotalsValidation(records, reportedTotals) {
	const computedSpecialistTotals = new Map();
	const computedJuzgadoTotals = new Map();

	for (const item of records) {
		const juzgado = normalizeJuzgadoName(item.juzgado || "SIN JUZGADO");
		const especialista = normalizePersonName(item.especialista || "SIN ESPECIALISTA");
		const cantidad = Number(item.cantidad) || 0;
		const espKey = `${juzgado}|${especialista}`;

		computedSpecialistTotals.set(espKey, (computedSpecialistTotals.get(espKey) || 0) + cantidad);
		computedJuzgadoTotals.set(juzgado, (computedJuzgadoTotals.get(juzgado) || 0) + cantidad);
	}

	const specialistMismatches = [];
	for (const [key, expected] of reportedTotals.specialistTotals.entries()) {
		const actual = computedSpecialistTotals.get(key) || 0;
		if (actual !== expected) {
			const [juzgado, especialista] = key.split("|");
			specialistMismatches.push({ juzgado, especialista, expected, actual, delta: actual - expected });
		}
	}

	const juzgadoMismatches = [];
	for (const [juzgado, expected] of reportedTotals.juzgadoTotals.entries()) {
		const actual = computedJuzgadoTotals.get(juzgado) || 0;
		if (actual !== expected) {
			juzgadoMismatches.push({ juzgado, expected, actual, delta: actual - expected });
		}
	}

	const hasMismatches = specialistMismatches.length > 0 || juzgadoMismatches.length > 0;

	const formatDelta = (delta) => (delta > 0 ? `+${delta}` : `${delta}`);
	const specialistDetails = specialistMismatches.slice(0, 3).map((item) => {
		return `Esp: ${item.especialista} | Juz: ${item.juzgado} | PDF=${item.expected} | Sistema=${item.actual} | Delta=${formatDelta(item.delta)}`;
	});
	const juzgadoDetails = juzgadoMismatches.slice(0, 3).map((item) => {
		return `Juz: ${item.juzgado} | PDF=${item.expected} | Sistema=${item.actual} | Delta=${formatDelta(item.delta)}`;
	});
	const detailLines = [...specialistDetails, ...juzgadoDetails];
	const detailSummary = detailLines.length
		? detailLines.join(" || ")
		: "Sin diferencias en detalle.";

	const summary = hasMismatches
		? `Advertencia: ${specialistMismatches.length} diferencias por especialista y ${juzgadoMismatches.length} diferencias por juzgado frente a totales del PDF.`
		: "Validacion OK: los totales parseados coinciden con los totales reportados por el PDF.";

	return {
		hasMismatches,
		specialistMismatches,
		juzgadoMismatches,
		detailSummary,
		summary,
	};
}

async function validatePdfTotalsWithRecords(pdfBuffer, records) {
	const parser = new PDFParse({ data: pdfBuffer });
	const parsed = await parser.getText();
	await parser.destroy();

	const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : [{ text: parsed.text || "" }];
	const pageLines = pages.map((page) =>
		cleanText(page.text)
			.split(/\r?\n/)
			.map((l) => l.replace(/\s+/g, " ").trim())
			.filter(Boolean)
	);

	const reportedTotals = extractReportedTotalsFromLines(pageLines);
	return buildPdfTotalsValidation(records, reportedTotals);
}

function buildVisualMatrixWorkbook(records, reportKind = "ESCRITO") {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet("REPORTE_MATRIZ");
	const normalizedKind = String(reportKind || "ESCRITO").toUpperCase();
	const titleWord =
		normalizedKind === "DEMANDA"
			? "DE DEMANDA"
			: normalizedKind === "INGRESO"
			? "DE INGRESO"
			: "DE ESCRITO";

	if (!records.length) {
		ws.getCell("A1").value = "No se encontraron datos para generar el reporte.";
		return wb;
	}

	const byJuzgado = new Map();
	for (const r of records) {
		if (!byJuzgado.has(r.juzgado)) byJuzgado.set(r.juzgado, []);
		byJuzgado.get(r.juzgado).push(r);
	}

	let row = 3;
	const sortedJuzgados = [...byJuzgado.keys()].sort((a, b) => a.localeCompare(b, "es"));

	// En Excel priorizamos continuidad visual (similar a PDF cuando entra en una sola vista)
	// y evitamos partir por cada mes.
	const MAX_MONTHS_PER_CHUNK = 12;

	for (const juzgado of sortedJuzgados) {
		const list = byJuzgado.get(juzgado);
		const specialists = [...new Set(list.map((x) => x.especialista))].sort((a, b) =>
			a.localeCompare(b, "es")
		);
		const materias = getOrderedMaterias(list.map((x) => x.materia));

		const monthSet = new Set(list.map((x) => `${x.anio}-${String(x.mes).padStart(2, "0")}`));
		const months = [...monthSet]
			.map((k) => ({
				key: k,
				anio: Number(k.slice(0, 4)),
				mes: Number(k.slice(5, 7)),
			}))
			.sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes));

		// Mantener bloques amplios para que un mismo anio salga en una sola tabla cuando sea posible.
		const maxMonthsPerChunk = Math.max(1, MAX_MONTHS_PER_CHUNK);

		const monthChunks = [];
		for (let i = 0; i < months.length; i += maxMonthsPerChunk) {
			monthChunks.push(months.slice(i, i + maxMonthsPerChunk));
		}

		const countMap = new Map();
		for (const item of list) {
			const key = `${item.especialista}|${item.anio}|${item.mes}|${item.materia}`;
			countMap.set(key, (countMap.get(key) || 0) + item.cantidad);
		}

		for (const [chunkIndex, chunkMonths] of monthChunks.entries()) {
			const colStart = 2;
			let col = colStart;
			const monthRanges = [];

			for (const m of chunkMonths) {
				const ini = col;
				for (const _mat of materias) col += 1;
				monthRanges.push({ ...m, ini, fin: col - 1 });
			}

			const totalCol = col;
			const titleRow = row;
			const yearRow = row + 1;
			const monthRow = row + 2;
			const materiaRow = row + 3;
			const dataStartRow = row + 4;
			const monthBandFills = ["FFF3F8FF", "FFEAF4FF"];

			const chunkSuffix = monthChunks.length > 1 ? ` (${chunkIndex + 1}/${monthChunks.length})` : "";
			ws.mergeCells(titleRow, 1, titleRow, totalCol);
			ws.getCell(titleRow, 1).value = `REPORTE ${titleWord} ${juzgado}${chunkSuffix}`;
			ws.getCell(titleRow, 1).alignment = { horizontal: "center", vertical: "middle" };
			ws.getCell(titleRow, 1).fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FF0F2D4A" },
			};
			ws.getCell(titleRow, 1).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };

			ws.mergeCells(yearRow, 1, materiaRow, 1);
			ws.getCell(yearRow, 1).value = "ESPECIALISTAS";
			ws.getCell(yearRow, 1).alignment = { horizontal: "center", vertical: "middle" };
			ws.getCell(yearRow, 1).font = { bold: true };
			ws.getCell(yearRow, 1).fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FFDCE6F2" },
			};

			const years = [...new Set(chunkMonths.map((m) => m.anio))];
			for (const y of years) {
				const ms = monthRanges.filter((m) => m.anio === y);
				if (!ms.length) continue;
				ws.mergeCells(yearRow, ms[0].ini, yearRow, ms[ms.length - 1].fin);
				ws.getCell(yearRow, ms[0].ini).value = `AÑO ${y}`;
				ws.getCell(yearRow, ms[0].ini).alignment = { horizontal: "center", vertical: "middle" };
				ws.getCell(yearRow, ms[0].ini).fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: y % 2 === 0 ? "FFE2F0D9" : "FFFCE4D6" },
				};
				ws.getCell(yearRow, ms[0].ini).font = { bold: true };
			}

			for (const [monthIndex, m] of monthRanges.entries()) {
				ws.mergeCells(monthRow, m.ini, monthRow, m.fin);
				ws.getCell(monthRow, m.ini).value = monthName(m.mes);
				ws.getCell(monthRow, m.ini).alignment = { horizontal: "center", vertical: "middle" };
				ws.getCell(monthRow, m.ini).fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: monthIndex % 2 === 0 ? "FFDCE6F2" : "FFD3E3F6" },
				};
				ws.getCell(monthRow, m.ini).font = { bold: true };
				let c = m.ini;
				for (const mat of materias) {
					ws.getCell(materiaRow, c).value = mat;
					ws.getCell(materiaRow, c).alignment = { horizontal: "center", vertical: "middle" };
					ws.getCell(materiaRow, c).fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: monthIndex % 2 === 0 ? "FFEFF4FA" : "FFE6EFFA" },
					};
					ws.getCell(materiaRow, c).font = { bold: true };
					c += 1;
				}
			}

			ws.mergeCells(yearRow, totalCol, materiaRow, totalCol);
			ws.getCell(yearRow, totalCol).value = "TOTAL";
			ws.getCell(yearRow, totalCol).alignment = { horizontal: "center", vertical: "middle" };
			ws.getCell(yearRow, totalCol).fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FFFDE2E2" },
			};
			ws.getCell(yearRow, totalCol).font = { bold: true };

			let r = dataStartRow;
			for (const esp of specialists) {
				ws.getCell(r, 1).value = esp;
				ws.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle" };
				ws.getCell(r, 1).fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: r % 2 === 0 ? "FFF8FBFF" : "FFFFFFFF" },
				};
				let rowTotal = 0;
				for (const [monthIndex, m] of monthRanges.entries()) {
					let c = m.ini;
					for (const mat of materias) {
						const val = countMap.get(`${esp}|${m.anio}|${m.mes}|${mat}`) || 0;
						ws.getCell(r, c).value = val;
						ws.getCell(r, c).numFmt = "0";
						ws.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
						ws.getCell(r, c).fill = {
							type: "pattern",
							pattern: "solid",
							fgColor: {
								argb: r % 2 === 0 ? monthBandFills[monthIndex % 2] : monthIndex % 2 === 0 ? "FFFFFFFF" : "FFFAFCFF",
							},
						};
						rowTotal += val;
						c += 1;
					}
				}
				ws.getCell(r, totalCol).value = rowTotal;
				ws.getCell(r, totalCol).numFmt = "0";
				ws.getCell(r, totalCol).alignment = { horizontal: "center", vertical: "middle" };
				ws.getCell(r, totalCol).fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFFFF1F2" },
				};
				r += 1;
			}

			ws.getCell(r, 1).value = "TOTAL";
			ws.getCell(r, 1).font = { bold: true };
			ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
			let grand = 0;
			for (let c = colStart; c <= totalCol; c += 1) {
				let colTotal = 0;
				for (let rr = dataStartRow; rr < r; rr += 1) {
					colTotal += Number(ws.getCell(rr, c).value) || 0;
				}
				ws.getCell(r, c).value = colTotal;
				ws.getCell(r, c).font = { bold: true };
				ws.getCell(r, c).numFmt = "0";
				ws.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
				ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
				if (c < totalCol) grand += colTotal;
			}
			ws.getCell(r, totalCol).value = grand;

			for (let rr = yearRow; rr <= r; rr += 1) {
				for (let cc = 1; cc <= totalCol; cc += 1) {
					const cell = ws.getCell(rr, cc);
					cell.border = {
						top: { style: "thin", color: { argb: "FFB6BCC7" } },
						left: { style: "thin", color: { argb: "FFB6BCC7" } },
						bottom: { style: "thin", color: { argb: "FFB6BCC7" } },
						right: { style: "thin", color: { argb: "FFB6BCC7" } },
					};
				}
			}

			for (const m of monthRanges) {
				for (let rr = yearRow; rr <= r; rr += 1) {
					const endCell = ws.getCell(rr, m.fin);
					endCell.border = {
						...endCell.border,
						right: { style: "thick", color: { argb: "FF334155" } },
					};

					if (m.ini > colStart) {
						const startCell = ws.getCell(rr, m.ini);
						startCell.border = {
							...startCell.border,
							left: { style: "thick", color: { argb: "FF334155" } },
						};
					}
				}
			}

			row = r + 3;
		}
	}

	ws.pageSetup = {
		orientation: "landscape",
		paperSize: 9,
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
	};

	ws.columns.forEach((c, idx) => {
		if (idx === 0) c.width = 34;
		else c.width = 14;
	});

	return wb;
}

function addSpecialistSummarySheet(workbook, records) {
	const ws = workbook.addWorksheet("RESUMEN_ESPECIALISTA");
	ws.columns = [
		{ header: "AÑO", key: "anio", width: 10 },
		{ header: "MES", key: "mes", width: 14 },
		{ header: "ESPECIALISTA", key: "especialista", width: 36 },
		{ header: "MATERIA", key: "materia", width: 14 },
		{ header: "CANTIDAD", key: "cantidad", width: 12 },
	];

	const grouped = new Map();
	for (const r of records) {
		const key = `${r.anio}|${r.mes}|${r.especialista}|${r.materia}`;
		grouped.set(key, (grouped.get(key) || 0) + (Number(r.cantidad) || 0));
	}

	const rows = [];
	for (const [k, cantidad] of grouped.entries()) {
		const [anio, mes, especialista, materia] = k.split("|");
		rows.push({
			anio: Number(anio),
			mes: monthName(Number(mes)),
			especialista,
			materia,
			cantidad,
		});
	}

	rows.sort((a, b) => {
		if (a.anio !== b.anio) return a.anio - b.anio;
		if (a.mes !== b.mes) return a.mes.localeCompare(b.mes, "es");
		if (a.especialista !== b.especialista) return a.especialista.localeCompare(b.especialista, "es");
		return a.materia.localeCompare(b.materia, "es");
	});

	for (const row of rows) ws.addRow(row);

	const header = ws.getRow(1);
	header.font = { bold: true, color: { argb: "FFFFFFFF" } };
	header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2D4A" } };
	header.alignment = { horizontal: "center", vertical: "middle" };
	ws.views = [{ state: "frozen", ySplit: 1 }];
	ws.autoFilter = "A1:E1";

	for (let r = 2; r <= ws.rowCount; r += 1) {
		for (let c = 1; c <= 5; c += 1) {
			ws.getCell(r, c).border = {
				top: { style: "thin", color: { argb: "FFE2E8F0" } },
				left: { style: "thin", color: { argb: "FFE2E8F0" } },
				bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
				right: { style: "thin", color: { argb: "FFE2E8F0" } },
			};
		}
		ws.getCell(r, 5).alignment = { horizontal: "center", vertical: "middle" };
		ws.getCell(r, 5).numFmt = "0";
	}
}

module.exports = {
	parsePdfToRecords,
	detectPdfReportKind,
	validatePdfTotalsWithRecords,
	extractReportedTotalsFromLines,
	buildPdfTotalsValidation,
	normalizeMateria,
	getOrderedMaterias,
	filterRecordsByMaterias,
	filterRecordsByEspecialistas,
	detectMateriasFromRecords,
	aggregateRecords,
	parseExcelToRecords,
	parseExcelWorkbookToRecords,
	buildVisualMatrixWorkbook,
	addSpecialistSummarySheet,
	analyzeExcelWorksheetStructure,
};
