const path = require("path");
const XLSX = require("xlsx");

function cleanCellValue(value) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.trim();
	if (typeof value === "number") return value;
	if (typeof value === "boolean") return value;
	if (value instanceof Date) return value;
	return String(value).trim();
}

function cloneRows(rows) {
	return rows.map((row) => (Array.isArray(row) ? [...row] : []));
}

function expandMergedCells(rows, merges = []) {
	const expanded = cloneRows(rows);

	for (const merge of merges) {
		const startRow = merge.s.r;
		const endRow = merge.e.r;
		const startCol = merge.s.c;
		const endCol = merge.e.c;
		const masterValue = expanded[startRow]?.[startCol];
		if (masterValue === undefined || masterValue === null || masterValue === "") continue;

		for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
			if (!expanded[rowIndex]) expanded[rowIndex] = [];
			for (let colIndex = startCol; colIndex <= endCol; colIndex += 1) {
				if (expanded[rowIndex][colIndex] === undefined || expanded[rowIndex][colIndex] === null || expanded[rowIndex][colIndex] === "") {
					expanded[rowIndex][colIndex] = masterValue;
				}
			}
		}
	}

	return expanded;
}

function loadWorkbookFromBuffer(buffer, fileName = "reporte.xlsx") {
	const extension = path.extname(fileName || "").toLowerCase();
	const workbook = XLSX.read(buffer, {
		type: "buffer",
		cellDates: true,
		dense: true,
		codepage: 65001,
		WTF: false,
	});

	const sheets = workbook.SheetNames.map((sheetName) => {
		const sheet = workbook.Sheets[sheetName];
		const rawRows = XLSX.utils.sheet_to_json(sheet, {
			header: 1,
			defval: "",
			blankrows: false,
			raw: false,
			dateNF: "yyyy-mm-dd hh:mm:ss",
		});
		const merges = Array.isArray(sheet["!merges"]) ? sheet["!merges"] : [];
		const rows = expandMergedCells(rawRows, merges).map((row) => row.map(cleanCellValue));
		const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

		return {
			name: sheetName,
			rows,
			mergeCount: merges.length,
			rowCount: rows.length,
			columnCount,
		};
	});

	return {
		extension,
		workbook,
		sheets,
	};
}

module.exports = {
	cleanCellValue,
	loadWorkbookFromBuffer,
};
