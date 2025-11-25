/**
 * HeySalad QC - PDF Mat Generator
 * 
 * Generates printable A4 QR code mats for QC stations.
 * Requirements: 2.1, 2.2, 2.3, 2.6
 */

import { jsPDF } from 'jspdf';
import type { Station, MatLayout } from '../types';
import { generateStationUrl } from './qrcode';
import QRCode from 'qrcode';

/** A4 dimensions in mm */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** QR code size in mm (50mm x 50mm as per requirements) */
const QR_SIZE_MM = 50;

/** Margins and spacing in mm */
const MARGIN_MM = 15;
const HEADER_HEIGHT_MM = 25;
const FOOTER_HEIGHT_MM = 15;

/** Detection zone border style */
const BORDER_DASH_PATTERN = [3, 3]; // 3mm dash, 3mm gap
const BORDER_WIDTH_MM = 0.5;

/** Layout configurations */
interface LayoutConfig {
  rows: number;
  cols: number;
  zoneWidth: number;
  zoneHeight: number;
}

const LAYOUT_CONFIGS: Record<MatLayout, LayoutConfig> = {
  '1x1': {
    rows: 1,
    cols: 1,
    zoneWidth: A4_WIDTH_MM - (2 * MARGIN_MM),
    zoneHeight: A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - (2 * MARGIN_MM),
  },
  '2x1': {
    rows: 1,
    cols: 2,
    zoneWidth: (A4_WIDTH_MM - (3 * MARGIN_MM)) / 2,
    zoneHeight: A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - (2 * MARGIN_MM),
  },
  '2x2': {
    rows: 2,
    cols: 2,
    zoneWidth: (A4_WIDTH_MM - (3 * MARGIN_MM)) / 2,
    zoneHeight: (A4_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - (3 * MARGIN_MM)) / 2,
  },
};

/**
 * Generates a QR code as a base64 data URL for embedding in PDF.
 */
async function generateQRCodeForPDF(stationId: string): Promise<string> {
  const url = generateStationUrl(stationId);
  return QRCode.toDataURL(url, {
    type: 'image/png',
    width: 300, // Higher resolution for print quality
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

/** HeySalad Logo as base64 PNG (resized for PDF) */
const HEYSALAD_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJMAAAAyCAYAAABYpeleAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAAITgAACE4AUWWMWAAAAAHdElNRQfpCxkXATphIJToAAAMs0lEQVR42u2beXRU1R3HP2/mZSYLJCGTBJiEIIsCgrKIIBS02qoFQmux1qVSLW3dq1Zsj6VVtK1dlNZqq9Xaaq3UVkXayna0Ll3OUSpIPaBRCigmIQkkBBhCJjPMzOsf9/eSO8PMJCGAy7nfc96BN+++u37v97fcFzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDgWsI5URbvnzgXHyVomsHKlmXFDpuxora5Go5EXGA0MBw4ANUCTIdXHH56+VlDq9+tEKgXuAl4AlgMrgb8DC4EBbqHd1dVm5j+G6LMyacQoAh4ALklTzAFWAzcD7+A4YFlGoQ5fAGztPi7XsWovBiTSFbSPBJEsxZYbXCJZgMeycICE8qMsYA4wEFiAZW3KUq0P8Gv3HcDBNOX8Ura7cscauUAVUC4LsR9oAHYeofonAIuBHKn/IeAvR3E8s4DrRBDiwA+B//SJTC1z5mBZ1iFyI0SaBlzrPm2JRmmOROhv2wTz8vBIWWAy8AvgYmDX7urqdOp0GfB16biFMpvL03TpaiFvXKq/A3juAySRD/gssEAWvFD6HwEaUeb+IeDtPrZTJhvTK/cvHOVxHQd8Rrv/baaCdneqkwn92ttpy88HKAButqC8I5Hg8dpaltbW0tDRQaFtM3fwYK4bMYIyv99VqbOELHdmqLoKOFW7H5Sh3LCUcuUfIJHygduBb4gypT4bAJwoi3JDH0nvoEyNS6bEUR6bHqLHsrVnZyKS1+Mhnkggu2sIcBIqSgsChW35+TbKrJQBszyWxaqmJm6tqSGq3mN3NMp927bRFImwZNw4+tm227NLgceA+pbZsyldvVpvPpFlMJnKOcdgUrNhPnCTtsCgzFtcFMoNdEahgpFX5PnHCnYmRRIijQKuQcnqEJJ9lCSE43GW7djRSSQdz+zYwcxAgPlVVcSVOo0EpgL1lsdztMfokb4PFdVoAbYCoRT1KNXuI8CuNEQuAfpp9yHZUBdrRIoAvwSWybNxwNeAmcAW4CcZiBRAmZQSIWET8B4QPswxV8q4+6FSNLVAfZZN55E5Ok4E5H1gW282aTafaTrwG2BsUouW1bnN4o6DI71ojUbZ0taWtqK447C8oYF5wSB5Xi+Oacci8IxzdIl0InA9cA7K+fcC7cCbwP3AMyLdw4A/yIJaMulfArZrdeUBvwJmyGInNJWp0Mo1S7n35X4Dyl+6CZUq+WdKHyuAy4F5qNxcnpA4BKwHlgAv92LMU4ErgE/KmHOE1LuAVSgftC7lnSAq0p6HchcsGcdy2Rx9IlNAdlASkSygJhRibWsrAZ+Ps8rKOk2X7fHgE5WxgE8EAkwPBPhjXR07wmG2tLXRHI0yND8fR6lTMMdxOGh1m504XL7NlM0wOuV3vzw7BeWf/UwUYyswScpUAdVCChdjgHNFOQA2y2LHUtRjEPAd4EHgXSFFI/CtNH2cAfycZN/PRS4wG+VefBFY2814c1BBySIhkQ6fbJjrRK0uA/bJs4HAw9KWjiEo/66tr2SaKlcSkf7a2MhtNTXUh8PYlsXVw4fzvdGjsS2LgM/HjSNHsqqpiRmBAPOCQQbm5pJjWdy5eTPRRIJIPCkdYkcty7K6J8vFYio8KQSbkeWdwbKjXSLFRLJDMqmlYtoWiXK8CDyCMucF8s6FwOPapJ+tEQlRtXrp1zpZdHdOrwTOlzY3AS/JlZoeGCljQ9Rju5jA47S2hohy9YRMkzUi7RN19Eo7brplFnA6sELur08hUhvwDl0nGf36SqbhaP6Rx7J4KxRisRAJIOY4rGhs5Kphwwjm5GABF1ZWcn4wSI7HQ8JxcByHKSUl+DweCmybAjupuT1Wz1TndLl6g88DU+T/7ahI6/cyUeOBX6PC92Lgy2JG/i2XGwZPFsKukgmdpdW/C+UTIebufunjSK1MqVxTga8AG4GfynvurnpcyHslcK+01QacBjyK8nuQRc0ju//UjjK7HjFVPxAie0Sx7hCC+KS+FULai7Q6GoVcz0vZecDdaKcX2ZDJ+z3ETi5vaKAunDyWsYWFFOfkEI7H+UdzMwdiMbyW1elLgUpaJhyHUf36UerzuekB10yAdcTOmvUN8mnt/l3gLTFTU+X5eu35KSiz3i6EO6iZGXeiTxbyuXhBFsrFBiHlc6jkaSq8KB/xYVTk5yKOOjWYI0rnEzO5A2V2ddXx9mDszcBVYsZqRN2Kgf+SHHD4tXEN0X5/VMgeAvYAvwOe6qsybZHJzbeAA7EY6/bsSSowvqiIRaNGkW/bxBIJ1uzcydrWVhYefzxeyX47wPo9e4g5DrMHDSLX63Wjub3ugjqJboOFBmB3BlNWmub3gpQJGoPKEEt+tXNxXZQA/WUhnheTNV0zbePk3yL5rQP4k5hOHa8CF4ianSnkGa2pC9LOzdJOg/w2VYg4VcbjWoTiw9hIeajE6Rek7UIZq631X0elEBXZROlM6auinIdNpjdRdnMSqLC/JdIlVsMKCrjn5JMZW1hI3HHI8Xg4Lxjkq6+/Tqnfz4KhQ/F5PGwKhXiivp5TBwxg1sCBuiqtlTYoXbWquz7eIzta72sC+HGGQVopZGlL2eUu3EC0SVPiPWJ6pkk9A1GRke4grxNzSIpyTANeB9bIlSukvkjMj7uYI4TgDago8xGSo0E3o98TJUpVv+8C39YIgpDeymCFUn9Ld8aXoOuw47DI1AL82SWTx7KwtXzQ6YEAk4qLXZUh7jhMKCripKIiFr/9Nk0dHVTm5fFYbS17o1HuHjeOMr/fLd8h8tnew0lqo8sJ1pHJfwiT7Og2o/I8/9PGmyA5g3xAK/8sKrfmOtSXa2bBkXlJ7c98Ife9qOgwIuPcgvJdJgHnaYvuk4W8ViNSA+qoqUbuF2kK2BOMQZ0suET6l2zCZiH1XRzq+zQJgbzy3kTUgbyOifTwg4BsGcOlwDoHKMrJYWYg0PlgUyhETSiEBdiWhW1ZFNg2IwoKOBCLsWTLFm7cuJHN+/dz25gxnFlW1kk84GlUvqWn6K1TFUlRjpGyoBOETB7geOAW+Xc/yYm5BjFjumlyTc9WlJOs43Mox7ocuE02yjmoBGAFKlI6USsfQkWBRaJSaIt/t9T/ci82m4uhGlkSqHPApSg/biPpg51NKRtvAXCGEMsHzCXZQe+dMgVWrnSz4I2o0+mlXii5Zvhw6sJhVjU1sWHvXi587TXOLi9nUnExAb+f+nCYNTu7+lWRl8ctJ5zARZWVurPyitTZ4bZ1lPAk6shmjNxXo3yZOtmJFahjoFNQycnmlPefll0+LOX3v9GVjNTJ6obxfqlvntQZQ5nKAq38y6KSOSQ7xTNR+al9QsbeRrAhIErX1wRXyEYoReWpStK8s1WU+Cq5Hy5zt0HUanKG93pl5pSmJxJrLI/n1gTcVZGXV3Df+PGcU17OisZG3tq/nyfq61laV4dXIrICr5fJAwYwMxBgXkUFY/v373TEUZnfa1BHBL1RIqsH5ayU+20oP+UBVPgLyqEtTqljGsrxXZlmkpeRnGjcTfrI5gEhy0KUwwvKEa5KU3YD8H1Rzwgqw3ya9L0C+JFWNtHDsbrYSHJq4wy5OpczzXtxVD5uIl15xYEkp0HaZTxWlrYzk8lVJzk3ewg4mHCc24tsOzi/qorzKyrY2dFBUyRC6OBBEkKkMr+fwbm5FOUosy0OdwvKqV0CNGBZ4DjZVKlddqf7CUpHhnIHZDfGZKJS0xlrUInDG4BPiRLZskh7UeHyw6iEZTo8hfK1XNPxEvBGmnJh1BcQr6ECgimoVIPru0RQpnM1cB/JwcCDQsAFsogema9lohLTpNw+zUxFgVa6/K4Orcw35f4sVG4sjkrBPIuKNEvlnXDKxrsMuFWIWCzzvo+u/NtC2TAHpf0eqUASUj5DORXlMJ4LDPJYVhJNXQVyVI5pP8r5fFEmZr2+07oxb4NIPg6oJ31qICgEcVGLisbSbZhhKP+kWCbyPZnEA1n6MUv6ni8TeAkqF5QNfroOSwfIlLgHy3Wk91tcH26M9HUz6punoJgYR/r5rsxhf6nf9XcbSDbT+aj8UZW894Y8H6kRvIlDs/E+lG83QpZ1Oyo/58i7Xvn/dpLNc8/IlIZQNupLgumoTPIQYax7MFkvE7ERlVpoTbabDoHuUwEfBtioBN6lmnk6V4hhcDjK1EmoOXMyZaptudwPttJ+i2zF45SsWfNRmpcJqCjI/eBuMcrXMehmB3YLXU1aqqt1BsY4NBOMA5R+tP9Y4AKNSM0on8PAoNeoRCUOXTfwSZIzygYZYJspOAQx1F9geFFuwAY+HH/1YmBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYPDRxv8B8HenBHuhIswAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjUtMTEtMjVUMjI6MjQ6NDYrMDA6MDBs2jRgAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI1LTExLTIxVDE0OjEyOjExKzAwOjAwDIkc8QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNS0xMS0yNVQyMzowMTo1NyswMDowMEOcDSkAAAAASUVORK5CYII=';

/**
 * Draws the HeySalad logo from embedded image.
 */
function drawLogo(doc: jsPDF, x: number, y: number): void {
  // Add the actual HeySalad logo image
  doc.addImage(HEYSALAD_LOGO_BASE64, 'PNG', x, y - 5, 40, 10);
}

/**
 * Draws a dashed detection boundary rectangle.
 */
function drawDetectionZone(
  doc: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number
): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BORDER_WIDTH_MM);
  doc.setLineDashPattern(BORDER_DASH_PATTERN, 0);
  doc.rect(x, y, width, height);
  doc.setLineDashPattern([], 0); // Reset dash pattern
}

/**
 * Draws a single detection zone with QR code and labels.
 */
async function drawZoneContent(
  doc: jsPDF,
  station: Station,
  qrDataUrl: string,
  zoneX: number,
  zoneY: number,
  zoneWidth: number,
  zoneHeight: number
): Promise<void> {
  // Draw dashed detection boundary
  drawDetectionZone(doc, zoneX, zoneY, zoneWidth, zoneHeight);
  
  // Calculate QR code position (centered horizontally, near top of zone)
  const qrX = zoneX + (zoneWidth - QR_SIZE_MM) / 2;
  const qrY = zoneY + 10;
  
  // Add QR code image
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE_MM, QR_SIZE_MM);
  
  // Add station name below QR code
  const textY = qrY + QR_SIZE_MM + 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  // Center the station name
  const stationNameWidth = doc.getTextWidth(station.name);
  const nameX = zoneX + (zoneWidth - stationNameWidth) / 2;
  doc.text(station.name, nameX, textY);
  
  // Add bilingual labels
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  const labelEn = 'Scan for QC Check';
  const labelZh = '扫描进行质检';
  
  const labelEnWidth = doc.getTextWidth(labelEn);
  const labelZhWidth = doc.getTextWidth(labelZh);
  
  doc.text(labelEn, zoneX + (zoneWidth - labelEnWidth) / 2, textY + 6);
  doc.text(labelZh, zoneX + (zoneWidth - labelZhWidth) / 2, textY + 11);
  
  // Add "Place items here" instruction at bottom of zone
  const instructionY = zoneY + zoneHeight - 10;
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  
  const instructionEn = 'Place items in detection zone';
  const instructionZh = '将物品放置在检测区域内';
  
  const instrEnWidth = doc.getTextWidth(instructionEn);
  const instrZhWidth = doc.getTextWidth(instructionZh);
  
  doc.text(instructionEn, zoneX + (zoneWidth - instrEnWidth) / 2, instructionY);
  doc.text(instructionZh, zoneX + (zoneWidth - instrZhWidth) / 2, instructionY + 5);
}

/**
 * Generates a PDF mat for a station with the specified layout.
 * 
 * @param station - The station to generate the mat for
 * @param layout - The layout option (1x1, 2x1, or 2x2)
 * @returns Promise resolving to PDF as ArrayBuffer
 */
export async function generateMatPDF(
  station: Station,
  layout: MatLayout
): Promise<ArrayBuffer> {
  // Create PDF document (A4 size, portrait orientation)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Generate QR code data URL
  const qrDataUrl = await generateQRCodeForPDF(station.id);
  
  // Get layout configuration
  const config = LAYOUT_CONFIGS[layout];
  
  // Draw header with logo
  drawLogo(doc, MARGIN_MM, MARGIN_MM + 5);
  
  // Draw station type badge
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const typeText = `Station Type: ${station.type.charAt(0).toUpperCase() + station.type.slice(1)}`;
  doc.text(typeText, A4_WIDTH_MM - MARGIN_MM - doc.getTextWidth(typeText), MARGIN_MM + 5);
  
  // Calculate starting position for zones
  const contentStartY = MARGIN_MM + HEADER_HEIGHT_MM;
  
  // Draw detection zones based on layout
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const zoneX = MARGIN_MM + col * (config.zoneWidth + MARGIN_MM);
      const zoneY = contentStartY + row * (config.zoneHeight + MARGIN_MM);
      
      await drawZoneContent(
        doc,
        station,
        qrDataUrl,
        zoneX,
        zoneY,
        config.zoneWidth,
        config.zoneHeight
      );
    }
  }
  
  // Draw footer
  const footerY = A4_HEIGHT_MM - MARGIN_MM;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  
  const footerText = `Generated: ${new Date().toISOString().split('T')[0]} | Station ID: ${station.id}`;
  doc.text(footerText, MARGIN_MM, footerY);
  
  const urlText = `qc.heysalad.app/station/${station.id}`;
  doc.text(urlText, A4_WIDTH_MM - MARGIN_MM - doc.getTextWidth(urlText), footerY);
  
  // Return PDF as ArrayBuffer
  return doc.output('arraybuffer');
}

/**
 * Generates a filename for the mat PDF.
 */
export function generateMatFilename(station: Station, layout: MatLayout): string {
  const sanitizedName = station.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const date = new Date().toISOString().split('T')[0];
  return `heysalad-qc-mat-${sanitizedName}-${layout}-${date}.pdf`;
}

/**
 * Validates mat generation request parameters.
 */
export function validateMatRequest(
  stationId: unknown,
  layout: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof stationId !== 'string' || stationId.trim().length === 0) {
    errors.push('station_id is required and must be a non-empty string');
  }
  
  if (!['1x1', '2x1', '2x2'].includes(layout as string)) {
    errors.push('layout must be one of: 1x1, 2x1, 2x2');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
