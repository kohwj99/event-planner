declare module "pptxgenjs" {
  export default class PptxGenJS {
    constructor(): void;
    layout: string;
    addSlide(): any;
    writeFile(opts: { fileName: string }): Promise<void>;
    ShapeType: {
      rect: string;
      roundRect: string;
      ellipse: string;
      line: string;
    };
  }

  export type HAlign = "left" | "center" | "right";
  export type ShapeFillProps = { color?: string; type?: "none" };
  export type ShapeLineProps = { color?: string; width?: number; type?: "none" };
}
