import * as XLSX from 'xlsx'

// ── Excel export ───────────────────────────────────────────────────────────────
export function exportPipelineToExcel(deals) {
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB') : ''
  const fmtNum  = (v) => (v != null && v !== '') ? Number(v) : ''

  const rows = deals.map(d => ({
    'Company':          d.company_name,
    'Stage':            d.stage,
    'Sector':           d.sector || '',
    'Country':          d.country || '',
    'Geography':        d.geography || '',
    'Theme':            d.theme || '',
    'Owner':            d.owner || '',
    'Deal Source':      d.deal_source || '',
    'Co-investor':      d.co_investor || '',
    'EV (€m)':          fmtNum(d.ev),
    'Revenue (€m)':     fmtNum(d.revenue),
    'EBITDA (€m)':      fmtNum(d.ebitda),
    'Ownership %':      fmtNum(d.ownership_pct),
    'IC Date':          fmtDate(d.ic_date),
    'Close Date':       fmtDate(d.close_date),
    'Next Action':      d.next_action || '',
    'Next Action Due':  fmtDate(d.next_action_due),
    'Lost Reason':      d.lost_reason || '',
    'Domain':           d.domain || '',
    'Date Added':       fmtDate(d.created_at),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 },
    { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 12 },
    { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 12 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline')

  // Lost sheet if any
  const lost = deals.filter(d => d.stage === 'Lost')
  if (lost.length > 0) {
    const wsLost = XLSX.utils.json_to_sheet(lost.map(d => ({
      'Company':     d.company_name,
      'Lost Reason': d.lost_reason || '',
      'Owner':       d.owner || '',
      'EV (€m)':     fmtNum(d.ev),
      'Date Added':  fmtDate(d.created_at),
    })))
    XLSX.utils.book_append_sheet(wb, wsLost, 'Lost Deals')
  }

  XLSX.writeFile(wb, `DTE_Pipeline_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── PDF export (deal summary) ──────────────────────────────────────────────────
export async function exportDealToPDF(deal, notes, contacts) {
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtVal  = (v, suffix = '') => (v != null && v !== '') ? `${v}${suffix}` : '—'

  const pinnedNote = notes.find(n => n.is_pinned)

  const fieldRow = (label, value) =>
    `<tr><td class="fl">${label}</td><td class="fv">${value || '—'}</td></tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${deal.company_name} — Deal Summary</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #0f172a; padding: 32px 40px; }
  @page { size: A4; margin: 18mm 15mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #021d49; padding-bottom: 12px; margin-bottom: 16px; }
  .company { font-size: 22px; font-weight: 700; color: #021d49; }
  .domain  { font-size: 11px; color: #64748b; margin-top: 2px; }
  .stage-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; }
  .logo-area { text-align: right; font-size: 13px; font-weight: 700; color: #021d49; }
  .date { font-size: 10px; color: #94a3b8; margin-top: 4px; }

  .section { margin-bottom: 16px; }
  .section-title { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }

  table.fields { width: 100%; border-collapse: collapse; }
  table.fields td { padding: 3px 6px; vertical-align: top; }
  td.fl { width: 120px; color: #64748b; font-weight: 500; }
  td.fv { font-weight: 500; }

  .thesis-box { background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 10px 12px; border-radius: 6px; margin-bottom: 14px; }
  .thesis-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #92400e; margin-bottom: 4px; }
  .thesis-text  { font-size: 11px; color: #451a03; line-height: 1.5; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .note-item { padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .note-meta  { font-size: 9px; color: #94a3b8; margin-bottom: 2px; }
  .note-text  { font-size: 11px; color: #334155; line-height: 1.4; }

  .contact-row { padding: 5px 0; border-bottom: 1px solid #f1f5f9; display: flex; gap: 16px; }
  .contact-name { font-weight: 600; min-width: 120px; }
  .contact-role { color: #64748b; min-width: 80px; }
  .contact-email { color: #4f46e5; min-width: 160px; }
  .contact-phone { color: #64748b; }

  .int-item { padding: 3px 0 3px 16px; font-size: 10px; color: #475569; }
  .int-item::before { content: '↳ '; color: #94a3b8; }

  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company">${deal.company_name}</div>
    ${deal.domain ? `<div class="domain">${deal.domain}</div>` : ''}
    <div style="margin-top:8px"><span class="stage-badge">${deal.stage}</span></div>
  </div>
  <div class="logo-area">
    DTE Capital Partners<br>
    <span class="date">Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
  </div>
</div>

${(pinnedNote || deal.thesis) ? `
<div class="thesis-box">
  <div class="thesis-label">Investment Thesis</div>
  <div class="thesis-text">${pinnedNote?.text || deal.thesis || ''}</div>
</div>` : ''}

<div class="grid2">
  <div class="section">
    <div class="section-title">Overview</div>
    <table class="fields">
      ${fieldRow('Sector',       deal.sector)}
      ${fieldRow('Country',      deal.country)}
      ${fieldRow('Geography',    deal.geography)}
      ${fieldRow('Theme',        deal.theme)}
      ${fieldRow('Stage',        deal.stage)}
      ${fieldRow('Owner',        deal.owner)}
      ${fieldRow('Deal Source',  deal.deal_source)}
      ${fieldRow('Co-investor',  deal.co_investor)}
    </table>
  </div>
  <div class="section">
    <div class="section-title">Financials</div>
    <table class="fields">
      ${fieldRow('EV (€m)',       deal.ev != null ? `€${deal.ev}m` : null)}
      ${fieldRow('Revenue (€m)',  deal.revenue != null ? `€${deal.revenue}m` : null)}
      ${fieldRow('EBITDA (€m)',   deal.ebitda != null ? `€${deal.ebitda}m` : null)}
      ${fieldRow('Ownership %',   deal.ownership_pct != null ? `${deal.ownership_pct}%` : null)}
      ${fieldRow('IC Date',       fmtDate(deal.ic_date))}
      ${fieldRow('Close Date',    fmtDate(deal.close_date))}
      ${deal.next_action ? fieldRow('Next Action', deal.next_action) : ''}
      ${deal.next_action_due ? fieldRow('Due', fmtDate(deal.next_action_due)) : ''}
    </table>
  </div>
</div>

${contacts.length > 0 ? `
<div class="section">
  <div class="section-title">Contacts (${contacts.length})</div>
  ${contacts.map(c => `
    <div class="contact-row">
      <span class="contact-name">${c.name}</span>
      <span class="contact-role">${c.role || ''}</span>
      <span class="contact-email">${c.email || ''}</span>
      <span class="contact-phone">${c.phone || ''}</span>
    </div>
    ${c.interactions?.slice(0, 3).map(i => `
      <div class="int-item">${i.type} · ${fmtDate(i.date)}${i.note ? ` — ${i.note}` : ''}</div>
    `).join('') || ''}
  `).join('')}
</div>` : ''}

${notes.length > 0 ? `
<div class="section">
  <div class="section-title">Notes (${notes.length})</div>
  ${notes.slice(0, 8).map(n => `
    <div class="note-item">
      <div class="note-meta">${n.author} · ${fmtDate(n.created_at)}</div>
      <div class="note-text">${n.text}</div>
    </div>
  `).join('')}
  ${notes.length > 8 ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px">+ ${notes.length - 8} more notes</div>` : ''}
</div>` : ''}

<div class="footer">
  <span>DTE Capital Partners · Deal Pipeline CRM</span>
  <span>${deal.company_name} · Confidential</span>
</div>

</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 600)
}
