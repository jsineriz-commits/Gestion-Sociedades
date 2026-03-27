const { google } = require('googleapis');
const { getAuthClient, DB_SHEET_ID } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: DB_SHEET_ID,
    });
    const tabs = response.data.sheets.map(s => s.properties.title);
    res.status(200).json({ DB_SHEET_ID, tabs });
  } catch (e) {
    res.status(500).json({ error: e.message, DB_SHEET_ID });
  }
};
