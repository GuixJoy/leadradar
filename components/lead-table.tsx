'use client';

import { motion } from 'framer-motion';
import { Phone, Globe, CheckCircle, Download, Search } from 'lucide-react';

interface LeadTableProps {
  leads: any[];
  selectedLeads: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onCheck360: (id: string, lat: number, lng: number) => void;
  onEnrich: (id: string) => void;
}

export default function LeadTable({
  leads, selectedLeads, onToggleSelect, onSelectAll, onCheck360, onEnrich,
}: LeadTableProps) {

  const allSelected = leads.length > 0 && selectedLeads.length === leads.length;

  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = ['Name', 'Address', 'Rating', 'Reviews', 'Phone', 'Website', '360 Status', 'Status'];
    const rows = leads.map(l => [
      l.name || '', (l.address || '').replace(/,/g, ' '), l.rating || '', l.reviews_count || '',
      l.phone || '', l.website || '', l.streetViewStatus || '', l.status || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leadradar-export-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const get360Badge = (status: string | undefined) => {
    switch (status) {
      case 'HAS_360':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/10">✅ Has 360 Tour</span>;
      case 'EXTERIOR_ONLY':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/10">⚠ Street View Only</span>;
      case 'NO_360':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/10">❌ No 360 Tour</span>;
      case 'CHECKING':
        return <span className="text-[10px] italic text-zinc-600 animate-pulse">Checking...</span>;
      default:
        return <span className="text-[10px] text-zinc-700">—</span>;
    }
  };

  if (leads.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.015)' }}>
          <Search className="w-5 h-5 text-zinc-700" />
        </div>
        <h3 className="text-[13px] font-medium text-zinc-400">No data to display</h3>
        <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed max-w-[220px]">Scan an area or switch to Database view to see leads here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table Header Bar */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-white/[0.04] shrink-0">
        <p className="text-[10px] text-zinc-600">{leads.length} rows · {selectedLeads.length} selected</p>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-white shadow-md shadow-indigo-500/15 transition-all hover:shadow-lg hover:shadow-indigo-500/20 animate-gradient"
          style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8, #6366f1)', backgroundSize: '200% 200%' }}>
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-auto premium-scroll">
        <table className="w-full min-w-[800px] border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: 'rgba(6,6,10,0.95)', backdropFilter: 'blur(12px)' }}>
            <tr className="border-b border-white/[0.06]">
              <th className="w-10 px-3 py-3 text-left">
                <div onClick={onSelectAll}
                  className={`w-[14px] h-[14px] rounded-[3px] border-[1.5px] flex items-center justify-center cursor-pointer transition-all ${allSelected ? 'bg-indigo-500 border-indigo-400' : 'border-zinc-700 hover:border-zinc-500'}`}>
                  {allSelected && <div className="w-[6px] h-[6px] bg-white rounded-[1px]" />}
                </div>
              </th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Address</th>
              <th className="px-3 py-3 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-16">Rating</th>
              <th className="px-3 py-3 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-16">Reviews</th>
              <th className="px-3 py-3 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-16">Phone</th>
              <th className="px-3 py-3 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-14">Web</th>
              <th className="px-3 py-3 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-20">360</th>
              <th className="px-3 py-3 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isSelected = selectedLeads.includes(lead.id);
              return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.01 }}
                  className={`border-b border-white/[0.03] transition-all duration-150 group cursor-pointer ${isSelected ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'}`}
                  onClick={() => onToggleSelect(lead.id)}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <div className={`w-[14px] h-[14px] rounded-[3px] border-[1.5px] flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-400 shadow-sm shadow-indigo-500/30' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                      {isSelected && <div className="w-[6px] h-[6px] bg-white rounded-[1px]" />}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-3">
                    <p className="text-[12px] font-semibold text-zinc-200 truncate max-w-[180px]">{lead.name}</p>
                  </td>

                  {/* Address */}
                  <td className="px-3 py-3" title={lead.address}>
                    <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">{lead.address || '—'}</p>
                  </td>

                  {/* Rating */}
                  <td className="px-3 py-3 text-center">
                    {lead.rating ? (
                      <span className="text-[11px] font-medium text-amber-400">★ {lead.rating}</span>
                    ) : <span className="text-[10px] text-zinc-700">—</span>}
                  </td>

                  {/* Reviews */}
                  <td className="px-3 py-3 text-center">
                    <span className="text-[11px] text-zinc-500">{lead.reviews_count || '—'}</span>
                  </td>

                  {/* Phone */}
                  <td className="px-3 py-3 text-center">
                    {lead.phone ? (
                      <div className="flex justify-center"><Phone className="w-3 h-3 text-zinc-400" /></div>
                    ) : <span className="text-[10px] text-zinc-700">—</span>}
                  </td>

                  {/* Website */}
                  <td className="px-3 py-3 text-center">
                    {lead.website ? (
                      <div className="flex justify-center"><Globe className="w-3 h-3 text-zinc-400" /></div>
                    ) : <span className="text-[10px] text-zinc-700">—</span>}
                  </td>

                  {/* 360 Status */}
                  <td className="px-3 py-3 text-center">
                    {get360Badge(lead.streetViewStatus)}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      {lead.streetViewStatus && lead.streetViewStatus !== 'CHECKING' ? (
                        <span className="text-[9px] px-2 py-1 rounded-md font-medium text-zinc-600 border border-white/[0.04]">Checked ✔</span>
                      ) : lead.streetViewStatus === 'CHECKING' ? (
                        <span className="text-[9px] italic text-zinc-600">...</span>
                      ) : (
                        <button onClick={() => onCheck360(lead.id, lead.lat, lead.lng)}
                          className="text-[9px] px-2 py-1 rounded-md font-medium border border-white/[0.06] hover:bg-white/[0.04] transition-all text-zinc-500 hover:text-zinc-300">
                          360
                        </button>
                      )}
                      {lead.status === 'READY' || lead.last_enriched_at ? (
                        <span className="text-[9px] px-2 py-1 rounded-md font-medium text-zinc-600 border border-white/[0.04]">Enriched ✔</span>
                      ) : lead.status === 'ENRICHING' ? (
                        <span className="text-[9px] italic text-zinc-600">...</span>
                      ) : (
                        <button onClick={() => onEnrich(lead.id)}
                          className="text-[9px] px-2 py-1 rounded-md font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors border border-indigo-500/10">
                          Enrich
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
