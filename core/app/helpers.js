/**
 * 共通の部品(テンプレートの取り込みで使う)
 */

/** docx File を Google ドキュメントに変換して新IDを返す（Drive API v3 の copy で形式変換） */
function convertDocxToDoc_(file, title) {
  var res = Drive.Files.copy(
    { name: title, parents: [OUTPUT_FOLDER_ID], mimeType: "application/vnd.google-apps.document" },
    file.getId(),
    { supportsAllDrives: true }
  );
  return res.id;
}

function setCellText_(cell, text) {
  cell.clear();
  if (cell.getNumChildren() > 0 && cell.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
    cell.getChild(0).asParagraph().setText(text);
  } else {
    cell.appendParagraph(text);
  }
}


