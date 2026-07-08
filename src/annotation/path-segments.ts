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

type PathCommand = [string, ...number[]];

type PathPointTransformer = (point: PathPoint) => PathPoint;

function isPathCommand(value: unknown): value is PathCommand {
    return (
        Array.isArray(value) &&
        typeof value[0] === 'string' &&
        value.slice(1).every((entry) => typeof entry === 'number' && Number.isFinite(entry))
    );
}

function identity(point: PathPoint): PathPoint {
    return point;
}

function toAbsolutePoint(x: number, y: number, current: PathPoint, isRelative: boolean): PathPoint {
    return isRelative ? { x: current.x + x, y: current.y + y } : { x, y };
}

function pathValue(values: readonly number[], index: number): number {
    return values[index] ?? 0;
}

function addSegment(
    segments: PathSegment[],
    transformPoint: PathPointTransformer,
    start: PathPoint,
    end: PathPoint,
): void {
    segments.push({
        start: transformPoint(start),
        end: transformPoint(end),
    });
}

function cubicPoint(
    start: PathPoint,
    c1: PathPoint,
    c2: PathPoint,
    end: PathPoint,
    t: number,
): PathPoint {
    const mt = 1 - t;
    return {
        x:
            mt * mt * mt * start.x +
            3 * mt * mt * t * c1.x +
            3 * mt * t * t * c2.x +
            t * t * t * end.x,
        y:
            mt * mt * mt * start.y +
            3 * mt * mt * t * c1.y +
            3 * mt * t * t * c2.y +
            t * t * t * end.y,
    };
}

function quadraticPoint(start: PathPoint, c: PathPoint, end: PathPoint, t: number): PathPoint {
    const mt = 1 - t;
    return {
        x: mt * mt * start.x + 2 * mt * t * c.x + t * t * end.x,
        y: mt * mt * start.y + 2 * mt * t * c.y + t * t * end.y,
    };
}

function addSampledCurve(
    segments: PathSegment[],
    transformPoint: PathPointTransformer,
    start: PathPoint,
    end: PathPoint,
    samplePoint: (t: number) => PathPoint,
): void {
    const approximateLength = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(8, Math.min(48, Math.ceil(approximateLength / 6)));
    let previous = start;
    for (let index = 1; index <= steps; index += 1) {
        const next = samplePoint(index / steps);
        addSegment(segments, transformPoint, previous, next);
        previous = next;
    }
}

export function getPathSegments(
    pathData: unknown,
    transformPoint: PathPointTransformer = identity,
): PathSegment[] {
    if (!Array.isArray(pathData)) return [];

    const segments: PathSegment[] = [];
    let current: PathPoint = { x: 0, y: 0 };
    let subpathStart: PathPoint | null = null;

    for (const rawCommand of pathData) {
        if (!isPathCommand(rawCommand)) continue;
        const rawName = rawCommand[0];
        const command = rawName.toUpperCase();
        const isRelative = rawName !== command;
        const values = rawCommand.slice(1) as number[];

        if (command === 'M') {
            for (let index = 0; index + 1 < values.length; index += 2) {
                const next = toAbsolutePoint(
                    pathValue(values, index),
                    pathValue(values, index + 1),
                    current,
                    isRelative,
                );
                if (index > 0) addSegment(segments, transformPoint, current, next);
                current = next;
                if (index === 0) subpathStart = next;
            }
            continue;
        }

        if (command === 'L') {
            for (let index = 0; index + 1 < values.length; index += 2) {
                const next = toAbsolutePoint(
                    pathValue(values, index),
                    pathValue(values, index + 1),
                    current,
                    isRelative,
                );
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }

        if (command === 'H') {
            for (const value of values) {
                const next = { x: isRelative ? current.x + value : value, y: current.y };
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }

        if (command === 'V') {
            for (const value of values) {
                const next = { x: current.x, y: isRelative ? current.y + value : value };
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }

        if (command === 'C') {
            for (let index = 0; index + 5 < values.length; index += 6) {
                const start = current;
                const c1 = toAbsolutePoint(
                    pathValue(values, index),
                    pathValue(values, index + 1),
                    current,
                    isRelative,
                );
                const c2 = toAbsolutePoint(
                    pathValue(values, index + 2),
                    pathValue(values, index + 3),
                    current,
                    isRelative,
                );
                const end = toAbsolutePoint(
                    pathValue(values, index + 4),
                    pathValue(values, index + 5),
                    current,
                    isRelative,
                );
                addSampledCurve(segments, transformPoint, start, end, (t) =>
                    cubicPoint(start, c1, c2, end, t),
                );
                current = end;
            }
            continue;
        }

        if (command === 'Q') {
            for (let index = 0; index + 3 < values.length; index += 4) {
                const start = current;
                const control = toAbsolutePoint(
                    pathValue(values, index),
                    pathValue(values, index + 1),
                    current,
                    isRelative,
                );
                const end = toAbsolutePoint(
                    pathValue(values, index + 2),
                    pathValue(values, index + 3),
                    current,
                    isRelative,
                );
                addSampledCurve(segments, transformPoint, start, end, (t) =>
                    quadraticPoint(start, control, end, t),
                );
                current = end;
            }
            continue;
        }

        if (command === 'A') {
            for (let index = 0; index + 6 < values.length; index += 7) {
                const next = toAbsolutePoint(
                    pathValue(values, index + 5),
                    pathValue(values, index + 6),
                    current,
                    isRelative,
                );
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }

        if (command === 'Z' && subpathStart) {
            addSegment(segments, transformPoint, current, subpathStart);
            current = subpathStart;
        }
    }

    return segments;
}

export function getPathPoints(
    pathData: unknown,
    transformPoint: PathPointTransformer = identity,
): PathPoint[] {
    const points: PathPoint[] = [];
    for (const segment of getPathSegments(pathData, transformPoint)) {
        const previous = points[points.length - 1];
        if (!previous || previous.x !== segment.start.x || previous.y !== segment.start.y) {
            points.push(segment.start);
        }
        points.push(segment.end);
    }
    return points;
}
