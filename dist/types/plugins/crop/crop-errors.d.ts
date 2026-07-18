export declare class CropError extends Error {
    readonly name: string;
}
export declare class CropSessionError extends CropError {
    readonly name: string;
}
export declare class CropValidationError extends CropError {
    readonly name: string;
}
export declare class CropIntegrationError extends CropError {
    readonly name: string;
}
