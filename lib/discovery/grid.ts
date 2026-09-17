import { boundsFromCenter, calculateCellCenter, getDistanceMeters, metersToLatDegrees, metersToLngDegrees } from './geo';
import type { GeoBounds, GeoPoint } from './geo';

export type GridCell = {
  id: string;
  center: GeoPoint;
  radius: number;
  depth: number;
  parentId?: string;
  bounds?: GeoBounds;
};

export type GridInput = {
  lat: number;
  lng: number;
  radius: number;
};

export type GridConfig = {
  cellRadiusMeters?: number;
  overlapPercent?: number;
  maxCells?: number;
};

export const INTERNAL_CELL_RADIUS_MIN = 500;
export const INTERNAL_CELL_RADIUS_MAX = 700;
export const DEFAULT_INTERNAL_CELL_RADIUS = 600;
export const DEFAULT_OVERLAP_PERCENT = 0.35;
export const MIN_OVERLAP_PERCENT = 0.3;
export const MAX_OVERLAP_PERCENT = 0.4;
export const DEFAULT_MAX_CELLS = 120;
export const DEFAULT_GRID_OVERLAP = DEFAULT_OVERLAP_PERCENT;
export const DEFAULT_DENSE_RESULT_THRESHOLD = 25;
export const DEFAULT_MAX_GRID_DEPTH = 2;

export function calculateOverlap(cellRadiusMeters: number, overlapPercent: number) {
  const clamped = Math.max(0, Math.min(overlapPercent, 0.9));
  return Math.max(1, cellRadiusMeters * 2 * (1 - clamped));
}

function clampInternalCellRadius(cellRadiusMeters: number) {
  if (!Number.isFinite(cellRadiusMeters)) return DEFAULT_INTERNAL_CELL_RADIUS;
  return Math.max(INTERNAL_CELL_RADIUS_MIN, Math.min(cellRadiusMeters, INTERNAL_CELL_RADIUS_MAX));
}

function resolveOverlapPercent(overlapPercent: number | undefined) {
  if (typeof overlapPercent !== 'number') return DEFAULT_OVERLAP_PERCENT;
  return Math.max(0, Math.min(overlapPercent, 0.9));
}

function resolveMaxCells(maxCells: number | undefined) {
  if (!Number.isFinite(maxCells) || (maxCells as number) <= 0) return DEFAULT_MAX_CELLS;
  return Math.floor(maxCells as number);
}

export function generateGrid(input: GridInput, config?: GridConfig): GridCell[];
export function generateGrid(
  center: GeoPoint,
  searchRadiusMeters: number,
  cellRadiusMeters: number,
  overlapPercent: number,
  maxCells: number
): GridCell[];
export function generateGrid(
  centerOrInput: GeoPoint | GridInput,
  searchRadiusMeters?: number | GridConfig,
  cellRadiusMeters?: number,
  overlapPercent?: number,
  maxCells?: number
) {
  const cells: GridCell[] = [];
  const usingInputObject = typeof (centerOrInput as GridInput).radius === 'number';
  const center = usingInputObject
    ? { lat: (centerOrInput as GridInput).lat, lng: (centerOrInput as GridInput).lng }
    : (centerOrInput as GeoPoint);
  const searchRadius = usingInputObject
    ? (centerOrInput as GridInput).radius
    : (searchRadiusMeters as number);
  const config = usingInputObject && typeof searchRadiusMeters === 'object'
    ? (searchRadiusMeters as GridConfig)
    : undefined;

  const resolvedCellRadius = clampInternalCellRadius(
    usingInputObject
      ? (config?.cellRadiusMeters ?? DEFAULT_INTERNAL_CELL_RADIUS)
      : (cellRadiusMeters ?? DEFAULT_INTERNAL_CELL_RADIUS)
  );
  const resolvedOverlap = resolveOverlapPercent(
    usingInputObject ? config?.overlapPercent : overlapPercent
  );
  const resolvedMaxCells = resolveMaxCells(
    usingInputObject ? config?.maxCells : maxCells
  );

  const bounds = boundsFromCenter(center, searchRadius);
  const stepMeters = calculateOverlap(resolvedCellRadius, resolvedOverlap);
  const stepLat = metersToLatDegrees(stepMeters);
  const stepLng = metersToLngDegrees(stepMeters, center.lat);

  let row = 0;
  for (let lat = bounds.north; lat >= bounds.south; lat -= stepLat) {
    let col = 0;
    for (let lng = bounds.west; lng <= bounds.east; lng += stepLng) {
      const cellCenter = { lat, lng };
      const dist = getDistanceMeters(center, cellCenter);
      if (dist <= searchRadius + resolvedCellRadius) {
        const cellBounds = boundsFromCenter(cellCenter, resolvedCellRadius);
        cells.push({
          id: `cell-0-${row}-${col}`,
          center: cellCenter,
          radius: resolvedCellRadius,
          bounds: cellBounds,
          depth: 0
        });
        if (cells.length >= resolvedMaxCells) return cells;
      }
      col += 1;
    }
    row += 1;
  }

  return cells;
}

export function createChildCells(cell: GridCell) {
  const baseBounds = cell.bounds ?? boundsFromCenter(cell.center, cell.radius);
  const midLat = (baseBounds.north + baseBounds.south) / 2;
  const midLng = (baseBounds.east + baseBounds.west) / 2;
  const nextRadius = cell.radius / 2;
  const depth = cell.depth + 1;

  const quadrants: GeoBounds[] = [
    { north: baseBounds.north, south: midLat, east: midLng, west: baseBounds.west },
    { north: baseBounds.north, south: midLat, east: baseBounds.east, west: midLng },
    { north: midLat, south: baseBounds.south, east: midLng, west: baseBounds.west },
    { north: midLat, south: baseBounds.south, east: baseBounds.east, west: midLng }
  ];

  return quadrants.map((bounds, index) => ({
    id: `cell-${depth}-${cell.id}-${index}`,
    parentId: cell.id,
    center: calculateCellCenter(bounds),
    radius: nextRadius,
    bounds,
    depth
  }));
}

export function subdivideCell(cell: GridCell, overlapPercent = DEFAULT_OVERLAP_PERCENT) {
  const nextRadius = cell.radius / 2;
  const depth = cell.depth + 1;
  const stepMeters = calculateOverlap(nextRadius, overlapPercent);
  const offsetMeters = stepMeters / 2;
  const latOffset = metersToLatDegrees(offsetMeters);
  const lngOffset = metersToLngDegrees(offsetMeters, cell.center.lat);

  const centers: GeoPoint[] = [
    { lat: cell.center.lat + latOffset, lng: cell.center.lng - lngOffset },
    { lat: cell.center.lat + latOffset, lng: cell.center.lng + lngOffset },
    { lat: cell.center.lat - latOffset, lng: cell.center.lng - lngOffset },
    { lat: cell.center.lat - latOffset, lng: cell.center.lng + lngOffset }
  ];

  return centers.map((center, index) => ({
    id: `cell-${depth}-${cell.id}-${index}`,
    parentId: cell.id,
    center,
    radius: nextRadius,
    bounds: boundsFromCenter(center, nextRadius),
    depth
  }));
}

export function subdivideGridCell(cell: GridCell) {
  return subdivideCell(cell);
}

export function estimateCellDensity(resultCount: number, duplicateRate: number) {
  const uniqueEstimate = Math.max(0, resultCount - Math.round(resultCount * duplicateRate));
  return uniqueEstimate;
}
