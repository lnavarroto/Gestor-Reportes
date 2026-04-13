const { analyzeExcelUploadController } = require("./excelUploadController");

async function analyzeExcelUpload(buffer, fileName) {
	return analyzeExcelUploadController(buffer, fileName);
}

module.exports = {
	analyzeExcelUpload,
};
