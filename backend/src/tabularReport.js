const ExcelJS = require("exceljs");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
require("dayjs/locale/es");

dayjs.extend(customParseFormat);
dayjs.locale("es");

const DATE_FORMATS = [
	"DD/MM/YYYY",
	"DD/MM/YYYY HH:mm",
	"DD/MM/YYYY HH:mm:ss",
	"YYYY-MM-DD",
	"YYYY-MM-DD HH:mm",
	"YYYY-MM-DD HH:mm:ss",
];

const HEADER_ALIASES = {
	fecha: ["FECHA", "F INGRESO", "F_INGRESO", "FINGRESO", "INGRESO"],
	especialista: ["ESPECIALISTA", "ESPECIALISTAS"],
	juzgado: ["JUZGADO", "JUZGADOS", "ORGANO", "ORGANO JURISDICCIONAL"],
	tipo: ["TIPO", "TIPO ING", "TIPO INGRESO", "TIPO DOC", "TIPO DOCUMENTO", "DOCUMENTO"],
};

function normalizeText(value) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.trim();
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
	if (value instanceof Date) return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
	if (Array.isArray(value?.richText)) {
		return value.richText.map((p) => p.text || "").join("").trim();
	}
	if (value?.text) return String(value.text).trim();
	if (value?.result !== undefined && value?.result !== null) return normalizeText(value.result);
	return String(value).trim();
}

function normalizeHeader(header) {
	return normalizeText(header)
		.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function excelSerialToDate(serial) {
	if (typeof serial !== "number") return null;
	const base = dayjs("1899-12-30 00:00:00", "YYYY-MM-DD HH:mm:ss");
	const days = Math.floor(serial);
	const seconds = Math.round((serial - days) * 24 * 60 * 60);
	return base.add(days, "day").add(seconds, "second");
}

function parseDateValue(value) {
	if (!value && value !== 0) return null;
	if (value instanceof Date) {
		const d = dayjs(value);
		return d.isValid() ? d : null;
	}
	if (typeof value === "number") {
		const d = excelSerialToDate(value);
		return d && d.isValid() ? d : null;
	}
	const text = normalizeText(value);
	if (!text) return null;

	for (const fmt of DATE_FORMATS) {
		const d = dayjs(text, fmt, true);
		if (d.isValid()) return d;
	}

	const loose = dayjs(text);
	return loose.isValid() ? loose : null;
}

function resolveHeaderMap(worksheet) {
	const headerRow = worksheet.getRow(1).values.slice(1);
	const normalized = headerRow.map(normalizeHeader);
	const map = {};

	for (const key of Object.keys(HEADER_ALIASES)) {
		const aliases = HEADER_ALIASES[key];
		const idx = normalized.findIndex((h) => aliases.includes(h));
		if (idx >= 0) map[key] = idx + 1;
	}

	const valid = Boolean(map.fecha && map.especialista && map.juzgado && map.tipo);
	return { valid, map };
}

function readTabularRows(worksheet, headerMap) {
	const rows = [];

	for (let r = 2; r <= worksheet.rowCount; r += 1) {
		const fechaRaw = worksheet.getCell(r, headerMap.fecha).value;
		const especialistaRaw = worksheet.getCell(r, headerMap.especialista).value;
		const juzgadoRaw = worksheet.getCell(r, headerMap.juzgado).value;
		const tipoRaw = worksheet.getCell(r, headerMap.tipo).value;

		const fecha = parseDateValue(fechaRaw);
		const especialista = normalizeText(especialistaRaw);
		const juzgado = normalizeText(juzgadoRaw);
		const tipo = normalizeText(tipoRaw);

		if (!fecha || !especialista || !juzgado || !tipo) continue;

		rows.push({
			fecha,
			especialista,
			juzgado,
			tipo,
			monthKey: fecha.format("YYYY-MM"),
			monthLabel: fecha.format("MMMM YYYY").replace(/^./, (s) => s.toUpperCase()),
			year: fecha.format("YYYY"),
		});
	}

	return rows;
}

function aggregateRows(rows) {
	const monthsMap = new Map();
	const tiposSet = new Set();
	const grouped = new Map();

	for (const row of rows) {
		monthsMap.set(row.monthKey, row.monthLabel);
		tiposSet.add(row.tipo);

		if (!grouped.has(row.juzgado)) grouped.set(row.juzgado, new Map());
		const byEspecialista = grouped.get(row.juzgado);
		if (!byEspecialista.has(row.especialista)) {
			byEspecialista.set(row.especialista, { total: 0, byMonth: new Map() });
		}

		const espNode = byEspecialista.get(row.especialista);
		if (!espNode.byMonth.has(row.monthKey)) {
			espNode.byMonth.set(row.monthKey, { byTipo: new Map(), total: 0 });
		}

		const monthNode = espNode.byMonth.get(row.monthKey);
		monthNode.byTipo.set(row.tipo, (monthNode.byTipo.get(row.tipo) || 0) + 1);
		monthNode.total += 1;
		espNode.total += 1;
	}

	const months = [...monthsMap.entries()]
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([key, label]) => ({ key, label }));

	const tipos = [...tiposSet].sort((a, b) => a.localeCompare(b, "es"));
	return { grouped, months, tipos };
}

function buildGroupedWorkbook(aggregation, sourceWorkbook) {
	const { grouped, months, tipos } = aggregation;
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet("REPORTE_AGRUPADO");

	const fixedCols = 2;
	const monthCols = months.length * (tipos.length + 1);
	const totalCol = fixedCols + monthCols + 1;

	ws.mergeCells(1, 1, 2, 1);
	ws.getCell(1, 1).value = "JUZGADO";
	ws.mergeCells(1, 2, 2, 2);
	ws.getCell(1, 2).value = "ESPECIALISTA";

	let col = 3;
	for (const month of months) {
		const start = col;
		for (const tipo of tipos) {
			ws.getCell(2, col).value = tipo;
			col += 1;
		}
		ws.getCell(2, col).value = "TOTAL MES";
		col += 1;
		ws.mergeCells(1, start, 1, col - 1);
		ws.getCell(1, start).value = month.label;
	}

	ws.mergeCells(1, totalCol, 2, totalCol);
	ws.getCell(1, totalCol).value = "TOTAL GENERAL";

	for (let c = 1; c <= totalCol; c += 1) {
		const cell1 = ws.getCell(1, c);
		const cell2 = ws.getCell(2, c);
		for (const cell of [cell1, cell2]) {
			cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
			cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
			cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
			cell.border = {
				top: { style: "thin", color: { argb: "FF94A3B8" } },
				left: { style: "thin", color: { argb: "FF94A3B8" } },
				bottom: { style: "thin", color: { argb: "FF94A3B8" } },
				right: { style: "thin", color: { argb: "FF94A3B8" } },
			};
		}
	}

	let rowIdx = 3;
	const sortedJuzgados = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "es"));
	const grandTotals = new Array(totalCol + 1).fill(0);

	for (const juzgado of sortedJuzgados) {
		const startJuzgado = rowIdx;
		const byEspecialista = grouped.get(juzgado);
		const especialistas = [...byEspecialista.keys()].sort((a, b) => a.localeCompare(b, "es"));
		const subtotal = new Array(totalCol + 1).fill(0);

		for (const especialista of especialistas) {
			const node = byEspecialista.get(especialista);
			ws.getCell(rowIdx, 2).value = especialista;
			ws.getCell(rowIdx, 2).alignment = { horizontal: "left", vertical: "middle" };

			let writeCol = 3;
			for (const month of months) {
				let monthTotal = 0;
				for (const tipo of tipos) {
					const val = node.byMonth.get(month.key)?.byTipo.get(tipo) || 0;
					ws.getCell(rowIdx, writeCol).value = val;
					subtotal[writeCol] += val;
					grandTotals[writeCol] += val;
					monthTotal += val;
					writeCol += 1;
				}
				ws.getCell(rowIdx, writeCol).value = monthTotal;
				subtotal[writeCol] += monthTotal;
				grandTotals[writeCol] += monthTotal;
				writeCol += 1;
			}

			ws.getCell(rowIdx, totalCol).value = node.total;
			subtotal[totalCol] += node.total;
			grandTotals[totalCol] += node.total;
			rowIdx += 1;
		}

		if (rowIdx > startJuzgado) {
			ws.mergeCells(startJuzgado, 1, rowIdx - 1, 1);
			const jCell = ws.getCell(startJuzgado, 1);
			jCell.value = juzgado;
			jCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
			jCell.font = { bold: true, color: { argb: "FF0F172A" } };
			jCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
		}

		ws.getCell(rowIdx, 1).value = `Subtotal ${juzgado}`;
		ws.mergeCells(rowIdx, 1, rowIdx, 2);
		ws.getCell(rowIdx, 1).font = { bold: true, color: { argb: "FF1E3A8A" } };
		ws.getCell(rowIdx, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
		for (let c = 3; c <= totalCol; c += 1) {
			ws.getCell(rowIdx, c).value = subtotal[c] || 0;
			ws.getCell(rowIdx, c).font = { bold: true, color: { argb: "FF1E3A8A" } };
			ws.getCell(rowIdx, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
		}
		rowIdx += 1;
	}

	ws.getCell(rowIdx, 1).value = "TOTAL GENERAL";
	ws.mergeCells(rowIdx, 1, rowIdx, 2);
	ws.getCell(rowIdx, 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
	ws.getCell(rowIdx, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2D4A" } };

	for (let c = 3; c <= totalCol; c += 1) {
		ws.getCell(rowIdx, c).value = grandTotals[c] || 0;
		ws.getCell(rowIdx, c).font = { bold: true, color: { argb: "FFFFFFFF" } };
		ws.getCell(rowIdx, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2D4A" } };
	}

	for (let r = 3; r <= rowIdx; r += 1) {
		for (let c = 1; c <= totalCol; c += 1) {
			ws.getCell(r, c).border = {
				top: { style: "thin", color: { argb: "FFE2E8F0" } },
				left: { style: "thin", color: { argb: "FFE2E8F0" } },
				bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
				right: { style: "thin", color: { argb: "FFE2E8F0" } },
			};
			if (c >= 3) ws.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
		}
	}

	ws.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];
	ws.autoFilter = {
		from: { row: 2, column: 1 },
		to: { row: 2, column: totalCol },
	};

	ws.getColumn(1).width = 28;
	ws.getColumn(2).width = 26;
	for (let c = 3; c <= totalCol; c += 1) ws.getColumn(c).width = 14;

	const sourceSheet = sourceWorkbook.worksheets[0];
	if (sourceSheet) {
		const backup = wb.addWorksheet("Datos_Originales");
		sourceSheet.eachRow({ includeEmpty: true }, (row) => {
			backup.addRow(row.values.slice(1));
		});
	}

	return wb;
}

function flattenAggregationForPDF(aggregation) {
	const { grouped, months, tipos } = aggregation;
	const out = [];
	const monthLabelByKey = new Map(months.map((m) => [m.key, m.label]));

	for (const [juzgado, byEspecialista] of grouped.entries()) {
		for (const [especialista, node] of byEspecialista.entries()) {
			for (const [monthKey, monthNode] of node.byMonth.entries()) {
				for (const tipo of tipos) {
					const cantidad = monthNode.byTipo.get(tipo) || 0;
					if (!cantidad) continue;
					out.push({
						anio: monthKey.slice(0, 4),
						mes: monthLabelByKey.get(monthKey) || monthKey,
						juzgado,
						especialista,
						materia: tipo,
						cantidad,
					});
				}
			}
		}
	}

	out.sort((a, b) => {
		if (a.anio !== b.anio) return Number(a.anio) - Number(b.anio);
		if (a.mes !== b.mes) return a.mes.localeCompare(b.mes, "es");
		if (a.juzgado !== b.juzgado) return a.juzgado.localeCompare(b.juzgado, "es");
		if (a.especialista !== b.especialista) return a.especialista.localeCompare(b.especialista, "es");
		return a.materia.localeCompare(b.materia, "es");
	});

	return out;
}

function buildGroupedReportFromWorksheet(worksheet, sourceWorkbook) {
	if (!worksheet) return null;
	const { valid, map } = resolveHeaderMap(worksheet);
	if (!valid) return null;

	const rows = readTabularRows(worksheet, map);
	if (!rows.length) return null;

	const aggregation = aggregateRows(rows);
	if (!aggregation.months.length || !aggregation.tipos.length) return null;

	return {
		outputWorkbook: buildGroupedWorkbook(aggregation, sourceWorkbook),
		pdfRows: flattenAggregationForPDF(aggregation),
		meta: {
			months: aggregation.months.length,
			tipos: aggregation.tipos.length,
			rows: rows.length,
		},
	};
}

module.exports = {
	buildGroupedReportFromWorksheet,
};
