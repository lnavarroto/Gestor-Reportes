const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const MATRIX_TYPES = {
	"especialista-anio-mes-juzgado": {
		label: "Especialista vs Ano > Mes > Juzgado",
		columnHierarchy: ["anio", "mes", "juzgado"],
	},
	"especialista-anio-mes-estado": {
		label: "Especialista vs Ano > Mes > Estado",
		columnHierarchy: ["anio", "mes", "estado"],
	},
	"especialista-anio-mes": {
		label: "Especialista vs Ano > Mes",
		columnHierarchy: ["anio", "mes"],
	},
};

function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function parseDate(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	const text = cleanText(value);
	if (!text) return null;
	const direct = new Date(text);
	if (!Number.isNaN(direct.getTime())) return direct;
	const slash = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
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

function monthName(mes) {
	const names = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
	return names[Number(mes) - 1] || String(mes || "-");
}

function prepareMatrixRows(normalizedRows = []) {
	return normalizedRows
		.map((row) => {
			const fecha = parseDate(row.fecha_ingreso || row.fecha);
			if (!fecha) return null;
			const anio = fecha.getFullYear();
			const mes = fecha.getMonth() + 1;
			return {
				especialista: cleanText(row.especialista || row.responsable || "SIN ESPECIALISTA") || "SIN ESPECIALISTA",
				juzgado: cleanText(row.juzgado || "SIN JUZGADO") || "SIN JUZGADO",
				estado: cleanText(row.estado || "SIN ESTADO") || "SIN ESTADO",
				anio,
				mes,
				fecha,
			};
		})
		.filter(Boolean);
}

function applyMatrixFilters(rows, filters = {}) {
	const startDate = filters.fechaInicio ? parseDate(filters.fechaInicio) : null;
	const endDate = filters.fechaFin ? parseDate(filters.fechaFin) : null;
	const juzgado = cleanText(filters.juzgado);
	const estado = cleanText(filters.estado);

	return rows.filter((row) => {
		if (startDate && row.fecha < startDate) return false;
		if (endDate && row.fecha > endDate) return false;
		if (juzgado && juzgado !== "ALL" && row.juzgado !== juzgado) return false;
		if (estado && estado !== "ALL" && row.estado !== estado) return false;
		return true;
	});
}

function buildLeafKey(path) {
	return path.join("|");
}

function compareLeaf(a, b) {
	if (a.anio !== b.anio) return a.anio - b.anio;
	if (a.mes !== b.mes) return a.mes - b.mes;
	return String(a.secondary || "").localeCompare(String(b.secondary || ""), "es", { sensitivity: "base" });
}

function getHierarchyParts(row, columnHierarchy) {
	return columnHierarchy.map((key) => {
		if (key === "anio") return String(row.anio);
		if (key === "mes") return monthName(row.mes);
		return cleanText(row[key]) || "SIN VALOR";
	});
}

function createHeaderRows(leafColumns, columnHierarchy) {
	const depth = columnHierarchy.length;
	const headerRows = [];

	for (let level = 0; level < depth; level += 1) {
		const groups = [];
		let currentLabel = null;
		let currentSpan = 0;

		for (const leaf of leafColumns) {
			const label = leaf.path[level] || "-";
			if (currentLabel === null || label !== currentLabel) {
				if (currentLabel !== null) {
					groups.push({ label: currentLabel, colSpan: currentSpan, rowSpan: 1 });
				}
				currentLabel = label;
				currentSpan = 1;
			} else {
				currentSpan += 1;
			}
		}

		if (currentLabel !== null) {
			groups.push({ label: currentLabel, colSpan: currentSpan, rowSpan: 1 });
		}

		headerRows.push(groups);
	}

	return headerRows;
}

function buildMatrixReport({
	normalizedRows,
	rowField = "especialista",
	columnHierarchy = ["anio", "mes", "juzgado"],
	filters = {},
}) {
	const prepared = prepareMatrixRows(normalizedRows);
	const filteredRows = applyMatrixFilters(prepared, filters);

	const leafMap = new Map();
	for (const row of filteredRows) {
		const path = getHierarchyParts(row, columnHierarchy);
		const key = buildLeafKey(path);
		if (!leafMap.has(key)) {
			leafMap.set(key, {
				key,
				path,
				anio: row.anio,
				mes: row.mes,
				secondary: columnHierarchy[2] ? row[columnHierarchy[2]] : "",
			});
		}
	}

	const leafColumns = [...leafMap.values()].sort(compareLeaf);
	const rowLabels = [...new Set(filteredRows.map((item) => cleanText(item[rowField]) || "SIN ESPECIALISTA"))].sort((a, b) =>
		a.localeCompare(b, "es", { sensitivity: "base" })
	);

	const rows = [];
	const columnTotals = {};
	let grandTotal = 0;

	for (const label of rowLabels) {
		const cells = {};
		let rowTotal = 0;
		for (const leaf of leafColumns) {
			const value = filteredRows.filter((item) => {
				if ((cleanText(item[rowField]) || "SIN ESPECIALISTA") !== label) return false;
				const path = getHierarchyParts(item, columnHierarchy);
				return buildLeafKey(path) === leaf.key;
			}).length;
			cells[leaf.key] = value;
			rowTotal += value;
			columnTotals[leaf.key] = (columnTotals[leaf.key] || 0) + value;
		}
		grandTotal += rowTotal;
		rows.push({ label, cells, total: rowTotal });
	}

	const headerRows = createHeaderRows(leafColumns, columnHierarchy);

	return {
		rowField,
		columnHierarchy,
		headers: headerRows,
		leafColumns,
		rows,
		columnTotals,
		grandTotal,
		totals: {
			rows: rows.map((row) => ({ label: row.label, total: row.total })),
			columns: leafColumns.map((leaf) => ({ key: leaf.key, total: columnTotals[leaf.key] || 0 })),
			general: grandTotal,
		},
		summary: {
			registrosBase: prepared.length,
			registrosFiltrados: filteredRows.length,
			especialistas: rowLabels.length,
			columnas: leafColumns.length,
		},
	};
}

function getMatrixFilterOptions(normalizedRows = []) {
	const prepared = prepareMatrixRows(normalizedRows);
	const juzgados = [...new Set(prepared.map((item) => item.juzgado))].sort((a, b) =>
		a.localeCompare(b, "es", { sensitivity: "base" })
	);
	const estados = [...new Set(prepared.map((item) => item.estado))].sort((a, b) =>
		a.localeCompare(b, "es", { sensitivity: "base" })
	);

	const sortedByDate = [...prepared].sort((a, b) => a.fecha - b.fecha);
	const fechaInicio = sortedByDate[0]?.fecha || null;
	const fechaFin = sortedByDate[sortedByDate.length - 1]?.fecha || null;

	return {
		juzgados,
		estados,
		fechaInicio,
		fechaFin,
		tipos: Object.entries(MATRIX_TYPES).map(([key, config]) => ({ key, label: config.label })),
	};
}

async function exportMatrixToExcelBuffer(matrix, title) {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet("Matriz");
	const depth = matrix.headers.length;
	const firstDataColumn = 2;
	const totalColumn = firstDataColumn + matrix.leafColumns.length;

	sheet.getCell(1, 1).value = title || "Reporte Matriz";
	sheet.mergeCells(1, 1, 1, totalColumn);
	sheet.getCell(1, 1).font = { bold: true, size: 13 };

	if (depth > 0) {
		sheet.mergeCells(2, 1, 1 + depth + 1, 1);
		sheet.getCell(2, 1).value = "Especialista";
		sheet.getCell(2, 1).alignment = { horizontal: "center", vertical: "middle" };
		sheet.getCell(2, 1).font = { bold: true };

		sheet.mergeCells(2, totalColumn, 1 + depth + 1, totalColumn);
		sheet.getCell(2, totalColumn).value = "Total";
		sheet.getCell(2, totalColumn).alignment = { horizontal: "center", vertical: "middle" };
		sheet.getCell(2, totalColumn).font = { bold: true };
	}

	for (let level = 0; level < depth; level += 1) {
		let currentColumn = firstDataColumn;
		for (const group of matrix.headers[level]) {
			const from = currentColumn;
			const to = currentColumn + group.colSpan - 1;
			sheet.mergeCells(level + 2, from, level + 2, to);
			sheet.getCell(level + 2, from).value = group.label;
			sheet.getCell(level + 2, from).alignment = { horizontal: "center", vertical: "middle" };
			sheet.getCell(level + 2, from).font = { bold: true };
			currentColumn = to + 1;
		}
	}

	let rowIndex = depth + 2;
	for (const row of matrix.rows) {
		rowIndex += 1;
		sheet.getCell(rowIndex, 1).value = row.label;
		sheet.getCell(rowIndex, 1).font = { bold: true };

		let col = firstDataColumn;
		for (const leaf of matrix.leafColumns) {
			sheet.getCell(rowIndex, col).value = row.cells[leaf.key] || 0;
			col += 1;
		}
		sheet.getCell(rowIndex, totalColumn).value = row.total || 0;
		sheet.getCell(rowIndex, totalColumn).font = { bold: true };
	}

	const totalRow = rowIndex + 1;
	sheet.getCell(totalRow, 1).value = "TOTAL GENERAL";
	sheet.getCell(totalRow, 1).font = { bold: true };
	let col = firstDataColumn;
	for (const leaf of matrix.leafColumns) {
		sheet.getCell(totalRow, col).value = matrix.columnTotals[leaf.key] || 0;
		sheet.getCell(totalRow, col).font = { bold: true };
		col += 1;
	}
	sheet.getCell(totalRow, totalColumn).value = matrix.grandTotal || 0;
	sheet.getCell(totalRow, totalColumn).font = { bold: true };

	sheet.columns = [{ width: 36 }, ...matrix.leafColumns.map(() => ({ width: 12 })), { width: 12 }];

	return workbook.xlsx.writeBuffer();
}

async function exportMatrixToPdfBuffer(matrix, title) {
	return new Promise((resolve) => {
		const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 26 });
		const chunks = [];
		doc.on("data", (chunk) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));

		doc.fontSize(12).text(title || "Reporte Matriz", { align: "left" });
		doc.moveDown(0.6);

		const printableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		const colCount = Math.max(matrix.leafColumns.length + 2, 3);
		const colWidth = printableWidth / colCount;
		let y = doc.y;

		doc.fontSize(8).font("Helvetica-Bold");
		doc.text("Especialista", doc.page.margins.left, y, { width: colWidth, align: "left" });
		let x = doc.page.margins.left + colWidth;
		for (const leaf of matrix.leafColumns) {
			doc.text(leaf.path.join("/"), x, y, { width: colWidth, align: "center" });
			x += colWidth;
		}
		doc.text("Total", x, y, { width: colWidth, align: "center" });
		y += 14;

		doc.font("Helvetica").fontSize(8);
		for (const row of matrix.rows) {
			x = doc.page.margins.left;
			doc.text(row.label, x, y, { width: colWidth, align: "left" });
			x += colWidth;
			for (const leaf of matrix.leafColumns) {
				doc.text(String(row.cells[leaf.key] || 0), x, y, { width: colWidth, align: "center" });
				x += colWidth;
			}
			doc.font("Helvetica-Bold").text(String(row.total || 0), x, y, { width: colWidth, align: "center" });
			doc.font("Helvetica");
			y += 13;
			if (y > doc.page.height - 40) {
				doc.addPage();
				y = doc.page.margins.top;
			}
		}

		doc.font("Helvetica-Bold");
		x = doc.page.margins.left;
		doc.text("TOTAL GENERAL", x, y, { width: colWidth, align: "left" });
		x += colWidth;
		for (const leaf of matrix.leafColumns) {
			doc.text(String(matrix.columnTotals[leaf.key] || 0), x, y, { width: colWidth, align: "center" });
			x += colWidth;
		}
		doc.text(String(matrix.grandTotal || 0), x, y, { width: colWidth, align: "center" });

		doc.end();
	});
}

module.exports = {
	MATRIX_TYPES,
	buildMatrixReport,
	getMatrixFilterOptions,
	exportMatrixToExcelBuffer,
	exportMatrixToPdfBuffer,
};
