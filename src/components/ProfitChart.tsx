import React, { useMemo } from 'react';
import { format, isDate } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface Contract {
  createdAt?: any;
  totalAmount?: number | string;
  rentalCost?: number | string;
  bookingStatus?: string;
  plateNumber?: string;
  carId?: string;
  [key: string]: any;
}

interface Props {
  contracts: Contract[];
  cars?: any[];
  maintenanceRecords?: any[];
}

export const ProfitChart: React.FC<Props> = ({ contracts, cars = [], maintenanceRecords = [] }) => {
  const data = useMemo(() => {
    let totalIncome = 0;
    let companyIncome = 0;
    let investorIncome = 0;
    
    // Map cars for quick lookup
    const carMap = new Map();
    cars.forEach(car => {
      if (car.id) carMap.set(car.id, car);
      if (car.plateNumber) carMap.set(car.plateNumber, car);
    });

    contracts.forEach((contract) => {
      if (contract.bookingStatus === 'cancelled') return;

      const rawAmount = contract.rentalCost || contract.totalAmount || 0;
      const amount = parseFloat(typeof rawAmount === 'string' ? rawAmount.replace(/,/g, '') : rawAmount.toString());

      if (!isNaN(amount)) {
        totalIncome += amount;
        
        let matchedCar = null;
        if (contract.carId && carMap.has(contract.carId)) {
          matchedCar = carMap.get(contract.carId);
        } else if (contract.plateNumber && carMap.has(contract.plateNumber)) {
          matchedCar = carMap.get(contract.plateNumber);
        }

        if (matchedCar && matchedCar.isInvested) {
          const perc = parseFloat(matchedCar.investmentPercentage) || 0;
          const compShare = amount * (perc / 100);
          const investShare = amount - compShare;
          companyIncome += compShare;
          investorIncome += investShare;
        } else {
          companyIncome += amount;
        }
      }
    });

    let totalMaintenance = 0;
    maintenanceRecords.forEach(rec => {
        const rawMaint = rec.total || 0;
        const maintAmt = parseFloat(typeof rawMaint === 'string' ? rawMaint.replace(/,/g, '') : rawMaint.toString());
        if (!isNaN(maintAmt)) {
            totalMaintenance += maintAmt;
        }
    });

    const netProfit = companyIncome - totalMaintenance;

    return { totalIncome, companyIncome, investorIncome, totalMaintenance, netProfit };
  }, [contracts, cars, maintenanceRecords]);

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col">
      <div className="flex flex-col md:flex-row-reverse justify-between items-start md:items-center mb-6 gap-3">
        <h3 className="text-xl font-black text-right text-[#eadfdf]">الأرباح بالتفصيل</h3>
        <p className="text-xs font-bold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full text-right w-fit">
          تحسب الربح عن جميع العقود الفعالة والمكتملة
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/50 flex flex-col text-right">
             <span className="text-amber-800 dark:text-amber-500 font-bold text-sm mb-1">صافي أرباح الشركة النهائي</span>
             <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
               {data.netProfit.toLocaleString('en-US')} <span className="text-lg">د.ع</span>
             </span>
        </div>
        
        <div className="p-5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex flex-col text-right">
             <span className="text-blue-800 dark:text-blue-500 font-bold text-sm mb-1">إجمالي الواردات (قبل الاستقطاع)</span>
             <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
               {data.totalIncome.toLocaleString('en-US')} <span className="text-base text-blue-500/70">د.ع</span>
             </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 text-right">
              <span className="font-bold text-neutral-500 text-xs mb-1">حصة الشركة من العقود</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-100 text-lg">{data.companyIncome.toLocaleString('en-US')} د.ع</span>
          </div>
          <div className="flex flex-col p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 text-right">
              <span className="font-bold text-neutral-500 text-xs mb-1">حصص المستثمرين</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-100 text-lg">{data.investorIncome.toLocaleString('en-US')} د.ع</span>
          </div>
          <div className="flex flex-col p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 text-right">
              <span className="font-bold text-rose-500 text-xs mb-1">صرفيات الصيانة وإدامة</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 text-lg">{data.totalMaintenance.toLocaleString('en-US')} د.ع</span>
          </div>
      </div>
    </div>
  );
};

