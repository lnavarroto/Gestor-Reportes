function countBy(items, selector) {
	const map = new Map();
	for (const item of items) {
		const key = selector(item);
		if (!key) continue;
		map.set(key, (map.get(key) || 0) + 1);
	}
	return [...map.entries()]
		.map(([label, total]) => ({ label, total }))
		.sort((a, b) => b.total - a.total)
		.slice(0, 8);
}

function buildReportSuggestions(workbookFieldKeys = []) {
	const fieldSet = new Set(workbookFieldKeys);
	const suggestions = [
		{
			key: "summary",
			label: "Resumen general",
			enabled: true,
			reason: "Siempre disponible con registros normalizados.",
		},
		{
			key: "by-state",
			label: "Conteo por estado",
			enabled: fieldSet.has("estado"),
			reason: "Disponible cuando el Excel tiene estado.",
		},
		{
			key: "by-owner",
			label: "Carga por responsable",
			enabled: fieldSet.has("responsable"),
			reason: "Disponible cuando el Excel tiene responsable o especialista.",
		},
		{
			key: "by-category",
			label: "Distribucion por categoria",
			enabled: fieldSet.has("categoria"),
			reason: "Disponible cuando hay categoria, materia o tipo.",
		},
		{
			key: "timeline",
			label: "Evolucion por fecha",
			enabled: fieldSet.has("fecha"),
			reason: "Disponible cuando hay fecha interpretable.",
		},
		{
			key: "aging",
			label: "Pendientes por antiguedad",
			enabled: fieldSet.has("dias") || fieldSet.has("estado"),
			reason: "Disponible cuando hay dias o estado.",
		},
		{
			key: "top-recurrent",
			label: "Top registros con recurrencia",
			enabled: fieldSet.has("codigo") || fieldSet.has("documento"),
			reason: "Disponible cuando hay codigo, expediente o documento.",
		},
		{
			key: "filterable-table",
			label: "Tabla filtrable",
			enabled: true,
			reason: "Siempre disponible con filas normalizadas.",
		},
	].filter((item) => item.enabled);

	return suggestions;
}

function buildExcelMetrics(normalizedRows = [], workbookAnalysis) {
	const workbookMeta = {
		sheetCount: workbookAnalysis.sheets.length,
		tableCount: workbookAnalysis.analysis.sheetInsights.reduce((acc, sheet) => acc + sheet.tables.length, 0),
		rowCount: normalizedRows.length,
		fieldCount: workbookAnalysis.analysis.workbookFieldKeys.length,
	};

	return {
		...workbookMeta,
		byState: countBy(normalizedRows, (row) => row.estado),
		byResponsable: countBy(normalizedRows, (row) => row.responsable),
		byCategoria: countBy(normalizedRows, (row) => row.categoria),
	};
}

module.exports = {
	buildExcelMetrics,
	buildReportSuggestions,
};
