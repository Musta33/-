const fs = require('fs');

let content = fs.readFileSync('src/components/ContractView.tsx', 'utf8');

const styleBlock = `
      <style>{` + "\`" + `
        @media print {
            html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                color: #000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            @page {
                size: A4 portrait !important;
                margin: 20mm 15mm 20mm 15mm !important;
            }
            #print-duplicates-container, .print-contract-copy {
                width: 210mm !important;
            }
            .contract-body, .contract-body p, .contract-body td, .contract-body span {
                font-size: 14pt !important;
                line-height: 1.6 !important;
            }
            .contract-body h1, .contract-body h2, .contract-body h3 {
                font-size: 18pt !important;
                font-weight: bold !important;
                margin-bottom: 10mm !important;
            }
            .contract-signatures {
                page-break-inside: avoid !important;
                margin-top: 15mm !important;
            }
            .btn, button, .navbar, .sidebar, .no-print, .print-hidden {
                display: none !important;
            }
        }
      ` + "\`" + `}</style>
`;

if (!content.includes('font-size: 14pt !important;')) {
    content = content.replace(
        '<div className="bg-slate-50 dark:bg-neutral-900 rounded-3xl min-h-screen">',
        styleBlock + '\n    <div className="bg-slate-50 dark:bg-neutral-900 rounded-3xl min-h-screen">'
    );
    fs.writeFileSync('src/components/ContractView.tsx', content);
}
