import pdfMake from 'pdfmake/build/pdfmake';
import { formatRupees } from './clientMoney';

// We dynamically fetch the font file so we don't bloat the bundle.
let fontLoaded = false;

async function loadFonts() {
  if (fontLoaded) return;
  // URL to a raw TTF font supporting Gujarati (Noto Sans Gujarati)
  const fontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansGujarati/NotoSansGujarati-Regular.ttf';
  const boldFontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansGujarati/NotoSansGujarati-Bold.ttf';
  
  const [regularRes, boldRes] = await Promise.all([
    fetch(fontUrl),
    fetch(boldFontUrl)
  ]);
  if (!regularRes.ok || !boldRes.ok) {
    throw new Error('Could not load Gujarati PDF font.');
  }
  
  const regularBuffer = await regularRes.arrayBuffer();
  const boldBuffer = await boldRes.arrayBuffer();
  
  // Convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const vfs = {
    'NotoSansGujarati-Regular.ttf': arrayBufferToBase64(regularBuffer),
    'NotoSansGujarati-Bold.ttf': arrayBufferToBase64(boldBuffer),
  };
  
  pdfMake.vfs = vfs;
  pdfMake.fonts = {
    NotoSansGujarati: {
      normal: 'NotoSansGujarati-Regular.ttf',
      bold: 'NotoSansGujarati-Bold.ttf',
    },
  };
  fontLoaded = true;
}

export async function downloadSlipPdf(receiptData, branding = {}) {
  await loadFonts();

  const { slipId, amount, scheme, donorName, village, paymentMode, paymentConfirmed, date } = receiptData;
  const { trustName = 'શ્રી સગર જ્ઞાતિ સમાજ', regNo = 'રજી. નં. એ/૧૬૦૩', receiptFooter = 'દાન આપવા બદલ આભાર.' } = branding;

  const docDefinition = {
    content: [
      { text: trustName, style: 'header', alignment: 'center' },
      { text: regNo, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] },
      
      {
        layout: 'noBorders',
        table: {
          widths: ['*', 'auto'],
          body: [
            [{ text: 'સ્લિપ નંબર (Slip No):', color: 'gray' }, { text: slipId || '—', bold: true }],
            [{ text: 'દાતાનું નામ (Donor Name):', color: 'gray' }, { text: donorName || '—' }],
            ...(village ? [[{ text: 'ગામ (Village):', color: 'gray' }, { text: village }]] : []),
            ...(scheme ? [[{ text: 'યોજના (Scheme):', color: 'gray' }, { text: scheme }]] : []),
            [{ text: 'રકમ (Amount):', color: 'gray', margin: [0, 5, 0, 0] }, { text: formatRupees(amount), bold: true, fontSize: 16, margin: [0, 5, 0, 0] }],
            [{ text: 'ચૂકવણી પ્રકાર (Payment Mode):', color: 'gray' }, { text: (paymentMode || '—').toUpperCase() }],
            [{ text: 'તારીખ (Date):', color: 'gray' }, { text: date ? new Date(date).toLocaleDateString('gu-IN') : '—' }],
            [{ text: 'સ્થિતિ (Status):', color: 'gray' }, { text: paymentConfirmed ? 'ખાતરી થયેલ (Confirmed)' : 'અખાતરી (Unconfirmed)', bold: true }],
          ]
        },
        margin: [0, 0, 0, 20]
      },

      { text: receiptFooter, alignment: 'center', style: 'footer', margin: [0, 20, 0, 0] }
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true
      },
      subheader: {
        fontSize: 12,
        color: 'gray'
      },
      footer: {
        fontSize: 10,
        italics: true,
        color: 'gray'
      }
    },
    defaultStyle: {
      font: 'NotoSansGujarati',
      fontSize: 12
    }
  };

  pdfMake.createPdf(docDefinition).download(`Slip_${slipId || 'Draft'}.pdf`);
}
