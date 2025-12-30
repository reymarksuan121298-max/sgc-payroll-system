import React, { useState } from 'react';
import { XMarkIcon, PrinterIcon, ShieldCheckIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PayrollPrintModal({ isOpen, onClose, data, calculateRow }) {
  const [reportMeta] = useState(() => ({
    id: `PYR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    date: new Date().toLocaleDateString('en-GB'),
    timestamp: new Date().toLocaleString(),
  }));

  const groupedData = data.reduce((acc, emp) => {
    const area = emp.area || 'UNDEFINED AREA';
    if (!acc[area]) acc[area] = [];
    acc[area].push(emp);
    return acc;
  }, {});

  const areaKeys = Object.keys(groupedData).sort();

  // --- EXPORT TO EXCEL LOGIC (UPDATED) ---
  const exportToExcel = () => {
    const exportData = [];
    
    areaKeys.forEach(area => {
      exportData.push({ 'Personnel Name': `AREA: ${area.toUpperCase()}` });
      
      groupedData[area].forEach(emp => {
        const v = calculateRow(emp) || {};
        // UPDATE: Check kung exempted para sa Days column
        const displayDays = v.isTimeExempted ? v.cutoffDays : (v.days || 0);

        exportData.push({
          'Personnel Name': emp.name || 'N/A',
          'Designation': emp.designation || 'Staff',
          'Area': area,
          'Monthly Basic': emp.basic_salary || 0,
          'Days': displayDays,
          'Gross Pay': v.totalBasic || 0,
          'OT Pay': v.otPay || 0,
          'Allowance': v.allowance || 0,
          'Late Ded.': v.lateDed || 0,
          'UT Ded.': v.utDed || 0,
          'PHIC': emp.phic_fixed_amount || 0,
          'HDMF': emp.hdmf_fixed_amount || 0,
          'SSS': emp.sss_fixed_amount || 0,
          'Other Ded.': v.volDed || 0,
          'Net Disbursed': v.netPay || 0
        });
      });
      exportData.push({});
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Report");
    XLSX.writeFile(workbook, `Payroll_Grouped_${reportMeta.id}.xlsx`);
  };

  // --- EXPORT TO PDF LOGIC (UPDATED) ---
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    let currentY = 30;

    doc.setFontSize(20);
    doc.text("PAYROLL SUMMARY REPORT (SEGMENTED)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Report ID: ${reportMeta.id} | Date: ${reportMeta.date}`, 14, 22);

    areaKeys.forEach((area, index) => {
      const tableRows = groupedData[area].map((emp) => {
        const v = calculateRow(emp) || {};
        // UPDATE: Check kung exempted para sa PDF table
        const displayDays = v.isTimeExempted ? v.cutoffDays : (v.days || 0);

        return [
          emp.name,
          emp.basic_salary,
          displayDays,
          v.totalBasic,
          v.otPay,
          v.allowance,
          v.lateDed,
          v.utDed,
          emp.phic_fixed_amount,
          emp.hdmf_fixed_amount,
          emp.sss_fixed_amount,
          v.netPay
        ];
      });

      if (index !== 0) currentY = doc.lastAutoTable.finalY + 15;

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text(`AREA: ${area}`, 14, currentY - 2);

      autoTable(doc, {
        head: [["Personnel", "Basic", "Days", "Gross", "OT", "Allow.", "Late", "UT", "PHIC", "HDMF", "SSS", "Net Pay"]],
        body: tableRows,
        startY: currentY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { top: 30 }
      });
    });

    doc.save(`Payroll_Grouped_${reportMeta.id}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md print:static print:bg-white">
      <div className="bg-[#f8fafc] w-full max-w-[99%] h-[92vh] rounded-2xl flex flex-col shadow-2xl print:shadow-none print:h-auto print:w-full overflow-hidden border border-slate-200">
        
        {/* --- TOOLBAR --- */}
        <div className="flex justify-between items-center px-8 py-4 bg-white border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Area-Segmented Report</h2>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest italic">Grouped by Operational Sector</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
              <ArrowDownTrayIcon className="w-4 h-4" /> Excel
            </button>
            <button onClick={exportToPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
              <ArrowDownTrayIcon className="w-4 h-4" /> PDF
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 border-l-2 border-slate-700 ml-2">
              <PrinterIcon className="w-4 h-4" /> Print Preview
            </button>
            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl text-slate-600 transition-all border border-slate-200">
              <XMarkIcon className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {/* --- PRINTABLE CONTENT --- */}
        <div className="flex-1 overflow-auto p-12 bg-slate-100 print:p-0 print:bg-white scrollbar-hide">
          <div className="bg-white text-slate-900 p-12 mx-auto shadow-sm print:shadow-none relative border border-slate-200 print:border-none" 
               style={{ minWidth: '1650px', width: 'max-content' }}>
            
            {/* Report Header */}
            <div className="flex justify-between items-start mb-10 border-b-4 border-slate-900 pb-8">
              <div className="space-y-1">
                <h1 className="text-4xl font-serif font-black tracking-tighter text-slate-900 uppercase">Payroll Summary</h1>
                <p className="text-sm font-bold text-blue-700 tracking-[0.2em] uppercase italic">Sector-Based Financial Breakdown</p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">CERTIFIED OFFICIAL</span>
                <p className="text-[10px] text-slate-500 mt-4 font-mono">Run Date: {reportMeta.date}</p>
                <p className="text-[10px] text-slate-500 font-mono tracking-tight">ID: {reportMeta.id}</p>
              </div>
            </div>

            {/* SEGMENTED TABLES PER AREA */}
            {areaKeys.map((area) => {
              const areaNetTotal = groupedData[area].reduce((sum, emp) => sum + (calculateRow(emp)?.netPay || 0), 0);
              
              return (
                <div key={area} className="mb-12 avoid-page-break">
                  <div className="bg-slate-900 text-white px-6 py-2.5 flex justify-between items-center mb-1 rounded-t-lg">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic">Area: {area}</h3>
                    <span className="text-[10px] font-bold opacity-60">Total Personnel: {groupedData[area].length}</span>
                  </div>

                  <table className="w-full text-[10px] border-collapse mb-0">
                    <thead>
                      <tr className="bg-slate-200 text-slate-800 uppercase tracking-tighter">
                        <th className="p-3 text-left border border-slate-400" rowSpan="2">Personnel Details</th>
                        <th className="p-3 border border-slate-400" rowSpan="2">Basic Pay</th>
                        <th className="p-3 border border-slate-400" rowSpan="2">Days</th>
                        <th className="p-3 border border-slate-400" rowSpan="2">Gross</th>
                        <th className="p-3 border border-slate-400 bg-slate-300/50" colSpan="2">Earnings</th>
                        <th className="p-3 border border-slate-400 bg-orange-100/50" colSpan="2">Attendance</th>
                        <th className="p-3 border border-slate-400 bg-red-100/50" colSpan="3">Mandatory</th>
                        <th className="p-3 border border-slate-400" rowSpan="2">Others</th>
                        <th className="p-3 bg-slate-800 text-white font-black" rowSpan="2">Net Disbursed</th>
                        <th className="p-3 border border-slate-400 w-32" rowSpan="2">Signature</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-600 uppercase font-black text-[8px]">
                        <th className="p-1.5 border border-slate-300">OT Pay</th>
                        <th className="p-1.5 border border-slate-300">Allow.</th>
                        <th className="p-1.5 border border-slate-300">Late</th>
                        <th className="p-1.5 border border-slate-300">UT</th>
                        <th className="p-1.5 border border-slate-300">PHIC</th>
                        <th className="p-1.5 border border-slate-300">HDMF</th>
                        <th className="p-1.5 border border-slate-300">SSS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border-x border-slate-300">
                      {groupedData[area].map((emp, i) => {
                        const v = calculateRow(emp) || {};
                        const format = (val) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        
                        // UPDATE: UI logic para sa Days column
                        const displayDays = v.isTimeExempted ? v.cutoffDays : (v.days || 0);

                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors odd:bg-white even:bg-slate-50/20">
                            <td className="p-3 border-r border-slate-200">
                              <div className="font-black text-slate-900 uppercase text-[11px] leading-none">
                                {emp.name} 
                                {v.isTimeExempted && <span className="ml-2 text-[7px] text-purple-600 bg-purple-50 px-1 rounded border border-purple-100 print:border-none print:bg-transparent"></span>}
                              </div>
                              <div className="text-[8px] text-slate-400 font-bold uppercase mt-1 italic">{emp.designation}</div>
                            </td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono">{format(emp.basic_salary)}</td>
                            
                            {/* DITO NAG-REFLECT ANG DAYS */}
                            <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-600">
                                {displayDays}
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center font-mono font-bold">{format(v.totalBasic)}</td>
                            <td className="p-3 border-r border-slate-200 text-center text-green-700 font-mono">{format(v.otPay)}</td>
                            <td className="p-3 border-r border-slate-200 text-center text-green-700 font-mono">{format(v.allowance)}</td>
                            <td className="p-3 border-r border-slate-200 text-center text-orange-700 bg-orange-50/20 font-mono">
                                {v.isTimeExempted ? "0.00" : format(v.lateDed)}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-center text-orange-700 bg-orange-50/20 font-mono">
                                {v.isTimeExempted ? "0.00" : format(v.utDed)}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono">{format(emp.phic_fixed_amount)}</td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono">{format(emp.hdmf_fixed_amount)}</td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono">{format(emp.sss_fixed_amount)}</td>
                            <td className="p-3 border-r border-slate-200 text-center text-red-700 font-mono bg-red-50/10">{format(v.volDed)}</td>
                            <td className="p-3 bg-slate-100 text-center text-slate-900 font-black text-[12px] italic border-x-2 border-slate-900">₱{format(v.netPay)}</td>
                            <td className="p-3 border-b border-slate-300"></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-900 font-black">
                        <td colSpan="12" className="p-3 text-right uppercase tracking-[0.2em] text-[9px] text-slate-500 italic">Subtotal Net for {area}</td>
                        <td className="p-3 text-center text-[12px] bg-slate-900 text-white italic">₱{areaNetTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })}

            {/* Final Signatories */}
            <div className="mt-20 grid grid-cols-4 gap-12 print:mt-32">
              <div className="space-y-16">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-4 border-slate-300 pl-4">Prepared By</p>
                <div className="pt-4 border-t-2 border-slate-900">
                  <p className="text-xs font-black uppercase">Payroll Administrator</p>
                </div>
              </div>
              <div className="space-y-16">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-4 border-slate-300 pl-4">Audited By</p>
                <div className="pt-4 border-t-2 border-slate-900">
                  <p className="text-xs font-black uppercase">Finance Officer</p>
                </div>
              </div>
              <div className="space-y-16 col-span-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-4 border-slate-300 pl-4">Approved For Disbursement</p>
                <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-end">
                  <div>
                    <p className="text-sm font-black uppercase">Managing Director</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 font-mono tracking-tighter italic">Digital Hash: {reportMeta.timestamp}</p>
                  </div>
                  <div className="w-16 h-16 border-2 border-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-black text-slate-200 -rotate-45 uppercase">Official Seal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .print\\:static, .print\\:static * { visibility: visible !important; }
          .print\\:static { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            height: auto !important; 
            background: white !important; 
            padding: 0 !important;
          }
          .avoid-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block;
          }
          table { border: 1.5px solid #000 !important; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #000 !important; color: #000 !important; }
          .bg-slate-900 { background-color: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact; }
          .bg-slate-100 { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}