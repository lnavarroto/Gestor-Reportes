function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function parseDate(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	const text = cleanText(value);
	if (!text) return null;
	if (/^0{2}\/0{2}\/0{4}$/.test(text)) return null;

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

function parseNumber(value) {
	const text = cleanText(value);
	if (!text) return null;
	const normalized = text.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
}

function normalizeUpper(value) {
	return cleanText(value)
		.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

function splitDocumento(documento) {
	const text = cleanText(documento);
	const match = text.match(/^(\d{3,6}-\d{4})\s+(.+)$/i);
	if (!match) return { numero_documento: "", tipo_documento: text };
	return {
		numero_documento: match[1],
		tipo_documento: cleanText(match[2]),
	};
}

function buildAggregateRecords(rows = []) {
	const grouped = new Map();
	for (const row of rows) {
		if (!(row.fecha instanceof Date) || Number.isNaN(row.fecha.getTime())) continue;
		const anio = row.fecha.getFullYear();
		const mes = row.fecha.getMonth() + 1;
		const key = `${anio}|${mes}|${row.juzgado}|${row.especialista}|${row.materia}`;
		grouped.set(key, (grouped.get(key) || 0) + 1);
	}

	return [...grouped.entries()].map(([key, cantidad]) => {
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

function normalizeParsedRows(parsedRows = []) {
	const normalizedRows = parsedRows.map((row) => {
		const fechaIngreso = parseDate(row.fecha_ingreso);
		const fechaRespuesta = parseDate(row.fecha_respuesta);
		const dias = parseNumber(row.dias);
		const documento = cleanText(row.documento);
		const documentoSplit = splitDocumento(documento);
		const especialista = normalizeUpper(row.especialista || "SIN ESPECIALISTA") || "SIN ESPECIALISTA";
		const materia = normalizeUpper(row.especialidad || "SIN MATERIA") || "SIN MATERIA";
		const juzgado = cleanText(row.juzgado || "SIN JUZGADO") || "SIN JUZGADO";
		const tipoIngreso = normalizeUpper(row.tipo_ing);

		return {
			sheetName: row.sheetName,
			source_main_row: row.source_main_row,
			source_detail_row: row.source_detail_row,
			expediente: cleanText(row.expediente),
			fecha_ingreso: fechaIngreso,
			documento,
			dias,
			estado: normalizeUpper(row.estado),
			fecha_respuesta: fechaRespuesta,
			tipo_ing: tipoIngreso,
			item_detalle: cleanText(row.item_detalle),
			canal_ingreso: cleanText(row.canal_ingreso),
			descripcion: cleanText(row.descripcion),
			juzgado,
			especialista,
			fecha_inicio_reporte: cleanText(row.fecha_inicio_reporte),
			fecha_fin_reporte: cleanText(row.fecha_fin_reporte),
			numero_documento: documentoSplit.numero_documento,
			tipo_documento: documentoSplit.tipo_documento,
			numeroDocumento: documentoSplit.numero_documento,
			tipoDocumento: documentoSplit.tipo_documento,
			categoria: materia,
			materia,
			responsable: especialista,
			codigo: cleanText(row.expediente),
			fecha: fechaIngreso,
			respuesta: fechaRespuesta,
			tipoIngresoCodigo: tipoIngreso,
			observacion: cleanText(row.descripcion),
			descripcionDocumento: cleanText(row.descripcion),
			canalIngreso: cleanText(row.canal_ingreso),
			canal_ingreso_normalizado: cleanText(row.canal_ingreso),
		};
	});

	return {
		normalizedRows,
		normalizedRecords: buildAggregateRecords(normalizedRows),
	};
}

module.exports = {
	normalizeParsedRows,
};
