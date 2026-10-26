export const motionTokens = {
  ease: {
    enter: [0.16, 1, 0.3, 1] as const,
    standard: [0.22, 1, 0.36, 1] as const,
    exit: [0.7, 0, 0.84, 0] as const,
    inOut: [0.65, 0, 0.35, 1] as const,
  },
  blur: {
    subtle: 2,
    soft: 8,
  },
  duration: {
    instant: 0.12,
    fast: 0.16,
    standard: 0.24,
    considered: 0.48,
    spring: 0.58,
  },
  spring: {
    snappy: { type: "spring" as const, stiffness: 450, damping: 25 },
    morph: { type: "spring" as const, stiffness: 350, damping: 28 },
    smooth: { type: "spring" as const, stiffness: 280, damping: 30 },
  },
  stagger: {
    item: 0.035,
  },
} as const;
