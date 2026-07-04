const fs = require('fs');

let content = fs.readFileSync('src/components/ContractView.tsx', 'utf8');

const styleBlock = `
      <style>{` + "\`" + `
        @media print {
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
            #contract, .contract-body, p, td, span, .text-xs, .text-sm, .text-base, .text-lg, .text-xl, .text-2xl {
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
            .btn, button, .navbar, .sidebar, .no-print, .print-hidden, .print\\:hidden {
                display: none !important;
            }

            #print-duplicates-container {
                width: 210mm !important;
            }
            .print-contract-copy {
                width: 210mm !important;
            }
        }
      ` + "\`" + `}</style>
`;

if (!content.includes('font-size: 14pt !important;')) {
    content = content.replace(
        '<div\n      className="p-6 bg-neutral-100 min-h-screen print:p-0 print:bg-white"\n      dir="rtl"\n    >',
        '<div\n      className="p-6 bg-neutral-100 min-h-screen print:p-0 print:bg-white"\n      dir="rtl"\n    >\n' + styleBlock
    );
    fs.writeFileSync('src/components/ContractView.tsx', content);
}
