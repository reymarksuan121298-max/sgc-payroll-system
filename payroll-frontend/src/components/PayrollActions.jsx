import React from 'react';
import { TableCellsIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Inayos ang import

export default function PayrollActions({ data, calculateRow }) {
  
  const handleExcel = () => {
    try {
      const exportData = data.map(emp => {
        const v = calculateRow(emp) || {}; // Safety fallback
        return {
          'EMPLOYEE NAME': emp.name || 'N/A',
          'DESIGNATION': emp.designation || 'N/A',
          'BASIC MONTHLY SALARY': emp.basic_salary || 0,
          '# OF DAYS': v.days || 0,
          'TOTAL BASIC PAY': (v.totalBasic || 0).toFixed(2),
          'NET PAY': (v.netPay || 0).toFixed(2)
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payroll");
      XLSX.writeFile(wb, `Payroll_${new Date().toLocaleDateString()}.xlsx`);
    } catch (error) {
      console.error("Excel Export Error:", error);
      alert("Failed to export Excel. Please check data console.");
    }
  };

  const handlePDF = () => {
    try {
      const doc = new jsPDF('landscape');
      
      const tableData = data.map(emp => {
        const v = calculateRow(emp) || {}; // Safety fallback
        return [
          emp.name || 'N/A', 
          emp.designation || 'N/A', 
          v.days || 0, 
          `P ${(v.totalBasic || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 
          `P ${(v.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ];
      });

      // Tamang paraan ng pagtawag sa autoTable
      autoTable(doc, {
        head: [['Name', 'Designation', 'Days', 'Total Basic', 'Net Pay']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [22, 27, 44], textColor: [255, 255, 255] }, // Dark theme para sa PDF header
        styles: { fontSize: 9 }
      });

      doc.save("Payroll_Report.pdf");
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Failed to generate PDF. Check if jspdf-autotable is installed.");
    }
  };

  return (
    <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5 shadow-inner">
      <button 
        onClick={handleExcel} 
        className="p-2.5 hover:bg-green-500/10 text-green-500 rounded-lg transition-all group active:scale-90" 
        title="Export Excel"
      >
        <TableCellsIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>
      
      <div className="w-[1px] h-5 bg-white/10 mx-1" />
      
      <button 
        onClick={handlePDF} 
        className="p-2.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-all group active:scale-90" 
        title="Export PDF"
      >
        <DocumentArrowDownIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}