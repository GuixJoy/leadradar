'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown, MapPin, Zap, Filter, Search, Phone, Globe, CheckCircle, Database, Radio, RefreshCw, LayoutGrid, Table2 } from 'lucide-react';
import MapComponent from '@/components/MapComponent';
import LeadTable from '@/components/lead-table';
import { supabase } from '@/lib/supabase';

const CATEGORY_MAP: Record<string, string> = {
  "Restaurant": "restaurant",
  "Gym & Fitness": "gym",
  "Dentist": "dentist",
  "Clothing Store": "clothing_store",
  "Electronics Store": "electronics_store",
  "Real Estate Agency": "real_estate_agency",
  "Car Dealership": "car_dealer",
  "Beauty Salon": "beauty_salon",
  "Plumber": "plumber",
  "Electrician": "electrician",
  "Hospital": "hospital",
  "Pharmacy": "pharmacy",
  "Spa": "spa",
  "Lawyer": "lawyer",
  "Bank": "bank",
  "Supermarket": "supermarket",
  "Accountant": "accounting",
  "Cafe": "cafe",
  "Doctor": "doctor",
  "Hardware Store": "hardware_store",
  "Insurance Agency": "insurance_agency",
  "Jewelry Store": "jewelry_store"
};


export default function Home() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [activeRadius, setActiveRadius] = useState(5000);
  const [activeCenter, setActiveCenter] = useState({ lat: 21.1458, lng: 79.0882 });
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('restaurant');
  const [categoryInput, setCategoryInput] = useState('Restaurant');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'live' | 'database'>('live');
  const [dbLeads, setDbLeads] = useState<any[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [displayStyle, setDisplayStyle] = useState<'cards' | 'table'>('cards');

  const [filters, setFilters] = useState({
    no360: false,
    noWebsite: false,
    noPhone: false,
    lowReviews: false
  });

  const filteredCategories = Object.keys(CATEGORY_MAP).filter(key => 
    key.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
        // Enforce valid selection on blur
        const validKey = Object.keys(CATEGORY_MAP).find(k => k.toLowerCase() === categoryInput.toLowerCase()) || 
                         Object.keys(CATEGORY_MAP).find(k => CATEGORY_MAP[k] === selectedCategory);
        if (validKey) {
          setCategoryInput(validKey);
          setSelectedCategory(CATEGORY_MAP[validKey]);
        } else {
          setCategoryInput('Restaurant');
          setSelectedCategory('restaurant');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoryInput, selectedCategory]);

  useEffect(() => {
    const savedCenter = localStorage.getItem('leadradar_center');
    if (savedCenter) {
      try {
        const parsed = JSON.parse(savedCenter);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setActiveCenter(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved center", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('leadradar_center', JSON.stringify(activeCenter));
  }, [activeCenter]);

  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchLeadsFromDB = useCallback(async () => {
    setIsLoadingDb(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('DB fetch error:', error);
        return;
      }

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name || 'Unknown',
        lat: row.lat,
        lng: row.lng,
        address: row.address,
        phone: row.phone,
        website: row.website,
        has_360: row.has_360,
        streetViewStatus: row.street_view_status || undefined,
        category: row.category,
        rating: row.rating,
        reviews_count: row.reviews_count,
        score: row.score,
        status: row.status || 'DISCOVERED',
        last_enriched_at: row.last_enriched_at,
        has_phone: row.has_phone,
        has_website: row.has_website,
      }));

      setDbLeads(mapped);
      console.log('DB leads loaded:', mapped.length);
    } catch (err) {
      console.error('DB fetch failed:', err);
    } finally {
      setIsLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    fetchLeadsFromDB();
  }, [fetchLeadsFromDB]);

  const handleToggleSelect = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === displayedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(displayedLeads.map(l => l.id));
    }
  };

  const handleCheck360Selected = async () => {
    if (selectedLeads.length === 0) return;
    
    for (const leadId of selectedLeads) {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) continue;
      
      console.log("360 clicked:", lead.id);

      setLeads(currentLeads => 
        currentLeads.map(l => 
          l.id === leadId ? { ...l, streetViewStatus: 'CHECKING' } : l
        )
      );

      let status = "NO_360";
      let data: any = null;

      try {
        const response = await fetch('/api/streetview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: lead.lat, lng: lead.lng })
        });

        if (response.ok) {
          data = await response.json();
          console.log("360 raw result:", data);
          
          if (data) {
            status = data.status; // Directly use HAS_360 or NO_360
          }
        }
      } catch (err) {
        console.error("Check 360 fetch failed:", err);
      }

      console.log("Mapped status:", status);
      const has_360 = status === "HAS_360";

      setLeads(currentLeads => 
        currentLeads.map(l => 
          l.id === leadId ? { ...l, streetViewStatus: status, avgDistance: data?.avgDistance, okCount: data?.okCount, has_360 } : l
        )
      );

      // Update DB (MANDATORY)
      const { data: dbData, error: dbError } = await supabase
        .from('leads')
        .update({
          street_view_status: status,
          has_360: has_360
        })
        .eq('id', String(lead.id))
        .select();

      if (dbError) {
        console.error("360 update error:", dbError);
      }
      
      await new Promise(res => setTimeout(res, 300));
    }
    setToastMsg(`✔ 360 Checked for ${selectedLeads.length} leads`);
    setSelectedLeads([]);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleEnrichSelected = async () => {
    if (selectedLeads.length === 0) return;

    let processedCount = 0;

    for (const leadId of selectedLeads) {
      if (processedCount >= 15) break;

      const lead = leads.find(l => l.id === leadId);
      if (!lead) continue;
      if (lead.last_enriched_at) continue;

      setLeads(currentLeads => 
        currentLeads.map(l => 
          l.id === leadId ? { ...l, status: 'ENRICHING' } : l
        )
      );

      try {
        const response = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: lead.id })
        });

        if (!response.ok) throw new Error(`Enrich API Error`);

        const enrichData = await response.json();
        const hasWebsite = !!enrichData.website;
        const hasPhone = !!enrichData.phone;
        const rating = enrichData.rating;

        const missingAttributes: string[] = [];
        const reasons: string[] = [];

        if (!hasWebsite) {
          missingAttributes.push("website");
          reasons.push("No website");
        }
        if (!hasPhone) {
          missingAttributes.push("phone");
          reasons.push("No contact number");
        }
        if (!rating) {
          missingAttributes.push("no_reviews");
          reasons.push("No reviews");
        } else if (rating < 4) {
          missingAttributes.push("low_rating");
          reasons.push("Low rating");
        }

        const now = new Date().toISOString();

        setLeads(currentLeads => 
          currentLeads.map(l => 
            l.id === leadId ? { 
              ...l, 
              status: 'READY',
              website: enrichData.website || l.website,
              phone: enrichData.phone || l.phone,
              rating: enrichData.rating || l.rating,
              reviews_count: enrichData.userRatingCount || l.reviews_count,
              missingAttributes,
              reasons,
              last_enriched_at: now
            } : l
          )
        );

        console.log("Enrich updating ID:", lead.id);
        const phone = enrichData.phone || null;
        const website = enrichData.website || null;

        const { data: dbData, error: dbError } = await supabase
          .from('leads')
          .update({
            phone: phone,
            website: website,
            has_phone: !!phone,
            has_website: !!website,
            rating: enrichData.rating || null,
            reviews_count: enrichData.userRatingCount || 0,
            status: 'READY',
            last_enriched_at: now
          })
          .eq('id', String(lead.id))
          .select();

        console.log("Enrich result:", dbData, dbError);

        processedCount++;

      } catch (err) {
        console.error("Enrich failed:", err);
        setLeads(currentLeads => 
          currentLeads.map(l => 
            l.id === leadId ? { ...l, status: 'DISCOVERED' } : l
          )
        );
      }
      
      await new Promise(res => setTimeout(res, 300));
    }
    setToastMsg(`✔ ${processedCount} Leads Enriched`);
    setSelectedLeads([]);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setActiveCenter({ lat, lng });
    setToastMsg("Center updated");
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: activeCenter.lat,
          lng: activeCenter.lng,
          radius: activeRadius,
          category: selectedCategory
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      const fetchedLeads = data.leads || [];
      setLeads(fetchedLeads);
      setNextPageToken(data.nextPageToken || null);

    } catch (err) {
      console.error("Search failed:", err);
      setErrorMsg("Failed to search leads. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;
    setIsSearching(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: activeCenter.lat,
          lng: activeCenter.lng,
          radius: activeRadius,
          category: selectedCategory,
          pageToken: nextPageToken
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setLeads(prev => [...prev, ...(data.leads || [])]);
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error("Load more failed:", err);
      setErrorMsg("Failed to load more leads.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnrich = async (placeId: string) => {
    setLeads(currentLeads => 
      currentLeads.map(lead => 
        lead.id === placeId ? { ...lead, status: 'ENRICHING' } : lead
      )
    );

    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placeId })
      });

      if (!response.ok) {
        throw new Error(`Enrich API Error: ${response.status}`);
      }

      const enrichData = await response.json();

      const hasWebsite = !!enrichData.website;
      const hasPhone = !!enrichData.phone;
      const rating = enrichData.rating;

      const missingAttributes: string[] = [];
      const reasons: string[] = [];

      if (!hasWebsite) {
        missingAttributes.push("website");
        reasons.push("No website");
      }
      if (!hasPhone) {
        missingAttributes.push("phone");
        reasons.push("No contact number");
      }
      if (!rating) {
        missingAttributes.push("no_reviews");
        reasons.push("No reviews");
      } else if (rating < 4) {
        missingAttributes.push("low_rating");
        reasons.push("Low rating");
      }

      setLeads(currentLeads => 
        currentLeads.map(lead => 
          lead.id === placeId ? { 
            ...lead, 
            status: 'READY',
            website: enrichData.website,
            phone: enrichData.phone,
            rating: enrichData.rating,
            missingAttributes,
            reasons
          } : lead
        )
      );

      console.log("Enrich updating ID:", placeId);
      const phone = enrichData.phone || null;
      const website = enrichData.website || null;

      const { data: dbData, error: dbError } = await supabase
        .from('leads')
        .update({
          phone: phone,
          website: website,
          has_phone: !!phone,
          has_website: !!website,
          rating: enrichData.rating || null,
          reviews_count: enrichData.userRatingCount || 0,
          status: 'READY',
          last_enriched_at: new Date().toISOString()
        })
        .eq('id', String(placeId))
        .select();

      console.log("Enrich result:", dbData, dbError);
      
      setToastMsg("✔ Lead Enriched");
      setSelectedLeads(prev => prev.filter(id => id !== placeId));
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error("Enrichment failed:", err);
      setLeads(currentLeads => 
        currentLeads.map(lead => 
          lead.id === placeId ? { ...lead, status: 'DISCOVERED' } : lead
        )
      );
    }
  };

  const handleCheck360 = async (leadId: string, lat: number, lng: number) => {
    console.log("360 clicked:", leadId);
    setLeads(currentLeads => 
      currentLeads.map(lead => 
        lead.id === leadId ? { ...lead, streetViewStatus: 'CHECKING' } : lead
      )
    );

    let status = "NO_360";
    let data: any = null;

    try {
      const response = await fetch('/api/streetview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lng })
      });

      if (response.ok) {
        data = await response.json();
        console.log("360 raw result:", data);

        if (data) {
          status = data.status; // Directly use HAS_360 or NO_360
        }
      }
    } catch (err) {
      console.error("Check 360 fetch failed:", err);
    }

    console.log("Mapped status:", status);
    const has_360 = status === "HAS_360";

    setLeads(currentLeads => 
      currentLeads.map(lead => 
        lead.id === leadId ? { ...lead, streetViewStatus: status, avgDistance: data?.avgDistance, okCount: data?.okCount, has_360 } : lead
      )
    );

    // Update DB (MANDATORY)
    const { data: dbData, error: dbError } = await supabase
      .from('leads')
      .update({
        street_view_status: status,
        has_360: has_360
      })
      .eq('id', String(leadId))
      .select();

    if (dbError) {
      console.error("360 update error:", dbError);
    }

    setToastMsg("✔ 360 Checked");
    setSelectedLeads(prev => prev.filter(id => id !== leadId));
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ready': return '#10B981';
      case 'enriched': return '#10B981';
      case 'enriching': return '#F59E0B';
      case 'discovered': return '#4F6EF7';
      default: return '#A0A0AB';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const sourceLeads = viewMode === 'database' ? dbLeads : leads;

  const displayedLeads = sourceLeads.filter(lead => {
    if (filters.no360) {
      if (lead.has_360 || lead.streetViewStatus === 'HAS_360_LIKELY' || lead.streetViewStatus === 'POSSIBLE_360') return false;
    }
    if (filters.noWebsite && lead.website) return false;
    if (filters.noPhone && lead.phone) return false;
    if (filters.lowReviews) {
      if (lead.rating && lead.rating >= 4.0 && lead.reviews_count > 5) return false;
    }
    return true;
  });

  return (
    <div className="h-screen w-full flex flex-col font-sans text-zinc-300 overflow-hidden select-none relative" style={{ background: '#06060a' }}>
      {/* ── Ambient Background Orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-60 -right-40 w-[600px] h-[600px] rounded-full animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 60%)' }} />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="h-[52px] flex items-center justify-between px-5 border-b border-white/[0.04] z-20 shrink-0 relative" style={{ background: 'rgba(6,6,10,0.7)', backdropFilter: 'blur(20px) saturate(180%)' }}>
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="LeadRadar Logo"
            width={160}
            height={44}
            className="object-contain"
            priority
          />
        </div>
        {/* Live Stats */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-zinc-500 font-medium">{leads.length} leads</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-600">{selectedLeads.length} selected</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* ── Left Panel ── */}
        <div className="hidden lg:flex lg:w-[300px] lg:flex-shrink-0 flex-col border-r border-white/[0.04] relative" style={{ background: 'rgba(6,6,10,0.5)' }}>
          <div className="flex-1 overflow-y-auto premium-scroll px-5 py-6 space-y-8">
            
            {/* Search Area */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center">
                  <MapPin className="w-3 h-3 text-indigo-400" />
                </div>
                <h3 className="text-[12px] font-semibold text-zinc-300 uppercase tracking-wider">Search Area</h3>
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Click anywhere on the map to set center point.
              </p>
              <div className="pt-1 p-3 rounded-xl border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[11px] font-medium text-zinc-500">Radius</label>
                  <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{activeRadius}m</span>
                </div>
                <input
                  type="range" min="500" max="5000" step="100"
                  value={activeRadius}
                  onChange={(e) => setActiveRadius(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </section>

            {/* Business Category */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center">
                  <Search className="w-3 h-3 text-indigo-400" />
                </div>
                <h3 className="text-[12px] font-semibold text-zinc-300 uppercase tracking-wider">Category</h3>
              </div>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text" value={categoryInput}
                  onChange={(e) => { setCategoryInput(e.target.value); setShowCategoryDropdown(true); }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="e.g. Restaurant..."
                  className="w-full px-3 py-2.5 text-[13px] rounded-xl text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all border border-white/[0.04]"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                />
                {showCategoryDropdown && (
                  <ul className="absolute z-50 w-full mt-2 max-h-48 overflow-y-auto rounded-xl shadow-2xl shadow-black/60 border border-white/[0.06]" style={{ background: 'rgba(15,15,21,0.97)', backdropFilter: 'blur(20px)' }}>
                    {filteredCategories.length > 0 ? filteredCategories.map((key) => (
                      <li key={key} onClick={() => { setCategoryInput(key); setSelectedCategory(CATEGORY_MAP[key]); setShowCategoryDropdown(false); }}
                        className="px-3 py-2.5 text-[13px] text-zinc-400 cursor-pointer hover:bg-white/[0.04] hover:text-zinc-200 transition-colors">{key}</li>
                    )) : <li className="px-3 py-2.5 text-[13px] text-zinc-600">No matches</li>}
                  </ul>
                )}
              </div>
            </section>

            {/* Opportunity Filters */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center">
                  <Filter className="w-3 h-3 text-indigo-400" />
                </div>
                <h3 className="text-[12px] font-semibold text-zinc-300 uppercase tracking-wider">Filters</h3>
              </div>
              <div className="space-y-2 pt-1">
                {[
                  { key: 'no360' as const, label: 'Missing 360 Tour' },
                  { key: 'noWebsite' as const, label: 'Missing Website' },
                  { key: 'noPhone' as const, label: 'Missing Phone' },
                  { key: 'lowReviews' as const, label: 'Low/No Reviews' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center transition-all duration-200 ${filters[key] ? 'bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-500/30' : 'border-white/10 group-hover:border-white/25'}`}>
                      {filters[key] && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={filters[key]} onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.checked }))} />
                    <span className="text-[12px] text-zinc-500 group-hover:text-zinc-300 transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Scan Button */}
          <div className="p-5 border-t border-white/[0.04]">
            <motion.button
              whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
              onClick={handleSearch}
              className="w-full py-3 rounded-xl font-semibold text-[13px] text-white shadow-lg shadow-indigo-500/15 transition-all duration-300 flex justify-center items-center gap-2 animate-gradient"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8, #6366f1)', backgroundSize: '200% 200%' }}
            >
              {isSearching ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Scanning...</>
              ) : <><Zap className="w-3.5 h-3.5" /> Scan Area</>}
            </motion.button>
          </div>
        </div>

        {/* ── Center Panel - Map ── */}
        <div className="hidden lg:flex lg:flex-1 flex-col relative p-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex-1 relative rounded-2xl overflow-hidden shadow-2xl"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.04)' }}
          >
            {/* Vignette + glow border */}
            <div className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.3)' }} />
            
            {/* Floating overlay badges */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 pointer-events-none">
              <div className="px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 border border-white/[0.06]" style={{ background: 'rgba(6,6,10,0.75)', backdropFilter: 'blur(12px)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-[10px] font-medium text-zinc-400">Live Map</span>
              </div>
              {toastMsg && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 border border-emerald-500/10"
                  style={{ background: 'rgba(6,6,10,0.8)', backdropFilter: 'blur(12px)' }}>
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">{toastMsg}</span>
                </motion.div>
              )}
            </div>

            {/* Stats overlay bottom-left */}
            <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
              <div className="px-3 py-2 rounded-lg border border-white/[0.06] flex items-center gap-4" style={{ background: 'rgba(6,6,10,0.75)', backdropFilter: 'blur(12px)' }}>
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Leads</p>
                  <p className="text-[13px] font-bold text-zinc-200">{displayedLeads.length}</p>
                </div>
                <div className="w-px h-6 bg-white/[0.06]" />
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Radius</p>
                  <p className="text-[13px] font-bold text-indigo-400">{activeRadius}m</p>
                </div>
              </div>
            </div>

            <MapComponent center={activeCenter} radius={activeRadius} leads={displayedLeads} onMapClick={handleMapClick} />
          </motion.div>
        </div>

        {/* ── Right Panel - Lead List ── */}
        <div className="flex-1 lg:w-[400px] flex-shrink-0 flex flex-col border-l border-white/[0.04] relative" style={{ background: 'rgba(6,6,10,0.5)' }}>
          {/* Header with toggle */}
          <div className="px-5 py-3 border-b border-white/[0.04]" style={{ background: 'rgba(6,6,10,0.7)', backdropFilter: 'blur(20px)' }}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-[13px] font-semibold text-zinc-200">{viewMode === 'database' ? 'Database' : 'Discovered Leads'}</h2>
                <p className="text-[10px] text-zinc-600 mt-0.5">{displayedLeads.length} results</p>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'database' && (
                  <button onClick={fetchLeadsFromDB}
                    className={`p-1.5 rounded-md border border-white/[0.06] hover:bg-white/[0.03] transition-all text-zinc-500 hover:text-zinc-300 ${isLoadingDb ? 'animate-spin' : ''}`}>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
                {selectedLeads.length > 0 && (
                  <>
                    <button onClick={handleCheck360Selected}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg font-medium border border-white/[0.06] hover:bg-white/[0.03] transition-all text-zinc-400 hover:text-zinc-200">
                      360 ({selectedLeads.length})
                    </button>
                    <button onClick={handleEnrichSelected}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold text-white transition-all shadow-sm shadow-indigo-500/10 animate-gradient"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8, #6366f1)', backgroundSize: '200% 200%' }}>
                      Enrich ({selectedLeads.length})
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-white/[0.04] overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <button
                onClick={() => setViewMode('live')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all ${
                  viewMode === 'live'
                    ? 'bg-indigo-500/10 text-indigo-400 border-r border-indigo-500/20'
                    : 'text-zinc-600 hover:text-zinc-400 border-r border-white/[0.04]'
                }`}>
                <Radio className="w-3 h-3" /> Live Results
              </button>
              <button
                onClick={() => setViewMode('database')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all ${
                  viewMode === 'database'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}>
                <Database className="w-3 h-3" /> Database
              </button>
            </div>
          </div>

          {/* Display Style Toggle (Cards / Table) */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-white/[0.04] shrink-0">
            <button onClick={() => setDisplayStyle('cards')}
              className={`p-1.5 rounded-md transition-all ${displayStyle === 'cards' ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setDisplayStyle('table')}
              className={`p-1.5 rounded-md transition-all ${displayStyle === 'table' ? 'bg-white/[0.06] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <Table2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content Area */}
          {displayStyle === 'table' ? (
            <div className="flex-1 overflow-hidden">
              <LeadTable
                leads={displayedLeads}
                selectedLeads={selectedLeads}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onCheck360={handleCheck360}
                onEnrich={handleEnrich}
              />
            </div>
          ) : (
          <div className="flex-1 overflow-y-auto premium-scroll p-3 space-y-2">
            {!isSearching && errorMsg && (
              <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                <p className="text-[12px] text-rose-400/80">{errorMsg}</p>
              </div>
            )}

            {!isSearching && !errorMsg && displayedLeads.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <Search className="w-5 h-5 text-zinc-700" />
                </div>
                <h3 className="text-[13px] font-medium text-zinc-400">No leads yet</h3>
                <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed max-w-[200px]">Click on the map and hit Scan Area to discover businesses.</p>
              </div>
            )}

            {!isSearching && displayedLeads.map((lead, i) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
                whileHover={{ scale: 1.008 }}
                onClick={() => setSelectedLead(lead.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                  selectedLeads.includes(lead.id) 
                    ? 'border-indigo-500/30 shadow-lg shadow-indigo-500/5' 
                    : selectedLead === lead.id 
                      ? 'border-white/[0.08]' 
                      : 'border-white/[0.03] hover:border-white/[0.07]'
                }`}
                style={{ background: selectedLeads.includes(lead.id) ? 'rgba(99,102,241,0.04)' : selectedLead === lead.id ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <div onClick={(e) => { e.stopPropagation(); handleToggleSelect(lead.id); }}
                      className={`w-[15px] h-[15px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
                        selectedLeads.includes(lead.id) ? 'bg-indigo-500 border-indigo-400 shadow-sm shadow-indigo-500/40' : 'border-zinc-700 hover:border-zinc-500'
                      }`}>
                      {selectedLeads.includes(lead.id) && <div className="w-[5px] h-[5px] bg-white rounded-full" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[13px] text-zinc-200 truncate leading-tight">{lead.name}</h4>
                    <p className="text-[10px] text-zinc-600 mt-1 truncate">{lead.address || "Location not available"}</p>
                    
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {lead.rating && (
                        <div className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/8 text-amber-400/80 font-medium flex items-center gap-0.5 border border-amber-500/10">
                          ★ {lead.rating}{lead.reviews_count ? ` (${lead.reviews_count})` : ''}
                        </div>
                      )}
                      {lead.phone && (
                        <div className="text-[9px] px-1.5 py-0.5 rounded-md text-zinc-500 flex items-center gap-0.5 border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <Phone className="w-2 h-2" /> Phone
                        </div>
                      )}
                      {lead.website && (
                        <div className="text-[9px] px-1.5 py-0.5 rounded-md text-zinc-500 flex items-center gap-0.5 border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <Globe className="w-2 h-2" /> Web
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.03]">
                      <div className="flex items-center gap-1.5">
                        {lead.streetViewStatus === 'CHECKING' ? (
                          <span className="text-[10px] italic text-zinc-600 animate-pulse">Checking...</span>
                        ) : lead.streetViewStatus === 'HAS_360' ? (
                          <span className="text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">✅ Has 360 Tour</span>
                        ) : lead.streetViewStatus === 'EXTERIOR_ONLY' ? (
                          <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">⚠ Street View Only</span>
                        ) : lead.streetViewStatus === 'NO_360' ? (
                          <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">❌ No 360 Tour</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleCheck360(lead.id, lead.lat, lead.lng); }}
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium border border-white/[0.06] hover:bg-white/[0.03] transition-all text-zinc-600 hover:text-zinc-400">
                            Check 360
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(lead.status === 'READY' || lead.last_enriched_at) ? (
                          <span className="text-[10px] font-medium text-zinc-600 border border-white/[0.04] px-2 py-0.5 rounded-md">Enriched ✔</span>
                        ) : lead.status === 'ENRICHING' ? (
                          <span className="text-[10px] italic text-zinc-600">Enriching...</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleEnrich(lead.id); }}
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-indigo-500/8 text-indigo-400/80 hover:bg-indigo-500/15 transition-colors border border-indigo-500/10">
                            Enrich
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {nextPageToken && !isSearching && (
              <div className="flex justify-center pt-4 pb-8">
                <button onClick={handleLoadMore}
                  className="px-4 py-2 rounded-xl font-medium text-[11px] border border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-all"
                  style={{ background: 'rgba(255,255,255,0.01)' }}>
                  Load More
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
