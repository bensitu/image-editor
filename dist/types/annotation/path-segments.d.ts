/**
 * Shared SVG path segment extraction for annotation runtime behavior.
 *
 * @module
 */
export interface PathPoint {
    x: number;
    y: number;
}
export interface PathSegment {
    start: PathPoint;
    end: PathPoint;
}
type PathPointTransformer = (point: PathPoint) => PathPoint;
export declare function getPathSegments(pathData: unknown, transformPoint?: PathPointTransformer): PathSegment[];
export declare function getPathPoints(pathData: unknown, transformPoint?: PathPointTransformer): PathPoint[];
export {};
