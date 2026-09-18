import { NextResponse } from 'next/server';
import { dbGetLeadById, dbUpdateLead, dbUpsertTesting } from '@/lib/db/store';

export async function POST(request: Request) {
  let placeId = '';

  try {
    const body = await request.json();
    placeId = body.placeId;

    if (!placeId) {
      return NextResponse.json(
        { error: 'Missing required parameter: placeId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY is not defined in environment variables.');
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    const googleApiUrl = `https://places.googleapis.com/v1/places/${placeId}`;

    // Fetching additional fields for USA detection and testing table population
    const response = await fetch(googleApiUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Places API Error during enrichment: ${response.status} - ${errorText}`);
      
      return NextResponse.json({
        id: placeId,
        website: null,
        phone: null,
        rating: null,
        userRatingCount: null
      });
    }

    const data = await response.json();

    // Fetch existing lead data to prevent null overwrites
    const existingLead = await dbGetLeadById(placeId);
 
    // Step 4: Verification
    if (!existingLead) {
      console.warn(`[Enrich Warning] Lead ${placeId} not found in database. Skipping enrichment.`);
      return NextResponse.json({ error: 'Lead not found in database' }, { status: 404 });
    }
 
    let businessStatus = existingLead.business_status || 'UNKNOWN';
    if (data.businessStatus) {
      businessStatus = data.businessStatus;
    }
 
    // Debug logging
    console.log(`[Enrich Debug] Raw Google Response for ${placeId}:`, JSON.stringify(data));
 
    const hasNewData = !!(data.nationalPhoneNumber || data.websiteUri || data.rating !== undefined || data.userRatingCount !== undefined || data.businessStatus);
 
    const enrichData: any = {
      business_status: businessStatus,
      last_enriched_at: new Date().toISOString()
    };
 
    // Safe update logic: preserve existing if new is missing
    enrichData.phone = data.nationalPhoneNumber || existingLead.phone;
    enrichData.website = data.websiteUri || existingLead.website;
    enrichData.rating = data.rating !== undefined ? data.rating : existingLead.rating;
    enrichData.reviews_count = data.userRatingCount !== undefined ? data.userRatingCount : existingLead.reviews_count;
 
    // Enrichment validation
    if (hasNewData) {
      enrichData.enrichment_completed = true;
    } else {
      enrichData.enrichment_completed = existingLead.enrichment_completed || false;
    }
 
    // Persist country from Place Details address components (e.g. "United States").
    // Previously country was only written to the testing table, leaving leads.country NULL.
    const leadCountryComponent = (data.addressComponents || []).find((c: any) =>
      Array.isArray(c?.types) && c.types.includes('country')
    );
    const leadCountryName = leadCountryComponent?.longText || leadCountryComponent?.shortText || null;
    if (leadCountryName) {
      enrichData.country = leadCountryName;
    }

    console.log(`[Enrich Debug] Update Payload for ${placeId}:`, JSON.stringify(enrichData));
 
    // Step 1: Replace upsert with update
    try {
      await dbUpdateLead(placeId, enrichData);
    } catch (mainError) {
      console.error("Enrich update error (leads table):", mainError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    // --- USA DETECTION & TESTING TABLE LOGIC ---
    
    // Detect USA business
    const addressComponents = data.addressComponents || [];
    const countryComponent = addressComponents.find((c: any) => c.types.includes('country'));
    const isUSA = (countryComponent?.shortText === 'US' || countryComponent?.longText === 'United States') ||
                  (data.formattedAddress?.toLowerCase().includes('usa')) ||
                  (data.formattedAddress?.toLowerCase().includes('united states'));

    const hasContact = !!(data.nationalPhoneNumber || data.websiteUri);

    if (isUSA && hasContact) {
      // Get existing lead info (for category, street_view_status etc) if possible
      const existingLead = await dbGetLeadById(placeId);

      const testingData = {
        id: placeId,
        name: data.displayName?.text || existingLead?.name,
        lat: data.location?.latitude || existingLead?.lat,
        lng: data.location?.longitude || existingLead?.lng,
        address: data.formattedAddress || existingLead?.address,
        phone: data.nationalPhoneNumber || null,
        website: data.websiteUri || null,
        rating: data.rating || null,
        reviews_count: data.userRatingCount || 0,
        category: existingLead?.category || (data.types && data.types[0]),
        country: 'USA',
        street_view_status: existingLead?.street_view_status || 'NOT_CHECKED',
      };

      try {
        await dbUpsertTesting(testingData);
        console.log("USA Lead saved to testing table:", placeId);
      } catch (testingError) {
        console.error("Testing table upsert error:", testingError);
      }
    }

    return NextResponse.json({
      id: placeId,
      website: enrichData.website || null,
      phone: enrichData.phone || null,
      rating: enrichData.rating !== undefined ? enrichData.rating : null,
      userRatingCount: enrichData.reviews_count !== undefined ? enrichData.reviews_count : null,
      businessStatus: enrichData.business_status
    });

  } catch (error) {
    console.error('Error in /api/enrich:', error);
    
    return NextResponse.json({
      id: placeId || 'unknown',
      website: null,
      phone: null,
      rating: null,
      userRatingCount: null,
      businessStatus: null
    });
  }
}

