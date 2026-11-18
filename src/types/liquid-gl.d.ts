declare module "liquid-gl" {
  export interface LiquidGLOptions {
    target?: string | Element;
    snapshot?: string;
    resolution?: number;
    engine?: "auto" | "webgpu" | "webgl2" | "webgl";
    zIndex?: number;
    content?: string | Element | false;
    refraction?: number;
    aberration?: number;
    bevelDepth?: number;
    bevelWidth?: number;
    frost?: number;
    shadow?: boolean;
    specular?: boolean;
    reveal?: "fade" | "none";
    tilt?: boolean;
    tiltFactor?: number;
    tiltEase?: number;
    draggable?: boolean;
    interaction?: "none" | "fluid";
    interactionStrength?: number;
    interactionRadius?: number;
    interactionViscosity?: number;
    magnify?: number;
    tint?: string | null;
    helper?: boolean;
    on?: {
      init?: (instance: any) => void;
      dragstart?: (instance: any, info: any) => void;
      drag?: (instance: any, info: any) => void;
      dragend?: (instance: any, info: any) => void;
    };
  }

  export interface LiquidGLInstance {
    destroy: () => void;
    setTint?: (color: string) => void;
    setDraggable?: (enabled: boolean) => void;
    [key: string]: any;
  }

  function liquidGL(options?: LiquidGLOptions): LiquidGLInstance;
  export default liquidGL;
}
