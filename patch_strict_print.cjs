const fs = require('fs');
let content = fs.readFileSync('src/components/ContractView.tsx', 'utf8');

// 1. Remove the inline style I added earlier
const styleStart = content.indexOf('<style>{`');
const styleEnd = content.indexOf('`}</style>', styleStart);
if (styleStart > -1 && styleEnd > -1) {
    content = content.slice(0, styleStart) + content.slice(styleEnd + 11);
}

// 2. Replace the runtime style textContent
const oldStyleText = `        @media print {
          #root, #initial-loader, .print-hidden {
            display: none !important;
          }
          #print-duplicates-container {
            visibility: visible !important;
            z-index: 9999 !important;
          }
          .print-contract-copy {
            page-break-after: always !important;
            break-after: page !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            margin: 0 auto !important;
          }
          .print-contract-copy:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }`;

const newStyleText = `        @media print {
          /* 1. إلغاء تأثير تكبير شاشة اللابتوب (Scaling) وإجبار المتصفح على حجم الورق القانوني */
          html, body {
            width: 210mm !important; /* أبعاد ورقة A4 الرسمية بالطول */
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. تحديد هوامش الصفحة الورقية كلياً بشكل ثابت لا يتأثر بنوع الجهاز */
          @page {
            size: A4 portrait !important; /* فرض الطباعة بالطول ورق رسمي A4 */
            margin: 20mm 15mm 20mm 15mm !important; /* هوامش ثابتة: أعلى، يمين، أسفل، يسار */
          }

          /* 3. توحيد حجم خطوط نصوص العقد بالسنتيمتر والنقاط الثابتة بدل البكسل */
          .contract-body, p, td, span, div {
            font-size: 14pt !important; /* حجم الخط القياسي للمعاملات القانونية */
            line-height: 1.6 !important; /* قفل المسافة بين الأسطر لمنع تداخل الكلام باللابتوب */
          }

          /* 4. إجبار عناوين البنود على أحجام ثابتة */
          h1, h2, h3 {
            font-size: 18pt !important;
            font-weight: bold !important;
            margin-bottom: 10mm !important;
          }

          /* 5. منع ترحيل التواقيع أو الأسطر الأخيرة لصفحة جديدة فارغة */
          .contract-signatures, .signature-area {
            page-break-inside: avoid !important; /* يمنع كسر منطقة التواقيع إلى نصفين بين الصفحات */
            margin-top: 15mm !important;
          }

          /* إخفاء شريط النظام والأزرار وأي شيء ليس له علاقة بنص العقد القانوني */
          .btn, button, .navbar, .sidebar, .no-print, .print-hidden, #root, #initial-loader {
            display: none !important;
          }

          #print-duplicates-container {
            visibility: visible !important;
            z-index: 9999 !important;
            width: 210mm !important;
          }

          .print-contract-copy {
            page-break-after: always !important;
            break-after: page !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            margin: 0 auto !important;
            width: 210mm !important;
          }

          .print-contract-copy:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }`;

content = content.replace(oldStyleText, newStyleText);

fs.writeFileSync('src/components/ContractView.tsx', content);
