const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fileUpload = require("express-fileupload");
const ExcelJS = require("exceljs");
const path = require("path");
const PDFDocument = require("pdfkit"); // NUEVO: generacion de PDF
const { analyzeExcelUpload } = require("./excel");
const {
	MATRIX_TYPES,
	buildMatrixReport,
	getMatrixFilterOptions,
	exportMatrixToExcelBuffer,
	exportMatrixToPdfBuffer,
} = require("./matrix/matrixReportService");
const { buildGroupedReportFromWorksheet } = require("./tabularReport"); // NUEVO: agrupacion tabular FECHA/ESPECIALISTA/JUZGADO/TIPO
const {
	parsePdfToRecords,
	detectPdfReportKind,
	validatePdfTotalsWithRecords,
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
} = require("./unifiedMatrix"); // NUEVO: matriz visual unificada para entrada PDF/Excel

const app = express();
const PORT = process.env.PORT || 4000;
const TRUST_PROXY = process.env.TRUST_PROXY || "1";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const FRONTEND_ORIGINS_RAW =
	process.env.FRONTEND_ORIGINS ||
	"http://localhost:3000,http://127.0.0.1:3000";
const ALLOWED_ORIGINS = new Set(
	String(FRONTEND_ORIGINS_RAW)
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean)
);

app.set("trust proxy", TRUST_PROXY === "true" ? true : Number(TRUST_PROXY) || 1);

app.use(
	helmet({
		crossOriginResourcePolicy: false,
	})
);

const globalLimiter = rateLimit({
	windowMs: RATE_LIMIT_WINDOW_MS,
	limit: RATE_LIMIT_MAX_REQUESTS,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: {
		message: "Demasiadas solicitudes desde tu IP. Intenta nuevamente en unos minutos.",
	},
});

app.use(globalLimiter);

app.use(
	cors({
		exposedHeaders: [
			"Content-Disposition",
			"Content-Type",
			"X-Reporte-Validacion",
			"X-Reporte-Validacion-Resumen",
			"X-Reporte-Validacion-Detalle",
		],
		origin: (origin, callback) => {
			// Permite requests sin origin (curl, health-check interno) y origins explícitamente autorizados.
			if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
			return callback(new Error("Origen no permitido por politica CORS."));
		},
	})
);

app.use(
	fileUpload({
		limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
		abortOnLimit: true,
	})
);

const MONTH_ORDER = {
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

function normalizeText(value) {
if (value === null || value === undefined) return "";
if (typeof value === "string") return value.trim();
if (typeof value === "number") return String(value);
if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
if (value instanceof Date) return value.toISOString();

if (Array.isArray(value.richText)) {
return value.richText.map((part) => part.text || "").join("").trim();
}

if (value.text) return String(value.text).trim();
if (value.result !== undefined && value.result !== null) {
return normalizeText(value.result);
}

return String(value).trim();
}

function lettersToColumn(letters) {
let column = 0;
const upper = (letters || "").toUpperCase();
for (let i = 0; i < upper.length; i += 1) {
column = column * 26 + (upper.charCodeAt(i) - 64);
}
return column;
}

function parseCellAddress(address) {
const match = String(address).match(/^([A-Z]+)(\d+)$/i);
if (!match) return null;
return { col: lettersToColumn(match[1]), row: Number(match[2]) };
}

function createMergeLookup(worksheet) {
const map = new Map();
const merges = worksheet?.model?.merges || [];

for (const merge of merges) {
const [startAddress, endAddress] = String(merge).split(":");
const start = parseCellAddress(startAddress);
const end = parseCellAddress(endAddress || startAddress);
if (!start || !end) continue;

const masterValue = normalizeText(worksheet.getCell(start.row, start.col).value);
if (!masterValue) continue;

for (let row = start.row; row <= end.row; row += 1) {
for (let col = start.col; col <= end.col; col += 1) {
map.set(`${row}:${col}`, masterValue);
}
}
}

return map;
}

function getCellText(worksheet, row, col, mergeLookup) {
const cell = worksheet.getCell(row, col);
const direct = normalizeText(cell.value);
if (direct) return direct;

if (cell.type === ExcelJS.ValueType.Merge && cell.master) {
const master = normalizeText(cell.master.value);
if (master) return master;
}

return mergeLookup.get(`${row}:${col}`) || "";
}

function parseMonth(text) {
if (!text) return null;
const key = text
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.trim();
return MONTH_ORDER[key] ? key : null;
}

function parseMateria(text) {
if (!text) return null;
const materia = normalizeMateria(text);
return materia === "SIN MATERIA" ? null : materia;
}

function parseYear(text) {
if (!text) return null;
const match = text.match(/(19\d{2}|20\d{2})/);
return match ? Number(match[1]) : null;
}

function parseNumber(value) {
if (typeof value === "number" && Number.isFinite(value)) return value;
const text = normalizeText(value);
if (!text) return null;
const cleaned = text.replace(/[^\d.-]/g, "");
if (!cleaned) return null;
const num = Number(cleaned);
return Number.isFinite(num) ? num : null;
}

function monthNameFromValue(value) {
	const monthMap = {
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

	const n = Number(value);
	if (monthMap[n]) return monthMap[n];
	return value || "";
}

function findSectionTitles(worksheet, maxRow, maxCol, mergeLookup) {
const titles = [];
for (let row = 1; row <= maxRow; row += 1) {
for (let col = 1; col <= maxCol; col += 1) {
const text = getCellText(worksheet, row, col, mergeLookup).toUpperCase();
if (text.includes("REPORTE DE ESCRITO")) {
titles.push({ row, title: getCellText(worksheet, row, col, mergeLookup) });
break;
}
}
}
return titles;
}

function extractOrderedRecords(workbook) {
const worksheet = workbook.worksheets[0];
if (!worksheet) return [];

const maxRow = worksheet.rowCount || worksheet.actualRowCount || 0;
const maxCol = worksheet.columnCount || 0;
const mergeLookup = createMergeLookup(worksheet);

const titles = findSectionTitles(worksheet, maxRow, maxCol, mergeLookup);
const sections = titles.length
? titles.map((title, index) => ({
start: title.row,
end: index < titles.length - 1 ? titles[index + 1].row - 1 : maxRow,
juzgado: title.title.replace(/REPORTE DE ESCRITO\s*/i, "").trim() || title.title,
  }))
: [{ start: 1, end: maxRow, juzgado: "Sin Juzgado" }];

const records = [];

for (const section of sections) {
const searchLimit = Math.min(section.start + 10, section.end);
let monthRow = null;

for (let row = section.start; row <= searchLimit; row += 1) {
let monthCount = 0;
for (let col = 1; col <= maxCol; col += 1) {
if (parseMonth(getCellText(worksheet, row, col, mergeLookup))) monthCount += 1;
}
if (monthCount >= 2) {
monthRow = row;
break;
}
}

if (!monthRow) continue;

let materiaRow = null;
for (let row = monthRow; row <= Math.min(monthRow + 3, section.end); row += 1) {
let materiaCount = 0;
for (let col = 1; col <= maxCol; col += 1) {
if (parseMateria(getCellText(worksheet, row, col, mergeLookup))) materiaCount += 1;
}
if (materiaCount >= 2) {
materiaRow = row;
break;
}
}

if (!materiaRow) continue;

let especialistaCol = 1;
for (let row = section.start; row <= materiaRow; row += 1) {
for (let col = 1; col <= maxCol; col += 1) {
const text = getCellText(worksheet, row, col, mergeLookup).toUpperCase();
if (text.includes("ESPECIALISTA")) {
especialistaCol = col;
break;
}
}
}

const dataColumns = [];
let currentMonth = null;
let currentYear = null;

for (let col = 1; col <= maxCol; col += 1) {
const month = parseMonth(getCellText(worksheet, monthRow, col, mergeLookup));
if (month) currentMonth = month;

for (let row = section.start; row < monthRow; row += 1) {
const year = parseYear(getCellText(worksheet, row, col, mergeLookup));
if (year) {
currentYear = year;
break;
}
}

const materia = parseMateria(getCellText(worksheet, materiaRow, col, mergeLookup));
if (currentMonth && materia) {
dataColumns.push({ col, month: currentMonth, year: currentYear, materia });
}
}

if (!dataColumns.length) continue;

let emptyStreak = 0;
for (let row = materiaRow + 1; row <= section.end; row += 1) {
const especialista = getCellText(worksheet, row, especialistaCol, mergeLookup)
.replace(/\s+/g, " ")
.trim();
const rowUpper = especialista.toUpperCase();

if (rowUpper.includes("REPORTE DE ESCRITO")) break;
if (!especialista || rowUpper === "TOTAL") {
emptyStreak += 1;
if (emptyStreak >= 4) break;
continue;
}

emptyStreak = 0;

for (const colData of dataColumns) {
const value = worksheet.getCell(row, colData.col).value;
const cantidad = parseNumber(value);
if (cantidad === null) continue;

records.push({
anio: colData.year || "",
mes: colData.month ? colData.month[0].toUpperCase() + colData.month.slice(1) : "",
juzgado: section.juzgado,
especialista,
materia: colData.materia,
cantidad,
});
}
}
}

records.sort((a, b) => {
const yearA = Number(a.anio) || 0;
const yearB = Number(b.anio) || 0;
if (yearA !== yearB) return yearA - yearB;

const monthA = MONTH_ORDER[(a.mes || "").toLowerCase()] || 99;
const monthB = MONTH_ORDER[(b.mes || "").toLowerCase()] || 99;
if (monthA !== monthB) return monthA - monthB;

const juzgadoCmp = a.juzgado.localeCompare(b.juzgado, "es");
if (juzgadoCmp !== 0) return juzgadoCmp;

const espCmp = a.especialista.localeCompare(b.especialista, "es");
if (espCmp !== 0) return espCmp;

return a.materia.localeCompare(b.materia, "es");
});

return records;
}

/* ============================================================
   NUEVO: generatePDFReport(records) -> Promise<Buffer>
   Genera un PDF tabular agrupado por juzgado con subtotales
   y gran total. Orientacion horizontal (A4 landscape).
   ============================================================ */
function generatePDFReport(records, nombreArchivo, reportKind = "ESCRITO") {
	return new Promise((resolve, reject) => {
		const titleKind = String(reportKind || "ESCRITO").toUpperCase();
		const titleWord = titleKind === "DEMANDA" ? "DE DEMANDA" : titleKind === "INGRESO" ? "DE INGRESO" : "DE ESCRITO";
		const doc = new PDFDocument({
			size: "A4",
			layout: "landscape",
			margins: { top: 40, bottom: 40, left: 40, right: 40 },
			info: { Title: `DocuMind | Reporte ${titleWord}`, Creator: "DocuMind" },
		});

		const buffers = [];
		doc.on("data", (chunk) => buffers.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(buffers)));
		doc.on("error", reject);

		const margin = 24;
		const pageW = doc.page.width;
		const pageH = doc.page.height;
		const usableW = pageW - margin * 2;
		const colors = {
			title: "#0F2D4A",
			head: "#DCE6F2",
			subhead: "#EFF4FA",
			total: "#DBEAFE",
			white: "#FFFFFF",
			grid: "#B6BCC7",
			text: "#0F172A",
		};

		const grouped = new Map();
		for (const record of records) {
			if (!grouped.has(record.juzgado)) grouped.set(record.juzgado, []);
			grouped.get(record.juzgado).push(record);
		}

		const drawCell = (x, y, w, h, text, options = {}) => {
			const fill = options.fill || colors.white;
			doc.rect(x, y, w, h).fill(fill);
			doc.rect(x, y, w, h).strokeColor(colors.grid).lineWidth(0.5).stroke();
			doc
				.fillColor(options.color || colors.text)
				.font(options.bold ? "Helvetica-Bold" : "Helvetica")
				.fontSize(options.fontSize || 7)
				.text(String(text ?? ""), x + 2, y + 5, {
					width: w - 4,
					align: options.align || "center",
					lineBreak: false,
				});
		};

		const drawMonthSeparators = (rowY, rowH, boundaries) => {
			doc.save();
			doc.strokeColor("#334155").lineWidth(0.95);
			for (const x of boundaries) {
				doc.moveTo(x - 0.75, rowY).lineTo(x - 0.75, rowY + rowH).stroke();
				doc.moveTo(x + 0.75, rowY).lineTo(x + 0.75, rowY + rowH).stroke();
			}
			doc.restore();
		};

		const startNewPage = () => {
			doc.addPage({ size: "A4", layout: "landscape", margins: { top: margin, bottom: margin, left: margin, right: margin } });
			return margin;
		};

		let y = margin;
		for (const [juzgado, list] of grouped.entries()) {
			const specialists = [
				...new Set(
					list
						.map((x) => normalizeText(x.especialista))
						.filter((name) => Boolean(name))
				),
			].sort((a, b) => a.localeCompare(b, "es"));
			const months = [...new Set(list.map((x) => `${x.anio}-${String(x.mes).padStart(2, "0")}`))]
				.map((k) => ({ anio: Number(k.slice(0, 4)), mes: Number(k.slice(5, 7)) }))
				.sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes));
			const materias = getOrderedMaterias(list.map((x) => x.materia));
			const nameW = 150;
			const totalW = 50;
			const minColW = 34;
			const availableForMonths = usableW - nameW - totalW;
			const minWidthPerMonth = Math.max(1, materias.length) * minColW;
			const maxMonthsPerChunk = Math.max(1, Math.floor(availableForMonths / minWidthPerMonth));

			const monthChunks = [];
			for (let i = 0; i < months.length; i += maxMonthsPerChunk) {
				monthChunks.push(months.slice(i, i + maxMonthsPerChunk));
			}

			const countMap = new Map();
			for (const item of list) {
				const key = `${item.especialista}|${item.anio}|${item.mes}|${item.materia}`;
				countMap.set(key, (countMap.get(key) || 0) + (Number(item.cantidad) || 0));
			}

			for (const [chunkIndex, chunkMonths] of monthChunks.entries()) {
				const colW = Math.max(minColW, Math.floor(availableForMonths / Math.max(1, chunkMonths.length * materias.length)));
				const tableW = nameW + totalW + chunkMonths.length * materias.length * colW;
				const monthBoundariesX = [];
				let monthBoundaryCursor = margin + nameW;
				for (const _month of chunkMonths) {
					monthBoundaryCursor += materias.length * colW;
					monthBoundariesX.push(monthBoundaryCursor);
				}

				if (y + 120 > pageH - margin) y = startNewPage();

				const chunkSuffix = monthChunks.length > 1 ? ` (${chunkIndex + 1}/${monthChunks.length})` : "";
				drawCell(margin, y, tableW, 20, `REPORTE ${titleWord} ${juzgado}${chunkSuffix}`, {
					fill: colors.title,
					color: colors.white,
					bold: true,
					fontSize: 10,
				});
				y += 20;

				drawCell(margin, y, nameW, 52, "ESPECIALISTAS", { fill: colors.head, bold: true });
				let currentX = margin + nameW;
				const years = [...new Set(chunkMonths.map((m) => m.anio))];
				for (const year of years) {
					const yearMonths = chunkMonths.filter((m) => m.anio === year);
					drawCell(currentX, y, yearMonths.length * materias.length * colW, 16, `AÑO ${year}`, {
						fill: year % 2 === 0 ? "#E2F0D9" : "#FCE4D6",
						bold: true,
					});
					currentX += yearMonths.length * materias.length * colW;
				}
				drawCell(margin + nameW + chunkMonths.length * materias.length * colW, y, totalW, 52, "TOTAL", {
					fill: "#FDE2E2",
					bold: true,
				});
				y += 16;

				currentX = margin + nameW;
				for (const [monthIndex, month] of chunkMonths.entries()) {
					drawCell(currentX, y, materias.length * colW, 18, monthNameFromValue(month.mes), {
						fill: monthIndex % 2 === 0 ? colors.head : "#D3E3F6",
						bold: true,
					});
					currentX += materias.length * colW;
				}
				drawMonthSeparators(y, 18, monthBoundariesX);
				y += 18;

				currentX = margin + nameW;
				for (const [monthIndex, _month] of chunkMonths.entries()) {
					for (const materia of materias) {
						drawCell(currentX, y, colW, 18, materia, {
							fill: monthIndex % 2 === 0 ? colors.subhead : "#E6EFFA",
							bold: true,
							fontSize: 6.5,
						});
						currentX += colW;
					}
				}
				drawMonthSeparators(y, 18, monthBoundariesX);
				y += 18;

				for (const specialist of specialists) {
					if (y + 18 > pageH - margin) y = startNewPage();
					drawCell(margin, y, nameW, 18, specialist, { align: "left", fontSize: 6.8 });
					currentX = margin + nameW;
					let rowTotal = 0;
					for (const [monthIndex, month] of chunkMonths.entries()) {
						for (const materia of materias) {
							const value = countMap.get(`${specialist}|${month.anio}|${month.mes}|${materia}`) || 0;
							rowTotal += value;
							drawCell(currentX, y, colW, 18, value, {
								fontSize: 7,
								fill: monthIndex % 2 === 0 ? "#FFFFFF" : "#F7FAFF",
							});
							currentX += colW;
						}
					}
					drawMonthSeparators(y, 18, monthBoundariesX);
					drawCell(margin + nameW + chunkMonths.length * materias.length * colW, y, totalW, 18, rowTotal, {
						fill: "#FFF7F7",
						bold: true,
					});
					y += 18;
				}

				drawCell(margin, y, nameW, 18, "TOTAL", { fill: colors.total, bold: true });
				currentX = margin + nameW;
				let grandTotal = 0;
				for (const [monthIndex, month] of chunkMonths.entries()) {
					for (const materia of materias) {
						let subtotal = 0;
						for (const specialist of specialists) {
							subtotal += countMap.get(`${specialist}|${month.anio}|${month.mes}|${materia}`) || 0;
						}
						grandTotal += subtotal;
						drawCell(currentX, y, colW, 18, subtotal, {
							fill: monthIndex % 2 === 0 ? colors.total : "#D1E5FD",
							bold: true,
						});
						currentX += colW;
					}
				}
				drawMonthSeparators(y, 18, monthBoundariesX);
				drawCell(margin + nameW + chunkMonths.length * materias.length * colW, y, totalW, 18, grandTotal, {
					fill: colors.total,
					bold: true,
				});
				y += 26;
			}
		}

		doc.end();
	});
}

function getArchivoInfo(archivo) {
	if (!archivo) {
		const error = new Error("Debes enviar un archivo con el campo 'archivo'.");
		error.statusCode = 400;
		throw error;
	}

	const extension = path.extname(archivo.name || "").toLowerCase();
	const excelProcesable = [".xlsx", ".xls", ".xlsm", ".xltx", ".xltm", ".csv"];
	const permitido = [...excelProcesable, ".pdf"];

	if (!permitido.includes(extension)) {
		const error = new Error(
			"Formato no soportado. Usa PDF o Excel compatible (.xlsx, .xls, .xlsm, .xltx, .xltm, .csv)."
		);
		error.statusCode = 400;
		throw error;
	}

	const nombreBase = (archivo.name || "reporte")
		.replace(/\.[^/.]+$/, "")
		.replace(/[^a-zA-Z0-9-_]/g, "_");

	return { extension, nombreBase };
}

async function analyzeExcelUploadWithFallback(archivo, extension) {
	const intelligentAnalysis = await analyzeExcelUpload(archivo.data, archivo.name || `reporte${extension}`);
	if (intelligentAnalysis.normalizedRecords.length || extension === ".xls" || extension === ".csv") {
		return intelligentAnalysis;
	}

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(archivo.data);
	const worksheet = workbook.worksheets[0];
	const orderedRecords = extractOrderedRecords(workbook);
	const tabularResult = buildGroupedReportFromWorksheet(worksheet, workbook);
	const flexibleExcelRecords = parseExcelWorkbookToRecords(workbook);
	const fallbackRecords = flexibleExcelRecords.length
		? flexibleExcelRecords
		: tabularResult?.pdfRows?.length
		? aggregateRecords(tabularResult.pdfRows)
		: aggregateRecords(orderedRecords);

	return {
		...intelligentAnalysis,
		normalizedRecords: fallbackRecords,
	};
}

async function extractNormalizedRecordsFromUpload(archivo, extension) {
	if (extension === ".pdf") {
		return parsePdfToRecords(archivo.data);
	}

	const excelAnalysis = await analyzeExcelUploadWithFallback(archivo, extension);
	return excelAnalysis.normalizedRecords;
}

function buildPreviewSummary(records) {
	const porMateria = new Map();
	const porEspecialista = new Map();
	let totalRegistros = 0;

	for (const item of records || []) {
		const cantidad = Number(item.cantidad) || 0;
		totalRegistros += cantidad;

		const materia = normalizeMateria(item.materia || "SIN MATERIA");
		const especialista = normalizeText(item.especialista || "SIN ESPECIALISTA");

		porMateria.set(materia, (porMateria.get(materia) || 0) + cantidad);
		porEspecialista.set(especialista, (porEspecialista.get(especialista) || 0) + cantidad);
	}

	return {
		totalRegistros,
		porMateria: [...porMateria.entries()]
			.map(([materia, total]) => ({ materia, total }))
			.sort((a, b) => b.total - a.total),
		porEspecialista: [...porEspecialista.entries()]
			.map(([especialista, total]) => ({ especialista, total }))
			.sort((a, b) => b.total - a.total),
	};
}

function buildStructureValidation(extension, records, materias) {
	const warnings = [];
	const total = (records || []).reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
	const materiasValidas = (materias || []).filter((m) => m && m !== "SIN MATERIA");
	const especialistasValidos = (records || []).filter(
		(item) => normalizeText(item.especialista || "") && normalizeText(item.especialista || "") !== "SIN ESPECIALISTA"
	);

	let ok = true;
	let message = "Estructura valida para procesar.";

	if (!records?.length || total <= 0) {
		ok = false;
		message = "No se detectaron registros legibles en el archivo.";
	}

	if (ok && !materiasValidas.length) {
		warnings.push("No se detectaron materias claras; se intentara inferencia al procesar.");
	}

	if (ok && !especialistasValidos.length) {
		warnings.push("No se detectaron especialistas claros; revisa encabezados RELATOR/ESPECIALISTA.");
	}

	if (ok && extension === ".pdf" && total < 3) {
		warnings.push("El PDF tiene pocos registros detectados; valida que no sea una exportacion incompleta.");
	}

	return {
		ok,
		message,
		warnings,
	};
}

function buildStructureValidationWithExcelDiagnostics(extension, records, materias, excelAnalysis) {
	const validation = buildStructureValidation(extension, records, materias);
	if (extension === ".pdf" || !excelAnalysis?.diagnostics) return validation;

	if (!validation.ok) {
		validation.message = excelAnalysis.diagnostics.message || validation.message;
	}

	for (const reason of excelAnalysis.diagnostics.reasons || []) {
		if (!validation.warnings.includes(reason)) validation.warnings.push(reason);
	}

	return validation;
}

async function analyzeUploadWithPreview(archivo) {
	const { extension } = getArchivoInfo(archivo);
	let excelAnalysis = null;
	const normalizedRecords = extension === ".pdf"
		? await extractNormalizedRecordsFromUpload(archivo, extension)
		: (excelAnalysis = await analyzeExcelUploadWithFallback(archivo, extension)).normalizedRecords;
	const materias = detectMateriasFromRecords(normalizedRecords);
	const vistaPrevia = buildPreviewSummary(normalizedRecords);
	const prevalidacion = buildStructureValidationWithExcelDiagnostics(extension, normalizedRecords, materias, excelAnalysis);
	const excelInsights = extension === ".pdf"
		? null
		: {
			legacyWorksheetInsights: extension === ".xls" || extension === ".csv"
				? null
				: (() => {
					try {
						const workbook = new ExcelJS.Workbook();
						return workbook.xlsx.load(archivo.data).then((loadedWorkbook) => analyzeExcelWorksheetStructure(loadedWorkbook.worksheets[0], normalizedRecords)).catch(() => null);
					} catch (_error) {
						return null;
					}
				})(),
			workbookMeta: excelAnalysis?.workbookMeta || null,
			sheetInsights: excelAnalysis?.sheetInsights || [],
			normalizationPreview: excelAnalysis?.normalizationPreview || null,
			suggestedReports: excelAnalysis?.suggestedReports || [],
			metrics: excelAnalysis?.metrics || null,
			diagnostics: excelAnalysis?.diagnostics || null,
		};

	if (excelInsights?.legacyWorksheetInsights && typeof excelInsights.legacyWorksheetInsights.then === "function") {
		excelInsights.legacyWorksheetInsights = await excelInsights.legacyWorksheetInsights;
	}

	return {
		extension,
		materias,
		prevalidacion,
		vistaPrevia,
		excelInsights,
	};
}

function parseMateriasSolicitadas(rawMaterias) {
	if (!rawMaterias) return [];
	if (Array.isArray(rawMaterias)) return rawMaterias;
	try {
		const parsed = JSON.parse(rawMaterias);
		return Array.isArray(parsed) ? parsed : [];
	} catch (_error) {
		return String(rawMaterias)
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}
}

function parseEspecialistasSolicitados(rawEspecialistas) {
	if (!rawEspecialistas) return [];
	if (Array.isArray(rawEspecialistas)) return rawEspecialistas.filter(Boolean);
	try {
		const parsed = JSON.parse(rawEspecialistas);
		return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
	} catch (_error) {
		return String(rawEspecialistas)
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}
}

function parseBooleanFlag(value) {
	if (typeof value === "boolean") return value;
	const normalized = String(value || "").trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "si";
}

function parseMatrixType(rawType) {
	const fallback = "especialista-anio-mes-juzgado";
	const type = String(rawType || fallback).trim();
	return MATRIX_TYPES[type] ? type : fallback;
}

function parseMatrixFilters(body = {}) {
	return {
		fechaInicio: body.fechaInicio || "",
		fechaFin: body.fechaFin || "",
		juzgado: body.juzgado || "",
		estado: body.estado || "",
	};
}

app.get("/health", (_req, res) => {
res.json({ ok: true, service: "documind-backend" });
});

app.post("/analizar-materias", async (req, res) => {
	try {
		const archivo = req.files?.archivo;
		const analysis = await analyzeUploadWithPreview(archivo);
		return res.json({
			extension: analysis.extension,
			materias: analysis.materias,
			prevalidacion: analysis.prevalidacion,
			vistaPrevia: analysis.vistaPrevia,
			excelInsights: analysis.excelInsights,
		});
	} catch (error) {
		console.error("Error analizando materias:", error);
		return res.status(error.statusCode || 500).json({
			message: error.message || "No se pudieron analizar las materias del documento.",
		});
	}
});

app.post("/analizar-excel", async (req, res) => {
	try {
		const archivo = req.files?.archivo;
		const { extension } = getArchivoInfo(archivo);
		if (extension === ".pdf") {
			return res.status(400).json({ message: "Este endpoint es solo para analisis de Excel." });
		}

		const analysis = await analyzeUploadWithPreview(archivo);
		return res.json({
			extension: analysis.extension,
			materias: analysis.materias,
			prevalidacion: analysis.prevalidacion,
			vistaPrevia: analysis.vistaPrevia,
			excelInsights: analysis.excelInsights,
		});
	} catch (error) {
		console.error("Error analizando Excel:", error);
		return res.status(error.statusCode || 500).json({
			message: error.message || "No se pudo analizar el archivo Excel.",
		});
	}
});

app.post("/prevalidar-archivo", async (req, res) => {
	try {
		const archivo = req.files?.archivo;
		const analysis = await analyzeUploadWithPreview(archivo);
		return res.json({
			ok: analysis.prevalidacion.ok,
			prevalidacion: analysis.prevalidacion,
			vistaPrevia: analysis.vistaPrevia,
			materias: analysis.materias,
		});
	} catch (error) {
		console.error("Error en prevalidacion:", error);
		return res.status(error.statusCode || 500).json({
			ok: false,
			message: error.message || "No se pudo prevalidar el archivo.",
		});
	}
});

app.post("/matriz-preview", async (req, res) => {
	try {
		const archivo = req.files?.archivo;
		const { extension } = getArchivoInfo(archivo);

		if (extension === ".pdf") {
			return res.status(400).json({
				message: "La matriz dinamica se construye solo con Excel normalizado.",
			});
		}

		const excelAnalysis = await analyzeExcelUploadWithFallback(archivo, extension);
		const normalizedRows = excelAnalysis.normalizedRows || [];

		if (!normalizedRows.length) {
			return res.status(400).json({
				message: excelAnalysis?.diagnostics?.message || "No hay filas normalizadas para construir matriz.",
				diagnostics: excelAnalysis?.diagnostics || null,
			});
		}

		const matrixType = parseMatrixType(req.body?.matrixType);
		const matrixConfig = MATRIX_TYPES[matrixType];
		const filters = parseMatrixFilters(req.body || {});
		const matrix = buildMatrixReport({
			normalizedRows,
			rowField: "especialista",
			columnHierarchy: matrixConfig.columnHierarchy,
			filters,
		});

		return res.json({
			matrixType,
			matrixLabel: matrixConfig.label,
			matrix,
			filterOptions: getMatrixFilterOptions(normalizedRows),
			diagnostics: excelAnalysis?.diagnostics || null,
		});
	} catch (error) {
		console.error("Error generando preview de matriz:", error);
		return res.status(error.statusCode || 500).json({
			message: error.message || "No se pudo construir la matriz de reporte.",
		});
	}
});

app.post("/exportar-matriz", async (req, res) => {
	try {
		const archivo = req.files?.archivo;
		const { extension, nombreBase } = getArchivoInfo(archivo);

		if (extension === ".pdf") {
			return res.status(400).json({
				message: "La exportacion de matriz dinamica requiere un Excel normalizado.",
			});
		}

		const excelAnalysis = await analyzeExcelUploadWithFallback(archivo, extension);
		const normalizedRows = excelAnalysis.normalizedRows || [];
		if (!normalizedRows.length) {
			return res.status(400).json({
				message: excelAnalysis?.diagnostics?.message || "No hay filas normalizadas para exportar matriz.",
				diagnostics: excelAnalysis?.diagnostics || null,
			});
		}

		const matrixType = parseMatrixType(req.body?.matrixType);
		const matrixConfig = MATRIX_TYPES[matrixType];
		const filters = parseMatrixFilters(req.body || {});
		const matrix = buildMatrixReport({
			normalizedRows,
			rowField: "especialista",
			columnHierarchy: matrixConfig.columnHierarchy,
			filters,
		});

		const formato = String(req.body?.formato || "excel").toLowerCase();
		const title = `Matriz ${matrixConfig.label}`;

		if (formato === "pdf") {
			const pdfBuffer = await exportMatrixToPdfBuffer(matrix, title);
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("Content-Disposition", `attachment; filename="matriz_${nombreBase}.pdf"`);
			return res.send(pdfBuffer);
		}

		const excelBuffer = await exportMatrixToExcelBuffer(matrix, title);
		res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		res.setHeader("Content-Disposition", `attachment; filename="matriz_${nombreBase}.xlsx"`);
		return res.send(Buffer.from(excelBuffer));
	} catch (error) {
		console.error("Error exportando matriz:", error);
		return res.status(error.statusCode || 500).json({
			message: error.message || "No se pudo exportar la matriz.",
		});
	}
});

app.post("/procesar-reporte", async (req, res) => {
try {
const archivo = req.files?.archivo;
const { extension, nombreBase } = getArchivoInfo(archivo);

const materiasSolicitadas = parseMateriasSolicitadas(req.body?.materias);
const especialistasSolicitados = parseEspecialistasSolicitados(req.body?.especialistas);
const hayFiltroEspecialistasFlag = parseBooleanFlag(req.body?.aplicarFiltroEspecialistas);

const hayFiltroMaterias = getOrderedMaterias(materiasSolicitadas).length > 0;

let normalizedRecords = [];
let outputWorkbook = null;
	let pdfValidation = null;
let excelAnalysis = null;
let pdfReportKind = "ESCRITO";

if (extension === ".pdf") {
	try {
		pdfReportKind = await detectPdfReportKind(archivo.data);
	} catch (_error) {
		pdfReportKind = "ESCRITO";
	}
	normalizedRecords = await extractNormalizedRecordsFromUpload(archivo, extension);
} else {
	excelAnalysis = await analyzeExcelUploadWithFallback(archivo, extension);
	normalizedRecords = excelAnalysis.normalizedRecords;
}

if (extension === ".pdf") {
	if (!hayFiltroMaterias) {
		try {
			pdfValidation = await validatePdfTotalsWithRecords(archivo.data, normalizedRecords);
			res.setHeader("X-Reporte-Validacion", pdfValidation.hasMismatches ? "WARN" : "OK");
			res.setHeader("X-Reporte-Validacion-Resumen", pdfValidation.summary);
				if (pdfValidation.detailSummary) {
					res.setHeader("X-Reporte-Validacion-Detalle", pdfValidation.detailSummary);
				}
		} catch (validationError) {
			console.warn("No se pudo validar totales del PDF:", validationError.message);
		}
	} else {
		res.setHeader("X-Reporte-Validacion", "FILTERED");
		res.setHeader(
			"X-Reporte-Validacion-Resumen",
			"Validacion de totales omitida porque se solicito un subconjunto de materias."
		);
	}
}

normalizedRecords = filterRecordsByMaterias(normalizedRecords, materiasSolicitadas);

const especialistasDetectados = [
	...new Set(
		(normalizedRecords || [])
			.map((record) => String(record?.especialista || "").trim())
			.filter(Boolean)
	),
];
const hayFiltroEspecialistasPorDelta =
	Array.isArray(especialistasSolicitados) &&
	especialistasSolicitados.length > 0 &&
	especialistasSolicitados.length < especialistasDetectados.length;
const hayFiltroEspecialistas = hayFiltroEspecialistasFlag || hayFiltroEspecialistasPorDelta;

if (hayFiltroEspecialistas) {
	normalizedRecords = filterRecordsByEspecialistas(normalizedRecords, especialistasSolicitados);
}

if (!normalizedRecords.length) {
	return res.status(400).json({
		message:
			materiasSolicitadas.length
				? "No hay registros para las materias seleccionadas en el documento cargado."
				: hayFiltroEspecialistas
				? "No hay registros para los especialistas seleccionados en el documento cargado."
				: extension === ".pdf"
				? "No se pudieron interpretar datos del documento. Verifica que el PDF tenga fechas y especialistas legibles."
				: excelAnalysis?.diagnostics?.message || "No se pudieron interpretar datos del Excel cargado.",
		diagnostics: extension === ".pdf" ? undefined : excelAnalysis?.diagnostics,
	});
}

/* NUEVO: rama por formato de salida solicitado por el frontend */
const formatoSolicitado = (req.body?.formato || "excel").toLowerCase();

if (formatoSolicitado === "pdf") {
	const pdfBuffer = await generatePDFReport(normalizedRecords, archivo.name || nombreBase, pdfReportKind);
	res.setHeader("Content-Type", "application/pdf");
	res.setHeader(
		"Content-Disposition",
		`attachment; filename="${`procesado_${nombreBase}`}.pdf"`
	);
	return res.send(pdfBuffer);
}

/* Rama Excel: genera cuadro visual tipo matriz como en el modelo solicitado */
outputWorkbook = buildVisualMatrixWorkbook(normalizedRecords, pdfReportKind);
addSpecialistSummarySheet(outputWorkbook, normalizedRecords);
const outputBuffer = await outputWorkbook.xlsx.writeBuffer();

res.setHeader(
"Content-Type",
"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
);
res.setHeader(
"Content-Disposition",
`attachment; filename="${`procesado_${nombreBase}`}.xlsx"`
);

return res.send(Buffer.from(outputBuffer));
} catch (error) {
console.error("Error procesando reporte:", error);
if (error?.message?.includes("Can't find end of central directory")) {
return res
.status(400)
.json({ message: "El archivo Excel parece danado o no es valido." });
}
return res.status(500).json({ message: "No se pudo procesar el reporte." });
}
});

app.listen(PORT, "0.0.0.0", () => {
	console.log(`Servidor backend escuchando en puerto ${PORT}`);
});


