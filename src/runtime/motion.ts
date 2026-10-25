export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
