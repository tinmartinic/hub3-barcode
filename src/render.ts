import bwipjs from 'bwip-js/node';

import { buildHub3Payload, type Hub3Input, type Hub3Options } from './payload.js';

export interface RenderOptions extends Hub3Options {
  /** Pixels per module for PNG, default 4. */
  scale?: number;
  /** Error correction level 0 to 8. Default 4. */
  eclevel?: number;
  /** Data columns. Default 9, which suits the printed proportions banks expect. */
  columns?: number;
  /** Quiet zone around the symbol in modules. Default 6. */
  padding?: number;
}

function bwipOptions(input: Hub3Input, options: RenderOptions) {
  return {
    bcid: 'pdf417',
    text: buildHub3Payload(input, options),
    eclevel: options.eclevel ?? 4,
    columns: options.columns ?? 9,
    scale: options.scale ?? 4,
    rowheight: 9,
    paddingwidth: options.padding ?? 6,
    paddingheight: options.padding ?? 6,
    backgroundcolor: 'FFFFFF',
  };
}

/** PNG bytes of the HUB3 barcode. Pure JavaScript, no canvas or native modules. */
export function hub3Png(input: Hub3Input, options: RenderOptions = {}): Promise<Buffer> {
  return bwipjs.toBuffer(bwipOptions(input, options));
}

/** SVG markup of the HUB3 barcode. Scales without blur, good for PDFs and print. */
export function hub3Svg(input: Hub3Input, options: RenderOptions = {}): string {
  return bwipjs.toSVG(bwipOptions(input, options));
}

/** `data:image/png;base64,...` URL, ready for an `<img>` or a PDF renderer. */
export async function hub3DataUrl(input: Hub3Input, options: RenderOptions = {}): Promise<string> {
  return `data:image/png;base64,${(await hub3Png(input, options)).toString('base64')}`;
}
