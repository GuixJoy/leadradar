'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown, MapPin, Zap, Filter, Search, Phone, Globe, CheckCircle, Database, Radio, RefreshCw, LayoutGrid, Table2, Maximize2, Minimize2, X } from 'lucide-react';
import MapComponent from '@/components/MapComponent';
import LeadTable from '@/components/lead-table';
import RadarLoader from '@/components/radar-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import {
  clientUsesSupabase,
  dcCreateSession,
  dcFetchLead,
  dcFetchMain,
  dcFetchSessions,
  dcFetchTesting,
  dcFetchToday,
  dcPatchLead,
  dcSessionLeadIds,
} from '@/lib/data-client';

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


// ─── Deduplication utility ───────────────────────────────────────────────────
// Merges `incoming` leads into `existing` by id.
// • If id already in existing → update with latest fields (incoming wins).
// • If id is new              → prepend to front of array.
// • Order: new leads first, then existing leads (updated in-place).
// This is the ONLY correct way to merge realtime + fetched data.
function mergeLeadsById(existing: any[], incoming: any[]): any[] {
  if (incoming.length === 0) return existing;
  const map = new Map<string, any>();
  // Load existing first (preserves order for existing items)
  existing.forEach(l => map.set(l.id, l));
  const truly_new: any[] = [];
  incoming.forEach(l => {
    if (map.has(l.id)) {
      // Update in-place: merge incoming fields onto existing
      map.set(l.id, { ...map.get(l.id), ...l });
    } else {
      truly_new.push(l);
      map.set(l.id, l);
    }
  });
  // New leads prepended, existing leads updated in their original order
  return [...truly_new, ...existing.map(l => map.get(l.id))];
}

// Deduplicate an array by id — keeps the last occurrence (most recent merge wins)
function dedupeById(arr: any[]): any[] {
  const map = new Map<string, any>();
  arr.forEach(l => map.set(l.id, l));
  return Array.from(map.values());
}
// ─────────────────────────────────────────────────────────────────────────────

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
  const [viewMode, setViewMode] = useState<'live' | 'today' | 'main' | 'testing'>('live');
  const [mainPage, setMainPage] = useState(1);
  const [mainTotalCount, setMainTotalCount] = useState<number | null>(null);
  const [mainHasMore, setMainHasMore] = useState(true);
  const [dbLeads, setDbLeads] = useState<any[]>([]);
  const [testingLeads, setTestingLeads] = useState<any[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [todayLeads, setTodayLeads] = useState<any[]>([]);
  const [isLoadingToday, setIsLoadingToday] = useState(false);
  const [isLoadingTesting, setIsLoadingTesting] = useState(false);
  const [displayStyle, setDisplayStyle] = useState<'cards' | 'table'>('cards');
  const [quickFilter, setQuickFilter] = useState('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrapeSessions, setScrapeSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSessionIdRef = useRef(selectedSessionId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchQueryRef = useRef('');
  const mainLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const [filters, setFilters] = useState({
    has360: false,
    no360: false,
    enriched: false,
    unenriched: false,
    operational: false,
    closed: false,
    unknown: false,
    hasPhone: false,
    hasWebsite: false,
    category: 'ALL',
    country: 'ALL',
  });

  const filteredCategories = Object.keys(CATEGORY_MAP).filter(key =>
    key.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchActive = searchQuery.trim().length > 0;

  const bumpSearchVersion = useCallback(() => {
    if (searchQueryRef.current.trim()) {
      setSearchVersion((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    if (!searchActive) {
      setSearchResults([]);
      setSearchCount(0);
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const handle = setTimeout(async () => {
      setIsSearchLoading(true);
      setSearchError(null);

      try {
        const response = await fetch('/api/leads/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            query: searchQuery,
            scope: viewMode,
            sessionId: viewMode === 'live' || viewMode === 'today' ? selectedSessionId : null
          })
        });

        if (!response.ok) {
          throw new Error(`Search error: ${response.status}`);
        }

        const data = await response.json();
        setSearchResults(data.leads || []);
        setSearchCount(data.count || 0);
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          console.error('Search failed:', err);
          setSearchError('Search failed. Please try again.');
          setSearchResults([]);
          setSearchCount(0);
        }
      } finally {
        setIsSearchLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [searchActive, searchQuery, viewMode, selectedSessionId, searchVersion]);

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

  // Realtime live subscription for scrape results (Supabase only).
  // PG-only open-source mode has no realtime — poll instead (see polling effect below).
  useEffect(() => {
    if (!clientUsesSupabase()) return;
    const channel = supabase.channel('live-leads')
      // Leads INSERT
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const row = payload.new;
        const mapped = {
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
          has_website: row.has_website,
          business_status: row.business_status,
          enrichment_completed: row.enrichment_completed,
          times_seen: row.times_seen || 1,
        };
        
        console.log('[Realtime Debug] Lead INSERT:', mapped.id);

        // Use mergeLeadsById so duplicate realtime events are safely idempotent
        setDbLeads(prev => mergeLeadsById(prev, [mapped]));
        setLeads(prev => mergeLeadsById(prev, [mapped]));
        bumpSearchVersion();

        // Update Today leads if the lead was created today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(row.created_at) >= today) {
          setTodayLeads(prev => mergeLeadsById(prev, [mapped]));
        }
      })
      // Leads UPDATE
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const row = payload.new;
        console.log('[Realtime Debug] Lead UPDATE:', row.id);

        // Remap DB column names → UI field names correctly
        const updatedFields = {
          phone: row.phone,
          website: row.website,
          has_360: row.has_360,
          streetViewStatus: row.street_view_status || undefined,
          rating: row.rating,
          reviews_count: row.reviews_count,
          score: row.score,
          status: row.status || 'DISCOVERED',
          last_enriched_at: row.last_enriched_at,
          has_website: row.has_website,
          business_status: row.business_status,
          enrichment_completed: row.enrichment_completed,
          times_seen: row.times_seen || 1,
          name: row.name || 'Unknown',
          address: row.address,
        };
        
        const updater = (prev: any[]) => prev.map(l => l.id === row.id ? { ...l, ...updatedFields } : l);
        
        setDbLeads(updater);
        setLeads(updater);
        setTodayLeads(updater);
        bumpSearchVersion();
      })
      // Scrape Map INSERT — fires for BOTH new inserts AND cache-hit rediscoveries
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_scrape_map' }, (payload) => {
        const { lead_id, session_id, scraped_at } = payload.new;
        console.log('[Realtime Debug] Map INSERT (session occurrence):', lead_id, session_id);

        // Always update session filter set
        if (session_id === selectedSessionIdRef.current) {
          setSessionFilteredLeadIds(prev => {
            const next = new Set(prev);
            next.add(lead_id);
            return next;
          });
        }

        // Fetch the lead and push to LIVE + TODAY even if it's a cache hit
        dcFetchLead(lead_id).then((mapped) => {
          if (!mapped) return;

          // Push to LIVE feed — merge handles both new and cache-hit rediscoveries
          setLeads(prev => mergeLeadsById(prev, [mapped]));
          bumpSearchVersion();

          // Push to TODAY feed if scraped today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          if (new Date(scraped_at || Date.now()) >= todayStart) {
            setTodayLeads(prev => mergeLeadsById(prev, [mapped]));
          }
        });
      })
      // Testing INSERT
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'testing' }, (payload) => {
        const row = payload.new;
        console.log('[Realtime Debug] Testing INSERT:', row.id);
        
        const mapped = {
          id: row.id,
          name: row.name || 'Unknown',
          lat: row.lat,
          lng: row.lng,
          address: row.address,
          phone: row.phone,
          website: row.website,
          has_360: row.street_view_status === 'HAS_360',
          streetViewStatus: row.street_view_status || undefined,
          category: row.category,
          rating: row.rating,
          reviews_count: row.reviews_count,
          status: 'READY',
          country: row.country,
          created_at: row.created_at
        };

        setTestingLeads(prev => mergeLeadsById(prev, [mapped]));
        bumpSearchVersion();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchLeadsFromDB = useCallback(async (page = 1) => {
    setIsLoadingDb(true);
    try {
      const pageSize = 50;
      const { leads: mapped, total: count } = await dcFetchMain(page, pageSize);

      // For page 1: replace entirely. For subsequent pages: merge (dedupe vs realtime injections).
      setDbLeads(prev => page === 1 ? dedupeById(mapped) : dedupeById([...prev, ...mapped]));
      if (typeof count === 'number') {
        setMainTotalCount(count);
        setMainHasMore(page * pageSize < count);
      } else {
        setMainHasMore(mapped.length === pageSize);
      }
      setMainPage(page);
      console.log(`[MAIN] DB leads loaded: page=${page}, fetched=${mapped.length}, total_in_db=${count}`);
    } catch (err) {
      console.error('DB fetch failed:', err);
    } finally {
      setIsLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'main' || searchActive) return;
    const target = mainLoadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        if (isLoadingDb || !mainHasMore) return;
        fetchLeadsFromDB(mainPage + 1);
      },
      {
        root: mainScrollRef.current || null,
        rootMargin: '200px'
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [viewMode, searchActive, isLoadingDb, mainHasMore, mainPage, fetchLeadsFromDB]);

  const exportToCSV = useCallback((leadsToExport: any[], filename: string) => {
    const headers = ["Name", "Address", "Phone", "Website", "Status"];
    const rows = leadsToExport.map(l => [
      l.name,
      l.address || "",
      l.phone || "",
      l.website || "",
      l.status || ""
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const fetchTestingLeads = useCallback(async () => {
    setIsLoadingTesting(true);
    try {
      const mapped = await dcFetchTesting();

      setTestingLeads(mapped);
      console.log('Testing leads loaded:', mapped.length);
    } catch (err) {
      console.error('Testing fetch failed:', err);
    } finally {
      setIsLoadingTesting(false);
    }
  }, []);

  const fetchTodayLeads = useCallback(async () => {
    setIsLoadingToday(true);
    try {
      const mapped = await dcFetchToday();
      setTodayLeads(mapped);
      console.log('Today leads loaded:', mapped.length);
    } catch (err) {
      console.error('Today fetch failed:', err);
    } finally {
      setIsLoadingToday(false);
    }
  }, []);

  const fetchScrapeSessions = useCallback(async () => {
    try {
      const data = await dcFetchSessions();
      setScrapeSessions(data || []);
    } catch (err) {
      console.error('Sessions fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchLeadsFromDB();
    fetchTestingLeads();
    fetchTodayLeads();
    fetchScrapeSessions();
  }, [fetchLeadsFromDB, fetchTestingLeads, fetchTodayLeads, fetchScrapeSessions]);

  // PG-only mode: no realtime — poll TODAY + sessions every 15s so multi-user
  // scans still appear. Supabase mode skips this (realtime covers it).
  useEffect(() => {
    if (clientUsesSupabase()) return;
    const t = setInterval(() => {
      fetchTodayLeads();
      fetchScrapeSessions();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchTodayLeads, fetchScrapeSessions]);

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

    // Search both live and DB leads so this works from either view
    const allLeads = [...leads, ...dbLeads];

    for (const leadId of selectedLeads) {
      const lead = allLeads.find(l => l.id === leadId);
      if (!lead) continue;

      console.log("360 clicked:", lead.id);

      const setChecking = (src: any[], set: (fn: any) => void) =>
        set((cur: any[]) => cur.map(l => l.id === leadId ? { ...l, streetViewStatus: 'CHECKING' } : l));
      setChecking(leads, setLeads);
      setChecking(dbLeads, setDbLeads);

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
          if (data) status = data.status;
        }
      } catch (err) {
        console.error("Check 360 fetch failed:", err);
      }

      const has_360 = status === "HAS_360";
      const updatedFields = { streetViewStatus: status, avgDistance: data?.avgDistance, okCount: data?.okCount, has_360 };

      setLeads(cur => cur.map(l => l.id === leadId ? { ...l, ...updatedFields } : l));
      setDbLeads(cur => cur.map(l => l.id === leadId ? { ...l, ...updatedFields } : l));

      try {
        await dcPatchLead(String(lead.id), { street_view_status: status, has_360 });
      } catch (dbError) {
        console.error("360 update error:", dbError);
      }

      await new Promise(res => setTimeout(res, 300));
    }
    setToastMsg(`✔ 360 Checked for ${selectedLeads.length} leads`);
    setSelectedLeads([]);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const updateLeadInAllViews = useCallback((leadId: string, updatedFields: any) => {
    const updater = (cur: any[]) => cur.map(l => l.id === leadId ? { ...l, ...updatedFields } : l);
    setLeads(updater);
    setDbLeads(updater);
    setTodayLeads(updater);
    setTestingLeads(updater);
  }, []);

  const handleEnrich = async (leadId: string) => {
    const allLeads = [...leads, ...dbLeads, ...todayLeads, ...testingLeads];
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;

    updateLeadInAllViews(leadId, { status: 'ENRICHING' });

    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: lead.id })
      });

      if (!response.ok) throw new Error(`Enrich API Error`);

      const enrichData = await response.json();
      const now = new Date().toISOString();

      const enrichedFields = {
        status: 'READY',
        website: enrichData.website !== null ? enrichData.website : lead.website,
        phone: enrichData.phone !== null ? enrichData.phone : lead.phone,
        rating: enrichData.rating !== null ? enrichData.rating : lead.rating,
        reviews_count: enrichData.userRatingCount !== null ? enrichData.userRatingCount : lead.reviews_count,
        has_website: !!(enrichData.website || lead.website),
        business_status: enrichData.businessStatus || lead.business_status,
        enrichment_completed: true,
        last_enriched_at: now
      };

      updateLeadInAllViews(leadId, enrichedFields);

    } catch (err) {
      console.error("Enrich failed:", err);
      updateLeadInAllViews(leadId, { status: 'DISCOVERED' });
    }
  };

  const handleEnrichSelected = async () => {
    if (selectedLeads.length === 0) return;

    let processedCount = 0;
    const allLeads = [...leads, ...dbLeads, ...todayLeads, ...testingLeads];

    for (const leadId of selectedLeads) {
      if (processedCount >= 15) break;

      const lead = allLeads.find(l => l.id === leadId);
      if (!lead) continue;
      if (lead.last_enriched_at) continue;

      updateLeadInAllViews(leadId, { status: 'ENRICHING' });

      try {
        const response = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: lead.id })
        });

        if (!response.ok) throw new Error(`Enrich API Error`);

        const enrichData = await response.json();
        const now = new Date().toISOString();

        const enrichedFields = {
          status: 'READY',
          website: enrichData.website !== null ? enrichData.website : lead.website,
          phone: enrichData.phone !== null ? enrichData.phone : lead.phone,
          rating: enrichData.rating !== null ? enrichData.rating : lead.rating,
          reviews_count: enrichData.userRatingCount !== null ? enrichData.userRatingCount : lead.reviews_count,
          has_website: !!(enrichData.website || lead.website),
          business_status: enrichData.businessStatus || lead.business_status,
          enrichment_completed: true,
          last_enriched_at: now
        };

        updateLeadInAllViews(leadId, enrichedFields);
        processedCount++;

      } catch (err) {
        console.error("Enrich failed:", err);
        updateLeadInAllViews(leadId, { status: 'DISCOVERED' });
      }

      await new Promise(res => setTimeout(res, 300));
    }
    setToastMsg(`✔ ${processedCount} Leads Enriched`);
    setSelectedLeads([]);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleReEnrichMissingData = async () => {
    const targetLeads = displayedLeads.filter(l => !l.phone || !l.website || l.reviews_count === null || l.rating === null);
    
    if (targetLeads.length === 0) {
      setToastMsg("No leads matching criteria for re-enrichment.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    let processedCount = 0;
    
    for (const lead of targetLeads) {
      if (processedCount >= 15) break;

      updateLeadInAllViews(lead.id, { status: 'ENRICHING' });

      try {
        const response = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: lead.id })
        });

        if (!response.ok) throw new Error(`Enrich API Error`);

        const enrichData = await response.json();
        const now = new Date().toISOString();

        const enrichedFields = {
          status: 'READY',
          website: enrichData.website !== null ? enrichData.website : lead.website,
          phone: enrichData.phone !== null ? enrichData.phone : lead.phone,
          rating: enrichData.rating !== null ? enrichData.rating : lead.rating,
          reviews_count: enrichData.userRatingCount !== null ? enrichData.userRatingCount : lead.reviews_count,
          has_website: !!(enrichData.website || lead.website),
          business_status: enrichData.businessStatus || lead.business_status,
          enrichment_completed: true,
          last_enriched_at: now
        };

        updateLeadInAllViews(lead.id, enrichedFields);
        processedCount++;

      } catch (err) {
        console.error("Re-Enrich failed:", err);
        updateLeadInAllViews(lead.id, { status: 'DISCOVERED' });
      }
      
      await new Promise(res => setTimeout(res, 300));
    }
    setToastMsg(`✔ Re-Enriched ${processedCount} leads`);
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
    setLeads([]); // Clear existing live leads for a fresh radar feel
    setNextPageToken(null);
    // Switch to LIVE view so user sees results streaming in
    setViewMode('live');
    let createdSessionId = null;

    try {
      // 1. Create scrape session (PG or Supabase via data-client)
      try {
        const sessionData = await dcCreateSession({
          location: `${activeCenter.lat}, ${activeCenter.lng}`,
          category: selectedCategory,
          radius: activeRadius,
        });
        if (sessionData) {
          createdSessionId = sessionData.id;
          setSelectedSessionId(createdSessionId);
          setSessionFilteredLeadIds(new Set()); // reset for new session
        }
      } catch (e) {
        console.error('session create failed', e);
      }

      // 2. Fetch API — cache hits will fire lead_scrape_map INSERTs
      //    which the realtime handler will pick up and push to LIVE/TODAY
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
          sessionId: createdSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      const fetchedLeads = data.leads || [];
      console.log('[Discovery Debug] API payload leads:', fetchedLeads.length);

      if (createdSessionId && fetchedLeads.length > 0) {
        setSessionFilteredLeadIds(prev => {
          const next = new Set(prev);
          fetchedLeads.forEach((lead: any) => {
            if (lead?.id) next.add(lead.id);
          });
          return next;
        });
      }

      // Merge API response into LIVE feed — mergeLeadsById prevents duplicates
      // even when realtime handlers have already pushed some of these leads in
      setLeads(prev => {
        const merged = mergeLeadsById(prev, fetchedLeads);
        console.log('[Discovery Debug] UI merged leads:', {
          prev: prev.length,
          incoming: fetchedLeads.length,
          merged: merged.length
        });
        return merged;
      });

      setNextPageToken(data.nextPageToken || null);
      
      // Refresh sessions, today, and MAIN DB so all sections stay in sync
      fetchScrapeSessions();
      fetchTodayLeads();
      // Reset MAIN page counter and reload from scratch so new leads appear
      setMainPage(1);
      fetchLeadsFromDB(1);

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
          pageToken: nextPageToken,
          sessionId: selectedSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      const loadedLeads = data.leads || [];
      setLeads(prev => [...prev, ...loadedLeads]);
      if (selectedSessionId && loadedLeads.length > 0) {
        setSessionFilteredLeadIds(prev => {
          const next = new Set(prev);
          loadedLeads.forEach((lead: any) => {
            if (lead?.id) next.add(lead.id);
          });
          return next;
        });
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error("Load more failed:", err);
      setErrorMsg("Failed to load more leads.");
    } finally {
      setIsSearching(false);
    }
  };



  const handleCheck360 = async (leadId: string, lat: number, lng: number) => {
    console.log("360 clicked:", leadId);
    setLeads(cur => cur.map(l => l.id === leadId ? { ...l, streetViewStatus: 'CHECKING' } : l));
    setDbLeads(cur => cur.map(l => l.id === leadId ? { ...l, streetViewStatus: 'CHECKING' } : l));

    let status = "NO_360";
    let data: any = null;

    try {
      const response = await fetch('/api/streetview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });

      if (response.ok) {
        data = await response.json();
        console.log("360 raw result:", data);
        if (data) status = data.status;
      }
    } catch (err) {
      console.error("Check 360 fetch failed:", err);
    }

    const has_360 = status === "HAS_360";
    const updatedFields = { streetViewStatus: status, avgDistance: data?.avgDistance, okCount: data?.okCount, has_360 };

    setLeads(cur => cur.map(l => l.id === leadId ? { ...l, ...updatedFields } : l));
    setDbLeads(cur => cur.map(l => l.id === leadId ? { ...l, ...updatedFields } : l));

    try {
      await dcPatchLead(String(leadId), { street_view_status: status, has_360 });
    } catch (dbError) {
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

  const baseLeads = viewMode === 'main'
    ? dbLeads
    : (viewMode === 'testing'
      ? testingLeads
      : (viewMode === 'today'
        ? todayLeads
        : leads));
  const sourceLeads = searchActive ? searchResults : baseLeads;

  const [sessionFilteredLeadIds, setSessionFilteredLeadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedSessionId) {
      dcSessionLeadIds(selectedSessionId)
        .then((ids) => {
          setSessionFilteredLeadIds(new Set(ids));
          console.log(`[Session Filter] Session ${selectedSessionId}: ${ids.length} leads`);
          // NOTE: We do NOT mutate dbLeads here — MAIN always shows the full leads table.
          // dbLeads is managed exclusively by fetchLeadsFromDB + realtime events.
        })
        .catch((e) => console.error('session filter failed', e));
    } else {
      setSessionFilteredLeadIds(new Set());
    }
  }, [selectedSessionId]);

  const _displayedLeads = sourceLeads.filter(lead => {
    // Session filter: ONLY applies to LIVE and TODAY — never to MAIN or TESTING.
    // MAIN = full master leads table, always unfiltered by session.
    if (selectedSessionId && viewMode !== 'main' && viewMode !== 'testing') {
      if (!sessionFilteredLeadIds.has(lead.id)) return false;
    }

    // Testing-specific quick filters
    if (viewMode === 'testing') {
      if (quickFilter === 'HAS_WEBSITE' && !lead.website) return false;
      if (quickFilter === 'HAS_PHONE' && !lead.phone) return false;
      if (quickFilter === 'HIGH_REVIEWS' && (!lead.rating || lead.rating < 4.5)) return false;
    }

    // Left-panel checkbox filters
    const is360 = lead.has_360 || lead.streetViewStatus === 'HAS_360';
    if (filters.has360 && !is360) return false;
    if (filters.no360 && is360) return false;
    if (filters.enriched && !lead.enrichment_completed) return false;
    if (filters.unenriched && lead.enrichment_completed) return false;
    if (filters.operational && lead.business_status !== 'OPERATIONAL') return false;
    if (filters.closed && !(lead.business_status === 'CLOSED_TEMPORARILY' || lead.business_status === 'CLOSED_PERMANENTLY')) return false;
    if (filters.unknown && lead.business_status !== 'UNKNOWN') return false;
    if (filters.hasPhone && !lead.phone) return false;
    if (filters.hasWebsite && !lead.website) return false;

    // Category and Country filters
    if (filters.category !== 'ALL' && lead.category !== filters.category) return false;
    if (filters.country !== 'ALL' && lead.country !== filters.country) return false;

    // Right-panel quick filter (single-select) — skip for testing (handled above)
    if (viewMode !== 'testing') {
      if (quickFilter === 'NOT_CHECKED_360') return !lead.streetViewStatus;
      if (quickFilter === 'HAS_360') return lead.streetViewStatus === 'HAS_360';
      if (quickFilter === 'NO_360') return lead.streetViewStatus === 'NO_360';
      if (quickFilter === 'NOT_ENRICHED') return !lead.enrichment_completed;
      if (quickFilter === 'ENRICHED') return lead.enrichment_completed;
    }

    return true;
  });

  // ── Render-time deduplication safety net ──────────────────────────────────
  // Even if any upstream merge has a bug, this guarantees React never gets
  // duplicate keys. Log a warning so upstream issues are visible in devtools.
  const seenRenderIds = new Set<string>();
  const displayedLeads = _displayedLeads.filter(lead => {
    if (seenRenderIds.has(lead.id)) {
      console.warn('[Duplicate Key Prevented] id:', lead.id, 'view:', viewMode);
      return false;
    }
    seenRenderIds.add(lead.id);
    return true;
  });
  // ──────────────────────────────────────────────────────────────────────────


  // Sync selection when filter changes — keep only still-visible IDs
  const handleQuickFilterChange = (key: string) => {
    setQuickFilter(key);
    setSelectedLeads(prev => prev.filter(id => displayedLeads.some(l => l.id === id)));
  };

  const todaySessions = scrapeSessions.filter(s => {
    const d = new Date(s.created_at);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
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
            <div className={`w-1.5 h-1.5 rounded-full ${isSearching ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-[11px] text-zinc-500 font-medium">
              {isSearching ? `Scanning... (${leads.length})` : `${leads.length} leads`}
            </span>
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
                  <ul className="absolute z-50 w-full mt-2 max-h-48 overflow-y-auto rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] border border-white/[0.08] premium-scroll" style={{ background: 'rgba(15,15,21,0.95)', backdropFilter: 'blur(20px)' }}>
                    {filteredCategories.length > 0 ? filteredCategories.map((key) => (
                      <li key={key} onClick={() => { setCategoryInput(key); setSelectedCategory(CATEGORY_MAP[key]); setShowCategoryDropdown(false); }}
                        className="px-3 py-2.5 text-[13px] text-zinc-400 cursor-pointer hover:bg-white/[0.05] hover:text-indigo-400 transition-colors">{key}</li>
                    )) : <li className="px-3 py-2.5 text-[13px] text-zinc-600">No matches</li>}
                  </ul>
                )}
              </div>
            </section>

            {/* Scrape Sessions — only shown in LIVE and TODAY (not MAIN, not TESTING) */}
            {(viewMode === 'today' || viewMode === 'live') && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center">
                    <Database className="w-3 h-3 text-indigo-400" />
                  </div>
                  <h3 className="text-[12px] font-semibold text-zinc-300 uppercase tracking-wider">Scrape Sessions</h3>
                </div>
                <div className="relative">
                  <Select
                    value={selectedSessionId || "all"}
                    onValueChange={(val) => setSelectedSessionId(val === "all" ? null : val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Leads" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Leads</SelectItem>
                      {scrapeSessions.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {new Date(s.created_at).toLocaleDateString()} - {s.category} ({s.total_results})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>
            )}

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
                  { key: 'has360' as const, label: 'Has 360' },
                  { key: 'no360' as const, label: 'No 360' },
                  { key: 'enriched' as const, label: 'Enriched' },
                  { key: 'unenriched' as const, label: 'Unenriched' },
                  { key: 'operational' as const, label: 'Operational' },
                  { key: 'closed' as const, label: 'Closed' },
                  { key: 'unknown' as const, label: 'Unknown' },
                  { key: 'hasPhone' as const, label: 'Has Phone' },
                  { key: 'hasWebsite' as const, label: 'Has Website' },
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
        <div className={`hidden lg:flex flex-col relative transition-all duration-500 ease-in-out ${isFullscreen ? 'w-0 opacity-0 p-0 pointer-events-none overflow-hidden' : 'flex-1 p-3 opacity-100'}`}>
          <motion.div
            layout
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
        <div className={`flex flex-col border-l border-white/[0.04] relative transition-all duration-300 ease-in-out ${isFullscreen ? 'flex-1 w-full' : 'flex-1 lg:w-[400px] lg:flex-shrink-0'}`} style={{ background: 'rgba(6,6,10,0.5)' }}>
          {/* Header with toggle */}
          <div className="px-4 py-3 border-b border-white/[0.04] shrink-0" style={{ background: 'rgba(6,6,10,0.7)', backdropFilter: 'blur(20px)' }}>
            {/* Row 1: Title + actions */}
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
                  {viewMode === 'main' ? 'Main Database' : (viewMode === 'testing' ? 'USA Enriched' : (viewMode === 'today' ? "Today's Operations" : 'Live Scan'))}
                  {viewMode === 'today' && selectedSessionId && (
                    <button onClick={() => {
                        const sessionLeads = sourceLeads.filter(l => sessionFilteredLeadIds.has(l.id));
                        exportToCSV(sessionLeads, `session_${selectedSessionId}.csv`);
                      }} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                      (Export Session)
                    </button>
                  )}
                  {viewMode === 'today' && !selectedSessionId && (
                    <button onClick={() => {
                        exportToCSV(sourceLeads, "today_leads.csv");
                      }} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                      (Export Today)
                    </button>
                  )}
                </h2>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {displayedLeads.length} results
                  {viewMode === 'main' && (
                    <span className="text-zinc-700 ml-1">
                      (of {mainTotalCount ?? dbLeads.length} total)
                    </span>
                  )}
                  {selectedLeads.length > 0 && <span className="text-indigo-400 ml-1.5">· {selectedLeads.length} selected</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(viewMode === 'main' || viewMode === 'testing' || viewMode === 'today') && (
                  <button onClick={() => {
                    if (viewMode === 'main') { setMainPage(1); fetchLeadsFromDB(1); }
                    else if (viewMode === 'testing') fetchTestingLeads();
                    else fetchTodayLeads();
                  }}
                    className={`p-1.5 rounded-md border border-white/[0.06] hover:bg-white/[0.04] transition-all text-zinc-500 hover:text-zinc-300 ${(viewMode === 'main' ? isLoadingDb : (viewMode === 'testing' ? isLoadingTesting : isLoadingToday)) ? 'animate-spin' : ''}`}>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
                {/* Display style */}
                <div className="flex items-center rounded-md border border-white/[0.06] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <button onClick={() => setDisplayStyle('cards')}
                    className={`p-1.5 transition-all ${displayStyle === 'cards' ? 'bg-white/[0.07] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDisplayStyle('table')}
                    className={`p-1.5 transition-all ${displayStyle === 'table' ? 'bg-white/[0.07] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <Table2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Fullscreen toggle */}
                <button
                  onClick={() => setIsFullscreen(f => !f)}
                  className="p-1.5 rounded-md border border-white/[0.06] hover:bg-white/[0.04] transition-all text-zinc-500 hover:text-zinc-300"
                  title={isFullscreen ? 'Collapse' : 'Expand'}>
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {/* Row 2: View mode toggle */}
            <div className="flex rounded-lg border border-white/[0.04] overflow-hidden p-0.5" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <button
                onClick={() => setViewMode('live')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all rounded-md ${viewMode === 'live'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                  }`}>
                <Radio className="w-3 h-3" /> Live
              </button>
              <button
                onClick={() => setViewMode('today')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all rounded-md ${viewMode === 'today'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                  }`}>
                <CheckCircle className="w-3 h-3" /> Today
              </button>
              <button
                onClick={() => { setViewMode('main'); setSelectedSessionId(null); setQuickFilter('ALL'); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all rounded-md ${viewMode === 'main'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                  }`}>
                <Database className="w-3 h-3" /> Main
              </button>
              <button
                onClick={() => setViewMode('testing')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all rounded-md ${viewMode === 'testing'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                  }`}>
                <Zap className="w-3 h-3" /> Testing
              </button>
            </div>

            {/* Search bar */}
            <div className="mt-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                    }
                  }}
                  placeholder="Search businesses, phones, websites, categories..."
                  className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none"
                />
                {isSearchLoading && (
                  <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin" />
                )}
                {searchQuery && !isSearchLoading && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {searchActive && (
                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>
                    {searchError ? 'Search failed' : `${searchCount || displayedLeads.length} results`}
                  </span>
                  {viewMode === 'live' && !selectedSessionId && (
                    <span className="text-zinc-700">Start a scan to search LIVE</span>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ── Premium Filter Bar ── */}
          {(viewMode === 'main' || viewMode === 'testing' || viewMode === 'today') && (() => {
            const s = sourceLeads;
            const counts: Record<string, number> = viewMode === 'testing' ? {
              ALL: s.length,
              HAS_WEBSITE: s.filter(l => !!l.website).length,
              HAS_PHONE: s.filter(l => !!l.phone).length,
              HIGH_REVIEWS: s.filter(l => l.rating && l.rating >= 4.5).length,
            } : {
              ALL: s.length,
              NOT_CHECKED_360: s.filter(l => !l.streetViewStatus).length,
              HAS_360: s.filter(l => l.streetViewStatus === 'HAS_360').length,
              NO_360: s.filter(l => l.streetViewStatus === 'NO_360').length,
              NOT_ENRICHED: s.filter(l => !l.phone && !l.website).length,
              ENRICHED: s.filter(l => !!(l.phone || l.website)).length,
            };

            const pills = viewMode === 'testing' ? [
              { key: 'ALL', label: 'All', dot: 'bg-zinc-500' },
              { key: 'HAS_WEBSITE', label: 'Has Website', dot: 'bg-blue-400' },
              { key: 'HAS_PHONE', label: 'Has Phone', dot: 'bg-green-400' },
              { key: 'HIGH_REVIEWS', label: 'High Reviews', dot: 'bg-amber-400' },
            ] : [
              { key: 'ALL', label: 'All', dot: 'bg-zinc-500' },
              { key: 'NOT_CHECKED_360', label: 'Unchecked', dot: 'bg-zinc-400' },
              { key: 'HAS_360', label: 'Has 360', dot: 'bg-green-400' },
              { key: 'NO_360', label: 'No 360', dot: 'bg-red-400' },
              { key: 'NOT_ENRICHED', label: 'Unenriched', dot: 'bg-amber-400' },
              { key: 'ENRICHED', label: 'Enriched', dot: 'bg-emerald-400' },
            ];

            const allFilteredSelected = displayedLeads.length > 0 && displayedLeads.every(l => selectedLeads.includes(l.id));
            return (
              <div className="shrink-0 border-b border-white/[0.04]" style={{ background: 'rgba(6,6,10,0.5)', backdropFilter: 'blur(12px)' }}>
                {/* Segmented filter pills */}
                <div className="flex items-center gap-1 px-3 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {pills.map(({ key, label, dot }) => {
                    const active = quickFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleQuickFilterChange(key)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 ${active
                            ? 'text-white scale-[1.02]'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                          }`}
                        style={active ? { background: 'linear-gradient(135deg,#6366f1,#3b82f6)', boxShadow: '0 2px 12px rgba(99,102,241,0.35)' } : {}}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${active ? 'bg-white/70' : dot}`} />
                        {label}
                        <span className={`tabular-nums ${active ? 'text-white/60' : 'text-zinc-600'}`}>{counts[key]}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Select-all row */}
                <div className="flex items-center justify-between px-4 py-1.5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => {
                        if (allFilteredSelected) {
                          setSelectedLeads([]);
                        } else {
                          setSelectedLeads(displayedLeads.map(l => l.id));
                        }
                      }}
                      className={`w-[13px] h-[13px] rounded-[3px] border flex items-center justify-center transition-all duration-150 ${allFilteredSelected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 group-hover:border-white/40'
                        }`}
                    >
                      {allFilteredSelected && <div className="w-[5px] h-[5px] bg-white rounded-[1px]" />}
                    </div>
                    <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      {allFilteredSelected ? 'Deselect all' : `Select all ${displayedLeads.length}`}
                    </span>
                  </label>
                  {selectedLeads.length > 0 && (
                    <div className="flex items-center gap-3">
                      <button onClick={handleReEnrichMissingData} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                        Re-Enrich Missing Data
                      </button>
                      <button onClick={() => {
                        const selectedData = displayedLeads.filter(l => selectedLeads.includes(l.id));
                        exportToCSV(selectedData, "selected_leads.csv");
                      }} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        Export
                      </button>
                      <button onClick={() => setSelectedLeads([])} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                        <X className="w-2.5 h-2.5" /> Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Content Area */}
          {viewMode === 'today' && !selectedSessionId ? (
            <div className="flex-1 overflow-y-auto premium-scroll p-4 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-[14px] font-semibold text-zinc-300">Today's Scrape Sessions</h3>
                <span className="text-[11px] text-zinc-600">{todaySessions.length} sessions</span>
              </div>
              {todaySessions.length === 0 ? (
                <div className="text-center py-20 text-zinc-600 text-[12px] border border-white/[0.02] rounded-2xl">
                  No sessions recorded today.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {todaySessions.map(session => (
                    <div key={session.id} 
                         onClick={() => setSelectedSessionId(session.id)}
                         className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02] transition-all cursor-pointer group hover:border-white/[0.08]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[13px] font-medium text-zinc-200 group-hover:text-indigo-400 transition-colors">{session.category || 'Unknown'}</span>
                        <span className="text-[11px] text-zinc-500">{new Date(session.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-600">
                        <span>{session.location || 'Unknown'}</span>
                        <span className="bg-indigo-500/10 px-2 py-0.5 rounded-full text-indigo-400 text-[10px]">{session.total_results || 0} leads</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : displayStyle === 'table' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
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
              {viewMode === 'main' && !isLoadingDb && !searchActive && mainHasMore && (
                <div className="flex justify-center pt-3 pb-5">
                  <button onClick={() => {
                      const nextPage = mainPage + 1;
                      setMainPage(nextPage);
                      fetchLeadsFromDB(nextPage);
                    }}
                    className="px-4 py-2 rounded-xl font-medium text-[11px] border border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-all"
                    style={{ background: 'rgba(255,255,255,0.01)' }}>
                    Load More Leads
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              ref={viewMode === 'main' ? mainScrollRef : undefined}
              className="flex-1 overflow-y-auto premium-scroll p-3 space-y-2"
            >
              {!isSearching && (errorMsg || searchError) && (
                <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                  <p className="text-[12px] text-rose-400/80">{errorMsg || searchError}</p>
                </div>
              )}

              {!isSearching && !errorMsg && displayedLeads.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-8 py-20">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border border-white/[0.04] shadow-2xl"
                    style={{ background: 'rgba(255,255,255,0.01)' }}
                  >
                    <Search className="w-6 h-6 text-zinc-800" />
                  </motion.div>
                  <h3 className="text-[14px] font-semibold text-zinc-300">
                    {sourceLeads.length > 0 ? "No matches found" : "No leads discovered"}
                  </h3>
                  <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed max-w-[220px]">
                    {sourceLeads.length > 0
                      ? "Try adjusting your filters to find the leads you're looking for."
                      : "Use the map and click 'Scan Area' to start finding local businesses."}
                  </p>
                  {sourceLeads.length > 0 && (
                    <button
                      onClick={() => { setQuickFilter('ALL'); setFilters({ has360: false, no360: false, enriched: false, unenriched: false, operational: false, closed: false, unknown: false, hasPhone: false, hasWebsite: false, category: 'ALL', country: 'ALL' }); setSelectedSessionId(null); }}
                      className="mt-6 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Clear all filters
                    </button>
                  )}
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
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${selectedLeads.includes(lead.id)
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
                        className={`w-[15px] h-[15px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${selectedLeads.includes(lead.id) ? 'bg-indigo-500 border-indigo-400 shadow-sm shadow-indigo-500/40' : 'border-zinc-700 hover:border-zinc-500'
                          }`}>
                        {selectedLeads.includes(lead.id) && <div className="w-[5px] h-[5px] bg-white rounded-full" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[13px] text-zinc-200 truncate leading-tight flex items-center gap-2">
                        {lead.name}
                        {lead.times_seen === 1 && <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-sm border border-indigo-500/30 uppercase">New</span>}
                        {lead.times_seen > 1 && <span className="text-[8px] bg-zinc-500/20 text-zinc-400 px-1.5 py-0.5 rounded-sm border border-zinc-500/30 uppercase">Recurring</span>}
                      </h4>
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
                            <RadarLoader size="sm" variant="360" label="Scanning..." />
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
                          {lead.enrichment_completed ? (
                            <span className="text-[10px] font-medium text-zinc-600 border border-white/[0.04] px-2 py-0.5 rounded-md">Enriched ✔</span>
                          ) : lead.status === 'ENRICHING' ? (
                            <RadarLoader size="sm" variant="enrich" label="Enriching..." />
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

              {nextPageToken && !isSearching && !searchActive && (
                <div className="flex justify-center pt-4 pb-8">
                  <button onClick={handleLoadMore}
                    className="px-4 py-2 rounded-xl font-medium text-[11px] border border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-all"
                    style={{ background: 'rgba(255,255,255,0.01)' }}>
                    Load More
                  </button>
                </div>
              )}

              {viewMode === 'main' && !isLoadingDb && !searchActive && mainHasMore && (
                <div className="flex justify-center pt-4 pb-8">
                  <button onClick={() => {
                      const nextPage = mainPage + 1;
                      setMainPage(nextPage);
                      fetchLeadsFromDB(nextPage);
                    }}
                    className="px-4 py-2 rounded-xl font-medium text-[11px] border border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-all"
                    style={{ background: 'rgba(255,255,255,0.01)' }}>
                    Load More Leads
                  </button>
                </div>
              )}
              {viewMode === 'main' && !searchActive && (
                <div ref={mainLoadMoreRef} className="h-6" />
              )}
            </div>
          )}

          {/* ── Floating Bulk Action Bar ── */}
          {selectedLeads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-2xl"
              style={{ background: 'rgba(20,20,25,0.9)', boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}
            >
              <div className="px-3 py-1.5 border-r border-white/[0.08] mr-1">
                <p className="text-[11px] font-bold text-white leading-none">{selectedLeads.length}</p>
                <p className="text-[8px] text-zinc-500 uppercase tracking-tighter mt-1 font-bold">Selected</p>
              </div>

              <button
                onClick={handleCheck360Selected}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                Check 360
              </button>

              <button
                onClick={handleEnrichSelected}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all shadow-lg shadow-indigo-500/20"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
              >
                <Zap className="w-3.5 h-3.5" />
                Enrich
              </button>

              <button
                onClick={() => setSelectedLeads([])}
                className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
