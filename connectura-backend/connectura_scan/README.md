# Connectura Scan (Driver License OCR)

Standalone, open-source driver license scanner using [Tesseract.js](https://github.com/naptha/tesseract.js) (MIT). Includes a local server to enable phone uploads via QR code.

## What it does
- Accepts an uploaded driver license image (photo or scan).
- Runs OCR locally in the browser with Tesseract.js (open source).
- Heuristically extracts common fields: Name, License Number, Date of Birth, Address.
- Shows full OCR text so you can review/copy as needed.

## How to use (PC camera)
1) Run the local server: `node server.js` (from this folder) — serves at `http://localhost:5080`.  
2) Open `http://localhost:5080` on your PC.  
3) Click **Start Camera**, frame the license, then **Capture & Scan**.  
4) Review/edit the extracted fields and the raw OCR text.

## Phone capture → PC processing
1) With the server running (`http://localhost:5080` open on your PC), scan the QR code shown on the page with your phone.  
2) The QR opens `mobile-upload.html` on your phone. Take/upload a license photo.  
3) Back on the PC page, click **Fetch last mobile upload & scan** to pull the latest phone photo and run OCR.  
4) Review/edit the extracted fields and raw text.

## Notes
- Default OCR language is English (`eng`). Adjust the language code field if you have other traineddata available.  
- Extraction rules are lightweight heuristics; always review the output.  
- Everything runs locally; OCR uses Tesseract.js from its CDN (MIT). Server uses express + multer (both MIT).
