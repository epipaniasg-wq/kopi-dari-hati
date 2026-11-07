import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CafeSettings, Expense, Ingredient, Order } from '../types';
import { formatDate, formatDateTime, formatNumber, formatRupiah } from '../utils/format';

interface ReportData {
  title: string;
  periodLabel: string;
  settings: CafeSettings;
  orders: Order[];
  expenses: Expense[];
  ingredients: Ingredient[];
  generatedBy: string;
}

export function generateFinancialReportPDF(data: ReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Banner KOPI DARI HATI
  doc.setFillColor(68, 36, 17); // Dark Coffee Brown #442411
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(data.settings.name || 'KOPI DARI HATI', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(230, 215, 200);
  doc.text(data.settings.tagline || 'Kelezatan Rasa, Hangatnya Cerita', 14, 17);
  doc.text(`${data.settings.address || 'Sentra Kuliner'} | Telp: ${data.settings.phone || '-'}`, 14, 22);

  // Document Title
  y = 36;
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN PENJUALAN, PENGELUARAN & LABA', 14, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Periode Laporan: ${data.periodLabel}`, 14, y);
  doc.text(`Dicetak pada: ${formatDateTime(new Date().toISOString())} oleh ${data.generatedBy}`, 14, y + 4);

  // Calculate totals
  const validOrders = data.orders.filter((o) => o.status === 'Selesai');
  const totalSales = validOrders.reduce((sum, o) => sum + o.total, 0);
  const totalHPP = validOrders.reduce((sum, o) => sum + (o.totalCostPrice || 0), 0);
  const grossProfit = totalSales - totalHPP;
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  // Summary Metrics Box
  y += 12;
  const boxWidth = (pageWidth - 28 - 9) / 4;
  const boxHeight = 18;

  const metrics = [
    { label: 'Total Penjualan', val: formatRupiah(totalSales), color: [16, 149, 193] },
    { label: 'HPP (Modal Bahan)', val: formatRupiah(totalHPP), color: [217, 119, 6] },
    { label: 'Pengeluaran Ops', val: formatRupiah(totalExpenses), color: [220, 38, 38] },
    { label: 'Keuntungan Bersih', val: formatRupiah(netProfit), color: netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] },
  ];

  metrics.forEach((m, idx) => {
    const bx = 14 + idx * (boxWidth + 3);
    doc.setFillColor(248, 246, 242);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'F');
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(m.label, bx + 3, y + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, bx + 3, y + 13);
  });

  y += boxHeight + 8;

  // 1. Table Penjualan (Orders)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(50, 40, 30);
  doc.text(`1. Rincian Penjualan (${validOrders.length} Transaksi)`, 14, y);

  const orderRows = validOrders.map((o) => [
    o.orderNumber,
    formatDateTime(o.createdAt),
    o.customerName || (o.tableNumber ? `Meja ${o.tableNumber}` : 'Pelanggan'),
    o.items.map((it) => `${it.name} (${it.quantity}x)`).join(', '),
    o.paymentMethod,
    formatRupiah(o.total),
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['No. Order', 'Waktu', 'Pelanggan/Meja', 'Menu Terjual', 'Bayar', 'Total']],
    body: orderRows.length > 0 ? orderRows : [['-', '-', '-', 'Belum ada transaksi di periode ini', '-', 'Rp 0']],
    theme: 'striped',
    headStyles: {
      fillColor: [101, 67, 33],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 26 },
      2: { cellWidth: 28 },
      3: { cellWidth: 64 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // 2. Table Pengeluaran (Expenses)
  // @ts-expect-error autoTable adds lastAutoTable to doc
  let nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 60;

  if (nextY > 230) {
    doc.addPage();
    nextY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(50, 40, 30);
  doc.text(`2. Rincian Pengeluaran Operasional (${data.expenses.length} Catatan)`, 14, nextY);

  const expenseRows = data.expenses.map((e) => [
    formatDate(e.date),
    e.category,
    e.description,
    e.recordedBy,
    formatRupiah(e.amount),
  ]);

  autoTable(doc, {
    startY: nextY + 2,
    head: [['Tanggal', 'Kategori', 'Keterangan Pengeluaran', 'Dicatat Oleh', 'Nominal']],
    body: expenseRows.length > 0 ? expenseRows : [['-', '-', 'Belum ada pengeluaran di periode ini', '-', 'Rp 0']],
    theme: 'striped',
    headStyles: {
      fillColor: [180, 83, 9], // Amber/Dark Orange
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 35 },
      2: { cellWidth: 65 },
      3: { cellWidth: 30 },
      4: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // 3. Table Stok Bahan (Bahan Awal, Terpakai, Sisa)
  // @ts-expect-error autoTable adds lastAutoTable to doc
  nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : nextY + 60;

  if (nextY > 210) {
    doc.addPage();
    nextY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(50, 40, 30);
  doc.text('3. Laporan Stok Bahan Baku (Awal, Terpakai, Sisa)', 14, nextY);

  const stockRows = data.ingredients.map((ing) => {
    const isLow = ing.currentStock <= ing.minStockAlert;
    const statusText = ing.currentStock <= 0 ? 'HABIS' : isLow ? 'MENIPIS' : 'AMAN';
    return [
      ing.name,
      `${formatNumber(ing.initialStock)} ${ing.unit}`,
      `${formatNumber(ing.addedStock || 0)} ${ing.unit}`,
      `${formatNumber(ing.usedStock || 0)} ${ing.unit}`,
      `${formatNumber(ing.currentStock)} ${ing.unit}`,
      statusText,
    ];
  });

  autoTable(doc, {
    startY: nextY + 2,
    head: [['Nama Bahan Baku', 'Bahan Awal', 'Tambahan', 'Bahan Terpakai', 'Sisa Bahan', 'Status']],
    body: stockRows,
    theme: 'grid',
    headStyles: {
      fillColor: [55, 65, 81], // Slate
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 24, halign: 'right' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 22, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer Signature
  // @ts-expect-error autoTable adds lastAutoTable to doc
  nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : nextY + 70;

  if (nextY > 250) {
    doc.addPage();
    nextY = 30;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Mengetahui, Pemilik Usaha`, pageWidth - 60, nextY);
  doc.text(`KOPI DARI HATI`, pageWidth - 60, nextY + 4);

  doc.line(pageWidth - 60, nextY + 22, pageWidth - 14, nextY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.settings.name, pageWidth - 60, nextY + 26);

  // Save the PDF
  const cleanPeriod = data.periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Laporan_KopiDariHati_${cleanPeriod}_${Date.now()}.pdf`;
  doc.save(filename);
}
