import fabricModule from 'fabric';
import ImageEditor, { setFabric } from './image-editor.js';

const fabricInstance = fabricModule && (fabricModule.fabric || fabricModule.default || fabricModule);

setFabric(fabricInstance);

export { ImageEditor };
export default ImageEditor;
