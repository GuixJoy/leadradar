import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    const response = await fetch(googleApiUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'websiteUri,nationalPhoneNumber,rating,userRatingCount'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Places API Error during enrichment: ${response.status} - ${errorText}`);
      
      // If API fails -> return null fields as requested
      return NextResponse.json({
        id: placeId,
        website: null,
        phone: null,
        rating: null,
        userRatingCount: null
      });
    }

    const data = await response.json();

    const enrichData = {
      id: placeId,
      phone: data.nationalPhoneNumber || undefined,
      website: data.websiteUri || undefined,
      rating: data.rating || undefined,
      reviews_count: data.userRatingCount || undefined,
      last_enriched_at: new Date().toISOString()
    };

    const { error } = await supabase.from('leads').upsert(enrichData, { onConflict: 'id' });
    if (error) {
      console.error("Enrich upsert error:", error);
    }

    return NextResponse.json({
      id: placeId,
      website: data.websiteUri || null,
      phone: data.nationalPhoneNumber || null,
      rating: data.rating || null,
      userRatingCount: data.userRatingCount || null
    });

  } catch (error) {
    console.error('Error in /api/enrich:', error);
    
    // Do not crash server, return null fields
    return NextResponse.json({
      id: placeId || 'unknown',
      website: null,
      phone: null,
      rating: null,
      userRatingCount: null
    });
  }
}
