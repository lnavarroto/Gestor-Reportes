function buildDiscardedSummary(discardedRows = []) {
	const counts = new Map();
	for (const row of discardedRows) {
		const reason = row.reason || "sin_clasificar";
		counts.set(reason, (counts.get(reason) || 0) + 1);
	}
	return [...counts.entries()].map(([reason, total]) => ({ reason, total })).sort((a, b) => b.total - a.total);
}

function buildExcelNormalizationPreview(parsed, normalized) {
	return {
		metadata: parsed.metadata,
		blocks: parsed.blocks,
		reconstructedCount: normalized.normalizedRows.length,
		discardedCount: parsed.discardedRows.length,
		discardedByReason: buildDiscardedSummary(parsed.discardedRows),
		discardedRows: parsed.discardedRows.slice(0, 40),
		normalizedRowsPreview: normalized.normalizedRows.slice(0, 30).map((row) => ({
			expediente: row.expediente,
			fecha_ingreso: row.fecha_ingreso,
			documento: row.documento,
			dias: row.dias,
			estado: row.estado,
			fecha_respuesta: row.fecha_respuesta,
			tipo_ing: row.tipo_ing,
			item_detalle: row.item_detalle,
			canal_ingreso: row.canal_ingreso,
			descripcion: row.descripcion,
			juzgado: row.juzgado,
			especialista: row.especialista,
			fecha_inicio_reporte: row.fecha_inicio_reporte,
			fecha_fin_reporte: row.fecha_fin_reporte,
		})),
	};
}

module.exports = {
	buildExcelNormalizationPreview,
};
