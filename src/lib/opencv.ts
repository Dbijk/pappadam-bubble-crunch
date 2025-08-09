// Utility to dynamically load OpenCV.js from CDN and wait until ready
// We resolve with the global cv object once WASM is initialized.
// Detailed comments for clarity during presentations.

export type OpenCV = typeof cv;

declare global {
  // eslint-disable-next-line no-var
  var cv: any;
}

export async function loadOpenCV(): Promise<OpenCV> {
  if (typeof window === "undefined") throw new Error("OpenCV can only load in browser");

  if ((window as any).cv && (window as any).cv.getBuildInformation) {
    return (window as any).cv as OpenCV;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      // Wait for WASM runtime to be ready
      (window as any).cv['onRuntimeInitialized'] = () => resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return (window as any).cv as OpenCV;
}
