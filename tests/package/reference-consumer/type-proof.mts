import { ImageEditorCore } from '@bensitu/image-editor/core';
import { definePluginRef, type ConfigurablePluginApi } from '@bensitu/image-editor/sdk';
import type { PluginConformanceReport } from '@bensitu/image-editor/testing';
import { createBlurRegionPlugin, type BlurRegionPluginApi } from '@bensitu/reference-blur-region';
import { createGridGuidePlugin, type GridGuidePluginApi } from '@bensitu/reference-grid-guide';
import { createMetadataPlugin, type MetadataPluginApi } from '@bensitu/reference-metadata';
import { createWatermarkPlugin, type WatermarkPluginApi } from '@bensitu/reference-watermark';

const watermark = createWatermarkPlugin();
const metadata = createMetadataPlugin();
const gridGuide = createGridGuidePlugin();
const blurRegion = createBlurRegionPlugin({
    rasterize: async () => {
        throw new Error('Type fixture only.');
    },
});

const watermarkRef = definePluginRef<WatermarkPluginApi>('reference:watermark', '1.0.0');
const metadataRef = definePluginRef<MetadataPluginApi>('reference:metadata', '1.0.0');

declare const values: readonly [
    ImageEditorCore,
    PluginConformanceReport,
    ConfigurablePluginApi<unknown>,
    WatermarkPluginApi,
    MetadataPluginApi,
    GridGuidePluginApi,
    BlurRegionPluginApi,
];

void watermark;
void metadata;
void gridGuide;
void blurRegion;
void watermarkRef;
void metadataRef;
void values;
